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
  COMPOSE_GEOMETRY_QUANTUM,
  composeCurveSegments,
  composeCurveViewBox,
  getComposeLayoutItem,
  jsonEqual,
  normalizeComposeCurveGeometry,
  composePolylineOutline,
  composePolylineSegments,
  getComposeCurve,
  projectComposeCurveToBox,
  type ComposeArcShape,
  type ComposeCurve,
  type ComposeOutlinePiece,
  type ComposeSegmentShape,
} from '@compose-ui/core'
import type { ComposeDocument, ComposeLayoutSnapshot, ComposePosition, JsonValue } from '@compose-ui/core'
import { applyMatrix, stageCurveToParent, type StageMatrix } from '../geometry'
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
/**
 * 一个坐标量化步长在**世界**空间里有多大。
 *
 * @remarks
 * 几何按 `COMPOSE_GEOMETRY_PRECISION` 舍入发生在**几何空间**，而交给求解的是世界片段，中间
 * 隔着两段缩放：`projectComposeCurveToBox` 的盒 / 取景框比例，以及世界矩阵。求解拿这个数当
 * 「这两条边是不是同一条」的容差，只有这里知道那两段是多少——让 `core` 自己猜等于把一条算得
 * 出来的量换成一个魔法数。
 *
 * 两轴取**大**的那一个：取小了归一够不着，而够不着只是退回「求解退化」这个看得见的失败。
 *
 * 缺几何或缺盒时退回文档精度的步长本身——那一档调用方本来就会以 `unresolved` 拒绝。
 */
export function stageWorldQuantum(
  index: StageSceneIndex,
  entityId: string,
  matrix: StageMatrix,
): number {
  const entity = index.document.entities[entityId]
  const curve = entity ? getComposeCurve(entity) : undefined
  const box = index.layoutSnapshot.boxes[entityId]
  if (!curve || !box) return COMPOSE_GEOMETRY_QUANTUM
  const view = composeCurveViewBox(curve)
  const boxScale = Math.max(box.width / view.width, box.height / view.height)
  const worldScale = Math.sqrt(Math.abs(matrix.a * matrix.d - matrix.b * matrix.c))
  return COMPOSE_GEOMETRY_QUANTUM * boxScale * worldScale
}

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

/**
 * 把盒局部的曲线搬进世界坐标，**保持 kind 不变**。
 *
 * @remarks
 * 与 {@link stageWorldOutline} 回答的是两个问题：那边要一列**可求交的片段**（求面、修剪、
 * 布尔的区域运算都拿它两两求交），这边要一条**还能落回文档的曲线**。拍平需要后者——它必须
 * 保住 `path` 的曲率，而 `stageWorldOutline` 会把贝塞尔拍成线段。
 *
 * 变换是**精确仿射**：`Transform` 只有 `rotation`，几何空间到盒的缩放已经由
 * `projectComposeCurveToBox` 吃掉，因此这里的矩阵只含平移、旋转与可能的镜像——弧与圆角在
 * 这样的矩阵下形状不变，只是搬了位置。半径按 `√|det|` 缩放，镜像（行列式为负）由
 * {@link stageWorldShapes} 用的同一套换算翻转扫掠方向。
 *
 * @public
 */
export function stageWorldCurve(curve: ComposeCurve, matrix: StageMatrix): ComposeCurve {
  /*
   * 经一次对象字面量落成 `ComposePosition`：`StagePoint` 少一条索引签名，而
   * `ComposePosition` 继承自 `JsonObject`，TypeScript 只对字面量放行这种赋值。
   */
  const at = (point: { readonly x: number; readonly y: number }): ComposePosition => {
    const world = applyMatrix(matrix, point)
    return { x: world.x, y: world.y }
  }
  if (curve.kind === 'line') {
    return { kind: 'line', start: at(curve.start), end: at(curve.end) }
  }
  if (curve.kind === 'arc') {
    const arc = worldArc(curve, matrix)
    return {
      kind: 'arc',
      center: { x: arc.center.x, y: arc.center.y },
      radius: arc.radius,
      startAngle: arc.startAngle,
      sweep: arc.sweep,
    }
  }
  if (curve.kind === 'polyline') {
    const scale = Math.sqrt(Math.abs(matrix.a * matrix.d - matrix.b * matrix.c))
    return {
      kind: 'polyline',
      vertices: curve.vertices.map(at),
      closed: curve.closed,
      // 缺席即尖角：半径为零时 MUST NOT 写成 0，两种表示会让「有没有圆角」读出两个答案。
      ...(curve.cornerRadius ? { cornerRadius: curve.cornerRadius * scale } : {}),
    }
  }
  return {
    kind: 'path',
    subpaths: curve.subpaths.map((subpath) => ({
      start: at(subpath.start),
      segments: subpath.segments.map((segment) => ({
        c1: at(segment.c1),
        c2: at(segment.c2),
        to: at(segment.to),
      })),
      closed: subpath.closed,
    })),
    ...(curve.fillRule ? { fillRule: curve.fillRule } : {}),
  }
}

/**
 * 一条世界曲线，是不是**正好**落在某个既有 Entity 已经存着的那份几何上。
 *
 * @remarks
 * 比的是**落地写入用的那个空间**：父级局部、归一化之后的 `Curve`，**加上那个归一化偏移**。
 * 求解是确定性的（同一份输入给出逐位相同的结果），因此这不是一次浮点比较，而是在问
 * 「这一次求出来的，是不是上一次写进去的那一个」。
 *
 * **偏移必须一起比。**`Curve` 归一化之后紧包围盒的左上角恒在原点，位置整个住在
 * `LayoutItem.offset` 里——只比 `Curve` 的话，一个矩形被竖线劈成的左右两半是**全等**的，
 * 于是填了左半再点右半会被判成「就是那一块」，右半永远填不上。
 *
 * 比较方式与 `entity.curve.set` 自己那条 noop 判断逐字相同（`jsonEqual` 比 `Curve` 与
 * `offset`），因此两处对「没有变化」给出同一个答案。
 *
 * @public
 */
export function stageCurveMatchesEntity(
  document: ComposeDocument,
  snapshot: ComposeLayoutSnapshot,
  curve: ComposeCurve,
  entityId: string,
): boolean {
  const entity = document.entities[entityId]
  const current = entity ? getComposeCurve(entity) : undefined
  const item = entity ? getComposeLayoutItem(entity) : undefined
  if (!current || !item) return false
  const next = normalizeComposeCurveGeometry(
    stageCurveToParent(document, snapshot, curve, entityId),
  )
  return jsonEqual(current as unknown as JsonValue, next.curve as unknown as JsonValue)
    && jsonEqual(item.offset as unknown as JsonValue, next.offset as unknown as JsonValue)
}
