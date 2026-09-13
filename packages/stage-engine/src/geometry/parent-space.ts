/**
 * 世界坐标 → 某个 Entity 的**父级**局部坐标。
 *
 * @remarks
 * 落地一条曲线、判断一块填充过没过期、判断这一下是不是点在同一块填充上——三件事换算的是同一个
 * 空间，而它们各写一份的症状不是代码长得像：是**两处对同一份几何算出不同的局部坐标**，
 * 于是「明明没动过却一直显示过期」或者「再点一次又叠了一块」。因此换算只有这一个入口，
 * 与「`projectComposeCurveToBox` 是盒到几何的唯一入口」是同一条判断。
 */

import {
  type ComposeCurve,
  type ComposeDocument,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import {
  applyMatrix,
  getEntityParentId,
  getEntityWorldMatrix,
  invertMatrix,
  type StagePoint,
} from './stage-geometry'

/**
 * 把一条曲线的每个点搬进另一个坐标系。
 *
 * @remarks
 * Stage 的世界矩阵链只有平移与旋转（缩放由 `LayoutItem` 的宽高表达，不进矩阵），因此弧
 * 只需搬圆心、把起始角加上矩阵的旋转量——半径不受影响。矩阵若带非等比缩放，弧就不再是弧，
 * 那是另一件事，本条链上不会出现。
 *
 * 目标坐标系由 `mapPoint` 表达而不是由一个 Entity id：落地时那个父级是**落点所在的容器**，
 * 未必是任何既有 Entity 的父级。
 *
 * @public
 */
export function stageCurveToSpace(
  curve: ComposeCurve,
  mapPoint: (point: StagePoint) => StagePoint,
  rotationDegrees: number,
): ComposeCurve {
  // `StagePoint` 没有索引签名，`ComposePosition` 有；重建一次比放宽协议类型便宜。
  const toParent = (point: StagePoint) => {
    const next = mapPoint(point)
    return { x: next.x, y: next.y }
  }
  if (curve.kind === 'line') {
    return { ...curve, start: toParent(curve.start), end: toParent(curve.end) }
  }
  if (curve.kind === 'polyline') {
    return { ...curve, vertices: curve.vertices.map(toParent) }
  }
  /*
   * 绘图命令眼下不产出 `path`（最窄 kind 落成直线、弧或多段线），但这条链是「任意曲线落地」
   * 的唯一入口，缺这一支的症状会是某天从别处落一条 `path` 时它静默地把控制点留在原坐标系里。
   * 旋转不出现在这里：只有弧把它记成角，其余 kind 由 `mapPoint` 一并带过去。
   */
  if (curve.kind === 'path') {
    return {
      ...curve,
      subpaths: curve.subpaths.map((subpath) => ({
        ...subpath,
        start: toParent(subpath.start),
        segments: subpath.segments.map((segment) => ({
          c1: toParent(segment.c1),
          c2: toParent(segment.c2),
          to: toParent(segment.to),
        })),
      })),
    }
  }
  return {
    ...curve,
    center: toParent(curve.center),
    startAngle: curve.startAngle + rotationDegrees,
  }
}

/** 某个 Entity 的父级世界矩阵的逆；根级下没有父级时为 `null`。 */
function parentInverse(
  document: ComposeDocument,
  snapshot: ComposeLayoutSnapshot,
  entityId: string,
) {
  const parentId = getEntityParentId(document, entityId)
  return parentId ? invertMatrix(getEntityWorldMatrix(document, snapshot, parentId)) : null
}

/**
 * 把一条世界坐标的曲线换算到某个既有 Entity 的**父级**局部坐标。
 *
 * @public
 */
export function stageCurveToParent(
  document: ComposeDocument,
  snapshot: ComposeLayoutSnapshot,
  curve: ComposeCurve,
  entityId: string,
): ComposeCurve {
  const inverse = parentInverse(document, snapshot, entityId)
  const toParent = (point: StagePoint) => (inverse ? applyMatrix(inverse, point) : point)
  const rotationDegrees = inverse ? Math.atan2(inverse.b, inverse.a) * 180 / Math.PI : 0
  return stageCurveToSpace(curve, toParent, rotationDegrees)
}

/**
 * 把一个世界坐标的点换算到某个既有 Entity 的**父级**局部坐标。
 *
 * @remarks
 * 与 {@link stageCurveToParent} 是同一条换算的点版本：填充的锚点住在 Entity 局部空间，而重新
 * 生成要先把它搬回世界求面、再搬回来写下去，两头必须是同一份矩阵。
 *
 * @public
 */
export function stagePointToParent(
  document: ComposeDocument,
  snapshot: ComposeLayoutSnapshot,
  point: StagePoint,
  entityId: string,
): StagePoint {
  const inverse = parentInverse(document, snapshot, entityId)
  return inverse ? applyMatrix(inverse, point) : point
}
