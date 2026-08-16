import type {
  ComposeAnimationClip,
  ComposeAnimationKeyframe,
  ComposeAnimationPanelModel,
  ComposeAnimationPanelValue,
  ComposeAnimationPlaybackMode,
} from './types'

/** 返回显式片段；旧会话没有片段时提供覆盖全时长的兼容默认值。 */
export function getComposeAnimationClips(model: ComposeAnimationPanelModel): readonly ComposeAnimationClip[] {
  // 未显式提供片段时，每条对象轨道各自获得一条覆盖全时长的片段——片段必须有归属轨道，
  // 用一条全局片段会让多轨道会话无处安放它。
  return model.clips ?? model.tracks.map((track) => ({
    id: `${track.id}-clip`,
    trackId: track.id,
    label: track.label,
    startTimeMs: 0,
    endTimeMs: model.durationMs,
  }))
}

export type ComposeAnimationKeyframeLocation = {
  readonly trackIndex: number
  readonly propertyIndex: number
  readonly keyframeIndex: number
}

export function clampComposeAnimationTime(value: number, durationMs: number) {
  return Math.min(durationMs, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)))
}

export function updateComposeAnimationDuration(
  value: ComposeAnimationPanelValue,
  durationMs: number,
): ComposeAnimationPanelValue {
  const previousDurationMs = value.model.durationMs
  const lastContentKeyframeMs = value.model.tracks.flatMap((track) => track.properties)
    .flatMap((property) => property.keyframes)
    .filter((keyframe) => keyframe.timeMs < previousDurationMs)
    .reduce((maximum, keyframe) => Math.max(maximum, keyframe.timeMs), 0)
  // 尾帧必须始终处于其他关键帧之后，避免缩短时生成同一属性轨道的重复时间。
  const nextDurationMs = Math.max(
    lastContentKeyframeMs + 10,
    Math.round(Number.isFinite(durationMs) ? durationMs : previousDurationMs),
  )
  if (nextDurationMs === previousDurationMs) return value
  return {
    ...value,
    currentTimeMs: clampComposeAnimationTime(value.currentTimeMs, nextDurationMs),
    model: {
      ...value.model,
      durationMs: nextDurationMs,
      clips: value.model.clips?.map((clip) => clip.endTimeMs === previousDurationMs
        ? { ...clip, endTimeMs: nextDurationMs }
        : clip),
      tracks: value.model.tracks.map((track) => ({
        ...track,
        properties: track.properties.map((property) => ({
          ...property,
          keyframes: property.keyframes.map((keyframe) => keyframe.timeMs === previousDurationMs
            ? { ...keyframe, timeMs: nextDurationMs }
            : keyframe),
        })),
      })),
    },
  }
}

export function updateComposeAnimationClip(
  value: ComposeAnimationPanelValue,
  clipId: string,
  range: Pick<ComposeAnimationClip, 'startTimeMs' | 'endTimeMs'>,
): ComposeAnimationPanelValue {
  const clips = getComposeAnimationClips(value.model)
  const clip = clips.find(({ id }) => id === clipId)
  if (!clip) return value
  const minimumDurationMs = Math.min(10, value.model.durationMs)
  let startTimeMs = clampComposeAnimationTime(range.startTimeMs, value.model.durationMs)
  let endTimeMs = clampComposeAnimationTime(range.endTimeMs, value.model.durationMs)
  if (endTimeMs - startTimeMs < minimumDurationMs) {
    if (range.startTimeMs <= range.endTimeMs) {
      endTimeMs = Math.min(value.model.durationMs, startTimeMs + minimumDurationMs)
      startTimeMs = Math.max(0, endTimeMs - minimumDurationMs)
    }
    else {
      startTimeMs = Math.max(0, endTimeMs - minimumDurationMs)
      endTimeMs = Math.min(value.model.durationMs, startTimeMs + minimumDurationMs)
    }
  }
  const normalized = {
    ...clip,
    startTimeMs,
    endTimeMs,
  }
  if (normalized.startTimeMs === clip.startTimeMs && normalized.endTimeMs === clip.endTimeMs) {
    return { ...value, selectedClipId: clipId }
  }
  return {
    ...value,
    selectedClipId: clipId,
    model: {
      ...value.model,
      clips: clips.map((candidate) => candidate.id === clipId ? normalized : candidate),
    },
  }
}

