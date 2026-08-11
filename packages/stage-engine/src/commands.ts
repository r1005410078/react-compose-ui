import {
  BUILTIN_COMMAND_TYPES,
  getComposeHierarchy,
  getComposeLayout,
  getComposeLayoutItem,
  getComposeLock,
  getComposeSpatialTransform,
  resolveComposeAppearance,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutItem,
  type ComposeLayoutSnapshot,
  type ComposeSpatialTransform,
  type EditorCommand,
  type JsonObject,
  type JsonValue,
} from '@compose-ui/core'
import {
  decomposeMatrix,
  getEntityParentId,
  getEntityWorldBounds,
  getEntityWorldMatrix,
  invertMatrix,
  multiplyMatrices,
  toComposeTransform,
  translationMatrix,
  unionRects,
} from './geometry'
import { describeEntityTargets } from './transaction-labels'

/** 结构命令的稳定可用性结果。 @public */
export type ComposeStructureCommandAvailability =
  | { readonly available: true }
  | { readonly available: false; readonly reason: string }

/** 同级节点绘制顺序操作；越靠后的 sibling 越位于前景。 @public */
export type ComposeLayerOrderOperation =
  | 'bring-forward'
  | 'send-backward'
  | 'bring-to-front'
  | 'send-to-back'

interface LayerOrderGroup {
  readonly parentId: string | null
  readonly siblings: readonly string[]
  readonly selectedIds: readonly string[]
}

interface LayerOrderMove {
  readonly entityIds: readonly string[]
  readonly parentId: string | null
  readonly index: number
}

const LAYER_ORDER_UNAVAILABLE_REASON = '选中节点已位于目标层级或不可移动'

const LAYER_ORDER_LABELS: Readonly<Record<ComposeLayerOrderOperation, string>> = {
  'bring-forward': 'Bring forward',
  'send-backward': 'Send backward',
  'bring-to-front': 'Bring to front',
  'send-to-back': 'Send to back',
}

function collectLayerOrderGroups(
  document: ComposeDocument,
  entityIds: readonly string[],
): readonly LayerOrderGroup[] {
  const requested = new Set(entityIds)
  const result: LayerOrderGroup[] = []
  const visit = (
    siblings: readonly string[],
    parentId: string | null,
    ancestorLocked: boolean,
  ) => {
    const parent = parentId === null ? null : document.entities[parentId]
    const parentLocked = ancestorLocked || Boolean(parent && getComposeLock(parent).locked)
    const selectedIds = parentLocked
      ? []
      : siblings.filter((id) => {
          const entity = document.entities[id]
          return requested.has(id) && entity !== undefined && !getComposeLock(entity).locked
        })
    if (selectedIds.length > 0) result.push({ parentId, siblings, selectedIds })
    siblings.forEach((id) => {
      const entity = document.entities[id]
      const hierarchy = entity && getComposeHierarchy(entity)
      if (hierarchy) {
        visit(
          hierarchy.childIds,
          id,
          parentLocked || getComposeLock(entity).locked,
        )
      }
    })
  }
  visit(document.rootIds, null, false)
  return result
}

function selectedBlocks(
  siblings: readonly string[],
  selectedIds: readonly string[],
): readonly { readonly start: number; readonly end: number; readonly ids: readonly string[] }[] {
  const selected = new Set(selectedIds)
  const result: Array<{ start: number; end: number; ids: string[] }> = []
  let current: { start: number; end: number; ids: string[] } | null = null
  siblings.forEach((id, index) => {
    if (!selected.has(id)) {
      current = null
      return
    }
    if (!current) {
      current = { start: index, end: index, ids: [id] }
      result.push(current)
      return
    }
    current.end = index
    current.ids.push(id)
  })
  return result
}

