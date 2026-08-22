import type { CadInputPoint } from '../point-input'
import {
  arcBounds,
  flattenCadArc,
  pointToArcDistanceSquared,
  type CadArcShape,
} from './cad-arc-geometry'
import {
  pointToSegmentDistanceSquared,
  segmentCrossesBounds,
  segmentNearPoint,
  segmentWithinBounds,
  type CadBounds,
  type CadSegment,
} from './cad-segment-geometry'

/** 图纸上的一段线段几何。 @public */
export interface CadSegmentCurve extends CadSegment {
  readonly kind: 'segment'
}

/** 图纸上的一段圆弧几何。 @public */
export interface CadArcCurve extends CadArcShape {
  readonly kind: 'arc'
}

/**
 * 图纸上的一段可见几何。
 *
 * @remarks
 * 命中、框选、对象捕捉与渲染共用同一条可见性遍历，遍历返回的就是它。做成联合而不是把圆弧
 * 拍扁成线段：拍扁会迫使渲染要么画出可见的多边形，要么绕开这条遍历而与命中分叉——后者正是
 * 「看得见却点不中」。拍扁还会让**圆心与象限点消失**，而它们不是任何线段的特征点。
 *
 * @public
 */
export type CadCurve = CadSegmentCurve | CadArcCurve

/** 包一条线段。 @internal */
export function segmentCurve(segment: CadSegment): CadSegmentCurve {
  return { kind: 'segment', start: segment.start, end: segment.end }
}

/** 包一段圆弧。 @internal */
export function arcCurve(arc: CadArcShape): CadArcCurve {
  return {
    kind: 'arc',
    center: arc.center,
    radius: arc.radius,
    startAngle: arc.startAngle,
    sweep: arc.sweep,
  }
}

/**
 * 几何的紧包围盒。
 *
 * @remarks
 * 圆弧用**紧**盒：拿整圆的盒子凑合会让一段 90° 的弧按四倍面积算，标尺上的选区条会比实际长
 * 出一截。
 *
 * @public
 */
export function curveBounds(curve: CadCurve): CadBounds {
  if (curve.kind === 'arc') return arcBounds(curve)
  return {
    minX: Math.min(curve.start.x, curve.end.x),
    minY: Math.min(curve.start.y, curve.end.y),
    maxX: Math.max(curve.start.x, curve.end.x),
    maxY: Math.max(curve.start.y, curve.end.y),
  }
}

/** 点到几何的距离平方；命中判据。 @internal */
export function pointToCurveDistanceSquared(curve: CadCurve, point: CadInputPoint) {
  return curve.kind === 'segment'
    ? pointToSegmentDistanceSquared(curve, point)
    : pointToArcDistanceSquared(curve, point)
}

/** 几何的包围盒是否与以 `point` 为心、`radius` 为半径的方框相交；捕捉的粗筛。 @internal */
export function curveNearPoint(curve: CadCurve, point: CadInputPoint, radius: number) {
  if (curve.kind === 'segment') return segmentNearPoint(curve, point, radius)
  const bounds = arcBounds(curve)
  return point.x >= bounds.minX - radius && point.x <= bounds.maxX + radius
    && point.y >= bounds.minY - radius && point.y <= bounds.maxY + radius
}

/**
 * 几何是否**完全**落在矩形内；窗口框选判据。
 *
 * @remarks
 * 圆弧用**紧**包围盒判定，因此是精确的：紧盒完全落在框内等价于弧完全落在框内。拿整圆的盒子
 * 凑合会让一段 90° 的弧按四倍面积判定，明明框住了也判成没框住。
 *
 * @internal
 */
export function curveWithinBounds(curve: CadCurve, bounds: CadBounds) {
  if (curve.kind === 'segment') return segmentWithinBounds(curve, bounds)
  const box = arcBounds(curve)
  return box.minX >= bounds.minX && box.maxX <= bounds.maxX
    && box.minY >= bounds.minY && box.maxY <= bounds.maxY
}

/**
 * 几何是否与矩形相交或落在其中；交叉框选判据。
 *
 * @remarks
 * 圆弧在这里**拍扁**后判定。框选本身是像素级粗粒度的手势，而精确的弧–矩形求交开销与收益不
 * 相称；命中、窗口框选与捕捉都有精确解，不走这条路。
 *
 * @internal
 */
export function curveCrossesBounds(curve: CadCurve, bounds: CadBounds) {
  if (curve.kind === 'segment') return segmentCrossesBounds(curve, bounds)
  return flattenCadArc(curve).some((segment) => segmentCrossesBounds(segment, bounds))
}
