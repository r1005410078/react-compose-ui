/**
 * 圆弧运算，全部转导自 `@compose-ui/core`。
 *
 * @remarks
 * 这些是纯形状函数，不认识任何文档协议，页面画布与 CAD 画布共用同一份实现——搬到 `core`
 * 之后本文件只保留 CAD 侧的既有名称，与点输入管线当初的做法一致。
 *
 * 保留别名而不是让调用点直接改名：`cad` 的调用点有几十处，改名只会让这次搬运的 diff 淹没
 * 掉真正需要复查的东西（有没有顺手改语义）。
 */
import {
  composeArcBoundsPoints,
  composeArcContainsAngle,
  composeArcEndpoints,
  composeArcMidpoint,
  composeArcPointAt,
  composeArcQuadrants,
  composeArcThroughPoints,
  flattenComposeArc,
  isComposeFullCircle,
  pointToComposeArcDistance,
  type ComposeArcShape,
} from '@compose-ui/core'
import type { CadInputPoint } from '../point-input'
import type { CadBounds, CadSegment } from './cad-segment-geometry'

/** 世界坐标下的一段圆弧。 @internal */
export type CadArcShape = ComposeArcShape

export const arcPointAt = composeArcPointAt as
  (arc: CadArcShape, degrees: number) => CadInputPoint
export const arcEndpoints = composeArcEndpoints as
  (arc: CadArcShape) => readonly [CadInputPoint, CadInputPoint]
export const arcMidpoint = composeArcMidpoint as (arc: CadArcShape) => CadInputPoint
export const isFullCircle = isComposeFullCircle
export const arcContainsAngle = composeArcContainsAngle
export const arcQuadrants = composeArcQuadrants as
  (arc: CadArcShape) => readonly CadInputPoint[]
export const flattenCadArc = flattenComposeArc as
  (arc: CadArcShape) => readonly CadSegment[]
export const arcThroughPoints = composeArcThroughPoints as
  (start: CadInputPoint, through: CadInputPoint, end: CadInputPoint) => CadArcShape | null

/**
 * 点到圆弧的距离**平方**。
 *
 * @remarks
 * `core` 侧返回距离本身；CAD 的命中与框选一路比较的是平方值（省掉每次开方），因此在这里
 * 平方回去而不是把 `core` 的返回值改成平方——距离才是那个函数自然的输出。
 *
 * @internal
 */
export function pointToArcDistanceSquared(arc: CadArcShape, point: CadInputPoint) {
  const distance = pointToComposeArcDistance(arc, point)
  return distance * distance
}

/** 圆弧的**紧**包围盒。 @internal */
export function arcBounds(arc: CadArcShape): CadBounds {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const { x, y } of composeArcBoundsPoints(arc)) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return { minX, minY, maxX, maxY }
}