function layerOrderMoves(
  group: LayerOrderGroup,
  operation: ComposeLayerOrderOperation,
): readonly LayerOrderMove[] {
  const { parentId, selectedIds, siblings } = group
  const selected = new Set(selectedIds)
  if (operation === 'bring-to-front') {
    const trailing = siblings.slice(siblings.length - selectedIds.length)
    return trailing.every((id) => selected.has(id))
      ? []
      : [{ entityIds: selectedIds, parentId, index: siblings.length }]
  }
  if (operation === 'send-to-back') {
    const leading = siblings.slice(0, selectedIds.length)
    return leading.every((id) => selected.has(id))
      ? []
      : [{ entityIds: selectedIds, parentId, index: 0 }]
  }
  const blocks = selectedBlocks(siblings, selectedIds)
  if (operation === 'bring-forward') {
    return [...blocks].reverse().flatMap((block) => (
      block.end < siblings.length - 1 && !selected.has(siblings[block.end + 1]!)
        ? [{ entityIds: block.ids, parentId, index: block.end + 2 }]
        : []
    ))
  }
  return blocks.flatMap((block) => (
    block.start > 0 && !selected.has(siblings[block.start - 1]!)
      ? [{ entityIds: block.ids, parentId, index: block.start - 1 }]
      : []
  ))
}

function planLayerOrderMoves(
  document: ComposeDocument,
  entityIds: readonly string[],
  operation: ComposeLayerOrderOperation,
) {
  return collectLayerOrderGroups(document, entityIds)
    .flatMap((group) => layerOrderMoves(group, operation))
}

/** 判断当前选择能否继续执行指定同级层级操作。 @public */
export function getLayerOrderCommandAvailability(
  document: ComposeDocument,
  entityIds: readonly string[],
  operation: ComposeLayerOrderOperation,
): ComposeStructureCommandAvailability {
  return planLayerOrderMoves(document, entityIds, operation).length > 0
    ? { available: true }
    : { available: false, reason: LAYER_ORDER_UNAVAILABLE_REASON }
}

/**
 * 创建只重排同级数组的原子层级命令。
 *
 * @returns 一个 `entity.move`、跨块/父级 batch，或在无变化时返回 `null`。
 * @public
 */
export function createLayerOrderCommand(
  document: ComposeDocument,
  entityIds: readonly string[],
  operation: ComposeLayerOrderOperation,
  commandId = `layer-order:${operation}:${entityIds.join(',')}`,
): EditorCommand | null {
  const moves = planLayerOrderMoves(document, entityIds, operation)
  if (moves.length === 0) return null
  const movedIds = [...new Set(moves.flatMap(({ entityIds: ids }) => ids))]
  const meta = {
    label: `${LAYER_ORDER_LABELS[operation]} ${describeEntityTargets(document, movedIds)}`,
    source: 'stage',
    targetIds: movedIds,
  } as const
  const commands: EditorCommand[] = moves.map((move, index) => ({
    id: `${commandId}:${index}`,
    type: BUILTIN_COMMAND_TYPES.moveEntity,
    payload: {
      entityIds: [...move.entityIds],
      parentId: move.parentId,
      index: move.index,
    },
  }))
  if (commands.length === 1) return { ...commands[0]!, id: commandId, meta }
  return {
    id: commandId,
    type: BUILTIN_COMMAND_TYPES.batch,
    payload: { commands: commands as unknown as JsonValue },
    meta,
  }
}

const FLOW_GROUP_REASON = '自动布局 Flow 子项不能参与 Group；请先转为 Absolute'
const FLOW_UNGROUP_REASON = '自动布局 Flow 子项不能参与 Ungroup；请先转为 Absolute'

/** 判断当前选择是否允许 Group。 @public */
export function getGroupCommandAvailability(
  document: ComposeDocument,
  entityIds: readonly string[],
): ComposeStructureCommandAvailability {
  return entityIds.some((id) => {
    const entity = document.entities[id]
    return entity && getComposeLayoutItem(entity).positioning === 'flow'
  })
    ? { available: false, reason: FLOW_GROUP_REASON }
    : { available: true }
}

