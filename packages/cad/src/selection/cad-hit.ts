import { getCadLine, getCadPlacement, type CadDocument } from '../document'
import type { CadInputPoint } from '../point-input'
import {
  boundsFromPoints,
  pointToSegmentDistanceSquared,
  segmentCrossesBounds,
  segmentWithinBounds,
  type CadBounds,
  type CadSegment,
} from '../geometry'

/**
 * 框选的判定模式。
 *
 * @remarks
 * AutoCAD 的招牌行为：`window` 只选**完全落在框内**的图元，`crossing` 选与框相交或落在框内的。
 * 画接线图时从右往左划一刀就能抓住穿过某个区域的所有导线，这一招几乎天天用。
 *
 * @public
 */
export type CadSelectionMode = 'window' | 'crossing'

/** 归一化后的选框（世界坐标）。 @public */
export type CadSelectionBounds = CadBounds

/**
 * 由拖动的起点与终点求判定模式。
 *
 * @remarks
 * 方向 MUST 由起终点的水平关系决定，不能由归一化后的框倒推——归一化把 min/max 排好之后，
 * 「从哪边拉过来」这个信息就没了。
 *
 * @param from - 按下点。
 * @param to - 当前点或松手点。
 * @returns 左→右为 `window`，右→左为 `crossing`；水平无位移时按 `window`。
 * @public
 */
export function cadSelectionModeFromDrag(from: CadInputPoint, to: CadInputPoint): CadSelectionMode {
  return to.x < from.x ? 'crossing' : 'window'
}

/** 由拖动的两点归一化出选框。 @public */
export function cadSelectionBoundsFromDrag(
  from: CadInputPoint,
  to: CadInputPoint,
): CadSelectionBounds {
  return boundsFromPoints(from, to)
}

/** 可见图元及其几何；命中与框选共用同一次遍历规则。 */
interface VisibleLine {
  readonly id: string
  readonly segment: CadSegment
}

function visibleLines(document: CadDocument): readonly VisibleLine[] {
  const visibleLayers = new Set(
    document.layers.filter(({ visible }) => visible).map(({ id }) => id),
  )
  const lines: VisibleLine[] = []
  for (const id of document.rootIds) {
    const entity = document.entities[id]
    if (!entity) continue
    const line = getCadLine(entity)
    if (!line) continue
    if (!visibleLayers.has(getCadPlacement(entity)?.layerId ?? '')) continue
    lines.push({ id, segment: line })
  }
  return lines
}

/**
 * 求指定点命中的图元。
 *
 * @remarks
 * 判据是**点到线段的距离**，不是包围盒。直线没有盒模型：一条对角线的包围盒里绝大部分是空的，
 * 按矩形判定会让两条交叉线互相遮挡对方的命中区。这也是 CAD 不复用页面 Stage 那套 SceneIndex
 * 的根本原因——那边命中的单位就是矩形。
 *
 * 同样距离时取 `rootIds` 中更靠后的：后画的在视觉上更靠上，用户点的是看得见的那条。
 *
 * 隐藏图层不参与：屏幕上看不见的东西被选中，用户无从解释。
 *
 * @param document - 当前文档。
 * @param point - 目标点（世界坐标）。
 * @param tolerance - 命中容差（世界单位）；宿主按屏幕像素除以缩放得出。
 * @returns 命中的 Entity ID，容差内没有则为 `null`。
 * @public
 */
export function findCadHit(
  document: CadDocument,
  point: CadInputPoint,
  tolerance: number,
): string | null {
  if (!(tolerance > 0)) return null
  const limit = tolerance * tolerance
  let hit: string | null = null
  let best = Number.POSITIVE_INFINITY
  for (const { id, segment } of visibleLines(document)) {
    const distance = pointToSegmentDistanceSquared(segment, point)
    if (distance > limit) continue
    // `<=` 而不是 `<`：同距时后遍历到的（rootIds 靠后、视觉上更靠上）胜出。
    if (distance <= best) {
      best = distance
      hit = id
    }
  }
  return hit
}

/**
 * 求落在选框内的图元。
 *
 * @param document - 当前文档。
 * @param bounds - 归一化后的选框（世界坐标）。
 * @param mode - 判定模式，通常由 {@link cadSelectionModeFromDrag} 得出。
 * @returns 命中的 Entity ID，顺序与 `rootIds` 一致。
 * @public
 */
export function findCadEntitiesInBounds(
  document: CadDocument,
  bounds: CadSelectionBounds,
  mode: CadSelectionMode,
): readonly string[] {
  const inside = mode === 'window' ? segmentWithinBounds : segmentCrossesBounds
  return visibleLines(document)
    .filter(({ segment }) => inside(segment, bounds))
    .map(({ id }) => id)
}
