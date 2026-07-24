import type {
  ComposeDocument,
  ComposeGroupNode,
  ComposeNode,
  JsonObject,
  JsonValue,
  NodeTransform,
} from './document-types'
import type {
  CommandHandler,
  CommandHandlerResult,
  CommandIssue,
  DocumentPatch,
  EditorCommand,
} from './command-types'

/**
 * core 首版内置命令的稳定 type。
 *
 * @public
 */
export const BUILTIN_COMMAND_TYPES = {
  createFrame: 'frame.create',
  createNode: 'node.create',
  deleteNode: 'node.delete',
  duplicateNode: 'node.duplicate',
  moveNode: 'node.move',
  renameNode: 'node.rename',
  setVisibility: 'node.set-visibility',
  setLocked: 'node.set-locked',
  setProps: 'node.props.set',
  resetProps: 'node.props.reset',
  setTransform: 'node.transform.set',
  groupNode: 'node.group',
  ungroupNode: 'node.ungroup',
  batch: 'transaction.batch',
} as const

type Location = { parentId: string | null; index: number }
type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function issue(code: string, message: string): CommandHandlerResult {
  return { status: 'rejected', issues: [{ code, message }] }
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

function asPath(value: unknown): readonly (string | number)[] | null {
  return Array.isArray(value)
    && value.every((item) => typeof item === 'string' || Number.isInteger(item))
    ? value as readonly (string | number)[]
    : null
}

function asIndex(value: unknown, fallback: number): number | null {
  if (value === undefined) return fallback
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function asNode(value: unknown): ComposeNode | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null
  if (value.kind !== 'frame' && value.kind !== 'group' && value.kind !== 'component') return null
  return value as unknown as ComposeNode
}

function asTransform(value: unknown): NodeTransform | null {
  if (!isRecord(value)) return null
  const fields = ['x', 'y', 'width', 'height', 'rotation'] as const
  if (!fields.every((field) => typeof value[field] === 'number')) return null
  return value as unknown as NodeTransform
}

function childIds(document: ComposeDocument, parentId: string | null): readonly string[] | null {
  if (parentId === null) return document.rootIds
  const parent = document.nodes[parentId]
  return parent && parent.kind !== 'component' ? parent.childIds : null
}

function childPath(parentId: string | null): readonly (string | number)[] {
  return parentId === null ? ['rootIds'] : ['nodes', parentId, 'childIds']
}

function buildLocations(document: ComposeDocument) {
  const locations = new Map<string, Location>()
  document.rootIds.forEach((id, index) => locations.set(id, { parentId: null, index }))
  for (const node of Object.values(document.nodes)) {
    if (node.kind === 'component') continue
    node.childIds.forEach((id, index) => locations.set(id, { parentId: node.id, index }))
  }
  return locations
}

function collectSubtree(document: ComposeDocument, rootId: string) {
  const ids: string[] = []
  const stack = [rootId]
  while (stack.length > 0) {
    const id = stack.pop()
    if (!id || ids.includes(id)) continue
    ids.push(id)
    const node = document.nodes[id]
    if (node && node.kind !== 'component') stack.push(...[...node.childIds].reverse())
  }
  return ids
}

function documentOrder(document: ComposeDocument) {
  const ids: string[] = []
  const stack = [...document.rootIds].reverse()
  while (stack.length > 0) {
    const id = stack.pop()
    if (!id) continue
    ids.push(id)
    const node = document.nodes[id]
    if (node && node.kind !== 'component') stack.push(...[...node.childIds].reverse())
  }
  return ids
}

function normalizeRoots(document: ComposeDocument, requested: readonly string[]) {
  const requestedSet = new Set(requested)
  const descendants = new Set<string>()
  for (const id of requested) {
    for (const descendant of collectSubtree(document, id).slice(1)) descendants.add(descendant)
  }
  return documentOrder(document).filter((id) => requestedSet.has(id) && !descendants.has(id))
}

function validateTargets(
  document: ComposeDocument,
  nodeIds: readonly string[],
  options: { allowLocked?: boolean } = {},
): CommandIssue[] {
  const issues: CommandIssue[] = []
  for (const nodeId of nodeIds) {
    const node = document.nodes[nodeId]
    if (!node) issues.push({ code: 'node.missing', message: `节点 ${nodeId} 不存在` })
    else if (node.locked && !options.allowLocked) {
      issues.push({ code: 'node.locked', message: `节点 ${nodeId} 已锁定` })
    }
  }
  return issues
}

function createFrameHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.createFrame,
    execute(document, command) {
      const node = asNode(valueAt(command.payload, 'node'))
      if (!node || node.kind !== 'frame') return issue('frame.invalid', 'frame.create 需要 Frame node')
      if (document.nodes[node.id]) return issue('node.duplicate-id', `节点 ${node.id} 已存在`)
      const index = asIndex(valueAt(command.payload, 'index'), document.rootIds.length)
      if (index === null || index < 0 || index > document.rootIds.length) {
        return issue('node.invalid-index', 'Frame 插入位置无效')
      }
      return patches([
        {
          op: 'set',
          path: ['nodes', node.id],
          value: node as unknown as JsonValue,
        },
        { op: 'insert', path: ['rootIds'], index, value: node.id },
      ])
    },
  }
}

function createNodeHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.createNode,
    execute(document, command) {
      const node = asNode(valueAt(command.payload, 'node'))
      const parentId = valueAt(command.payload, 'parentId')
      if (!node || node.kind === 'frame') return issue('node.invalid', 'node.create 需要 Group 或 Component')
      if (typeof parentId !== 'string') return issue('node.invalid-parent', '普通节点必须属于 Frame 或 Group')
      if (document.nodes[node.id]) return issue('node.duplicate-id', `节点 ${node.id} 已存在`)
      const parent = document.nodes[parentId]
      if (!parent || parent.kind === 'component') return issue('node.invalid-parent', `父节点 ${parentId} 无效`)
      if (parent.locked) return issue('node.locked', `父节点 ${parentId} 已锁定`)
      const index = asIndex(valueAt(command.payload, 'index'), parent.childIds.length)
      if (index === null || index < 0 || index > parent.childIds.length) {
        return issue('node.invalid-index', '节点插入位置无效')
      }
      return patches([
        {
          op: 'set',
          path: ['nodes', node.id],
          value: node as unknown as JsonValue,
        },
        {
          op: 'insert',
          path: ['nodes', parentId, 'childIds'],
          index,
          value: node.id,
        },
      ])
    },
  }
}

function deleteNodeHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.deleteNode,
    execute(document, command) {
      const requested = asStringArray(valueAt(command.payload, 'nodeIds'))
      if (!requested || requested.length === 0) return issue('node.invalid-targets', 'nodeIds 不能为空')
      const roots = normalizeRoots(document, requested)
      const allIds = roots.flatMap((id) => collectSubtree(document, id))
      const targetIssues = validateTargets(document, allIds)
      if (targetIssues.length > 0) return { status: 'rejected', issues: targetIssues }
      const locations = buildLocations(document)
      const byParent = new Map<string | null, number[]>()
      for (const rootId of roots) {
        const location = locations.get(rootId)
        if (!location) return issue('node.missing', `节点 ${rootId} 没有场景位置`)
        const indexes = byParent.get(location.parentId) ?? []
        indexes.push(location.index)
        byParent.set(location.parentId, indexes)
      }
      const result: DocumentPatch[] = []
      for (const [parentId, indexes] of byParent) {
        for (const index of [...indexes].sort((a, b) => b - a)) {
          result.push({ op: 'remove', path: [...childPath(parentId), index] })
        }
      }
      for (const nodeId of [...allIds].reverse()) {
        result.push({ op: 'remove', path: ['nodes', nodeId] })
      }
      return patches(result)
    },
  }
}

function moveNodeHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.moveNode,
    execute(document, command) {
      const requested = asStringArray(valueAt(command.payload, 'nodeIds'))
      const parentValue = valueAt(command.payload, 'parentId')
      const parentId = parentValue === null || typeof parentValue === 'string' ? parentValue : undefined
      if (!requested || requested.length === 0 || parentId === undefined) {
        return issue('node.invalid-targets', 'node.move 参数无效')
      }
      const moving = normalizeRoots(document, requested)
      const targetIssues = validateTargets(document, moving)
      if (targetIssues.length > 0) return { status: 'rejected', issues: targetIssues }
      const movingNodes = moving.map((id) => document.nodes[id])
      const framesOnly = movingNodes.every((node) => node.kind === 'frame')
      const ordinaryOnly = movingNodes.every((node) => node.kind !== 'frame')
      if ((!framesOnly && !ordinaryOnly) || (framesOnly && parentId !== null) || (ordinaryOnly && parentId === null)) {
        return issue('node.invalid-parent', 'Frame 与普通节点不能混合或移动到错误层级')
      }
      if (parentId !== null) {
        const parent = document.nodes[parentId]
        if (!parent || parent.kind === 'component') return issue('node.invalid-parent', `父节点 ${parentId} 无效`)
        if (parent.locked) return issue('node.locked', `父节点 ${parentId} 已锁定`)
        if (moving.some((id) => collectSubtree(document, id).includes(parentId))) {
          return issue('node.cycle', '不能把节点移动到自身后代')
        }
      }
      const targetChildren = childIds(document, parentId)
      if (!targetChildren) return issue('node.invalid-parent', '目标父节点无效')
      const requestedIndex = asIndex(valueAt(command.payload, 'index'), targetChildren.length)
      if (requestedIndex === null || requestedIndex < 0 || requestedIndex > targetChildren.length) {
        return issue('node.invalid-index', '移动目标索引无效')
      }

      const locations = buildLocations(document)
      const byParent = new Map<string | null, number[]>()
      for (const nodeId of moving) {
        const location = locations.get(nodeId)
        if (!location) return issue('node.missing', `节点 ${nodeId} 没有场景位置`)
        const indexes = byParent.get(location.parentId) ?? []
        indexes.push(location.index)
        byParent.set(location.parentId, indexes)
      }
      const removedBefore = moving.filter((id) => {
        const location = locations.get(id)
        return location?.parentId === parentId && location.index < requestedIndex
      }).length
      const result: DocumentPatch[] = []
      for (const [sourceParentId, indexes] of byParent) {
        for (const index of [...indexes].sort((a, b) => b - a)) {
          result.push({ op: 'remove', path: [...childPath(sourceParentId), index] })
        }
      }
      const remainingLength = targetChildren.length
        - (byParent.get(parentId)?.length ?? 0)
      const targetIndex = Math.min(
        Math.max(0, requestedIndex - removedBefore),
        remainingLength,
      )
      moving.forEach((nodeId, offset) => result.push({
        op: 'insert',
        path: childPath(parentId),
        index: targetIndex + offset,
        value: nodeId,
      }))
      return patches(result)
    },
  }
}

function duplicateNodeHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.duplicateNode,
    execute(document, command) {
      const nodeValues = valueAt(command.payload, 'nodes')
      const rootIds = asStringArray(valueAt(command.payload, 'rootIds'))
      const parentValue = valueAt(command.payload, 'parentId')
      const parentId = parentValue === null || typeof parentValue === 'string' ? parentValue : undefined
      if (!isRecord(nodeValues) || !rootIds || rootIds.length === 0 || parentId === undefined) {
        return issue('node.invalid-duplicate', 'node.duplicate 参数无效')
      }
      const entries = Object.entries(nodeValues)
      if (entries.length === 0) return issue('node.invalid-duplicate', '复制节点不能为空')
      for (const [id, value] of entries) {
        const node = asNode(value)
        if (!node || node.id !== id) return issue('node.invalid-duplicate', `复制节点 ${id} 无效`)
        if (document.nodes[id]) return issue('node.duplicate-id', `节点 ${id} 已存在`)
      }
      const roots = rootIds.map((id) => asNode(nodeValues[id]))
      if (roots.some((node) => !node)) return issue('node.invalid-duplicate', '复制 rootIds 不完整')
      if (parentId === null && roots.some((node) => node?.kind !== 'frame')) {
        return issue('node.invalid-parent', '只有 Frame 可以复制到根级')
      }
      if (parentId !== null && roots.some((node) => node?.kind === 'frame')) {
        return issue('node.invalid-parent', 'Frame 不能复制到普通父节点')
      }
      const target = childIds(document, parentId)
      if (!target) return issue('node.invalid-parent', '复制目标父节点无效')
      if (parentId !== null && document.nodes[parentId]?.locked) {
        return issue('node.locked', `父节点 ${parentId} 已锁定`)
      }
      const index = asIndex(valueAt(command.payload, 'index'), target.length)
      if (index === null || index < 0 || index > target.length) {
        return issue('node.invalid-index', '复制目标索引无效')
      }
      const result: DocumentPatch[] = entries.map(([id, node]) => ({
        op: 'set',
        path: ['nodes', id],
        value: node as JsonValue,
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

function simpleNodeHandler(
  type: string,
  field: 'name' | 'visible' | 'locked',
): CommandHandler {
  return {
    type,
    execute(document, command) {
      const ids = field === 'name'
        ? [valueAt(command.payload, 'nodeId')].filter((id): id is string => typeof id === 'string')
        : asStringArray(valueAt(command.payload, 'nodeIds'))
      if (!ids || ids.length === 0) return issue('node.invalid-targets', '命令目标不能为空')
      const targetIssues = validateTargets(document, ids, { allowLocked: field === 'locked' })
      if (targetIssues.length > 0) return { status: 'rejected', issues: targetIssues }
      const nextValue = valueAt(command.payload, field)
      if (
        (field === 'name' && (typeof nextValue !== 'string' || nextValue.trim().length === 0))
        || (field !== 'name' && typeof nextValue !== 'boolean')
      ) {
        return issue('node.invalid-value', `${field} 值无效`)
      }
      return patches(ids.map((id) => ({
        op: 'set',
        path: ['nodes', id, field],
        value: nextValue as JsonValue,
      })))
    },
  }
}

function propsHandler(type: string): CommandHandler {
  return {
    type,
    execute(document, command) {
      const nodeId = valueAt(command.payload, 'nodeId')
      const path = asPath(valueAt(command.payload, 'path'))
      if (typeof nodeId !== 'string' || !path) return issue('node.invalid-targets', '属性命令参数无效')
      const node = document.nodes[nodeId]
      if (!node || node.kind !== 'component') return issue('node.invalid-kind', '属性目标必须是 Component')
      if (node.locked) return issue('node.locked', `节点 ${nodeId} 已锁定`)
      const value = valueAt(command.payload, 'value') as JsonValue
      return patches([{
        op: 'set',
        path: ['nodes', nodeId, 'props', ...path],
        value,
      }])
    },
  }
}

function transformHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.setTransform,
    execute(document, command) {
      const updates = valueAt(command.payload, 'updates')
      if (!Array.isArray(updates) || updates.length === 0) {
        return issue('node.invalid-transform', 'transform updates 不能为空')
      }
      const result: DocumentPatch[] = []
      for (const update of updates) {
        if (!isRecord(update) || typeof update.nodeId !== 'string') {
          return issue('node.invalid-transform', 'transform update 参数无效')
        }
        const node = document.nodes[update.nodeId]
        if (!node) return issue('node.missing', `节点 ${update.nodeId} 不存在`)
        if (node.locked) return issue('node.locked', `节点 ${update.nodeId} 已锁定`)
        const transform = asTransform(update.transform)
        if (!transform) return issue('node.invalid-transform', `节点 ${update.nodeId} transform 无效`)
        result.push({
          op: 'set',
          path: ['nodes', update.nodeId, 'transform'],
          value: transform as unknown as JsonValue,
        })
      }
      return patches(result)
    },
  }
}

function groupHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.groupNode,
    execute(document, command) {
      const groupValue = asNode(valueAt(command.payload, 'group'))
      const requested = asStringArray(valueAt(command.payload, 'nodeIds'))
      const transformValues = valueAt(command.payload, 'childTransforms')
      if (
        !groupValue
        || groupValue.kind !== 'group'
        || !requested
        || requested.length < 2
        || !isRecord(transformValues)
      ) {
        return issue('group.invalid', 'node.group 参数无效')
      }
      if (document.nodes[groupValue.id]) return issue('node.duplicate-id', `节点 ${groupValue.id} 已存在`)
      const nodes = normalizeRoots(document, requested)
      if (nodes.length !== requested.length || nodes.some((id) => document.nodes[id]?.kind === 'frame')) {
        return issue('group.invalid-targets', 'Group 只能包含同级非 Frame 节点')
      }
      const targetIssues = validateTargets(document, nodes)
      if (targetIssues.length > 0) return { status: 'rejected', issues: targetIssues }
      const locations = buildLocations(document)
      const first = locations.get(nodes[0])
      if (!first || first.parentId === null) return issue('group.invalid-parent', 'Group 必须位于 Frame 子树')
      if (nodes.some((id) => locations.get(id)?.parentId !== first.parentId)) {
        return issue('group.invalid-parent', '待分组节点必须具有同一直接父节点')
      }
      const parent = document.nodes[first.parentId]
      if (parent?.locked) return issue('node.locked', `父节点 ${first.parentId} 已锁定`)
      const indexes = nodes.map((id) => locations.get(id)?.index ?? -1)
      const result: DocumentPatch[] = [...indexes]
        .sort((a, b) => b - a)
        .map((index) => ({ op: 'remove', path: [...childPath(first.parentId), index] }))
      const group: ComposeGroupNode = { ...groupValue, childIds: nodes }
      result.push({
        op: 'set',
        path: ['nodes', group.id],
        value: group as unknown as JsonValue,
      })
      result.push({
        op: 'insert',
        path: childPath(first.parentId),
        index: Math.min(...indexes),
        value: group.id,
      })
      for (const nodeId of nodes) {
        const transform = asTransform(transformValues[nodeId])
        if (!transform) return issue('group.invalid-transform', `节点 ${nodeId} 缺少局部 transform`)
        result.push({
          op: 'set',
          path: ['nodes', nodeId, 'transform'],
          value: transform as unknown as JsonValue,
        })
      }
      return patches(result)
    },
  }
}