export function advanceComposeAnimationPlayback(
  currentTimeMs: number,
  durationMs: number,
  playbackMode: ComposeAnimationPlaybackMode,
  elapsedMs: number,
  direction: 1 | -1,
) {
  const duration = Math.max(0, Math.round(Number.isFinite(durationMs) ? durationMs : 0))
  const elapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0)
  const current = clampComposeAnimationTime(currentTimeMs, duration)
  if (duration === 0) return { timeMs: 0, isPlaying: false, direction: 1 as const }

  if (playbackMode === 'play-once') {
    const nextTimeMs = current + elapsed
    if (nextTimeMs >= duration) return { timeMs: duration, isPlaying: false, direction: 1 as const }
    return { timeMs: Math.round(nextTimeMs), isPlaying: true, direction: 1 as const }
  }

  if (playbackMode === 'loop') {
    return {
      timeMs: Math.round((current + elapsed) % duration),
      isPlaying: true,
      direction: 1 as const,
    }
  }

  let nextTimeMs = current
  let remainingMs = elapsed
  let nextDirection: 1 | -1 = direction
  while (remainingMs > 0) {
    const boundary = nextDirection === 1 ? duration : 0
    const distanceToBoundary = Math.abs(boundary - nextTimeMs)
    if (distanceToBoundary === 0) {
      nextDirection = nextDirection === 1 ? -1 : 1
      continue
    }
    if (remainingMs < distanceToBoundary) {
      nextTimeMs += nextDirection * remainingMs
      remainingMs = 0
    }
    else {
      nextTimeMs = boundary
      remainingMs -= distanceToBoundary
      nextDirection = nextDirection === 1 ? -1 : 1
    }
  }
  return { timeMs: Math.round(nextTimeMs), isPlaying: true, direction: nextDirection }
}

export function findComposeAnimationKeyframe(
  model: ComposeAnimationPanelModel,
  keyframeId: string | null,
) {
  if (keyframeId === null) return undefined
  for (const [trackIndex, track] of model.tracks.entries()) {
    for (const [propertyIndex, property] of track.properties.entries()) {
      const keyframeIndex = property.keyframes.findIndex(({ id }) => id === keyframeId)
      if (keyframeIndex >= 0) {
        return {
          track,
          property,
          keyframe: property.keyframes[keyframeIndex]!,
          location: { trackIndex, propertyIndex, keyframeIndex },
        }
      }
    }
  }
  return undefined
}

function replaceKeyframe(
  model: ComposeAnimationPanelModel,
  location: ComposeAnimationKeyframeLocation,
  replacement: ComposeAnimationKeyframe,
): ComposeAnimationPanelModel {
  return {
    ...model,
    tracks: model.tracks.map((track, trackIndex) => trackIndex !== location.trackIndex
      ? track
      : {
          ...track,
          properties: track.properties.map((property, propertyIndex) => propertyIndex !== location.propertyIndex
            ? property
            : {
                ...property,
                keyframes: property.keyframes.map((keyframe, keyframeIndex) => keyframeIndex === location.keyframeIndex
                  ? replacement
                  : keyframe),
              }),
        }),
  }
}

export function updateComposeAnimationKeyframe(
  value: ComposeAnimationPanelValue,
  keyframeId: string,
  update: Partial<Pick<ComposeAnimationKeyframe, 'timeMs' | 'value' | 'interpolation'>>,
): { readonly value: ComposeAnimationPanelValue; readonly conflict: boolean } {
  const located = findComposeAnimationKeyframe(value.model, keyframeId)
  if (!located) return { value, conflict: false }
  const nextTimeMs = update.timeMs === undefined
    ? located.keyframe.timeMs
    : clampComposeAnimationTime(update.timeMs, value.model.durationMs)
  const conflict = located.property.keyframes.some((keyframe) => (
    keyframe.id !== keyframeId && keyframe.timeMs === nextTimeMs
  ))
  if (conflict) return { value, conflict: true }
  const nextKeyframe = { ...located.keyframe, ...update, timeMs: nextTimeMs }
  const model = replaceKeyframe(value.model, located.location, nextKeyframe)
  return { value: { ...value, model }, conflict: false }
}

export function toggleComposeAnimationTrack(
  value: ComposeAnimationPanelValue,
  trackId: string,
): ComposeAnimationPanelValue {
  return {
    ...value,
    model: {
      ...value.model,
      tracks: value.model.tracks.map((track) => track.id === trackId
        ? { ...track, expanded: !track.expanded }
        : track),
    },
  }
}

/**
 * 关键帧 ID 只把时间当作初始命名依据。关键帧被移动后 ID 不跟随时间变化，
 * 因此原名可能仍被占用，必须在整个会话范围内查重后追加序号。
 */
