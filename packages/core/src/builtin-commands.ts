import {
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  type ComposeFrameGuide,
  type ComposeCanvasSettings,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeOverflowMode,
  type ComposeSpatialTransform,
  type JsonObject,
  type JsonValue,
} from './document-types'
import {
  getComposeComposition,
  getComposeLayoutItem,
  getComposeHierarchy,
  getComposeLock,
  normalizeComposeOverflow,
  getComposeSpatialTransform,
  isComposeComponentKey,
  resolveComposeGeometryConstraints,
} from './entity'
import { isValidComposeSpatialTransform } from './document'
import { isComposeColor, isValidComposePaint } from './paint'
import { jsonEqual } from './patches'
import { isComposeGroupEntity, isComposeUngroupableEntity } from './group'
import { getComposeFrame } from './frame'
import { isValidComposeWire } from './wire'
import {
  getComposeCurve,
  isValidComposeCurve,
  normalizeComposeCurveGeometry,
  type ComposeCurve,
} from './curve'
import type {
  CommandHandler,
  CommandHandlerResult,
  CommandIssue,
  DocumentPatch,
  EditorCommand,
  EditorCommandMeta,
} from './command-types'

/** ComposeDocument v7 内置命令 type。 @public */
export const BUILTIN_COMMAND_TYPES = {
  configureCanvas: 'canvas.configure',
  setTextStyle: 'document.style.text.set',
  removeTextStyle: 'document.style.text.remove',
  setFrameSize: 'entity.frame.size.set',
  createFrameGuide: 'frame.guide.create',
  moveFrameGuide: 'frame.guide.move',
  deleteFrameGuide: 'frame.guide.delete',
  createEntity: 'entity.create',
  deleteEntity: 'entity.delete',
  duplicateEntity: 'entity.duplicate',
  moveEntity: 'entity.move',
  renameEntity: 'entity.name.set',
  setVisibility: 'entity.visibility.set',
  setLock: 'entity.lock.set',
  addComponent: 'entity.component.add',
  updateComponent: 'entity.component.update',
  removeComponent: 'entity.component.remove',
  setRendererProps: 'entity.renderer.props.set',
  setAppearance: 'entity.appearance.set',
  setTransform: 'entity.transform.set',
  setCurve: 'entity.curve.set',
  setClip: 'entity.clip.set',
  configureClip: 'entity.clip.configure',
  groupEntity: 'entity.group',
  ungroupEntity: 'entity.ungroup',
  batch: 'transaction.batch',
} as const

type UnknownRecord = Record<string, unknown>
type Location = { readonly parentId: string | null; readonly index: number }
type TransformOperation = 'move' | 'resize' | 'rotate' | 'set'

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function issue(code: string, message: string, path?: readonly (string | number)[]): CommandHandlerResult {
  return { status: 'rejected', issues: [{ code, message, ...(path ? { path } : {}) }] }
}

function patches(value: readonly DocumentPatch[]): CommandHandlerResult {
  return value.length === 0
    ? { status: 'noop', reason: '命令没有产生文档修改' }
    : { status: 'patches', patches: value }
}

function valueAt(payload: JsonObject, key: string): unknown {
  return payload[key]
}

function asStringArray(value: unknown): readonly string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : null
}

function asIndex(value: unknown, fallback: number): number | null {
  if (value === undefined) return fallback
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function asEntity(value: unknown): ComposeEntity | null {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && isRecord(value.components)
    ? value as unknown as ComposeEntity
    : null
}

function asCanvasSettings(value: unknown): ComposeCanvasSettings | null {
  if (!isRecord(value) || !isRecord(value.grid) || !isRecord(value.smartSnap)) return null
  const { grid, smartSnap } = value
  if (
    typeof grid.stepX !== 'number'
    || !Number.isFinite(grid.stepX)
    || grid.stepX <= 0
    || typeof grid.stepY !== 'number'
    || !Number.isFinite(grid.stepY)
    || grid.stepY <= 0
    || typeof grid.offsetX !== 'number'
    || !Number.isFinite(grid.offsetX)
    || typeof grid.offsetY !== 'number'
    || !Number.isFinite(grid.offsetY)
    || typeof grid.primaryLineEvery !== 'number'
    || !Number.isInteger(grid.primaryLineEvery)
    || grid.primaryLineEvery <= 0
    || typeof grid.snapEnabled !== 'boolean'
    || typeof smartSnap.nodes !== 'boolean'
    || typeof smartSnap.guides !== 'boolean'
  ) return null
  return {
    grid: {
      stepX: grid.stepX,
      stepY: grid.stepY,
      offsetX: grid.offsetX,
      offsetY: grid.offsetY,
      primaryLineEvery: grid.primaryLineEvery,
      snapEnabled: grid.snapEnabled,
    },
    smartSnap: { nodes: smartSnap.nodes, guides: smartSnap.guides },
  }
}

function asFrameGuide(value: unknown): ComposeFrameGuide | null {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || value.id.trim().length === 0
    || (value.axis !== 'x' && value.axis !== 'y')
    || typeof value.position !== 'number'
    || !Number.isFinite(value.position)
  ) return null
  return { id: value.id, axis: value.axis, position: value.position }
}

function frameGuides(
  document: ComposeDocument,
  frameId: string,
): readonly ComposeFrameGuide[] | null {
  const frame = document.entities[frameId]?.components[COMPOSE_BUILTIN_COMPONENT_KEYS.frame]
  if (!frame) return null
  return Array.isArray(frame.guides) ? (frame.guides as readonly ComposeFrameGuide[]) : []
}

/**
 * 新建或改写一条文字样式。
 *
 * @remarks
 * 样式表是**文档级字段**，而既有命令里只有 `canvas.configure` 写这一层，因此这里必须有自己
 * 的命令词。**upsert 而不是分成新建与更新两条**：两者的载荷与补丁逐字相同，差别只是「这个 id
 * 在不在」——而那不是一个用户能说出来的区别，分成两条只会让调用方先查一次再选命令。
 *
 * 删掉一条样式**不追着去解除引用**：悬空引用只是解析失败，跟随者保留作者写下的值照常渲染。
 * 追着解除等于把一次删除变成一次波及全文档的写入，而撤销还得把它们一条条放回去。
 */
function setTextStyleHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.setTextStyle,
    execute(document, command) {
      const styleId = valueAt(command.payload, 'styleId')
      const name = valueAt(command.payload, 'name')
      const props = valueAt(command.payload, 'props')
      if (typeof styleId !== 'string' || styleId.length === 0) {
        return issue('style.invalid-id', 'document.style.text.set 需要非空 styleId')
      }
      if (typeof name !== 'string' || name.length === 0) {
        return issue('style.invalid-name', 'document.style.text.set 需要非空 name')
      }
      if (!isRecord(props)) {
        return issue('style.invalid-props', 'document.style.text.set 的 props 必须是对象')
      }
      const next = { name, props: props as JsonObject }
      if (jsonEqual(document.styles?.[styleId] as JsonValue, next as unknown as JsonValue)) {
        return { status: 'noop', reason: '样式没有变化' }
      }
      /*
       * 样式表缺席时先把整张表建出来：补丁引擎要求 `set` 的父容器已经存在，而
       * 「缺席即没有样式」正是这个字段的默认态——第一次新建样式必然走这一支。
       */
      return patches([document.styles === undefined
        ? { op: 'set', path: ['styles'], value: { [styleId]: next } as unknown as JsonValue }
        : { op: 'set', path: ['styles', styleId], value: next as unknown as JsonValue }])
    },
  }
}

/** 删除一条文字样式；跟随者的引用变成悬空，保留作者写下的值。 */
function removeTextStyleHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.removeTextStyle,
    execute(document, command) {
      const styleId = valueAt(command.payload, 'styleId')
      if (typeof styleId !== 'string') {
        return issue('style.invalid-id', 'document.style.text.remove 需要 styleId')
      }
      if (!document.styles?.[styleId]) return { status: 'noop', reason: '样式不存在' }
      return patches([{ op: 'remove', path: ['styles', styleId] }])
    },
  }
}

function configureCanvasHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.configureCanvas,
    execute(document, command) {
      const settings = asCanvasSettings(command.payload)
      if (!settings) return issue('canvas.invalid-settings', 'canvas.configure 参数无效')
      if (
        jsonEqual(document.canvas.grid, settings.grid)
        && jsonEqual(document.canvas.smartSnap, settings.smartSnap)
      ) return { status: 'noop', reason: '画布设置没有变化' }
      return patches([
        {
          op: 'set',
          path: ['canvas', 'grid'],
          value: settings.grid as unknown as JsonValue,
        },
        {
          op: 'set',
          path: ['canvas', 'smartSnap'],
          value: settings.smartSnap as unknown as JsonValue,
        },
      ])
    },
  }
}

/**
 * 设置 Frame 尺寸。
 *
 * @remarks
 * Frame.size 是该 Entity 尺寸的唯一事实来源，因此这里同时把 LayoutItem 的 fixed fallback
 * 对齐到新尺寸——否则 Frame 一旦被降格为普通容器就会跳回旧尺寸。
 */
function setFrameSizeHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.setFrameSize,
    execute(document, command) {
      const entityId = valueAt(command.payload, 'entityId')
      if (typeof entityId !== 'string') return issue('frame.invalid-target', 'entityId 无效')
      const frame = document.entities[entityId]?.components[COMPOSE_BUILTIN_COMPONENT_KEYS.frame]
      if (!frame) return issue('frame.missing', `Entity ${entityId} 不是 Frame`)
      const size = valueAt(command.payload, 'size')
      if (
        !isRecord(size)
        || typeof size.width !== 'number'
        || !Number.isFinite(size.width)
        || size.width <= 0
        || typeof size.height !== 'number'
        || !Number.isFinite(size.height)
        || size.height <= 0
      ) return issue('frame.invalid-size', 'Frame size 必须是有限正数')
      if (jsonEqual(frame.size, size as unknown as JsonValue)) {
        return { status: 'noop', reason: 'Frame 尺寸没有变化' }
      }
      const framePath = ['entities', entityId, 'components', COMPOSE_BUILTIN_COMPONENT_KEYS.frame]
      const itemPath = ['entities', entityId, 'components', COMPOSE_BUILTIN_COMPONENT_KEYS.layoutItem]
      return patches([
        { op: 'set', path: [...framePath, 'size'], value: { width: size.width, height: size.height } },
        { op: 'set', path: [...itemPath, 'width', 'value'], value: size.width },
        { op: 'set', path: [...itemPath, 'height', 'value'], value: size.height },
      ])
    },
  }
}

function createFrameGuideHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.createFrameGuide,
    execute(document, command) {
      const frameId = valueAt(command.payload, 'frameId')
      if (typeof frameId !== 'string') return issue('frame.invalid-target', 'frameId 无效')
      const existing = frameGuides(document, frameId)
      if (!existing) return issue('frame.missing', `Entity ${frameId} 不是 Frame`)
      const guidesValue = valueAt(command.payload, 'guides')
      const values = guidesValue === undefined ? [valueAt(command.payload, 'guide')] : guidesValue
      if (!Array.isArray(values) || values.length === 0) {
        return issue('frame.invalid-guide', 'frame.guide.create 参数无效')
      }
      const guides = values.map(asFrameGuide)
      if (guides.some((guide) => !guide)) {
        return issue('frame.invalid-guide', 'frame.guide.create 包含非法 guide')
      }
      const known = new Set(existing.map(({ id }) => id))
      for (const guide of guides as ComposeFrameGuide[]) {
        if (known.has(guide.id)) return issue('frame.duplicate-guide', `Guide ${guide.id} 已存在`)
        known.add(guide.id)
      }
      const guidesPath = [
        'entities',
        frameId,
        'components',
        COMPOSE_BUILTIN_COMPONENT_KEYS.frame,
        'guides',
      ]
      return patches((guides as ComposeFrameGuide[]).map((guide, offset) => ({
        op: 'insert' as const,
        path: guidesPath,
        index: existing.length + offset,
        value: guide as unknown as JsonValue,
      })))
    },
  }
}

