/**
 * 盒局部曲线 → 世界形状的换算：`TRIM` 与 `HATCH` 的共享入口。
 *
 * @remarks
 * 两条命令都要先把候选曲线搬进世界坐标再求交，而各写一份的症状**不是**两处代码长得像——是
 * 它们对同一张图求出不同的交点，于是「看得见的形状」与「算出来的边界」对不上，而这只在某些
 * 缩放下现形。因此换算只有这一个入口，与「`projectComposeCurveToBox` 是盒到几何的唯一入口」
 * 是同一条判断。
 *
 * 两条命令要的**粒度不同**，这是有意保留的差别而不是遗漏：
 * - `TRIM` 要 {@link stageWorldShapes}，按**尖角顶点**拍，且每段带回它在曲线参数轴上的起点
 *   （`base`）——它要把交点排到一维上去取邻居。代价写在那条决定里：剪口与画出来的圆角差一个
 *   圆角的距离。
 * - `HATCH` 要 {@link stageWorldOutline}，走**圆角之后**的那一列轮廓片段，也不需要参数。它
 *   不能取同样的近似：差一个圆角的**面积**是屏幕上看得见的一块色，四个角就是四块。
 */

import {
  composeCurveSegments,
  composePolylineOutline,
  composePolylineSegments,
  getComposeCurve,
  projectComposeCurveToBox,
  type ComposeArcShape,
  type ComposeCurve,
  type ComposeOutlinePiece,
  type ComposeSegmentShape,
} from '@compose-ui/core'
import { applyMatrix, type StageMatrix } from '../geometry'
import type { StageSceneIndex } from '../hit-testing'

/**
 * 世界坐标下的一条形状，带它对应的曲线参数区间。
 *
 * @remarks
 * `base` 是这一段在曲线自身参数轴上的起点（`line`/`polyline` 的段下标）；弧的参数是走过的
 * 角量，从零起算，因此那一支没有这个字段。
 */
export type StageWorldShape =
  | { readonly kind: 'segment'; readonly segment: ComposeSegmentShape; readonly base: number }
  | { readonly kind: 'arc'; readonly arc: ComposeArcShape }

const rotationDegrees = (matrix: StageMatrix) => (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI

/** 把一段弧搬进世界坐标。 */
function worldArc(arc: ComposeArcShape, matrix: StageMatrix): ComposeArcShape {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c
  return {
    center: applyMatrix(matrix, arc.center),
    radius: arc.radius * Math.sqrt(Math.abs(determinant)),
    startAngle: arc.startAngle + rotationDegrees(matrix),
    // 镜像矩阵翻转扫掠方向；参数轴（走过的角量）因此在两边都一致。
    sweep: determinant < 0 ? -arc.sweep : arc.sweep,
  }
}

function worldSegment(segment: ComposeSegmentShape, matrix: StageMatrix): ComposeSegmentShape {
  return { start: applyMatrix(matrix, segment.start), end: applyMatrix(matrix, segment.end) }
}

/**
 * 盒局部曲线：与命中、捕捉应用同一个盒到几何的变换。
 *
 * @remarks
 * 没有 `Curve` 或还没有布局盒时返回 `null`——后者在新建的那一帧是正常的。
 *
 * @public
 */
export function stageBoxCurve(index: StageSceneIndex, entityId: string): ComposeCurve | null {
  const entity = index.document.entities[entityId]
  const curve = entity ? getComposeCurve(entity) : undefined
  const box = index.layoutSnapshot.boxes[entityId]
  return curve && box ? projectComposeCurveToBox(curve, box) : null
}

/**
 * 把盒局部的曲线搬进世界坐标，拆成可求交的形状。
 *
 * @remarks
 * 弧在非等比拉伸下已经被 `projectComposeCurveToBox` 投影成折线，因此这里不必再分流。多段线
 * 按**尖角顶点**拍：顶点没有 bulge，落在角弧里的位置没法落成顶点，而 `TRIM` 的产物必须是
 * 一条能落回文档的曲线。
 *
 * @public
 */
export function stageWorldShapes(
  curve: ComposeCurve,
  matrix: StageMatrix,
): readonly StageWorldShape[] {
  if (curve.kind === 'arc') return [{ kind: 'arc', arc: worldArc(curve, matrix) }]
  if (curve.kind === 'path') {
    return composeCurveSegments(curve).map((segment, index) => ({
      kind: 'segment',
      segment: worldSegment(segment, matrix),
      base: index,
    }))
  }
  const vertices = curve.kind === 'line' ? [curve.start, curve.end] : curve.vertices
  const closed = curve.kind === 'polyline' && curve.closed
  return composePolylineSegments(vertices, closed).map((segment, index) => ({
    kind: 'segment',
    segment: worldSegment(segment, matrix),
    base: index,
  }))
}

/**
 * 把盒局部的曲线搬进世界坐标，拆成**圆角之后**的那一列轮廓片段。
 *
 * @remarks
 * 与 {@link stageWorldShapes} 的差别只在多段线那一支：这里走 `composePolylineOutline`，也就是
 * 命中、框选、内部判定与渲染读的**同一列**片段。求面不能用尖角顶点——填出来的色会盖过角弧，
 * 而那是屏幕上看得见的一块。
 *
 * @public
 */
export function stageWorldOutline(
  curve: ComposeCurve,
  matrix: StageMatrix,
): readonly ComposeOutlinePiece[] {
  if (curve.kind === 'arc') return [{ kind: 'arc', arc: worldArc(curve, matrix) }]
  if (curve.kind === 'polyline') {
    return composePolylineOutline(curve).map((piece) => (piece.kind === 'arc'
      ? { kind: 'arc', arc: worldArc(piece.arc, matrix) }
      : { kind: 'segment', segment: worldSegment(piece.segment, matrix) }))
  }
  return stageWorldShapes(curve, matrix).map((shape) => (shape.kind === 'arc'
    ? { kind: 'arc', arc: shape.arc }
    : { kind: 'segment', segment: shape.segment }))
}
