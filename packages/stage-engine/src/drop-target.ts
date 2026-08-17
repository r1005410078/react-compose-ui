import {
  getComposeHierarchy,
  getComposeLayout,
  getComposeLayoutItem,
  getComposeLock,
} from '@compose-ui/core'
import { applyMatrix, invertMatrix, type StagePoint, type StageRect } from './geometry'
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

interface FlowSlot {
  readonly childIndex: number
  /** 主轴起始边（局部坐标）。 */
  readonly leading: number
  /** 主轴结束边（局部坐标）。 */
  readonly trailing: number
  readonly mid: number
  /** 交叉轴起始边（局部坐标）。 */
  readonly crossLeading: number
  /** 交叉轴结束边（局部坐标）。 */
  readonly crossTrailing: number
}

interface MainAxis {
  readonly isRow: boolean
  readonly reversed: boolean
}

function mainAxisOf(layout: { readonly flexDirection: string }): MainAxis {
  return {
    isRow: layout.flexDirection === 'row' || layout.flexDirection === 'row-reverse',
    reversed: layout.flexDirection.endsWith('-reverse'),
  }
}

/** 收集参与排队的 Flow 兄弟；Absolute 子项脱离主轴，位置对插入位无参考意义。 */
function collectFlowSlots(input: {
  readonly index: StageSceneIndex
  readonly childIds: readonly string[]
  readonly draggedIds: readonly string[]
  readonly isRow: boolean
}): readonly FlowSlot[] {
  const { index, childIds, draggedIds, isRow } = input
  const dragged = new Set(draggedIds)
  return childIds.flatMap((id, childIndex) => {
    if (dragged.has(id)) return []
    const entity = index.document.entities[id]
    if (!entity || getComposeLayoutItem(entity).positioning !== 'flow') return []
    const box = index.layoutSnapshot.boxes[id]
    if (!box) return []
    const leading = isRow ? box.x : box.y
    const trailing = leading + (isRow ? box.width : box.height)
    const crossLeading = isRow ? box.y : box.x
    const crossTrailing = crossLeading + (isRow ? box.height : box.width)
    return [{ childIndex, leading, trailing, mid: (leading + trailing) / 2, crossLeading, crossTrailing }]
  })
}

interface FlowRow {
  readonly crossStart: number
  readonly crossEnd: number
  readonly slots: readonly FlowSlot[]
}

/**
 * 把 Flow 兄弟按交叉轴区间聚类成逻辑行。
 *
 * @remarks
 * Yoga 按 childIds 顺序换行，slots 已是逻辑序；同一行的交叉轴区间必然重叠，下一行
 * （wrap 向交叉轴正方向、wrap-reverse 向负方向）与当前行不重叠。据此只需顺序扫描：
 * 区间不再重叠即开新行，天然得到逻辑行序，无需关心 wrap 方向。nowrap 恒为单行。
 */
function clusterRows(slots: readonly FlowSlot[], wraps: boolean): readonly FlowRow[] {
  if (slots.length === 0) return []
  if (!wraps) {
    return [{
      crossStart: Math.min(...slots.map((slot) => slot.crossLeading)),
      crossEnd: Math.max(...slots.map((slot) => slot.crossTrailing)),
      slots,
    }]
  }
  const rows: { crossStart: number; crossEnd: number; slots: FlowSlot[] }[] = []
  for (const slot of slots) {
    const row = rows[rows.length - 1]
    const overlaps = row
      && slot.crossLeading < row.crossEnd
      && slot.crossTrailing > row.crossStart
    if (row && overlaps) {
      row.crossStart = Math.min(row.crossStart, slot.crossLeading)
      row.crossEnd = Math.max(row.crossEnd, slot.crossTrailing)
      row.slots.push(slot)
    }
    else rows.push({ crossStart: slot.crossLeading, crossEnd: slot.crossTrailing, slots: [slot] })
  }
  return rows
}

