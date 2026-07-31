import {
  getComposeClip,
  getComposeHierarchy,
  getComposeLock,
  getComposeVisibility,
  type ComposeDocument,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import {
  applyMatrix,
  getEntityWorldBounds,
  getEntityWorldMatrix,
  invertMatrix,
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
  /** 索引对应的布局快照；revision 参与缓存身份。 */
  readonly layoutSnapshot: ComposeLayoutSnapshot
  /** 按文档树顺序返回全部 Entity ID。 */
  readonly order: readonly string[]
  /** 查询 Entity 直接父级；根 Entity 返回 null。 */
  getParentId(entityId: string): string | null
  /** 查询 Entity 完整世界矩阵；缺失 Entity 返回 null。 */
  getWorldMatrix(entityId: string): StageMatrix | null
  /** 查询 Entity 世界轴对齐边界；缺失 Entity 返回 null。 */
  getWorldBounds(entityId: string): StageRect | null
  /** 查询 Entity 及全部祖先共同决定的有效可见性。 */
  isVisible(entityId: string): boolean
  /** 移除其祖先也在输入集合中的后代选择。 */
  topLevelSelection(entityIds: readonly string[]): readonly string[]
  /** 查询 Entity 自身或最近 Container 祖先。 */
  closestContainerForEntity(entityId: string): string | null
  /** 查询全部 Entity 共享的最近可用 Container。 */
  commonContainerForSelection(entityIds: readonly string[]): string | null
  /** 按 paint order 查询包含世界点的最深可用 Container。 */
  containerAtPoint(point: { readonly x: number; readonly y: number }): string | null
  /** 按 paint order 查询包含世界点且未被裁剪祖先遮蔽的最上层可见 Entity。 */
  entityAtPoint(point: { readonly x: number; readonly y: number }): string | null
  /** 为选区建立 Entity 与文档辅助线吸附候选。 */
  snapCandidates(excludedIds: readonly string[]): readonly StageGuide[]
}

const cache = new WeakMap<ComposeLayoutSnapshot, WeakMap<ComposeDocument, StageSceneIndex>>()

/**
 * 为不可变文档创建或复用空间索引。
 *
 * @param document - 已通过 core 校验的 ComposeDocument。
 * @returns 与该文档引用绑定的空间索引。
 * @public
 */
export function createStageSceneIndex(
  document: ComposeDocument,
  layoutSnapshot: ComposeLayoutSnapshot,
): StageSceneIndex {
  let documentCache = cache.get(layoutSnapshot)
  if (!documentCache) {
    documentCache = new WeakMap()
    cache.set(layoutSnapshot, documentCache)
  }
  const cached = documentCache.get(document)
  if (cached) return cached

  const parents = new Map<string, string | null>()
  const order: string[] = []
  const matrices = new Map<string, StageMatrix>()
  const bounds = new Map<string, StageRect>()
  const visibility = new Map<string, boolean>()

  const visit = (
    entityId: string,
    parentId: string | null,
    parentVisible: boolean,
  ) => {
    const entity = document.entities[entityId]
    if (!entity || parents.has(entityId)) return
    parents.set(entityId, parentId)
    const visible = parentVisible && getComposeVisibility(entity).visible
    visibility.set(entityId, visible)
    order.push(entityId)
    matrices.set(entityId, getEntityWorldMatrix(document, layoutSnapshot, entityId))
    bounds.set(entityId, getEntityWorldBounds(document, layoutSnapshot, entityId))
    getComposeHierarchy(entity)?.childIds.forEach((childId) =>
      visit(childId, entityId, visible))
  }
  document.rootIds.forEach((entityId) => visit(entityId, null, true))

  const index: StageSceneIndex = {
    document,
    layoutSnapshot,
    order,
    getParentId: (entityId) => parents.get(entityId) ?? null,
    getWorldMatrix: (entityId) => matrices.get(entityId) ?? null,
    getWorldBounds: (entityId) => bounds.get(entityId) ?? null,
    isVisible: (entityId) => visibility.get(entityId) ?? false,
    topLevelSelection(entityIds) {
      const selected = new Set(entityIds)
      return entityIds.filter((entityId) => {
        let parentId = parents.get(entityId) ?? null
        while (parentId) {
          if (selected.has(parentId)) return false
          parentId = parents.get(parentId) ?? null
        }
        return document.entities[entityId] !== undefined
      })
    },
    closestContainerForEntity(entityId) {
      let current: string | null = entityId
      while (current) {
        const entity = document.entities[current]
        if (entity && getComposeHierarchy(entity)) return current
        current = parents.get(current) ?? null
      }
      return null
    },
    commonContainerForSelection(entityIds) {
      const validIds = entityIds.filter((id) => document.entities[id] !== undefined)
      if (validIds.length === 0) return null
      const containerChain = (entityId: string) => {
        const result: string[] = []
        let current: string | null = entityId
        while (current) {
          const entity = document.entities[current]
          if (entity && getComposeHierarchy(entity) && !getComposeLock(entity).locked) {
            result.push(current)
          }
          current = parents.get(current) ?? null
        }
        return result
      }
      const chains = validIds.map(containerChain)
      return chains[0]?.find((containerId) =>
        chains.every((chain) => chain.includes(containerId))) ?? null
    },
    containerAtPoint(point) {
      const contains = (entityId: string) => {
        const entity = document.entities[entityId]
        const matrix = matrices.get(entityId)
        if (!entity || !getComposeHierarchy(entity) || !matrix) return false
        const box = layoutSnapshot.boxes[entityId]
        if (!box) return false
        const local = applyMatrix(invertMatrix(matrix), point)
        return local.x >= 0
          && local.x <= box.width
          && local.y >= 0
          && local.y <= box.height
      }
      const isExposed = (entityId: string) => {
        let current = parents.get(entityId) ?? null
        while (current) {
          const ancestor = document.entities[current]
          if (ancestor && getComposeClip(ancestor)?.enabled && !contains(current)) {
            return false
          }
          current = parents.get(current) ?? null
        }
        return true
      }
      return [...order].reverse().find((entityId) => {
        const entity = document.entities[entityId]
        return entity
          && getComposeHierarchy(entity)
          && !getComposeLock(entity).locked
          && visibility.get(entityId)
          && contains(entityId)
          && isExposed(entityId)
      }) ?? null
    },
    entityAtPoint(point) {
      const contains = (entityId: string) => {
        const entity = document.entities[entityId]
        const matrix = matrices.get(entityId)
        if (!entity || !matrix) return false
        const box = layoutSnapshot.boxes[entityId]
        if (!box) return false
        const local = applyMatrix(invertMatrix(matrix), point)
        return local.x >= 0
          && local.x <= box.width
          && local.y >= 0
          && local.y <= box.height
      }
      const isExposed = (entityId: string) => {
        let current = parents.get(entityId) ?? null
        while (current) {
          const ancestor = document.entities[current]
          if (ancestor && getComposeClip(ancestor)?.enabled && !contains(current)) return false
          current = parents.get(current) ?? null
        }
        return true
      }
      return [...order].reverse().find((entityId) => (
        visibility.get(entityId) === true && contains(entityId) && isExposed(entityId)
      )) ?? null
    },
    snapCandidates(excludedIds) {
      const excluded = new Set(excludedIds)
      const excludeDescendants = (entityId: string) => {
        const entity = document.entities[entityId]
        const hierarchy = entity && getComposeHierarchy(entity)
        if (!hierarchy) return
        hierarchy.childIds.forEach((childId) => {
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
        order.forEach((entityId) => {
          const entity = document.entities[entityId]
          const entityBounds = bounds.get(entityId)
          if (
            entity
            && visibility.get(entityId)
            && entityBounds
            && !excluded.has(entityId)
          ) {
            addRect(entityBounds)
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
  documentCache.set(document, index)
  return index
}