function frameGuideHandler(type: string): CommandHandler {
  return {
    type,
    execute(document, command) {
      const frameId = valueAt(command.payload, 'frameId')
      if (typeof frameId !== 'string') return issue('frame.invalid-target', 'frameId 无效')
      const existing = frameGuides(document, frameId)
      if (!existing) return issue('frame.missing', `Entity ${frameId} 不是 Frame`)
      const guideId = valueAt(command.payload, 'guideId')
      if (typeof guideId !== 'string') return issue('frame.invalid-guide', 'guideId 无效')
      const index = existing.findIndex(({ id }) => id === guideId)
      if (index < 0) return issue('frame.guide-missing', `Guide ${guideId} 不存在`)
      const guidesPath = [
        'entities',
        frameId,
        'components',
        COMPOSE_BUILTIN_COMPONENT_KEYS.frame,
        'guides',
      ]
      if (type === BUILTIN_COMMAND_TYPES.deleteFrameGuide) {
        return patches([{ op: 'remove', path: [...guidesPath, index] }])
      }
      const position = valueAt(command.payload, 'position')
      if (typeof position !== 'number' || !Number.isFinite(position)) {
        return issue('frame.invalid-guide', 'Guide position 必须是有限数')
      }
      if (existing[index]?.position === position) {
        return { status: 'noop', reason: 'Guide 位置没有变化' }
      }
      return patches([{ op: 'set', path: [...guidesPath, index, 'position'], value: position }])
    },
  }
}

function children(document: ComposeDocument, parentId: string | null): readonly string[] | null {
  if (parentId === null) return document.rootIds
  const entity = document.entities[parentId]
  return entity ? getComposeHierarchy(entity)?.childIds ?? null : null
}

function childPath(parentId: string | null): readonly (string | number)[] {
  return parentId === null
    ? ['rootIds']
    : ['entities', parentId, 'components', COMPOSE_BUILTIN_COMPONENT_KEYS.hierarchy, 'childIds']
}

function buildLocations(document: ComposeDocument) {
  const result = new Map<string, Location>()
  const visit = (ids: readonly string[], parentId: string | null) => {
    ids.forEach((id, index) => {
      result.set(id, { parentId, index })
      const hierarchy = getComposeHierarchy(document.entities[id]!)
      if (hierarchy) visit(hierarchy.childIds, id)
    })
  }
  visit(document.rootIds, null)
  return result
}

function collectSubtree(document: ComposeDocument, rootId: string) {
  const result: string[] = []
  const stack = [rootId]
  while (stack.length > 0) {
    const id = stack.pop()!
    if (result.includes(id)) continue
    result.push(id)
    const hierarchy = document.entities[id] && getComposeHierarchy(document.entities[id]!)
    if (hierarchy) stack.push(...hierarchy.childIds)
  }
  return result
}

function documentOrder(document: ComposeDocument) {
  const ordered: string[] = []
  const visit = (ids: readonly string[]) => ids.forEach((id) => {
    ordered.push(id)
    const hierarchy = document.entities[id] && getComposeHierarchy(document.entities[id]!)
    if (hierarchy) visit(hierarchy.childIds)
  })
  visit(document.rootIds)
  return ordered
}

function normalizeRoots(document: ComposeDocument, requested: readonly string[]) {
  const unique = [...new Set(requested)].filter((id) => document.entities[id])
  const selected = new Set(unique)
  const locations = buildLocations(document)
  return documentOrder(document).filter((id) => {
    if (!selected.has(id)) return false
    let parentId = locations.get(id)?.parentId ?? null
    while (parentId) {
      if (selected.has(parentId)) return false
      parentId = locations.get(parentId)?.parentId ?? null
    }
    return true
  })
}

function validateTargets(
  document: ComposeDocument,
  ids: readonly string[],
  options: { readonly allowLocked?: boolean } = {},
): readonly CommandIssue[] {
  const issues: CommandIssue[] = []
  const seen = new Set<string>()
  ids.forEach((id) => {
    const entity = document.entities[id]
    if (!entity) issues.push({ code: 'entity.missing', message: `Entity ${id} 不存在` })
    else if (seen.has(id)) issues.push({ code: 'entity.duplicate-target', message: `Entity ${id} 重复` })
    else if (!options.allowLocked && getComposeLock(entity).locked) {
      issues.push({ code: 'entity.locked', message: `Entity ${id} 已锁定` })
    }
    seen.add(id)
  })
  return issues
}

function createEntityHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.createEntity,
    execute(document, command) {
      const entity = asEntity(valueAt(command.payload, 'entity'))
      const parentValue = valueAt(command.payload, 'parentId')
      const parentId = parentValue === null || typeof parentValue === 'string'
        ? parentValue
        : undefined
      if (!entity || parentId === undefined) return issue('entity.invalid', 'entity.create 参数无效')
      if (document.entities[entity.id]) return issue('entity.duplicate-id', `Entity ${entity.id} 已存在`)
      const target = children(document, parentId)
      if (!target) return issue('entity.invalid-parent', '目标父 Entity 必须拥有 Hierarchy')
      if (parentId !== null && getComposeLock(document.entities[parentId]!).locked) {
        return issue('entity.locked', `父 Entity ${parentId} 已锁定`)
      }
      const index = asIndex(valueAt(command.payload, 'index'), target.length)
      if (index === null || index < 0 || index > target.length) {
        return issue('entity.invalid-index', '创建索引无效')
      }
      return patches([
        {
          op: 'set',
          path: ['entities', entity.id],
          value: entity as unknown as JsonValue,
        },
        {
          op: 'insert',
          path: childPath(parentId),
          index,
          value: entity.id,
        },
      ])
    },
  }
}

function deleteEntityHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.deleteEntity,
    execute(document, command) {
      const requested = asStringArray(valueAt(command.payload, 'entityIds'))
      if (!requested?.length) return issue('entity.invalid-targets', 'entity.delete 目标不能为空')
      const roots = normalizeRoots(document, requested)
      const targetIssues = validateTargets(document, roots)
      if (targetIssues.length) return { status: 'rejected', issues: targetIssues }
      const locations = buildLocations(document)
      const byParent = new Map<string | null, number[]>()
      roots.forEach((id) => {
        const location = locations.get(id)!
        const indexes = byParent.get(location.parentId) ?? []
        indexes.push(location.index)
        byParent.set(location.parentId, indexes)
      })
      const result: DocumentPatch[] = []
      byParent.forEach((indexes, parentId) => {
        indexes.sort((a, b) => b - a).forEach((index) =>
          result.push({ op: 'remove', path: [...childPath(parentId), index] }))
      })
      const deleting = new Set(roots.flatMap((id) => collectSubtree(document, id)))
      documentOrder(document).reverse().forEach((id) => {
        if (deleting.has(id)) result.push({ op: 'remove', path: ['entities', id] })
      })
      return patches(result)
    },
  }
}

function moveEntityHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.moveEntity,
    execute(document, command) {
      const requested = asStringArray(valueAt(command.payload, 'entityIds'))
      const parentValue = valueAt(command.payload, 'parentId')
      const parentId = parentValue === null || typeof parentValue === 'string'
        ? parentValue
        : undefined
      if (!requested?.length || parentId === undefined) {
        return issue('entity.invalid-targets', 'entity.move 参数无效')
      }
      const moving = normalizeRoots(document, requested)
      const targetIssues = validateTargets(document, moving)
      if (targetIssues.length) return { status: 'rejected', issues: targetIssues }
      if (parentId !== null) {
        const parent = document.entities[parentId]
        if (!parent || !getComposeHierarchy(parent)) {
          return issue('entity.invalid-parent', `父 Entity ${parentId} 无效`)
        }
        if (getComposeLock(parent).locked) return issue('entity.locked', `父 Entity ${parentId} 已锁定`)
        if (moving.some((id) => collectSubtree(document, id).includes(parentId))) {
          return issue('entity.cycle', '不能把 Entity 移动到自身后代')
        }
      }
      const targetChildren = children(document, parentId)
      if (!targetChildren) return issue('entity.invalid-parent', '目标父 Entity 无效')
      const requestedIndex = asIndex(valueAt(command.payload, 'index'), targetChildren.length)
      if (requestedIndex === null || requestedIndex < 0 || requestedIndex > targetChildren.length) {
        return issue('entity.invalid-index', '移动目标索引无效')
      }
      const locations = buildLocations(document)
      const byParent = new Map<string | null, number[]>()
      moving.forEach((id) => {
        const location = locations.get(id)!
        const indexes = byParent.get(location.parentId) ?? []
        indexes.push(location.index)
        byParent.set(location.parentId, indexes)
      })
      const removedBefore = moving.filter((id) => {
        const location = locations.get(id)
        return location?.parentId === parentId && location.index < requestedIndex
      }).length
      const result: DocumentPatch[] = []
      byParent.forEach((indexes, sourceParentId) => {
        [...indexes].sort((a, b) => b - a).forEach((index) =>
          result.push({ op: 'remove', path: [...childPath(sourceParentId), index] }))
      })
      const remainingLength = targetChildren.length - (byParent.get(parentId)?.length ?? 0)
      const targetIndex = Math.min(
        Math.max(0, requestedIndex - removedBefore),
        remainingLength,
      )
      moving.forEach((id, offset) => result.push({
        op: 'insert',
        path: childPath(parentId),
        index: targetIndex + offset,
        value: id,
      }))
      return patches(result)
    },
  }
}

function duplicateEntityHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.duplicateEntity,
    execute(document, command) {
      const values = valueAt(command.payload, 'entities')
      const rootIds = asStringArray(valueAt(command.payload, 'rootIds'))
      const parentValue = valueAt(command.payload, 'parentId')
      const parentId = parentValue === null || typeof parentValue === 'string'
        ? parentValue
        : undefined
      if (!isRecord(values) || !rootIds?.length || parentId === undefined) {
        return issue('entity.invalid-duplicate', 'entity.duplicate 参数无效')
      }
      const entries = Object.entries(values)
      for (const [id, value] of entries) {
        const entity = asEntity(value)
        if (!entity || entity.id !== id) return issue('entity.invalid-duplicate', `Entity ${id} 无效`)
        if (document.entities[id]) return issue('entity.duplicate-id', `Entity ${id} 已存在`)
      }
      if (rootIds.some((id) => !asEntity(values[id]))) {
        return issue('entity.invalid-duplicate', '复制 rootIds 不完整')
      }
      const target = children(document, parentId)
      if (!target) return issue('entity.invalid-parent', '复制目标父 Entity 无效')
      if (parentId !== null && getComposeLock(document.entities[parentId]!).locked) {
        return issue('entity.locked', `父 Entity ${parentId} 已锁定`)
      }
      const index = asIndex(valueAt(command.payload, 'index'), target.length)
      if (index === null || index < 0 || index > target.length) {
        return issue('entity.invalid-index', '复制目标索引无效')
      }
      const result: DocumentPatch[] = entries.map(([id, entity]) => ({
        op: 'set',
        path: ['entities', id],
        value: entity as JsonValue,
      }))
      rootIds.forEach((id, offset) => result.push({
        op: 'insert',
        path: childPath(parentId),
        index: index + offset,
        value: id,
      }))
      return patches(result)
    },
  }
}

function renameEntityHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.renameEntity,
    execute(document, command) {
      const entityId = valueAt(command.payload, 'entityId')
      const name = valueAt(command.payload, 'name')
      if (typeof entityId !== 'string' || !nonEmptyString(name)) {
        return issue('entity.invalid-value', 'Entity 名称参数无效')
      }
      const entity = document.entities[entityId]
      if (!entity) return issue('entity.missing', `Entity ${entityId} 不存在`)
      if (getComposeLock(entity).locked) return issue('entity.locked', `Entity ${entityId} 已锁定`)
      if (entity.name === name) return { status: 'noop', reason: 'Entity 名称没有变化' }
      return patches([{ op: 'set', path: ['entities', entityId, 'name'], value: name }])
    },
  }
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function booleanComponentHandler(
  type: string,
  componentKey: 'Visibility' | 'Lock' | 'Clip',
  field: 'visible' | 'locked' | 'enabled',
): CommandHandler {
  return {
    type,
    execute(document, command) {
      const ids = asStringArray(valueAt(command.payload, 'entityIds'))
      const value = valueAt(command.payload, field)
      if (!ids?.length || typeof value !== 'boolean') {
        return issue('entity.invalid-value', `${field} 命令参数无效`)
      }
      const targetIssues = validateTargets(document, ids, {
        allowLocked: componentKey === 'Lock',
      })
      if (targetIssues.length) return { status: 'rejected', issues: targetIssues }
      for (const id of ids) {
        if (!document.entities[id]!.components[componentKey]) {
          return issue('component.missing', `Entity ${id} 缺少 ${componentKey}`)
        }
      }
      const changes = ids.filter((id) =>
        document.entities[id]!.components[componentKey]?.[field] !== value)
      return patches(changes.map((id) => ({
        op: 'set',
        path: ['entities', id, 'components', componentKey, field],
        value,
      })))
    },
  }
}

function configureClipHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.configureClip,
    execute(document, command) {
      const ids = asStringArray(valueAt(command.payload, 'entityIds'))
      const horizontal = valueAt(command.payload, 'horizontal')
      const vertical = valueAt(command.payload, 'vertical')
      const modes = new Set<unknown>(['visible', 'clip', 'scroll'])
      if (!ids?.length || !modes.has(horizontal) || !modes.has(vertical)) {
        return issue('entity.invalid-value', 'Clip 分轴命令参数无效')
      }
      const targetIssues = validateTargets(document, ids, { allowLocked: false })
      if (targetIssues.length) return { status: 'rejected', issues: targetIssues }
      // 缺席的 Clip 由本命令补齐而不是拒绝：`Clip` 是可选 Component，缺席即不裁剪，而场景
      // （`createComposeFrameEntity`）与 v6 迁移出来的容器都没有它。拒绝的话这些容器只能
      // 先「添加容器能力」才配得了溢出，而那条入口对已有 Hierarchy 的 Entity 又是拒绝的——
      // 两头堵死。把关的改成 Hierarchy：`Clip MUST 依赖 Hierarchy`，写给叶 Entity 会产出
      // 一份校验不过的文档。
      for (const id of ids) {
        if (!document.entities[id]!.components.Hierarchy) {
          return issue('component.missing', `Entity ${id} 缺少 Hierarchy`)
        }
      }
      const normalized = normalizeComposeOverflow(
        horizontal as ComposeOverflowMode,
        vertical as ComposeOverflowMode,
      )
      const value = {
        enabled: normalized.horizontal !== 'visible' || normalized.vertical !== 'visible',
        horizontal: normalized.horizontal,
        vertical: normalized.vertical,
      }
      const changes = ids.filter((id) =>
        !jsonEqual(document.entities[id]!.components.Clip, value))
      return patches(changes.map((id) => ({
        op: 'set',
        path: ['entities', id, 'components', 'Clip'],
        value,
      })))
    },
  }
}

function componentHandler(type: string): CommandHandler {
  return {
    type,
    execute(document, command) {
      const entityId = valueAt(command.payload, 'entityId')
      const key = valueAt(command.payload, 'key')
      if (typeof entityId !== 'string' || typeof key !== 'string' || !isComposeComponentKey(key)) {
        return issue('component.invalid', 'Component 命令参数无效')
      }
      const entity = document.entities[entityId]
      if (!entity) return issue('entity.missing', `Entity ${entityId} 不存在`)
      if (getComposeLock(entity).locked) return issue('entity.locked', `Entity ${entityId} 已锁定`)
      const current = entity.components[key]
      if (type === BUILTIN_COMMAND_TYPES.removeComponent) {
        if (!current) return { status: 'noop', reason: `Component ${key} 不存在` }
        const composition = getComposeComposition(entity)
        if (
          key === COMPOSE_BUILTIN_COMPONENT_KEYS.composition
          || composition.baseComponentKeys.includes(key)
        ) {
          return issue('component.protected', `基础 Component ${key} 不可移除`)
        }
        const hierarchy = key === COMPOSE_BUILTIN_COMPONENT_KEYS.hierarchy
          ? getComposeHierarchy(entity)
          : undefined
        if (hierarchy?.childIds.length) {
          return issue('component.has-children', '含子项的 Hierarchy 不可移除')
        }
        return patches([{ op: 'remove', path: ['entities', entityId, 'components', key] }])
      }
      const value = valueAt(command.payload, 'value')
      if (!isRecord(value)) return issue('component.invalid-value', 'Component value 必须是 JsonObject')
      if (type === BUILTIN_COMMAND_TYPES.addComponent && current) {
        return issue('component.exists', `Component ${key} 已存在`)
      }
      if (type === BUILTIN_COMMAND_TYPES.updateComponent && !current) {
        return issue('component.missing', `Component ${key} 不存在`)
      }
      if (jsonEqual(current, value)) return { status: 'noop', reason: 'Component 没有变化' }
      return patches([{
        op: 'set',
        path: ['entities', entityId, 'components', key],
        value: value as JsonValue,
      }])
    },
  }
}

function rendererPropsHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.setRendererProps,
    execute(document, command) {
      const entityId = valueAt(command.payload, 'entityId')
      const props = valueAt(command.payload, 'props')
      if (typeof entityId !== 'string' || !isRecord(props)) {
        return issue('renderer.invalid-props', 'Renderer props 参数无效')
      }
      const entity = document.entities[entityId]
      if (!entity) return issue('entity.missing', `Entity ${entityId} 不存在`)
      if (getComposeLock(entity).locked) return issue('entity.locked', `Entity ${entityId} 已锁定`)
      const renderer = entity.components[COMPOSE_BUILTIN_COMPONENT_KEYS.renderer]
      if (!renderer) return issue('renderer.missing', `Entity ${entityId} 缺少 Renderer`)
      if (jsonEqual(renderer.props, props)) return { status: 'noop', reason: 'Renderer props 没有变化' }
      return patches([{
        op: 'set',
        path: [
          'entities',
          entityId,
          'components',
          COMPOSE_BUILTIN_COMPONENT_KEYS.renderer,
          'props',
        ],
        value: props as JsonValue,
      }])
    },
  }
}

function appearanceHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.setAppearance,
    execute(document, command) {
      const entityId = valueAt(command.payload, 'entityId')
      const appearance = valueAt(command.payload, 'appearance')
      if (typeof entityId !== 'string' || !isRecord(appearance)) {
        return issue('appearance.invalid', 'Appearance 参数无效')
      }
      if (
        'backgroundColor' in appearance
        || ('backgroundPaint' in appearance && !isValidComposePaint(appearance.backgroundPaint))
        || ('borderColor' in appearance && !isComposeColor(appearance.borderColor))
      ) {
        return issue('appearance.invalid', 'Appearance 包含非法 Paint 或颜色')
      }
      const entity = document.entities[entityId]
      if (!entity) return issue('entity.missing', `Entity ${entityId} 不存在`)
      if (getComposeLock(entity).locked) return issue('entity.locked', `Entity ${entityId} 已锁定`)
      if (jsonEqual(entity.components.Appearance, appearance)) {
        return { status: 'noop', reason: 'Appearance 没有变化' }
      }
      return patches([{
        op: 'set',
        path: ['entities', entityId, 'components', 'Appearance'],
        value: appearance as JsonValue,
      }])
    },
  }
}

function samePosition(left: ComposeSpatialTransform, right: ComposeSpatialTransform) {
  return left.position.x === right.position.x && left.position.y === right.position.y
}