/** 指针交叉轴坐标选行：优先包含，否则取交叉轴距离最近的行。 */
function rowAtCross(rows: readonly FlowRow[], cross: number): FlowRow | null {
  let best: FlowRow | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const row of rows) {
    const distance = cross < row.crossStart
      ? row.crossStart - cross
      : cross > row.crossEnd
        ? cross - row.crossEnd
        : 0
    if (distance < bestDistance) {
      best = row
      bestDistance = distance
    }
  }
  return best
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

  const { isRow, reversed } = mainAxisOf(layout)
  const pointer = isRow ? local.x : local.y
  const cross = isRow ? local.y : local.x
  const slots = collectFlowSlots({ index, childIds, draggedIds, isRow })
  const wraps = layout.flexWrap !== 'nowrap'

  const inRowComparison = (row: readonly FlowSlot[]) =>
    // reverse 方向下 childIds 顺序与坐标顺序相反，比较方向随之翻转。
    row.filter(({ mid }) => reversed ? mid > pointer : mid < pointer).length

  let precedingCount = 0
  if (!wraps) {
    // nowrap 单行：交叉轴位置对插入位无意义，保持纯主轴中点比较。
    precedingCount = inRowComparison(slots)
  }
  else {
    const rows = clusterRows(slots, true)
    const targetRow = rowAtCross(rows, cross)
    // 指针落在目标行交叉轴区间外侧时，位于「换行方向」一侧算整行之后，反侧算整行之前；
    // 只有落在区间内才做行内主轴比较。wrap-reverse 的换行方向指向交叉轴负向，两侧互换。
    const wrapReversed = layout.flexWrap === 'wrap-reverse'
    // 目标行之前的逻辑行整行计入；行按 childIds 连续分段，因此「计入的 slot 数」
    // 始终是逻辑序 slots 的前缀长度。
    for (const row of rows) {
      if (row !== targetRow) {
        precedingCount += row.slots.length
        continue
      }
      const pastRow = wrapReversed ? cross < row.crossStart : cross > row.crossEnd
      const beforeRow = wrapReversed ? cross > row.crossEnd : cross < row.crossStart
      if (pastRow) precedingCount += row.slots.length
      else if (!beforeRow) precedingCount += inRowComparison(row.slots)
      break
    }
  }
  return slots[precedingCount]?.childIndex ?? childIds.length
}

/**
 * 拖拽手势的结构意图修饰键。
 *
 * @remarks
 * `alt` 强制以指针命中的最内层合法容器为 reparent 落点（跳过边缘留白的深入判定）；
 * `space` 锁定原父级，指针经过其他容器不产生 reparent 落点，但不阻止原容器内的重排。
 * 两者同按时锁定优先——结构意图的否决权高于命中放宽。
 * @public
 */
export interface StageDropModifiers {
  readonly alt?: boolean
  readonly space?: boolean
}

function pointInsideBox(index: StageSceneIndex, entityId: string, worldPoint: StagePoint): boolean {
  const box = index.layoutSnapshot.boxes[entityId]
  const local = localPoint(index, entityId, worldPoint)
  return Boolean(box && local
    && local.x >= 0 && local.x <= box.width
    && local.y >= 0 && local.y <= box.height)
}

