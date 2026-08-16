import { sampleComposeAnimationTrack } from './animation-sampler'
import type { ComposeAnimationTrack, ComposeKeyframe } from './animation-types'
import { isComposeAnimationValue } from './animation-value'

/** 二维平面上的一点。 @public */
export interface ComposeMotionPathPoint {
  readonly x: number
  readonly y: number
}

/**
 * 运动路径上的一个关键帧顶点。
 *
 * @remarks
 * `inTangent` / `outTangent` 是**绝对坐标的手柄端点**，不是相对增量——覆盖层要画的就是
 * 这两个点。文档里存的是相对增量，换算在这里完成，避免每个渲染方各算一遍。
 * `corner` 顶点没有手柄，两侧都是 `null`。
 *
 * @public
 */
export interface ComposeMotionPathVertex {
  /** 对应关键帧的稳定标识。 */
  readonly keyframeId: string
  readonly timeMs: number
  readonly point: ComposeMotionPathPoint
  readonly inTangent: ComposeMotionPathPoint | null
  readonly outTangent: ComposeMotionPathPoint | null
  readonly mode: 'corner' | 'smooth'
}

/**
 * 一条 `vector2` 轨道求值出的可编辑运动路径几何。
 *
 * @remarks
 * `polyline` 与 `dots` 是两套不同的点集，不能合并：前者按**弧长**细分只为把轨迹画平滑，
 * 后者按**时间**等分用来表达速度快慢——间距越大走得越快。
 *
 * @public
 */
export interface ComposeMotionPathGeometry {
  readonly vertices: readonly ComposeMotionPathVertex[]
  readonly polyline: readonly ComposeMotionPathPoint[]
  readonly dots: readonly ComposeMotionPathPoint[]
}

/** 每个路径段细分为多少条折线；曲线段用满，直线段只留两端。 */
const SEGMENT_SUBDIVISIONS = 24
/** 等时采样点总数上限，避免长动画在覆盖层上糊成一片。 */
const MAX_TIME_DOTS = 60
/** 每 16 ms 一个等时采样点，约等于 60fps 的一帧。 */
const TIME_DOT_STEP_MS = 16

const EMPTY: ComposeMotionPathGeometry = { vertices: [], polyline: [], dots: [] }

function toPoint(value: unknown): ComposeMotionPathPoint | null {
  if (!isComposeAnimationValue(value, 'vector2')) return null
  // 判定已经保证恰好有两个有限数字字段 x / y，但它只把类型收窄到 `JsonValue`。
  const point = value as unknown as ComposeMotionPathPoint
  return { x: point.x, y: point.y }
}

function tangentMode(keyframe: ComposeKeyframe) {
  return keyframe.spatial?.mode === 'smooth' ? 'smooth' : 'corner'
}

function cubicPoint(
  p0: ComposeMotionPathPoint,
  p1: ComposeMotionPathPoint,
  p2: ComposeMotionPathPoint,
  p3: ComposeMotionPathPoint,
  t: number,
): ComposeMotionPathPoint {
  const inverse = 1 - t
  const a = inverse * inverse * inverse
  const b = 3 * inverse * inverse * t
  const c = 3 * inverse * t * t
  const d = t * t * t
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  }
}

/**
 * 求一段路径在参数 `t` 上的位置。
 *
 * @remarks
 * 两端都是 `corner` 时退化为直线；任一端是 `smooth` 就走三次贝塞尔，控制点是
 * 起点加出向切线与终点加入向切线。这里的 `t` 是**空间参数**，与时间无关——
 * 时间维度由 {@link sampleComposeAnimationTrack} 单独处理。
 */
function segmentPoint(
  from: ComposeMotionPathVertex,
  to: ComposeMotionPathVertex,
  t: number,
): ComposeMotionPathPoint {
  if (!from.outTangent && !to.inTangent) {
    return {
      x: from.point.x + (to.point.x - from.point.x) * t,
      y: from.point.y + (to.point.y - from.point.y) * t,
    }
  }
  return cubicPoint(
    from.point,
    from.outTangent ?? from.point,
    to.inTangent ?? to.point,
    to.point,
    t,
  )
}

function buildVertices(track: ComposeAnimationTrack): readonly ComposeMotionPathVertex[] {
  const vertices: ComposeMotionPathVertex[] = []
  track.keyframes.forEach((keyframe) => {
    const point = toPoint(keyframe.value)
    if (!point) return
    const mode = tangentMode(keyframe)
    const spatial = keyframe.spatial
    vertices.push({
      keyframeId: keyframe.id,
      timeMs: keyframe.timeMs,
      point,
      mode,
      inTangent: mode === 'smooth' && spatial
        ? { x: point.x + spatial.inX, y: point.y + spatial.inY }
        : null,
      outTangent: mode === 'smooth' && spatial
        ? { x: point.x + spatial.outX, y: point.y + spatial.outY }
        : null,
    })
  })
  return vertices
}

function buildPolyline(
  vertices: readonly ComposeMotionPathVertex[],
): readonly ComposeMotionPathPoint[] {
  if (vertices.length === 0) return []
  if (vertices.length === 1) return [vertices[0]!.point]
  const polyline: ComposeMotionPathPoint[] = [vertices[0]!.point]
  for (let index = 0; index + 1 < vertices.length; index += 1) {
    const from = vertices[index]!
    const to = vertices[index + 1]!
    // 直线段不需要细分，只补终点；曲线段才按弧长细分。
    const steps = !from.outTangent && !to.inTangent ? 1 : SEGMENT_SUBDIVISIONS
    for (let step = 1; step <= steps; step += 1) {
      polyline.push(segmentPoint(from, to, step / steps))
    }
  }
  return polyline
}

function buildTimeDots(
  track: ComposeAnimationTrack,
  vertices: readonly ComposeMotionPathVertex[],
): readonly ComposeMotionPathPoint[] {
  if (vertices.length === 0) return []
  const startMs = vertices[0]!.timeMs
  const endMs = vertices[vertices.length - 1]!.timeMs
  const span = endMs - startMs
  if (span <= 0) return [vertices[0]!.point]
  const count = Math.min(MAX_TIME_DOTS, Math.max(2, Math.round(span / TIME_DOT_STEP_MS)))
  const dots: ComposeMotionPathPoint[] = []
  for (let index = 0; index <= count; index += 1) {
    const point = toPoint(sampleComposeAnimationTrack(track, startMs + (span * index) / count))
    if (point) dots.push(point)
  }
  return dots
}

/**
 * 把一条 `vector2` 轨道求值为可编辑的运动路径几何。
 *
 * @remarks
 * 非 `vector2` 轨道返回空几何而不是抛错——调用方通常在遍历全部轨道时顺带调用它。
 *
 * 等时采样点走的是完整采样器，因此关键帧的时间插值（`hold` / `cubic`）会如实反映在点的
 * 疏密上；折线只关心空间形状，与时间插值无关。
 *
 * @public
 */
export function sampleComposeMotionPath(
  track: ComposeAnimationTrack,
): ComposeMotionPathGeometry {
  if (track.valueKind !== 'vector2') return EMPTY
  const vertices = buildVertices(track)
  if (vertices.length === 0) return EMPTY
  return {
    vertices,
    polyline: buildPolyline(vertices),
    dots: buildTimeDots(track, vertices),
  }
}
