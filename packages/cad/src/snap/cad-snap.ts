import { getCadLine, getCadPlacement, type CadDocument } from '../document'
import type { CadInputPoint } from '../point-input'
import {
  segmentIntersection,
  segmentMidpoint,
  segmentNearPoint,
  squaredDistance,
  type CadSegment,
} from '../geometry'

/**
 * 对象捕捉模式。
 *
 * @remarks
 * 目前只有直线图元，这三种即覆盖它的全部几何特征。圆心、切点、垂足等随对应图元一并加入。
 *
 * @public
 */
export type CadSnapMode = 'endpoint' | 'midpoint' | 'intersection'

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
 * @public
 */
export const CAD_SNAP_MODES: readonly CadSnapMode[] = ['endpoint', 'midpoint', 'intersection']

function priorityOf(mode: CadSnapMode) {
  return CAD_SNAP_MODES.indexOf(mode)
}

/**
 * 在捕捉半径内求出最佳特征点。
 *
 * @remarks
 * **交点是 O(n²)**，因此先用捕捉半径的包围盒过滤出候选线段（O(n)，通常剩不到五条），再在候选
 * 之间两两求交。不建空间索引：候选过滤已经把常数压得很低，而索引要处理增量维护与失效，属于
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
  const visibleLayers = new Set(
    document.layers.filter(({ visible }) => visible).map(({ id }) => id),
  )

  const nearby: CadSegment[] = []
  for (const id of document.rootIds) {
    const entity = document.entities[id]
    if (!entity) continue
    const line = getCadLine(entity)
    if (!line) continue
    if (!visibleLayers.has(getCadPlacement(entity)?.layerId ?? '')) continue
    if (!segmentNearPoint(line, point, radius)) continue
    nearby.push(line)
  }

  const candidates: CadSnapCandidate[] = []
  for (const segment of nearby) {
    if (enabled.has('endpoint')) {
      candidates.push({ mode: 'endpoint', point: segment.start })
      candidates.push({ mode: 'endpoint', point: segment.end })
    }
    if (enabled.has('midpoint')) {
      candidates.push({ mode: 'midpoint', point: segmentMidpoint(segment) })
    }
  }
  if (enabled.has('intersection')) {
    for (let i = 0; i < nearby.length; i += 1) {
      for (let j = i + 1; j < nearby.length; j += 1) {
        const crossing = segmentIntersection(nearby[i]!, nearby[j]!)
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
