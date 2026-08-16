import type {
  ComposeDocument,
  ComposeEntity,
  JsonObject,
  JsonValue,
} from '@compose-ui/core'
import { getComposeEntityTracks } from './animation-component'
import type {
  ComposeAnimationTrack,
  ComposeKeyframe,
  ComposeKeyframeInterpolation,
} from './animation-types'
import { isComposeAnimationValue, mixComposeAnimationValue } from './animation-value'

/** 牛顿迭代上限；超过后退化为二分，避免病态控制点导致长循环。 */
const CUBIC_NEWTON_ITERATIONS = 8
/** 牛顿法在导数过小时不可靠，低于该阈值直接改用二分。 */
const CUBIC_MIN_SLOPE = 1e-6
const CUBIC_BISECTION_ITERATIONS = 20

function cubicComponent(t: number, a: number, b: number) {
  // 标准 cubic-bezier，P0 = 0、P3 = 1 时的 Bernstein 展开。
  const inverse = 1 - t
  return 3 * inverse * inverse * t * a + 3 * inverse * t * t * b + t * t * t
}

function cubicSlope(t: number, a: number, b: number) {
  const inverse = 1 - t
  return 3 * inverse * inverse * a
    + 6 * inverse * t * (b - a)
    + 3 * t * t * (1 - b)
}

/**
 * 解 `cubic-bezier(x1, y1, x2, y2)` 在给定进度上的输出。
 *
 * @remarks
 * 曲线的 x 轴是时间进度、y 轴是值进度，两者都不是参数 t，所以要先由 x 反解 t 再取 y。
 * 先用牛顿法快速收敛；导数过小（曲线在该处近乎水平）时牛顿法会发散，退回二分兜底。
 */
function solveCubicBezier(progress: number, control: readonly [number, number, number, number]) {
  const [x1, y1, x2, y2] = control
  // 恒等曲线直接短路，省掉常见 linear-ish 缓动的迭代开销。
  if (x1 === y1 && x2 === y2) return progress
  let t = progress
  for (let index = 0; index < CUBIC_NEWTON_ITERATIONS; index += 1) {
    const error = cubicComponent(t, x1, x2) - progress
    const slope = cubicSlope(t, x1, x2)
    if (Math.abs(slope) < CUBIC_MIN_SLOPE) break
    const next = t - error / slope
    if (next === t) break
    t = next
  }
  if (t < 0 || t > 1 || Number.isNaN(t)) {
    let low = 0
    let high = 1
    t = progress
    for (let index = 0; index < CUBIC_BISECTION_ITERATIONS; index += 1) {
      t = (low + high) / 2
      if (cubicComponent(t, x1, x2) < progress) low = t
      else high = t
    }
  }
  return cubicComponent(t, y1, y2)
}

/**
 * 把线性时间进度按插值方式重映射为值进度。
 *
 * @remarks
 * `hold` 在这里返回 `0`——保持前值直到下一帧，跳变由调用方在命中末端关键帧时处理。
 */
function remapProgress(interpolation: ComposeKeyframeInterpolation, progress: number) {
  if (interpolation.kind === 'hold') return 0
  if (interpolation.kind === 'linear') return progress
  return solveCubicBezier(progress, interpolation.control)
}

function findSegment(keyframes: readonly ComposeKeyframe[], timeMs: number) {
  // 关键帧按 timeMs 升序，线性扫描即可；单轨道关键帧数量在人工编辑量级，
  // 二分带来的常数收益抵不过它在乱序数据下的不可预测行为。
  let index = 0
  while (index + 1 < keyframes.length && keyframes[index + 1]!.timeMs <= timeMs) index += 1
  return index
}

/**
 * 在给定毫秒位置求值单条轨道。
 *
 * @remarks
 * 播放头位于首帧之前或末帧之后时钳制到端点值，不做外推。轨道为空、或参与求值的关键帧值形状
 * 与 `valueKind` 不符时返回 `undefined`——采样绝不因为坏数据抛错，坏数据的报告是
 * `collectComposeAnimationIssues` 的职责。
 *
 * @returns 该时刻的值；无法求值时为 `undefined`。
 * @public
 */