function ungroupHandler(): CommandHandler {
  return {
    type: BUILTIN_COMMAND_TYPES.ungroupNode,
    execute(document, command) {
      const groupId = valueAt(command.payload, 'groupId')
      const transformValues = valueAt(command.payload, 'childTransforms')
      if (typeof groupId !== 'string' || !isRecord(transformValues)) {
        return issue('group.invalid', 'node.ungroup 参数无效')
      }
      const group = document.nodes[groupId]
      if (!group || group.kind !== 'group') return issue('group.invalid', `Group ${groupId} 不存在`)
      if (group.locked) return issue('node.locked', `Group ${groupId} 已锁定`)
      const targetIssues = validateTargets(document, group.childIds)
      if (targetIssues.length > 0) return { status: 'rejected', issues: targetIssues }
      const location = buildLocations(document).get(groupId)
      if (!location || location.parentId === null) return issue('group.invalid-parent', 'Group 父节点无效')
      if (document.nodes[location.parentId]?.locked) {
        return issue('node.locked', `父节点 ${location.parentId} 已锁定`)
      }
      const result: DocumentPatch[] = [{
        op: 'remove',
        path: [...childPath(location.parentId), location.index],
      }]
      group.childIds.forEach((nodeId, offset) => result.push({
        op: 'insert',
        path: childPath(location.parentId),
        index: location.index + offset,
        value: nodeId,
      }))
      for (const nodeId of group.childIds) {
        const transform = asTransform(transformValues[nodeId])
        if (!transform) return issue('group.invalid-transform', `节点 ${nodeId} 缺少父级 transform`)
        result.push({
          op: 'set',
          path: ['nodes', nodeId, 'transform'],
          value: transform as unknown as JsonValue,
        })
      }
      result.push({ op: 'remove', path: ['nodes', groupId] })
      return patches(result)
    },
  }
}

/**
 * 创建首版 ComposeDocument 内置命令处理器。
 *
 * @returns 每次调用都返回没有可变共享状态的新 handler 列表。
 * @public
 */
export function createBuiltinCommandHandlers(): readonly CommandHandler[] {
  return [
    createFrameHandler(),
    createNodeHandler(),
    deleteNodeHandler(),
    duplicateNodeHandler(),
    moveNodeHandler(),
    simpleNodeHandler(BUILTIN_COMMAND_TYPES.renameNode, 'name'),
    simpleNodeHandler(BUILTIN_COMMAND_TYPES.setVisibility, 'visible'),
    simpleNodeHandler(BUILTIN_COMMAND_TYPES.setLocked, 'locked'),
    propsHandler(BUILTIN_COMMAND_TYPES.setProps),
    propsHandler(BUILTIN_COMMAND_TYPES.resetProps),
    transformHandler(),
    groupHandler(),
    ungroupHandler(),
  ]
}

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
    ) {
      return { code: 'batch.invalid-command', message: 'batch 子命令结构无效' }
    }
    if (item.type === BUILTIN_COMMAND_TYPES.batch) {
      return { code: 'batch.nested', message: 'transaction.batch 不允许嵌套' }
    }
    commands.push(item as unknown as EditorCommand)
  }
  return commands
}
