import type {
  ComposeDocument,
  ComposeGroupNode,
  ComposeNode,
  EditorCommand,
  JsonObject,
  JsonValue,
  NodeTransform,
} from '@compose-ui/core'
import {
  decomposeMatrix,
  getNodeParentId,
  getNodeWorldBounds,
  getNodeWorldMatrix,
  invertMatrix,
  multiplyMatrices,
  translationMatrix,
  unionRects,
} from './geometry'

function transformUnderParent(
  document: ComposeDocument,
  worldMatrix: ReturnType<typeof getNodeWorldMatrix>,
  parentId: string | null,
  width: number,
  height: number,
): NodeTransform {
  const parentWorld = parentId ? getNodeWorldMatrix(document, parentId) : null
  const local = parentWorld
    ? multiplyMatrices(invertMatrix(parentWorld), worldMatrix)
    : worldMatrix
  return decomposeMatrix(local, width, height)
}

/**
 * 创建保持后代世界几何不变的 node.group 命令。
 *
 * @param document - 当前正式文档。
 * @param nodeIds - 按选择顺序排列的待分组节点。
 * @param groupId - 新 Group 稳定 ID。
 * @param commandId - 命令稳定 ID。
 * @returns 交给同一 TransactionRuntime 的结构化命令。
 * @public
 */
export function createGroupCommand(
  document: ComposeDocument,
  nodeIds: readonly string[],
  groupId: string,
  commandId = `group:${groupId}`,
): EditorCommand {
  const bounds = unionRects(nodeIds
    .filter((id) => Boolean(document.nodes[id]))
    .map((id) => getNodeWorldBounds(document, id)))
  const parentId = nodeIds[0] ? getNodeParentId(document, nodeIds[0]) : null
  const safeBounds = bounds ?? { x: 0, y: 0, width: 1, height: 1 }
  const groupWorld = translationMatrix(safeBounds.x, safeBounds.y)
  const groupTransform = transformUnderParent(
    document,
    groupWorld,
    parentId,
    safeBounds.width,
    safeBounds.height,
  )
  const group: ComposeGroupNode = {
    id: groupId,
    kind: 'group',
    name: 'Group',
    visible: true,
    locked: false,
    transform: groupTransform,
    childIds: [...nodeIds],
  }
  const childTransforms: Record<string, JsonValue> = {}
  for (const nodeId of nodeIds) {
    const node = document.nodes[nodeId]
    if (!node) continue
    childTransforms[nodeId] = decomposeMatrix(
      multiplyMatrices(invertMatrix(groupWorld), getNodeWorldMatrix(document, nodeId)),
      node.transform.width,
      node.transform.height,
    ) as unknown as JsonValue
  }
  return {
    id: commandId,
    type: 'node.group',
    payload: {
      group: group as unknown as JsonValue,
      nodeIds,
      childTransforms,
    },
    meta: {
      label: '分组节点',
      source: 'stage',
      targetIds: nodeIds,
    },
  }
}

/**
 * 创建保持后代世界几何不变的 node.ungroup 命令。
 *
 * @public
 */
export function createUngroupCommand(
  document: ComposeDocument,
  groupId: string,
  commandId = `ungroup:${groupId}`,
): EditorCommand {
  const group = document.nodes[groupId]
  const parentId = getNodeParentId(document, groupId)
  const childTransforms: Record<string, JsonValue> = {}
  if (group?.kind === 'group') {
    for (const childId of group.childIds) {
      const child = document.nodes[childId]
      if (!child) continue
      childTransforms[childId] = transformUnderParent(
        document,
        getNodeWorldMatrix(document, childId),
        parentId,
        child.transform.width,
        child.transform.height,
      ) as unknown as JsonValue
    }
  }
  return {
    id: commandId,
    type: 'node.ungroup',
    payload: { groupId, childTransforms },
    meta: {
      label: '取消分组',
      source: 'stage',
      targetIds: [groupId],
    },
  }
}

/**
 * 创建原子 reparent batch，并把每个目标的世界矩阵分解到新父级。
 *
 * @public
 */
export function createReparentCommand(
  document: ComposeDocument,
  nodeIds: readonly string[],
  parentId: string,
  index: number,
  commandId = `reparent:${nodeIds.join(',')}`,
): EditorCommand {
  const updates = nodeIds.map((nodeId) => {
    const node = document.nodes[nodeId]
    return {
      nodeId,
      transform: node
        ? transformUnderParent(
            document,
            getNodeWorldMatrix(document, nodeId),
            parentId,
            node.transform.width,
            node.transform.height,
          )
        : { x: 0, y: 0, width: 1, height: 1, rotation: 0 },
    }
  })
  return {
    id: commandId,
    type: 'transaction.batch',
    payload: {
      commands: [
        {
          id: `${commandId}:move`,
          type: 'node.move',
          payload: { nodeIds, parentId, index },
        },
        {
          id: `${commandId}:transform`,
          type: 'node.transform.set',
          payload: {
            updates: updates.map(({ nodeId, transform }) => ({
              nodeId,
              transform: { ...transform },
            })),
          },
        },
      ],
    },
    meta: {
      label: '重设节点父级',
      source: 'stage',
      targetIds: nodeIds,
    },
  }
}

function subtreeIds(document: ComposeDocument, rootId: string) {
  const result: string[] = []
  const visit = (id: string) => {
    const node = document.nodes[id]
    if (!node) return
    result.push(id)
    if (node.kind !== 'component') node.childIds.forEach(visit)
  }
  visit(rootId)
  return result
}

/**
 * 为一个节点子树创建 node.duplicate 命令。
 *
 * @public
 */
export function createDuplicateCommand(
  document: ComposeDocument,
  sourceId: string,
  idFactory: () => string,
  commandId = `duplicate:${sourceId}`,
): { readonly command: EditorCommand; readonly rootId: string } | null {
  const source = document.nodes[sourceId]
  if (!source) return null
  const ids = subtreeIds(document, sourceId)
  const remap = new Map(ids.map((id) => [id, idFactory()]))
  const nodes: Record<string, JsonValue> = {}
  for (const id of ids) {
    const node = document.nodes[id]
    const cloneId = remap.get(id)
    if (!node || !cloneId) continue
    let clone: ComposeNode
    if (node.kind === 'component') {
      clone = {
        ...node,
        id: cloneId,
        name: `${node.name} 副本`,
        transform: id === sourceId
          ? { ...node.transform, x: node.transform.x + 10, y: node.transform.y + 10 }
          : { ...node.transform },
        props: structuredClone(node.props),
      }
    }
    else {
      clone = {
        ...node,
        id: cloneId,
        name: `${node.name} 副本`,
        transform: id === sourceId
          ? { ...node.transform, x: node.transform.x + 10, y: node.transform.y + 10 }
          : { ...node.transform },
        childIds: node.childIds.map((childId) => remap.get(childId) ?? childId),
      }
    }
    nodes[cloneId] = clone as unknown as JsonValue
  }
  const rootId = remap.get(sourceId)
  if (!rootId) return null
  const parentId = getNodeParentId(document, sourceId)
  const siblings = parentId
    ? (document.nodes[parentId]?.kind === 'component'
        ? []
        : document.nodes[parentId]?.childIds ?? [])
    : document.rootIds
  return {
    rootId,
    command: {
      id: commandId,
      type: 'node.duplicate',
      payload: {
        nodes: nodes as unknown as JsonObject,
        rootIds: [rootId],
        parentId,
        index: Math.max(0, siblings.indexOf(sourceId) + 1),
      },
      meta: {
        label: '复制节点',
        source: 'stage',
        targetIds: [sourceId],
      },
    },
  }
}