/** 判断 Container 及其直接子项是否允许 Ungroup。 @public */
export function getUngroupCommandAvailability(
  document: ComposeDocument,
  containerId: string,
): ComposeStructureCommandAvailability {
  const container = document.entities[containerId]
  const hierarchy = container && getComposeHierarchy(container)
  const containsFlow = Boolean(
    container
    && (
      getComposeLayoutItem(container).positioning === 'flow'
      || hierarchy?.childIds.some((id) => {
        const child = document.entities[id]
        return child && getComposeLayoutItem(child).positioning === 'flow'
      })
    ),
  )
  return containsFlow
    ? { available: false, reason: FLOW_UNGROUP_REASON }
    : { available: true }
}

function transformUnderParent(
  document: ComposeDocument,
  layoutSnapshot: ComposeLayoutSnapshot,
  worldMatrix: ReturnType<typeof getEntityWorldMatrix>,
  parentId: string | null,
  width: number,
  height: number,
): ComposeSpatialTransform {
  const parentWorld = parentId
    ? getEntityWorldMatrix(document, layoutSnapshot, parentId)
    : null
  const local = parentWorld
    ? multiplyMatrices(invertMatrix(parentWorld), worldMatrix)
    : worldMatrix
  return toComposeTransform(decomposeMatrix(local, width, height))
}

