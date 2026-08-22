import { collectCadVisibleCurves } from '../block'
import { collectCadInstancePorts } from '../connection'
import type { CadDocument } from '../document'
import type { CadInputPoint } from '../point-input'
import {
  arcEndpoints,
  isFullCircle,
  arcMidpoint,
  arcQuadrants,
  curveNearPoint,
  segmentIntersection,
  segmentMidpoint,
  squaredDistance,
  type CadCurve,
  type CadSegment,
} from '../geometry'

/**
 * 对象捕捉模式。
 *
 * @remarks
 * 端口是块声明的接线点，圆心与象限点属于圆弧，其余覆盖直线图元的全部几何特征。切点、垂足等
 * 随需要一并加入。
 *
 * @public
 */
export type CadSnapMode =
  | 'port'
  | 'endpoint'
  | 'midpoint'
  | 'center'
  | 'quadrant'
  | 'intersection'

/** 一个捕捉候选。 @public */
export interface CadSnapCandidate {
  readonly mode: CadSnapMode
  readonly point: CadInputPoint
}

/**
 * 默认启用的捕捉模式，同时定义**优先级顺序**。
 *
 * @remarks
 * 端点压过中点、中点压过交点：这是 AutoCAD 的惯例，也是可预期性的一部分——同等距离下总是
 * 命中端点，用户才敢直接点过去而不用先放大确认。
 *
 * **端口排在最前**，理由是一个静默失败：端口几乎总是画在符号线段的端点上（接线柱就是那根
 * 短线的头）。同等距离下若端点胜出，用户点在接线柱上得到的是一条自由端点的导线——屏幕上像素
 * 级正确，要等到移动符号时才暴露，而画的当刻没有任何视觉线索。
 *
 * 圆心排在象限点之前，两者都排在端点、中点之后——这是 AutoCAD 的次序。
 *
 * @public
 */
export const CAD_SNAP_MODES: readonly CadSnapMode[] = [
  'port',
  'endpoint',
  'midpoint',
  'center',
  'quadrant',
  'intersection',
]

function priorityOf(mode: CadSnapMode) {
  return CAD_SNAP_MODES.indexOf(mode)
}

/**
 * 在捕捉半径内求出最佳特征点。
 *
 * @remarks
 * **交点是 O(n²)**，因此先用捕捉半径的包围盒过滤出候选几何（O(n)，通常剩不到五条），再在候选
 * 的**线段**之间两两求交——线–弧与弧–弧求交是另一笔工作，接线时想捕的是圆心与象限点。不建空间索引：候选过滤已经把常数压得很低，而索引要处理增量维护与失效，属于
 * 当前没有证据支持的复杂度。图元数量真正上去时再说，届时本函数的签名不必变。
 *
 * 隐藏图层上的图元不参与——它在屏幕上看不见，捕捉到它会让光标莫名其妙地跳走。
 *
 * @param document - 当前文档。
 * @param point - 目标点（世界坐标）。
 * @param radius - 捕捉半径（世界单位）；宿主按屏幕像素除以缩放得出。
 * @param modes - 启用的模式；顺序不影响优先级，优先级由 {@link CAD_SNAP_MODES} 定义。
 * @returns 最佳候选，半径内没有则为 `null`。
 * @public
 */
export function findCadSnap(
  document: CadDocument,
  point: CadInputPoint,
  radius: number,
  modes: readonly CadSnapMode[] = CAD_SNAP_MODES,
): CadSnapCandidate | null {
  if (!(radius > 0) || modes.length === 0) return null
  const enabled = new Set(modes)

  // 与命中、框选共用同一条可见性遍历：三者对「什么算可见」必须给出同一个答案。块实例在这里
  // 同样被展开——插完符号要能捕到它的接线端点，否则块只是一张贴图。
  const nearby: CadCurve[] = []
  for (const { curve } of collectCadVisibleCurves(document)) {
    if (!curveNearPoint(curve, point, radius)) continue
    nearby.push(curve)
  }
  const nearbySegments: CadSegment[] = nearby.filter(
    (curve): curve is CadCurve & { kind: 'segment' } => curve.kind === 'segment',
  )

  const candidates: CadSnapCandidate[] = []
  if (enabled.has('port')) {
    for (const { point: candidate } of collectCadInstancePorts(document)) {
      candidates.push({ mode: 'port', point: candidate })
    }
  }
  for (const curve of nearby) {
    // 整圆没有端点也没有中点：它们只是「起始角写在哪」的产物，会随一次等价的重写而跳到别处。
    // AutoCAD 对圆同样只给圆心与象限点。
    const hasEnds = curve.kind === 'segment' || !isFullCircle(curve)
    if (hasEnds) {
      const [start, end] = curve.kind === 'segment'
        ? [curve.start, curve.end]
        : arcEndpoints(curve)
      if (enabled.has('endpoint')) {
        candidates.push({ mode: 'endpoint', point: start })
        candidates.push({ mode: 'endpoint', point: end })
      }
      if (enabled.has('midpoint')) {
        candidates.push({
          mode: 'midpoint',
          point: curve.kind === 'segment' ? segmentMidpoint(curve) : arcMidpoint(curve),
        })
      }
    }
    if (curve.kind !== 'arc') continue
    if (enabled.has('center')) {
      candidates.push({ mode: 'center', point: curve.center })
    }
    if (enabled.has('quadrant')) {
      for (const quadrant of arcQuadrants(curve)) {
        candidates.push({ mode: 'quadrant', point: quadrant })
      }
    }
  }
  if (enabled.has('intersection')) {
    for (let i = 0; i < nearbySegments.length; i += 1) {
      for (let j = i + 1; j < nearbySegments.length; j += 1) {
        const crossing = segmentIntersection(nearbySegments[i]!, nearbySegments[j]!)
        if (crossing) candidates.push({ mode: 'intersection', point: crossing })
      }
    }
  }

  const limit = radius * radius
  let best: CadSnapCandidate | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const candidate of candidates) {
    const distance = squaredDistance(candidate.point, point)
    if (distance > limit) continue
    if (best === null
      || priorityOf(candidate.mode) < priorityOf(best.mode)
      || (candidate.mode === best.mode && distance < bestDistance)) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}
