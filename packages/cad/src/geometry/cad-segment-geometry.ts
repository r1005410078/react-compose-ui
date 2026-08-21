import type { CadInputPoint } from '../point-input'

/** 一条待求解的线段。 @internal */
export interface CadSegment {
  readonly start: CadInputPoint
  readonly end: CadInputPoint
}

/** 线段中点。 @internal */
export function segmentMidpoint(segment: CadSegment): CadInputPoint {
  return {
    x: (segment.start.x + segment.end.x) / 2,
    y: (segment.start.y + segment.end.y) / 2,
  }
}

/**
 * 求两条线段的交点。
 *
 * @remarks
 * 只返回**落在两条线段范围内**的交点：延长线上的交点在 AutoCAD 里属于「外观交点」，是另一种
 * 捕捉模式，不能混进来。平行（含共线）时返回 `null`——共线重叠有无穷多个交点，任选一个都是
 * 武断的。
 *
 * @internal
 */
export function segmentIntersection(a: CadSegment, b: CadSegment): CadInputPoint | null {
  const ax = a.end.x - a.start.x
  const ay = a.end.y - a.start.y
  const bx = b.end.x - b.start.x
  const by = b.end.y - b.start.y
  const denominator = ax * by - ay * bx
  if (denominator === 0) return null

  const dx = b.start.x - a.start.x
  const dy = b.start.y - a.start.y
  const t = (dx * by - dy * bx) / denominator
  const u = (dx * ay - dy * ax) / denominator
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { x: a.start.x + t * ax, y: a.start.y + t * ay }
}

/** 两点距离的平方；比较距离时不必开方。 @internal */
export function squaredDistance(a: CadInputPoint, b: CadInputPoint) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

/** 线段的包围盒是否与以 `point` 为心、`radius` 为半径的方框相交。 @internal */
export function segmentNearPoint(segment: CadSegment, point: CadInputPoint, radius: number) {
  const minX = Math.min(segment.start.x, segment.end.x) - radius
  const maxX = Math.max(segment.start.x, segment.end.x) + radius
  const minY = Math.min(segment.start.y, segment.end.y) - radius
  const maxY = Math.max(segment.start.y, segment.end.y) + radius
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
}

/**
 * 点到线段的距离平方。
 *
 * @remarks
 * CAD 的命中判据是**距离**而不是包围盒：一条对角线的包围盒里绝大部分是空的，按矩形判定会
 * 让两条交叉线互相遮挡对方的命中区。退化线段（两端点重合）按到该点的距离处理，否则
 * `t = dot / lengthSquared` 会除零。
 *
 * @internal
 */
export function pointToSegmentDistanceSquared(segment: CadSegment, point: CadInputPoint) {
  const dx = segment.end.x - segment.start.x
  const dy = segment.end.y - segment.start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return squaredDistance(segment.start, point)
  const t = Math.max(0, Math.min(1, (
    (point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy
  ) / lengthSquared))
  return squaredDistance({ x: segment.start.x + t * dx, y: segment.start.y + t * dy }, point)
}

/** 归一化的轴对齐矩形。 @internal */
export interface CadBounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

/** 由任意两点归一化出矩形。 @internal */
export function boundsFromPoints(a: CadInputPoint, b: CadInputPoint): CadBounds {
  return {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
  }
}

function containsPoint(bounds: CadBounds, point: CadInputPoint) {
  return point.x >= bounds.minX && point.x <= bounds.maxX
    && point.y >= bounds.minY && point.y <= bounds.maxY
}

/** 线段是否**完全**落在矩形内。 @internal */
export function segmentWithinBounds(segment: CadSegment, bounds: CadBounds) {
  return containsPoint(bounds, segment.start) && containsPoint(bounds, segment.end)
}

/**
 * 线段是否与矩形相交或落在其中。
 *
 * @remarks
 * 先判包含再判与四条边求交。只判四条边是不够的：完全落在矩形内部的线段与任何一条边都不相交。
 *
 * @internal
 */
export function segmentCrossesBounds(segment: CadSegment, bounds: CadBounds) {
  if (containsPoint(bounds, segment.start) || containsPoint(bounds, segment.end)) return true
  const corners = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ]
  for (let i = 0; i < corners.length; i += 1) {
    const edge = { start: corners[i]!, end: corners[(i + 1) % corners.length]! }
    if (segmentIntersection(segment, edge)) return true
  }
  return false
}