function resolveSameContainerReorder(input: {
  readonly index: StageSceneIndex
  readonly containerId: string
  readonly draggedIds: readonly string[]
  readonly worldPoint: StagePoint
}): StageDropTarget | null {
  const { index, containerId, draggedIds, worldPoint } = input
  const container = index.document.entities[containerId]
  const hierarchy = container ? getComposeHierarchy(container) : null
  if (!container || !hierarchy) return null
  const layout = getComposeLayout(container)
  if (!layout) return null
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

/**
 * 判定一次画布拖拽当前的落点。
 *
 * @remarks
 * 纯函数：只读取索引与文档，不产生命令，也不持有会话状态。跨容器 reparent 要求指针深入
 * 目标内部（`alt` 放宽为命中即可）；同容器在全部拖动目标为 Flow 时给出重排位置，wrap
 * 容器按行聚类做二维插槽命中。
 *
 * @returns 当前落点；为 null 表示无结构意图——松手时 Absolute 目标只更新坐标，Flow 目标
 * 回弹（拖拽不改变 positioning，脱流走显式入口）。
 * @public
 */
export function resolveStageDropTarget(input: {
  readonly index: StageSceneIndex
  readonly draggedIds: readonly string[]
  readonly worldPoint: StagePoint
  readonly zoom: number
  readonly modifiers?: StageDropModifiers
}): StageDropTarget | null {
  const { index, draggedIds, worldPoint, zoom, modifiers } = input
  if (draggedIds.length === 0) return null

  if (modifiers?.space) {
    // 锁定原父级：只允许共同父级内的重排，其余情况一律无落点。
    const parents = draggedIds.map((id) => index.getParentId(id))
    const locked = parents[0]
    if (!locked || parents.some((parentId) => parentId !== locked)) return null
    const container = index.document.entities[locked]
    if (!container || getComposeLock(container).locked) return null
    if (!pointInsideBox(index, locked, worldPoint)) return null
    return resolveSameContainerReorder({ index, containerId: locked, draggedIds, worldPoint })
  }

  const containerId = index.containerAtPoint(worldPoint, draggedIds)
  if (!containerId) return null
  const container = index.document.entities[containerId]
  const hierarchy = container ? getComposeHierarchy(container) : null
  if (!container || !hierarchy || getComposeLock(container).locked) return null

  const staysInPlace = draggedIds.every((id) => index.getParentId(id) === containerId)
  if (staysInPlace) {
    return resolveSameContainerReorder({ index, containerId, draggedIds, worldPoint })
  }

  if (!modifiers?.alt && !isDeepInside(index, containerId, worldPoint, zoom)) return null
  return { kind: 'reparent', containerId }
}

/**
 * 落点的世界坐标指示几何。
 *
 * @remarks
 * Engine 只给出世界坐标，由 Stage 自行换算到屏幕并决定描边样式——与 `snapGuides`、
 * `paintHandles` 的分工一致。
 * @public
 */
export type StageDropIndicator =
  | { readonly kind: 'reparent'; readonly bounds: StageRect }
  | { readonly kind: 'reorder'; readonly start: StagePoint; readonly end: StagePoint }

/**
 * 把落点判定换算成可渲染的世界几何。
 *
 * @returns 指示几何；目标已失效或缺少布局结果时为 null。
 * @public
 */
export function resolveStageDropIndicator(input: {
  readonly index: StageSceneIndex
  readonly target: StageDropTarget
  readonly draggedIds: readonly string[]
}): StageDropIndicator | null {
  const { index, target, draggedIds } = input
  if (target.kind === 'reparent') {
    const bounds = index.getWorldBounds(target.containerId)
    return bounds ? { kind: 'reparent', bounds } : null
  }

  const container = index.document.entities[target.containerId]
  const hierarchy = container ? getComposeHierarchy(container) : null
  const layout = container ? getComposeLayout(container) : null
  const box = index.layoutSnapshot.boxes[target.containerId]
  const matrix = index.getWorldMatrix(target.containerId)
  if (!hierarchy || !layout || !box || !matrix) return null

  const { isRow, reversed } = mainAxisOf(layout)
  const slots = collectFlowSlots({
    index,
    childIds: hierarchy.childIds,
    draggedIds,
    isRow,
  })
  const wraps = layout.flexWrap !== 'nowrap'
  const rows = clusterRows(slots, wraps)
  const last = slots[slots.length - 1]
  const at = slots.find((slot) => slot.childIndex === target.index)
  // 插入位落在某个兄弟之前时贴其起始边；追加到末尾时贴最后一个兄弟的结束边。
  // reverse 方向下「逻辑靠前」对应坐标更大的一侧，两条边随之互换。
  const main = at
    ? (reversed ? at.trailing : at.leading)
    : last
      ? (reversed ? last.leading : last.trailing)
      : (reversed ? (isRow ? box.width : box.height) : 0)
  // nowrap 横跨整个容器交叉轴；wrap 只覆盖目标行的交叉轴区间，行间空隙不画线。
  const anchor = at ?? last
  const row = anchor && rows.find((candidate) => candidate.slots.includes(anchor))
  const crossStart = wraps && row ? row.crossStart : 0
  const crossEnd = wraps && row ? row.crossEnd : (isRow ? box.height : box.width)
  const localStart = isRow ? { x: main, y: crossStart } : { x: crossStart, y: main }
  const localEnd = isRow ? { x: main, y: crossEnd } : { x: crossEnd, y: main }
  return {
    kind: 'reorder',
    start: applyMatrix(matrix, localStart),
    end: applyMatrix(matrix, localEnd),
  }
}
