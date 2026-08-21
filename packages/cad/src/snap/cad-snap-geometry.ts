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
