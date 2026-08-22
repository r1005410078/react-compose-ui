import { composeCurvePoints, getComposeCurve, getComposeVisibility } from '@compose-ui/core'
import type { ComposeDocument, ComposeEntity } from '@compose-ui/core'
import { applyMatrix } from '../geometry'
import type { StagePoint } from '../geometry'
import type { StageSceneIndex } from './scene-index'

/**
 * 特征点的种类。
 *
 * @remarks
 * 同时定义**优先级顺序**：端点压过中点。这是 AutoCAD 的惯例，也是可预期性的一部分——
 * 同等距离下总是命中端点，用户才敢直接点过去而不用先放大确认。
 *
 * 圆心与象限点随圆弧一起加入，届时插在中点之后。
 *
 * @public
 */
export type StageFeatureSnapMode = 'endpoint' | 'midpoint'

/** 一个特征点候选。 @public */
export interface StageFeaturePoint {
  readonly mode: StageFeatureSnapMode
  readonly entityId: string
  /** 世界坐标。 */
  readonly point: StagePoint
}

const MODE_ORDER: readonly StageFeatureSnapMode[] = ['endpoint', 'midpoint']

function midpoint(a: StagePoint, b: StagePoint): StagePoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function curveFeaturePoints(
  entity: ComposeEntity,
  toWorld: (point: StagePoint) => StagePoint,
): readonly { readonly mode: StageFeatureSnapMode; readonly point: StagePoint }[] {
  const curve = getComposeCurve(entity)
  if (!curve) return []
  const points = composeCurvePoints(curve).map(toWorld)
  const result: { readonly mode: StageFeatureSnapMode; readonly point: StagePoint }[] = []
  points.forEach((point) => result.push({ mode: 'endpoint', point }))
  points.slice(0, -1).forEach((point, index) => {
    result.push({ mode: 'midpoint', point: midpoint(point, points[index + 1]!) })
  })
  return result
}

/**
 * 在世界点附近求解几何特征点。
 *
 * @remarks
 * 这是与对齐吸附（`snapCandidates`）**并列**的另一条查询，不是它的扩展：对齐吸附返回的是
 * `{ axis, value }` 的参考**线**，服务「与那个盒的左边对齐」；本查询返回一个二维**点**，
 * 服务「正好落在那条线的端点上」。两者输入相同、输出形状不同、消费方式也不同。
 *
 * 候选**只来自带 `Curve` 的 Entity**。盒的角点与中心刻意不出：那正是对齐吸附覆盖的语义，
 * 两套同时生效会在同一次取点里给出互相拉扯的答案，而用户看不出是哪一套在起作用。
 *
 * @param tolerance - 世界单位的容差；调用方用屏幕像素除以 zoom 换算。
 * @param excludedIds - 不参与捕捉的 Entity，例如正在被这条命令编辑的那个。
 * @returns 容差内优先级最高、同优先级下最近的候选；没有则返回 null。
 * @public
 */
export function findStageFeaturePoint(
  document: ComposeDocument,
  index: StageSceneIndex,
  point: StagePoint,
  tolerance: number,
  excludedIds: readonly string[] = [],
): StageFeaturePoint | null {
  if (!(tolerance > 0)) return null
  const excluded = new Set(excludedIds)
  const limit = tolerance * tolerance
  let best: { readonly candidate: StageFeaturePoint; readonly distance: number } | null = null

  for (const entityId of index.order) {
    if (excluded.has(entityId)) continue
    const entity = document.entities[entityId]
    if (!entity || !getComposeVisibility(entity).visible) continue
    const matrix = index.getWorldMatrix(entityId)
    if (!matrix) continue
    const toWorld = (local: StagePoint) => applyMatrix(matrix, local)
    for (const candidate of curveFeaturePoints(entity, toWorld)) {
      const dx = candidate.point.x - point.x
      const dy = candidate.point.y - point.y
      const distance = dx * dx + dy * dy
      if (distance > limit) continue
      const next = { candidate: { ...candidate, entityId }, distance }
      if (best === null) {
        best = next
        continue
      }
      const rank = MODE_ORDER.indexOf(candidate.mode) - MODE_ORDER.indexOf(best.candidate.mode)
      // 优先级先于距离：端点在容差内就赢，哪怕中点更近一点。
      if (rank < 0 || (rank === 0 && distance < best.distance)) best = next
    }
  }
  return best?.candidate ?? null
}