function sameSize(left: ComposeSpatialTransform, right: ComposeSpatialTransform) {
  return left.size.width === right.size.width && left.size.height === right.size.height
}

function withinConstraints(entity: ComposeEntity, transform: ComposeSpatialTransform) {
  const item = getComposeLayoutItem(entity)
  const { width, height } = transform.size
  return (item.width.min === null || width >= item.width.min)
    && (item.height.min === null || height >= item.height.min)
    && (item.width.max === null || width <= item.width.max)
    && (item.height.max === null || height <= item.height.max)
}

function validatesOperation(
  entity: ComposeEntity,
  next: ComposeSpatialTransform,
  operation: TransformOperation,
): string | null {
  const current = getComposeSpatialTransform(entity)
  const constraints = resolveComposeGeometryConstraints(entity)
  if (!withinConstraints(entity, next)) return 'Transform 尺寸超出约束'
  const positionChanged = !samePosition(current, next)
  const sizeChanged = !sameSize(current, next)
  const rotationChanged = current.rotation !== next.rotation
  const resizeViolation = () => {
    if (!sizeChanged) return null
    if (constraints.resize === 'none') return 'Entity 禁止修改 size'
    if (constraints.resize === 'horizontal' && next.size.height !== current.size.height) {
      return 'horizontal Resize 不得修改高度'
    }
    if (constraints.resize === 'vertical' && next.size.width !== current.size.width) {
      return 'vertical Resize 不得修改宽度'
    }
    if (constraints.resize === 'preserve-aspect') {
      const previousRatio = current.size.width / current.size.height
      const nextRatio = next.size.width / next.size.height
      if (Math.abs(previousRatio - nextRatio) > 0.000_001) return 'Resize 必须保持宽高比'
    }
    return null
  }
  if (operation === 'move') {
    if (!constraints.movable) return 'Entity 禁止移动'
    const item = getComposeLayoutItem(entity)
    const widthMayBake = item.positioning === 'flow' && item.width.mode === 'fill'
    const heightMayBake = item.positioning === 'flow' && item.height.mode === 'fill'
    if (
      rotationChanged
      || (next.size.width !== current.size.width && !widthMayBake)
      || (next.size.height !== current.size.height && !heightMayBake)
    ) return 'move 只能修改 position，Flow 的 Fill 轴除外'
  }
  else if (operation === 'resize') {
    if (rotationChanged) return 'resize 不得修改 rotation'
    const violation = resizeViolation()
    if (violation) return violation
  }
  else if (operation === 'rotate') {
    if (!constraints.rotatable) return 'Entity 禁止旋转'
    if (sizeChanged) return 'rotate 不得修改 size'
  }
  else {
    if (positionChanged && !constraints.movable) return 'Entity 禁止修改 position'
    const violation = resizeViolation()
    if (violation) return violation
    if (rotationChanged && !constraints.rotatable) return 'Entity 禁止修改 rotation'
  }
  return null
}

function appendSpatialTransformPatches(
  result: DocumentPatch[],
  entity: ComposeEntity,
  next: ComposeSpatialTransform,
  operation: TransformOperation = 'set',
  detachFromFlow = false,
) {
  const current = getComposeSpatialTransform(entity)
  const item = getComposeLayoutItem(entity)
  if (!samePosition(current, next) || !sameSize(current, next)) {
    // Flow→Absolute 只由显式脱流意图驱动：普通 move 不得隐式改变 positioning，
    // 拖拽重排/回弹语义依赖这一点（脱流入口是几何 Inspector 的显式开关）。
    const movingFlowItem = operation === 'move' && detachFromFlow && item.positioning === 'flow'
    const resizing = operation === 'resize' || operation === 'set'
    result.push({
      op: 'set',
      path: ['entities', entity.id, 'components', 'LayoutItem'],
      value: {
        ...item,
        offset: next.position,
        positioning: movingFlowItem ? 'absolute' : item.positioning,
        width: {
          ...item.width,
          ...((resizing && current.size.width !== next.size.width)
            || (movingFlowItem && item.width.mode === 'fill')
            ? { mode: 'fixed', value: next.size.width }
            : {}),
        },
        height: {
          ...item.height,
          ...((resizing && current.size.height !== next.size.height)
            || (movingFlowItem && item.height.mode === 'fill')
            ? { mode: 'fixed', value: next.size.height }
            : {}),
        },
      },
    })
  }
  // Frame 的尺寸事实来源是 Frame.size，布局求解会用它覆盖 LayoutItem 的推导结果。
  // 只写 LayoutItem 会让文档已经改变而画面纹丝不动——拖手柄缩放场景必须同时写这里。
  const frame = getComposeFrame(entity)
  if (frame && !sameSize(current, next)) {
    result.push({
      op: 'set',
      path: ['entities', entity.id, 'components', 'Frame', 'size'],
      value: { width: next.size.width, height: next.size.height },
    })
  }
  if (current.rotation !== next.rotation) {
    result.push({
      op: 'set',
      path: ['entities', entity.id, 'components', 'Transform', 'rotation'],
      value: next.rotation,
    })
  }
}

function transformHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.setTransform,
    execute(document, command) {
      const operation = valueAt(command.payload, 'operation')
      const updates = valueAt(command.payload, 'updates')
      if (
        !['move', 'resize', 'rotate', 'set'].includes(operation as string)
        || !Array.isArray(updates)
        || updates.length === 0
      ) return issue('transform.invalid', 'Transform 命令参数无效')
      const result: DocumentPatch[] = []
      for (const update of updates) {
        if (
          !isRecord(update)
          || typeof update.entityId !== 'string'
          || (update.detachFromFlow !== undefined && typeof update.detachFromFlow !== 'boolean')
        ) {
          return issue('transform.invalid', 'Transform update 参数无效')
        }
        const entity = document.entities[update.entityId]
        if (!entity) return issue('entity.missing', `Entity ${update.entityId} 不存在`)
        if (getComposeLock(entity).locked) return issue('entity.locked', `Entity ${update.entityId} 已锁定`)
        if (!isValidComposeSpatialTransform(update.transform)) {
          return issue('transform.invalid', `Entity ${update.entityId} Transform 无效`)
        }
        const violation = validatesOperation(
          entity,
          update.transform,
          operation as TransformOperation,
        )
        if (violation) return issue('transform.constraint', violation)
        appendSpatialTransformPatches(
          result,
          entity,
          update.transform,
          operation as TransformOperation,
          update.detachFromFlow === true,
        )
      }
      return patches(result)
    },
  }
}

function groupHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.groupEntity,
    execute(document, command) {
      const container = asEntity(valueAt(command.payload, 'container'))
      const requested = asStringArray(valueAt(command.payload, 'entityIds'))
      const transformValues = valueAt(command.payload, 'childTransforms')
      if (
        !container
        || !getComposeHierarchy(container)
        || !isComposeGroupEntity(container)
        || !requested
        || requested.length < 2
        || !isRecord(transformValues)
      ) return issue('entity.invalid-group', 'entity.group 参数无效')
      if (document.entities[container.id]) {
        return issue('entity.duplicate-id', `Entity ${container.id} 已存在`)
      }
      const roots = normalizeRoots(document, requested)
      if (roots.length !== requested.length) {
        return issue('entity.invalid-targets', '组合目标必须是顶层选择')
      }
      const targetIssues = validateTargets(document, roots)
      if (targetIssues.length) return { status: 'rejected', issues: targetIssues }
      if (roots.some((id) => getComposeLayoutItem(document.entities[id]!).positioning === 'flow')) {
        return issue('entity.flow-group-disabled', '自动布局 Flow 子项不能参与 Group')
      }
      const locations = buildLocations(document)
      const first = locations.get(roots[0]!)
      if (!first || roots.some((id) => locations.get(id)?.parentId !== first.parentId)) {
        return issue('entity.invalid-parent', '待组合 Entity 必须具有同一直接父级')
      }
      if (first.parentId !== null && getComposeLock(document.entities[first.parentId]!).locked) {
        return issue('entity.locked', `父 Entity ${first.parentId} 已锁定`)
      }
      const indexes = roots.map((id) => locations.get(id)!.index)
      const hierarchy = getComposeHierarchy(container)!
      const grouped: ComposeEntity = {
        ...container,
        components: {
          ...container.components,
          Hierarchy: { ...hierarchy, childIds: roots },
        },
      }
      const result: DocumentPatch[] = [...indexes]
        .sort((a, b) => b - a)
        .map((index) => ({ op: 'remove', path: [...childPath(first.parentId), index] }))
      result.push({
        op: 'set',
        path: ['entities', grouped.id],
        value: grouped as unknown as JsonValue,
      })
      result.push({
        op: 'insert',
        path: childPath(first.parentId),
        index: Math.min(...indexes),
        value: grouped.id,
      })
      for (const entityId of roots) {
        const transform = transformValues[entityId]
        if (!isValidComposeSpatialTransform(transform)) {
          return issue('transform.invalid', `Entity ${entityId} 缺少局部 Transform`)
        }
        appendSpatialTransformPatches(result, document.entities[entityId]!, transform)
      }
      return patches(result)
    },
  }
}

function ungroupHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.ungroupEntity,
    execute(document, command) {
      const containerId = valueAt(command.payload, 'containerId')
      const transformValues = valueAt(command.payload, 'childTransforms')
      if (typeof containerId !== 'string' || !isRecord(transformValues)) {
        return issue('entity.invalid-ungroup', 'entity.ungroup 参数无效')
      }
      const container = document.entities[containerId]
      const hierarchy = container && getComposeHierarchy(container)
      if (!container || !hierarchy) return issue('entity.invalid-container', `Container ${containerId} 不存在`)
      if (!isComposeUngroupableEntity(container)) {
        return issue('entity.invalid-ungroup', `Entity ${containerId} 不是 Group`)
      }
      if (getComposeLock(container).locked) return issue('entity.locked', `Container ${containerId} 已锁定`)
      if (!hierarchy.childIds.length) return issue('entity.empty-container', 'Container 没有子项')
      if (
        getComposeLayoutItem(container).positioning === 'flow'
        || hierarchy.childIds.some((id) => getComposeLayoutItem(document.entities[id]!).positioning === 'flow')
      ) {
        return issue('entity.flow-ungroup-disabled', '自动布局 Flow 子项不能参与 Ungroup')
      }
      const targetIssues = validateTargets(document, hierarchy.childIds)
      if (targetIssues.length) return { status: 'rejected', issues: targetIssues }
      const location = buildLocations(document).get(containerId)
      if (!location) return issue('entity.invalid-parent', 'Container 父级无效')
      if (
        location.parentId !== null
        && getComposeLock(document.entities[location.parentId]!).locked
      ) return issue('entity.locked', `父 Entity ${location.parentId} 已锁定`)
      const result: DocumentPatch[] = [{
        op: 'remove',
        path: [...childPath(location.parentId), location.index],
      }]
      hierarchy.childIds.forEach((entityId, offset) => result.push({
        op: 'insert',
        path: childPath(location.parentId),
        index: location.index + offset,
        value: entityId,
      }))
      for (const entityId of hierarchy.childIds) {
        const transform = transformValues[entityId]
        if (!isValidComposeSpatialTransform(transform)) {
          return issue('transform.invalid', `Entity ${entityId} 缺少父级 Transform`)
        }
        appendSpatialTransformPatches(result, document.entities[entityId]!, transform)
      }
      result.push({ op: 'remove', path: ['entities', containerId] })
      return patches(result)
    },
  }
}

/**
 * 设置曲线几何。
 *
 * @remarks
 * 曲线几何写入的**唯一漏斗**：载荷是 parent 局部坐标下的几何，这里换算成「盒 + 盒局部
 * 几何」并在同一事务里写 `Curve` 与 `LayoutItem`。分成两条命令会让盒与几何之间出现一个
 * 可观察的不一致中间态，撤销也会变成两步。
 *
 * `LayoutItem` 的 fixed fallback 与 offset 一起对齐——盒尺寸是几何的派生，不是第二份事实。
 */
function setCurveHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.setCurve,
    execute(document, command) {
      const entityId = valueAt(command.payload, 'entityId')
      if (typeof entityId !== 'string') return issue('curve.invalid-target', 'entityId 无效')
      const entity = document.entities[entityId]
      if (!entity || !getComposeCurve(entity)) {
        return issue('curve.missing', `Entity ${entityId} 不是曲线`)
      }
      if (getComposeLock(entity).locked) return issue('entity.locked', `Entity ${entityId} 已锁定`)
      /*
       * 本漏斗写 `Curve` 的同时**重算 `LayoutItem` 的尺寸与 offset**，那是它作为唯一漏斗的
       * 定义的一部分——因此它是 `resize: 'none'` 唯一的漏洞：`entity.transform.set` 那条既有
       * 拒绝按操作分类（move/resize/rotate）判断，根本不经过这里，拖一下夹点就把盒改了。
       *
       * 无条件拒绝而不是「盒变了才拒绝」：这条命令的盒是几何的派生量，写几何就是写盒。
       */
      if (resolveComposeGeometryConstraints(entity).resize === 'none') {
        return issue('curve.constraint', `Entity ${entityId} 禁止修改 size`)
      }
      const candidate = valueAt(command.payload, 'curve')
      if (!isValidComposeCurve(candidate)) {
        return issue('curve.invalid-geometry', 'entity.curve.set 几何无效')
      }
      const item = getComposeLayoutItem(entity)
      if (!item) return issue('curve.invalid-target', `Entity ${entityId} 缺少 LayoutItem`)
      // 导线的接线改动**必须与几何同一个事务**：拖端点落到另一个端口上时几何与绑定一起变，
      // 分成两条命令会产生一个可观察的不一致中间态（几何已经动了、绑定还指着旧端口），
      // 撤销也会变成两步。缺席即不动 `Wire`，因此 Inspector 那条写入路径一行不改。
      const wire = valueAt(command.payload, 'wire')
      const wirePath = ['entities', entityId, 'components', COMPOSE_BUILTIN_COMPONENT_KEYS.wire]
      if (wire !== undefined && wire !== null && !isValidComposeWire(wire)) {
        return issue('curve.invalid-geometry', 'entity.curve.set 的 wire 无效')
      }
      const next = normalizeComposeCurveGeometry(candidate as ComposeCurve)
      const curvePath = ['entities', entityId, 'components', COMPOSE_BUILTIN_COMPONENT_KEYS.curve]
      const itemPath = ['entities', entityId, 'components', COMPOSE_BUILTIN_COMPONENT_KEYS.layoutItem]
      if (
        wire === undefined
        && jsonEqual(entity.components[COMPOSE_BUILTIN_COMPONENT_KEYS.curve] as JsonValue, next.curve as unknown as JsonValue)
        && jsonEqual(item.offset as unknown as JsonValue, next.offset as unknown as JsonValue)
        && item.width.value === next.size.width
        && item.height.value === next.size.height
      ) return { status: 'noop', reason: '曲线几何没有变化' }
      return patches([
        ...(wire === undefined
          ? []
          : wire === null
            ? [{ op: 'remove' as const, path: wirePath }]
            : [{ op: 'set' as const, path: wirePath, value: wire as JsonValue }]),
        { op: 'set', path: curvePath, value: next.curve as unknown as JsonValue },
        { op: 'set', path: [...itemPath, 'offset'], value: next.offset as unknown as JsonValue },
        { op: 'set', path: [...itemPath, 'width', 'value'], value: next.size.width },
        { op: 'set', path: [...itemPath, 'height', 'value'], value: next.size.height },
      ])
    },
  }
}

/** 创建 ComposeDocument v6 内置命令处理器。 @public */
export function createBuiltinCommandHandlers(): readonly CommandHandler[] {
  return [
    configureCanvasHandler(),
    setTextStyleHandler(),
    removeTextStyleHandler(),
    setFrameSizeHandler(),
    setCurveHandler(),
    createFrameGuideHandler(),
    frameGuideHandler(BUILTIN_COMMAND_TYPES.moveFrameGuide),
    frameGuideHandler(BUILTIN_COMMAND_TYPES.deleteFrameGuide),
    createEntityHandler(),
    deleteEntityHandler(),
    duplicateEntityHandler(),
    moveEntityHandler(),
    renameEntityHandler(),
    booleanComponentHandler(BUILTIN_COMMAND_TYPES.setVisibility, 'Visibility', 'visible'),
    booleanComponentHandler(BUILTIN_COMMAND_TYPES.setLock, 'Lock', 'locked'),
    booleanComponentHandler(BUILTIN_COMMAND_TYPES.setClip, 'Clip', 'enabled'),
    configureClipHandler(),
    componentHandler(BUILTIN_COMMAND_TYPES.addComponent),
    componentHandler(BUILTIN_COMMAND_TYPES.updateComponent),
    componentHandler(BUILTIN_COMMAND_TYPES.removeComponent),
    rendererPropsHandler(),
    appearanceHandler(),
    transformHandler(),
    groupHandler(),
    ungroupHandler(),
  ]
}

/**
 * 从已构造的子命令创建原子 transaction.batch 命令。
 *
 * @remarks
 * EditorCommand 结构上是严格 JSON，但 TypeScript 接口无法直接赋值给带索引签名的
 * JsonObject；本构造器把这次不可避免的类型收窄集中在 core，调用方不再需要
 * `as unknown as JsonValue` 强转。
 *
 * @public
 */
export function createComposeBatchCommand(input: {
  /** 宿主生成的 batch 命令 ID。 */
  readonly id: string
  /** 依序原子执行的子命令；不允许嵌套 batch。 */
  readonly commands: readonly EditorCommand[]
  /** 可选展示、来源与目标语义。 */
  readonly meta?: EditorCommandMeta
}): EditorCommand {
  return {
    id: input.id,
    type: BUILTIN_COMMAND_TYPES.batch,
    payload: { commands: input.commands as unknown as JsonValue },
    ...(input.meta ? { meta: input.meta } : {}),
  }
}

/** 解析不允许嵌套的 transaction.batch 子命令。 @public */
export function asBatchCommands(command: EditorCommand): readonly EditorCommand[] | CommandIssue {
  const value = valueAt(command.payload, 'commands')
  if (!Array.isArray(value)) {
    return { code: 'batch.invalid', message: 'transaction.batch commands 必须是数组' }
  }
  const commands: EditorCommand[] = []
  for (const item of value) {
    if (
      !isRecord(item)
      || typeof item.id !== 'string'
      || typeof item.type !== 'string'
      || !isRecord(item.payload)
    ) return { code: 'batch.invalid-command', message: 'batch 子命令结构无效' }
    if (item.type === BUILTIN_COMMAND_TYPES.batch) {
      return { code: 'batch.nested', message: 'transaction.batch 不允许嵌套' }
    }
    commands.push(item as unknown as EditorCommand)
  }
  return commands
}