function createUniqueKeyframeId(model: ComposeAnimationPanelModel, propertyId: string, timeMs: number) {
  const used = new Set(model.tracks
    .flatMap((track) => track.properties)
    .flatMap((property) => property.keyframes)
    .map(({ id }) => id))
  const base = `${propertyId}-${timeMs}`
  if (!used.has(base)) return base
  let suffix = 2
  while (used.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

/** 最大缩放级别：300 ms 动画在此级别下撑出 6000 px，10 ms 吸附粒度仍有 200 px 可用而不至于让 DOM 过宽。 */
const MAX_PIXELS_PER_MS = 20

function computeComposeAnimationTimelineMaxScrollLeft(
  containerWidthPx: number,
  durationMs: number,
  pixelsPerMs: number,
) {
  const totalWidthPx = Math.max(containerWidthPx, durationMs * pixelsPerMs)
  return Math.max(0, totalWidthPx - containerWidthPx)
}

/**
 * 把缩放级别钳制在有效范围内：下限保证时间线总宽度不小于可视宽度（避免空白），
 * 上限是一个与关键帧 10 ms 吸附粒度匹配的固定值。容器宽度变化时应重新调用本函数
 * 对当前缩放级别求值，用返回值替换当前状态即可实现"回弹"。
 */
export function clampComposeAnimationPixelsPerMs(
  pixelsPerMs: number,
  containerWidthPx: number,
  durationMs: number,
): number {
  const safeDurationMs = Math.max(0, Number.isFinite(durationMs) ? durationMs : 0)
  const safeContainerWidthPx = Math.max(0, Number.isFinite(containerWidthPx) ? containerWidthPx : 0)
  const minPixelsPerMs = safeDurationMs > 0 ? safeContainerWidthPx / safeDurationMs : 0
  const safePixelsPerMs = Number.isFinite(pixelsPerMs) ? pixelsPerMs : minPixelsPerMs
  return Math.min(MAX_PIXELS_PER_MS, Math.max(minPixelsPerMs, safePixelsPerMs))
}

/** 缩放后的新级别与滚动位置。 */
export interface ComposeAnimationTimelineZoomResult {
  readonly pixelsPerMs: number
  readonly scrollLeft: number
}

/**
 * 以锚点时间为中心求解新的缩放级别与滚动位置，使锚点在视口内的像素偏移在缩放前后保持不变。
 *
 * @remarks
 * `factor` 是请求的缩放倍数（例如 `Math.exp(-event.deltaY * 0.002)`），实际生效的缩放级别会先
 * 经过 {@link clampComposeAnimationPixelsPerMs} 钳制；滚动位置的锚点方程必须用钳制后的级别求解，
 * 否则请求的缩放一旦被钳制到边界，锚点对齐关系就会算错。
 */
export function zoomComposeAnimationTimelineAt(
  currentPixelsPerMs: number,
  factor: number,
  anchorTimeMs: number,
  anchorOffsetPx: number,
  containerWidthPx: number,
  durationMs: number,
): ComposeAnimationTimelineZoomResult {
  const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : 1
  const nextPixelsPerMs = clampComposeAnimationPixelsPerMs(
    currentPixelsPerMs * safeFactor,
    containerWidthPx,
    durationMs,
  )
  const maxScrollLeft = computeComposeAnimationTimelineMaxScrollLeft(containerWidthPx, durationMs, nextPixelsPerMs)
  const rawScrollLeft = anchorTimeMs * nextPixelsPerMs - anchorOffsetPx
  const scrollLeft = Math.min(maxScrollLeft, Math.max(0, rawScrollLeft))
  return { pixelsPerMs: nextPixelsPerMs, scrollLeft }
}

/** 按像素增量平移时间线，滚动位置钳制在 `[0, 内容总宽度 - 可视宽度]` 内。 */
export function panComposeAnimationTimeline(
  scrollLeft: number,
  deltaPx: number,
  containerWidthPx: number,
  durationMs: number,
  pixelsPerMs: number,
): number {
  const maxScrollLeft = computeComposeAnimationTimelineMaxScrollLeft(containerWidthPx, durationMs, pixelsPerMs)
  const safeDeltaPx = Number.isFinite(deltaPx) ? deltaPx : 0
  return Math.min(maxScrollLeft, Math.max(0, scrollLeft + safeDeltaPx))
}

export function addComposeAnimationKeyframe(
  value: ComposeAnimationPanelValue,
): ComposeAnimationPanelValue {
  const selected = findComposeAnimationKeyframe(value.model, value.selectedKeyframeId)
  const target = selected ?? (() => {
    const track = value.model.tracks[0]
    const property = track?.properties[0]
    const keyframe = property?.keyframes[0]
    return track && property && keyframe
      ? { track, property, keyframe, location: { trackIndex: 0, propertyIndex: 0, keyframeIndex: 0 } }
      : undefined
  })()
  if (!target) return value
  const existing = target.property.keyframes.find(({ timeMs }) => timeMs === value.currentTimeMs)
  if (existing) return { ...value, selectedKeyframeId: existing.id }
  const keyframe: ComposeAnimationKeyframe = {
    ...target.keyframe,
    id: createUniqueKeyframeId(value.model, target.property.id, value.currentTimeMs),
    timeMs: value.currentTimeMs,
  }
  return {
    ...value,
    selectedKeyframeId: keyframe.id,
    model: {
      ...value.model,
      tracks: value.model.tracks.map((track, trackIndex) => trackIndex !== target.location.trackIndex
        ? track
        : {
            ...track,
            properties: track.properties.map((property, propertyIndex) => propertyIndex !== target.location.propertyIndex
              ? property
              : { ...property, keyframes: [...property.keyframes, keyframe].sort((left, right) => left.timeMs - right.timeMs) }),
          }),
    },
  }
}
