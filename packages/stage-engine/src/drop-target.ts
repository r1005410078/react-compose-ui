import {
  getComposeHierarchy,
  getComposeLayout,
  getComposeLayoutItem,
  getComposeLock,
} from '@compose-ui/core'
import { applyMatrix, invertMatrix, type StagePoint } from './geometry'
import type { StageSceneIndex } from './scene-index'

/**
 * 画布拖拽在 Pointer Up 前的落点判定。
 *
 * @remarks
 * `reparent` 表示松手会把选区移入 `containerId`；`reorder` 表示选区停留在原容器内，
 * 只调整 `Hierarchy.childIds` 顺序。为 null 时松手按既有规则只更新坐标。
 * @public
 */
export type StageDropTarget =
  | { readonly kind: 'reparent'; readonly containerId: string }
  | {
      readonly kind: 'reorder'
      readonly containerId: string
      /** 目标位置在容器**原始** `childIds` 中的索引，与 `entity.move` 命令的语义一致。 */
      readonly index: number
    }

/**
 * 触发 reparent 所需的边缘留白（屏幕像素）。
 *
 * @remarks
 * 贴边掠过不应把节点吸进容器——这是 Figma 自动吸入被诟病的主要原因。留白按屏幕像素定义，
 * 使判定手感不随缩放变化。
 */
const EDGE_INSET_SCREEN_PX = 16

/** 小容器上留白最多占其尺寸的比例，避免窄容器完全无法作为落点。 */
const MAX_INSET_RATIO = 0.2

function localPoint(
  index: StageSceneIndex,
  entityId: string,
  worldPoint: StagePoint,
): StagePoint | null {
  const matrix = index.getWorldMatrix(entityId)
  if (!matrix) return null
  return applyMatrix(invertMatrix(matrix), worldPoint)
}

function isDeepInside(
  index: StageSceneIndex,
  containerId: string,
  worldPoint: StagePoint,
  zoom: number,
): boolean {
  const box = index.layoutSnapshot.boxes[containerId]
  const local = localPoint(index, containerId, worldPoint)
  if (!box || !local) return false
  const inset = EDGE_INSET_SCREEN_PX / Math.max(zoom, 0.01)
  const insetX = Math.min(inset, box.width * MAX_INSET_RATIO)
  const insetY = Math.min(inset, box.height * MAX_INSET_RATIO)
  return local.x >= insetX
    && local.x <= box.width - insetX
    && local.y >= insetY
    && local.y <= box.height - insetY
}

/**
 * 复刻 `entity.move` 的索引语义，用于判断一次重排是否为 no-op。
 *
 * @remarks
 * 命令把 `index` 解释为**移除待移动项之前**的原始 `childIds` 下标，内部再用 `removedBefore`
 * 补偿。这里必须使用同一套换算，否则「顺序没变」的判断会与实际提交结果不一致。
 */
export function applyChildReorder(
  childIds: readonly string[],
  movingIds: readonly string[],
  requestedIndex: number,
): readonly string[] {
  const moving = new Set(movingIds)
  const ordered = childIds.filter((id) => moving.has(id))
  const removedBefore = ordered.filter((id) => childIds.indexOf(id) < requestedIndex).length
  const remaining = childIds.filter((id) => !moving.has(id))
  const target = Math.min(Math.max(0, requestedIndex - removedBefore), remaining.length)
  return [...remaining.slice(0, target), ...ordered, ...remaining.slice(target)]
}

function resolveInsertIndex(input: {
  readonly index: StageSceneIndex
  readonly containerId: string
  readonly childIds: readonly string[]
  readonly draggedIds: readonly string[]
  readonly worldPoint: StagePoint
}): number | null {
  const { index, containerId, childIds, draggedIds, worldPoint } = input
  const container = index.document.entities[containerId]
  const layout = container ? getComposeLayout(container) : null
  const local = localPoint(index, containerId, worldPoint)
  if (!layout || !local) return null

  const isRow = layout.flexDirection === 'row' || layout.flexDirection === 'row-reverse'
  const reversed = layout.flexDirection.endsWith('-reverse')
  const pointer = isRow ? local.x : local.y
  const dragged = new Set(draggedIds)

  // 只有参与排队的 Flow 兄弟才构成插入位；Absolute 子项脱离主轴，位置无参考意义。
  const slots = childIds.flatMap((id, childIndex) => {
    if (dragged.has(id)) return []
    const entity = index.document.entities[id]
    if (!entity || getComposeLayoutItem(entity).positioning !== 'flow') return []
    const box = index.layoutSnapshot.boxes[id]
    if (!box) return []
    const mid = isRow ? box.x + box.width / 2 : box.y + box.height / 2
    return [{ childIndex, mid }]
  })

  // reverse 方向下 childIds 顺序与坐标顺序相反，比较方向随之翻转。
  const precedingCount = slots.filter(({ mid }) => reversed ? mid > pointer : mid < pointer).length
  return slots[precedingCount]?.childIndex ?? childIds.length
}

/**
 * 判定一次画布拖拽当前的落点。
 *
 * @remarks
 * 纯函数：只读取索引与文档，不产生命令，也不持有会话状态。跨容器 reparent 要求指针深入
 * 目标内部，同容器则只在 `nowrap` Auto Layout 且全部拖动目标为 Flow 时给出重排位置。
 *
 * @returns 当前落点；不满足任何判定条件时为 null，表示松手只更新坐标。
 * @public
 */
export function resolveStageDropTarget(input: {
  readonly index: StageSceneIndex
  readonly draggedIds: readonly string[]
  readonly worldPoint: StagePoint
  readonly zoom: number
}): StageDropTarget | null {
  const { index, draggedIds, worldPoint, zoom } = input
  if (draggedIds.length === 0) return null
  const containerId = index.containerAtPoint(worldPoint, draggedIds)
  if (!containerId) return null
  const container = index.document.entities[containerId]
  const hierarchy = container ? getComposeHierarchy(container) : null
  if (!container || !hierarchy || getComposeLock(container).locked) return null

  const staysInPlace = draggedIds.every((id) => index.getParentId(id) === containerId)
  if (staysInPlace) {
    const layout = getComposeLayout(container)
    // wrap 容器里指针位置无法无歧义地反推插入序号，维持既有的烘焙 Absolute 行为。
    if (!layout || layout.flexWrap !== 'nowrap') return null
    const allFlow = draggedIds.every((id) => {
      const entity = index.document.entities[id]
      return entity && getComposeLayoutItem(entity).positioning === 'flow'
    })
    if (!allFlow) return null
    const insertIndex = resolveInsertIndex({
      index,
      containerId,
      childIds: hierarchy.childIds,
      draggedIds,
      worldPoint,
    })
    if (insertIndex === null) return null
    const next = applyChildReorder(hierarchy.childIds, draggedIds, insertIndex)
    const unchanged = next.length === hierarchy.childIds.length
      && next.every((id, at) => id === hierarchy.childIds[at])
    if (unchanged) return null
    return { kind: 'reorder', containerId, index: insertIndex }
  }

  if (!isDeepInside(index, containerId, worldPoint, zoom)) return null
  return { kind: 'reparent', containerId }
}