/** 创建保持后代世界几何不变的 entity.group 命令。 @public */
export function createGroupCommand(
  document: ComposeDocument,
  layoutSnapshot: ComposeLayoutSnapshot,
  entityIds: readonly string[],
  containerId: string,
  commandId = `group:${containerId}`,
): EditorCommand {
  const bounds = unionRects(entityIds
    .filter((id) => Boolean(document.entities[id]))
    .map((id) => getEntityWorldBounds(document, layoutSnapshot, id)))
  const parentId = entityIds[0] ? getEntityParentId(document, entityIds[0]) : null
  const safeBounds = bounds ?? { x: 0, y: 0, width: 1, height: 1 }
  const groupWorld = translationMatrix(safeBounds.x, safeBounds.y)
  const groupTransform = transformUnderParent(
    document,
    layoutSnapshot,
    groupWorld,
    parentId,
    safeBounds.width,
    safeBounds.height,
  )
  const container: ComposeEntity = {
    id: containerId,
    name: 'Container',
    components: {
      Composition: {
        presetId: null,
        baseComponentKeys: [
          'Transform',
          'LayoutItem',
          'Visibility',
          'Lock',
          'Hierarchy',
          'Clip',
          'Appearance',
        ],
        capabilityIds: [],
      },
      Transform: { rotation: groupTransform.rotation },
      LayoutItem: {
        positioning: 'absolute',
        offset: groupTransform.position,
        width: { mode: 'fixed', value: groupTransform.size.width, min: 1, max: null },
        height: { mode: 'fixed', value: groupTransform.size.height, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      Hierarchy: { childIds: [...entityIds] },
      Clip: { enabled: false },
      Appearance: {
        backgroundPaint: { kind: 'solid', color: 'transparent' },
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 0,
        opacity: 1,
        shadow: null,
      },
    },
  }
  const childTransforms: Record<string, JsonValue> = {}
  for (const entityId of entityIds) {
    const entity = document.entities[entityId]
    if (!entity) continue
    const box = layoutSnapshot.boxes[entityId]
    if (!box) continue
    childTransforms[entityId] = toComposeTransform(decomposeMatrix(
      multiplyMatrices(
        invertMatrix(groupWorld),
        getEntityWorldMatrix(document, layoutSnapshot, entityId),
      ),
      box.width,
      box.height,
    )) as unknown as JsonValue
  }
  return {
    id: commandId,
    type: BUILTIN_COMMAND_TYPES.groupEntity,
    payload: {
      container: container as unknown as JsonValue,
      entityIds,
      childTransforms,
    },
    meta: {
      label: `Group ${describeEntityTargets(document, entityIds)}`,
      source: 'stage',
      targetIds: entityIds,
    },
  }
}

/** 创建保持后代世界几何不变的 entity.ungroup 命令。 @public */
export function createUngroupCommand(
  document: ComposeDocument,
  layoutSnapshot: ComposeLayoutSnapshot,
  containerId: string,
  commandId = `ungroup:${containerId}`,
): EditorCommand {
  const container = document.entities[containerId]
  const hierarchy = container && getComposeHierarchy(container)
  const parentId = getEntityParentId(document, containerId)
  const childTransforms: Record<string, JsonValue> = {}
  for (const childId of hierarchy?.childIds ?? []) {
    const child = document.entities[childId]
    const box = layoutSnapshot.boxes[childId]
    if (!child || !box) continue
    childTransforms[childId] = transformUnderParent(
      document,
      layoutSnapshot,
      getEntityWorldMatrix(document, layoutSnapshot, childId),
      parentId,
      box.width,
      box.height,
    ) as unknown as JsonValue
  }
  return {
    id: commandId,
    type: BUILTIN_COMMAND_TYPES.ungroupEntity,
    payload: { containerId, childTransforms },
    meta: {
      label: `Ungroup ${container?.name ?? 'Container'}`,
      source: 'stage',
      targetIds: [containerId],
    },
  }
}

/** 创建原子 reparent batch，并把每个目标的世界矩阵分解到新父级。 @public */
export function createReparentCommand(
  document: ComposeDocument,
  layoutSnapshot: ComposeLayoutSnapshot,
  entityIds: readonly string[],
  parentId: string | null,
  index: number,
  commandId = `reparent:${entityIds.join(',')}`,
): EditorCommand {
  const targetManagesFlow = Boolean(
    parentId && document.entities[parentId] && getComposeLayout(document.entities[parentId]!),
  )
  const targetBorder = parentId && document.entities[parentId]
    ? resolveComposeAppearance(document.entities[parentId]!).borderWidth
    : 0
  const updates = entityIds.map((entityId) => {
    const entity = document.entities[entityId]
    const box = layoutSnapshot.boxes[entityId]
    const transform = entity && box
      ? transformUnderParent(
          document,
          layoutSnapshot,
          getEntityWorldMatrix(document, layoutSnapshot, entityId),
          parentId,
          box.width,
          box.height,
        )
      : {
          position: { x: 0, y: 0 },
          size: { width: 1, height: 1 },
          rotation: 0,
        }
    const currentItem = entity ? getComposeLayoutItem(entity) : null
    const item: ComposeLayoutItem | null = currentItem
      ? targetManagesFlow
        ? { ...currentItem, positioning: 'flow' }
        : {
            ...currentItem,
            positioning: 'absolute',
            offset: {
              x: transform.position.x - targetBorder,
              y: transform.position.y - targetBorder,
            },
            width: currentItem.width.mode === 'fill'
              ? { ...currentItem.width, mode: 'fixed', value: transform.size.width }
              : currentItem.width,
            height: currentItem.height.mode === 'fill'
              ? { ...currentItem.height, mode: 'fixed', value: transform.size.height }
              : currentItem.height,
          }
      : null
    return {
      entityId,
      transform,
      item,
    }
  })
  const moveCommand: EditorCommand = {
    id: `${commandId}:move`,
    type: BUILTIN_COMMAND_TYPES.moveEntity,
    payload: { entityIds, parentId, index },
  }
  const componentCommands: EditorCommand[] = updates.flatMap(({ entityId, transform, item }) => item
    ? [
        {
          id: `${commandId}:${entityId}:layout-item`,
          type: BUILTIN_COMMAND_TYPES.updateComponent,
          payload: { entityId, key: 'LayoutItem', value: item },
        },
        {
          id: `${commandId}:${entityId}:transform`,
          type: BUILTIN_COMMAND_TYPES.updateComponent,
          payload: {
            entityId,
            key: 'Transform',
            value: { rotation: transform.rotation },
          },
        },
      ]
    : [])
  // batch 会逐子命令严格校验：移出 Layout 时须先转 Absolute，移入时则先建立目标父子关系。
  const commands = targetManagesFlow
    ? [moveCommand, ...componentCommands]
    : [...componentCommands, moveCommand]
  return {
    id: commandId,
    type: BUILTIN_COMMAND_TYPES.batch,
    payload: { commands: commands as unknown as JsonValue },
    meta: {
      label: `Move ${describeEntityTargets(document, entityIds)}`
        + ` to ${parentId ? document.entities[parentId]?.name ?? 'Container' : 'Canvas'}`,
      source: 'stage',
      targetIds: entityIds,
    },
  }
}

function subtreeIds(document: ComposeDocument, rootId: string) {
  const result: string[] = []
  const visit = (id: string) => {
    const entity = document.entities[id]
    if (!entity) return
    result.push(id)
    getComposeHierarchy(entity)?.childIds.forEach(visit)
  }
  visit(rootId)
  return result
}

/** 为一个 Entity 子树创建 entity.duplicate 命令。 @public */
export function createDuplicateCommand(
  document: ComposeDocument,
  sourceId: string,
  idFactory: () => string,
  commandId = `duplicate:${sourceId}`,
): { readonly command: EditorCommand; readonly rootId: string } | null {
  const source = document.entities[sourceId]
  if (!source) return null
  const ids = subtreeIds(document, sourceId)
  const remap = new Map(ids.map((id) => [id, idFactory()]))
  const entities: Record<string, JsonValue> = {}
  for (const id of ids) {
    const entity = document.entities[id]
    const cloneId = remap.get(id)
    if (!entity || !cloneId) continue
    const clone = structuredClone(entity) as ComposeEntity
    const item = getComposeLayoutItem(clone)
    const transform = getComposeSpatialTransform(clone)
    const hierarchy = getComposeHierarchy(clone)
    const nextTransform: ComposeSpatialTransform = id === sourceId && item.positioning === 'absolute'
      ? {
          ...transform,
          position: {
            x: transform.position.x + 10,
            y: transform.position.y + 10,
          },
        }
      : transform
    const next: ComposeEntity = {
      ...clone,
      id: cloneId,
      name: `${clone.name} 副本`,
      components: {
        ...clone.components,
        Transform: { rotation: nextTransform.rotation },
        LayoutItem: {
          ...clone.components.LayoutItem,
          offset: nextTransform.position,
          width: {
            ...(clone.components.LayoutItem?.width as JsonObject),
            value: nextTransform.size.width,
          },
          height: {
            ...(clone.components.LayoutItem?.height as JsonObject),
            value: nextTransform.size.height,
          },
        },
        ...(hierarchy
          ? {
              Hierarchy: {
                childIds: hierarchy.childIds.map((childId) =>
                  remap.get(childId) ?? childId),
              },
            }
          : {}),
      },
    }
    entities[cloneId] = next as unknown as JsonValue
  }
  const rootId = remap.get(sourceId)
  if (!rootId) return null
  const parentId = getEntityParentId(document, sourceId)
  const siblings = parentId
    ? getComposeHierarchy(document.entities[parentId]!)?.childIds ?? []
    : document.rootIds
  return {
    rootId,
    command: {
      id: commandId,
      type: BUILTIN_COMMAND_TYPES.duplicateEntity,
      payload: {
        entities: entities as unknown as JsonObject,
        rootIds: [rootId],
        parentId,
        index: Math.max(0, siblings.indexOf(sourceId) + 1),
      },
      meta: {
        label: `Duplicate ${source.name}`,
        source: 'stage',
        targetIds: [sourceId],
      },
    },
  }
}
