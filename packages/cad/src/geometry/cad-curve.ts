import type { CadInputPoint } from '../point-input'
import {
  arcBounds,
  flattenCadArc,
  pointToArcDistanceSquared,
  type CadArcShape,
} from './cad-arc-geometry'
import {
  cadTextBounds,
  cadTextCorners,
  pointToTextDistanceSquared,
  type CadTextShape,
} from './cad-text-geometry'
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

/** 图纸上的一段文字几何。 @public */
export interface CadTextGeometry extends CadTextShape {
  readonly kind: 'text'
}

/**
 * 图纸上一个可见对象的几何。
 *
 * @remarks
 * `CadCurve` 继续只表示线段与圆弧——两者共享端点、中点、到点距离与拍扁一整套运算，是一个
 * **真实的类别**。文字与它们一个共同运算都没有，塞进去只会让「曲线」退化成「凡是画得出来的
 * 东西」的别名。因此在上面加一层伞，而不是把一个已经准确的名字弄脏。
 *
 * @public
 */
export type CadGeometry = CadCurve | CadTextGeometry

/** 包一段文字。 @internal */
export function textGeometry(text: CadTextShape): CadTextGeometry {
  return {
    kind: 'text',
    position: text.position,
    content: text.content,
    height: text.height,
    rotation: text.rotation,
    align: text.align,
  }
}

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
export function geometryBounds(geometry: CadGeometry): CadBounds {
  if (geometry.kind === 'text') return cadTextBounds(geometry)
  if (geometry.kind === 'arc') return arcBounds(geometry)
  return {
    minX: Math.min(geometry.start.x, geometry.end.x),
    minY: Math.min(geometry.start.y, geometry.end.y),
    maxX: Math.max(geometry.start.x, geometry.end.x),
    maxY: Math.max(geometry.start.y, geometry.end.y),
  }
}

/**
 * 点到几何的距离平方；命中判据。
 *
 * @remarks
 * 文字给出的是「框内为 0、框外取到框边」，因此「最近者胜出」这条仲裁不必认识文字——它拿到的
 * 仍然只是一个距离。
 *
 * @internal
 */
export function pointToGeometryDistanceSquared(geometry: CadGeometry, point: CadInputPoint) {
  if (geometry.kind === 'text') return pointToTextDistanceSquared(geometry, point)
  return geometry.kind === 'segment'
    ? pointToSegmentDistanceSquared(geometry, point)
    : pointToArcDistanceSquared(geometry, point)
}

/** 几何的包围盒是否与以 `point` 为心、`radius` 为半径的方框相交；捕捉的粗筛。 @internal */
export function geometryNearPoint(geometry: CadGeometry, point: CadInputPoint, radius: number) {
  if (geometry.kind === 'segment') return segmentNearPoint(geometry, point, radius)
  const bounds = geometryBounds(geometry)
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
export function geometryWithinBounds(geometry: CadGeometry, bounds: CadBounds) {
  if (geometry.kind === 'segment') return segmentWithinBounds(geometry, bounds)
  // 圆弧用紧盒、文字用旋转后四角的盒，两者都是紧的，因此「盒在框内」等价于「几何在框内」。
  const box = geometryBounds(geometry)
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
export function geometryCrossesBounds(geometry: CadGeometry, bounds: CadBounds) {
  if (geometry.kind === 'segment') return segmentCrossesBounds(geometry, bounds)
  if (geometry.kind === 'arc') {
    return flattenCadArc(geometry).some((segment) => segmentCrossesBounds(segment, bounds))
  }
  // 文字按旋转后的四条边判：只判轴对齐盒会让斜着的短标签在盒角附近被误选。
  const corners = cadTextCorners(geometry)
  return corners.some((corner, index) => segmentCrossesBounds(
    { start: corner, end: corners[(index + 1) % corners.length]! },
    bounds,
  ))
}
