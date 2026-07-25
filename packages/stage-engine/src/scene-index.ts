import type { ComposeDocument } from '@compose-ui/core'
import {
  getNodeWorldBounds,
  getNodeWorldMatrix,
  type StageGuide,
  type StageMatrix,
  type StageRect,
} from './geometry'

/**
 * 一个不可变 ComposeDocument 的空间查询索引。
 *
 * @public
 */
export interface StageSceneIndex {
  /** 索引对应的文档引用。 */
  readonly document: ComposeDocument
  /** 按文档树顺序返回全部节点 ID。 */
  readonly order: readonly string[]
  /** 查询节点直接父级；根节点返回 null。 */
  getParentId(nodeId: string): string | null
  /** 查询节点完整世界矩阵；缺失节点返回 null。 */
  getWorldMatrix(nodeId: string): StageMatrix | null
  /** 查询节点世界轴对齐边界；缺失节点返回 null。 */
  getWorldBounds(nodeId: string): StageRect | null
  /** 查询节点及全部祖先共同决定的有效可见性。 */
  isVisible(nodeId: string): boolean
  /** 移除其祖先也在输入集合中的后代选择。 */
  topLevelSelection(nodeIds: readonly string[]): readonly string[]
  /** 查询节点所属根 Frame。 */
  frameForNode(nodeId: string): string | null
  /** 为选区建立节点与文档辅助线吸附候选。 */
  snapCandidates(excludedIds: readonly string[]): readonly StageGuide[]
}

const cache = new WeakMap<ComposeDocument, StageSceneIndex>()

/**
 * 为不可变文档创建或复用空间索引。
 *
 * @param document - 已通过 core 校验的 ComposeDocument。
 * @returns 与该文档引用绑定的空间索引。
 * @public
 */
export function createStageSceneIndex(document: ComposeDocument): StageSceneIndex {
  const cached = cache.get(document)
  if (cached) return cached

  const parents = new Map<string, string | null>()
  const order: string[] = []
  const matrices = new Map<string, StageMatrix>()
  const bounds = new Map<string, StageRect>()
  const visibility = new Map<string, boolean>()

  const visit = (
    nodeId: string,
    parentId: string | null,
    parentVisible: boolean,
  ) => {
    const node = document.nodes[nodeId]
    if (!node || parents.has(nodeId)) return
    parents.set(nodeId, parentId)
    const visible = parentVisible && node.visible
    visibility.set(nodeId, visible)
    order.push(nodeId)
    matrices.set(nodeId, getNodeWorldMatrix(document, nodeId))
    bounds.set(nodeId, getNodeWorldBounds(document, nodeId))
    if (node.kind !== 'component') {
      node.childIds.forEach((childId) => visit(childId, nodeId, visible))
    }
  }
  document.rootIds.forEach((nodeId) => visit(nodeId, null, true))

  const index: StageSceneIndex = {
    document,
    order,
    getParentId: (nodeId) => parents.get(nodeId) ?? null,
    getWorldMatrix: (nodeId) => matrices.get(nodeId) ?? null,
    getWorldBounds: (nodeId) => bounds.get(nodeId) ?? null,
    isVisible: (nodeId) => visibility.get(nodeId) ?? false,
    topLevelSelection(nodeIds) {
      const selected = new Set(nodeIds)
      return nodeIds.filter((nodeId) => {
        let parentId = parents.get(nodeId) ?? null
        while (parentId) {
          if (selected.has(parentId)) return false
          parentId = parents.get(parentId) ?? null
        }
        return document.nodes[nodeId] !== undefined
      })
    },
    frameForNode(nodeId) {
      let current: string | null = nodeId
      while (current) {
        const node = document.nodes[current]
        if (node?.kind === 'frame') return current
        current = parents.get(current) ?? null
      }
      return null
    },
    snapCandidates(excludedIds) {
      const excluded = new Set(excludedIds)
      const excludeDescendants = (nodeId: string) => {
        const node = document.nodes[nodeId]
        if (!node || node.kind === 'component') return
        node.childIds.forEach((childId) => {
          excluded.add(childId)
          excludeDescendants(childId)
        })
      }
      excludedIds.forEach(excludeDescendants)
      const candidates: StageGuide[] = []
      const addRect = (rect: StageRect) => candidates.push(
        { axis: 'x', value: rect.x, source: 'node' },
        { axis: 'x', value: rect.x + rect.width / 2, source: 'node' },
        { axis: 'x', value: rect.x + rect.width, source: 'node' },
        { axis: 'y', value: rect.y, source: 'node' },
        { axis: 'y', value: rect.y + rect.height / 2, source: 'node' },
        { axis: 'y', value: rect.y + rect.height, source: 'node' },
      )
      if (document.canvas.smartSnap.nodes) {
        order.forEach((nodeId) => {
          const node = document.nodes[nodeId]
          const nodeBounds = bounds.get(nodeId)
          if (node && visibility.get(nodeId) && nodeBounds && !excluded.has(nodeId)) {
            addRect(nodeBounds)
          }
        })
      }
      if (document.canvas.smartSnap.guides) {
        document.canvas.guides.forEach((guide) => candidates.push({
          axis: guide.axis,
          value: guide.position,
          source: 'guide',
        }))
      }
      return candidates
    },
  }
  cache.set(document, index)
  return index
}