export function sampleComposeAnimationTrack(
  track: ComposeAnimationTrack,
  timeMs: number,
): JsonValue | undefined {
  const { keyframes, valueKind } = track
  if (keyframes.length === 0) return undefined

  const first = keyframes[0]!
  if (timeMs <= first.timeMs) {
    return isComposeAnimationValue(first.value, valueKind) ? first.value : undefined
  }
  const last = keyframes[keyframes.length - 1]!
  if (timeMs >= last.timeMs) {
    return isComposeAnimationValue(last.value, valueKind) ? last.value : undefined
  }

  const index = findSegment(keyframes, timeMs)
  const from = keyframes[index]!
  const to = keyframes[index + 1]
  if (!to) return isComposeAnimationValue(from.value, valueKind) ? from.value : undefined
  if (!isComposeAnimationValue(from.value, valueKind)
    || !isComposeAnimationValue(to.value, valueKind)) return undefined

  const span = to.timeMs - from.timeMs
  // 零长度段没有可插值的区间，取起点值即可，同时避免除零。
  if (span <= 0) return from.value
  const progress = remapProgress(from.interpolation, (timeMs - from.timeMs) / span)
  return mixComposeAnimationValue(valueKind, from.value, to.value, progress)
}

/**
 * 在 JsonObject 树上按路径不可变写入，未触及的分支保持原引用。
 *
 * @returns 写入后的新对象；路径无效时返回 `null` 表示应当跳过该轨道。
 */
function setAtPath(
  target: JsonObject,
  path: readonly (string | number)[],
  value: JsonValue,
): JsonObject | null {
  const [head, ...rest] = path
  if (typeof head !== 'string') return null
  if (rest.length === 0) return { ...target, [head]: value }
  const child = target[head]
  // `Array.isArray` 不会收窄 `readonly JsonValue[]`，所以这里显式判定而不是依赖类型收窄。
  if (child === null || typeof child !== 'object' || Array.isArray(child)) return null
  const nextChild = setAtPath(child as JsonObject, rest, value)
  return nextChild === null ? null : { ...target, [head]: nextChild }
}

function applyTracksToEntity(
  entity: ComposeEntity,
  tracks: readonly ComposeAnimationTrack[],
  timeMs: number,
): ComposeEntity {
  let components = entity.components
  let changed = false
  tracks.forEach((track) => {
    const [componentKey, ...rest] = track.path
    if (typeof componentKey !== 'string' || rest.length === 0) return
    const component = components[componentKey]
    // 指向不存在的 Component 的轨道是失效数据，跳过而不是凭空造一个。
    if (component === undefined) return
    const sampled = sampleComposeAnimationTrack(track, timeMs)
    if (sampled === undefined) return
    const nextComponent = setAtPath(component, rest, sampled)
    if (nextComponent === null) return
    components = { ...components, [componentKey]: nextComponent }
    changed = true
  })
  return changed ? { ...entity, components } : entity
}

/**
 * 把动画在给定时刻的全部采样值套用到文档上。
 *
 * @remarks
 * 未被任何轨道命中的 Entity 保持原对象引用，整份文档在无命中时也返回原引用。Stage 与 Preview
 * 的子树 memo 依赖引用相等，否则播放时每帧都会让整棵场景失效。
 *
 * 失效路径与坏数据被静默跳过，采样绝不抛错。
 *
 * @param animationId - 文档动画清单中的动画 ID；不存在时原样返回文档。
 * @public
 */
export function applyComposeAnimationAtTime(
  document: ComposeDocument,
  animationId: string,
  timeMs: number,
): ComposeDocument {
  let entities = document.entities
  let changed = false
  Object.entries(document.entities).forEach(([entityId, entity]) => {
    const tracks = getComposeEntityTracks(entity, animationId)
    if (tracks.length === 0) return
    const nextEntity = applyTracksToEntity(entity, tracks, timeMs)
    if (nextEntity === entity) return
    entities = { ...entities, [entityId]: nextEntity }
    changed = true
  })
  return changed ? { ...document, entities } : document
}
