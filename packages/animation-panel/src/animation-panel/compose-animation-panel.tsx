import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent, RefObject, WheelEvent } from 'react'
import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import { useAnimationPanelSession } from './animation-panel-context'
import {
  clampComposeAnimationPixelsPerMs,
  getComposeAnimationClips,
  panComposeAnimationTimeline,
  zoomComposeAnimationTimelineAt,
} from './animation-panel-model'
import { AnimationPanelProvider } from './animation-panel-provider'
import { CommittedInput } from './committed-input'
import {
  ChevronIcon,
  CurveIcon,
  DiamondIcon,
  LoopIcon,
  PauseIcon,
  PlayIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from './animation-icons'
import type {
  ComposeAnimationInspectorProps,
  ComposeAnimationPlaybackMode,
  ComposeAnimationPanelProviderProps,
  ComposeAnimationTimelineProps,
} from './types'

const messages = {
  'zh-CN': {
    timeline: '动画编辑器',
    inspector: '关键帧属性',
    play: '播放动画',
    pause: '暂停动画',
    addKeyframe: '添加关键帧',
    zoomIn: '放大时间线',
    zoomOut: '缩小时间线',
    playbackMode: '播放模式',
    playOnce: '播放一次',
    loop: '循环',
    pingPong: '往返',
    autoRecord: '自动记录属性',
    animationClip: (label: string, startMs: number, endMs: number) => `动画片段 ${label}：${startMs} ms 至 ${endMs} ms`,
    clipMove: '使用左右方向键移动动画片段，每次 10 毫秒',
    clipStart: (label: string) => `调整动画片段 ${label} 的起始时间`,
    clipEnd: (label: string) => `调整动画片段 ${label} 的结束时间`,
    currentTime: '当前时间',
    duration: '尾帧时长',
    trackList: '动画轨道',
    toolbar: '时间线操作栏',
    track: 'Fault',
    trackToggle: (name: string) => `展开或收起 ${name} 轨道`,
    selectTrack: (name: string) => `选择对象轨道 ${name}`,
    selectProperty: (name: string) => `选择属性轨道 ${name}`,
    selectPropertyLane: (name: string) => `选择 ${name} 关键帧轨道`,
    property: '背景填充',
    propertyField: '属性',
    interpolationRange: '曲线区间',
    keyframe: (timeMs: number, label: string) => `关键帧 ${timeMs} ms：${label}`,
    interpolationSegment: (startMs: number, endMs: number, label: string) => `编辑 ${startMs} ms 至 ${endMs} ms 的${label}动画曲线`,
    keyframeMove: '使用左右方向键每次移动 10 毫秒，也可以水平拖动',
    keyframeHeading: '关键帧',
    noSelection: '未选中关键帧',
    time: '时间',
    value: '值',
    interpolation: '插值',
    curve: '曲线',
    spring: '弹簧',
    linear: 'Linear',
    easeIn: 'Ease In',
    easeOut: 'Ease Out',
    easingEditor: '缓动编辑器',
    duplicateTime: '该属性轨道已存在同一时间的关键帧',
  },
  'en-US': {
    timeline: 'Animation editor',
    inspector: 'Keyframe properties',
    play: 'Play animation',
    pause: 'Pause animation',
    addKeyframe: 'Add keyframe',
    zoomIn: 'Zoom in timeline',
    zoomOut: 'Zoom out timeline',
    playbackMode: 'Playback mode',
    playOnce: 'Play once',
    loop: 'Loop',
    pingPong: 'PingPong',
    autoRecord: 'Auto record properties',
    animationClip: (label: string, startMs: number, endMs: number) => `Animation clip ${label}: ${startMs} ms to ${endMs} ms`,
    clipMove: 'Use the left and right arrow keys to move the animation clip by 10 milliseconds',
    clipStart: (label: string) => `Adjust the start time of animation clip ${label}`,
    clipEnd: (label: string) => `Adjust the end time of animation clip ${label}`,
    currentTime: 'Current time',
    duration: 'End frame duration',
    trackList: 'Animation tracks',
    toolbar: 'Timeline toolbar',
    track: 'Fault',
    trackToggle: (name: string) => `Expand or collapse ${name} track`,
    selectTrack: (name: string) => `Select object track ${name}`,
    selectProperty: (name: string) => `Select property track ${name}`,
    selectPropertyLane: (name: string) => `Select ${name} keyframe lane`,
    property: 'Background fill',
    propertyField: 'Property',
    interpolationRange: 'Curve range',
    keyframe: (timeMs: number, label: string) => `Keyframe ${timeMs} ms: ${label}`,
    interpolationSegment: (startMs: number, endMs: number, label: string) => `Edit ${label} animation curve from ${startMs} ms to ${endMs} ms`,
    keyframeMove: 'Use the left and right arrow keys to move by 10 milliseconds, or drag horizontally',
    keyframeHeading: 'Keyframe',
    noSelection: 'No keyframe selected',
    time: 'Time',
    value: 'Value',
    interpolation: 'Interpolation',
    curve: 'Curve',
    spring: 'Spring',
    linear: 'Linear',
    easeIn: 'Ease In',
    easeOut: 'Ease Out',
    easingEditor: 'Easing editor',
    duplicateTime: 'A keyframe already exists at this time on the property track',
  },
} as const

type Locale = keyof typeof messages

function displayTrackLabel(id: string, fallback: string, locale: Locale) {
  return id === 'fault' ? messages[locale].track : fallback
}

function displayPropertyLabel(id: string, fallback: string, locale: Locale) {
  return id === 'background-fill' ? messages[locale].property : fallback
}

function timelineRatio(timeMs: number, durationMs: number) {
  return durationMs <= 0 ? 0 : Math.min(1, Math.max(0, timeMs / durationMs))
}

// `.compose-animation-timeline__scale` 的 `margin: 0 10px`：可视宽度测量必须扣掉这部分，
// 否则缩放下限会把内容撑到比 `.scale-scroll` 实际可视区域还宽，出现横向留白。
const SCALE_HORIZONTAL_MARGIN_PX = 20
// 工具栏缩放按钮每次点击的缩放倍数，和 Stage（packages/stage）的 zoomIn/zoomOut 步长保持一致的手感。
const ZOOM_BUTTON_STEP_FACTOR = 1.2
// 主刻度步长的候选值，1-2-5 十进制级数（时间轴的通用惯例），供按可读间距反推步长时查表。
const TIME_MARKER_STEPS_MS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000]
// 相邻主刻度标签之间至少需要的像素间距，避免数字重叠。
const MIN_MARKER_SPACING_PX = 56

function createTimeMarkers(durationMs: number, pixelsPerMs: number) {
  const safeDurationMs = Math.max(0, Math.round(Number.isFinite(durationMs) ? durationMs : 0))
  // 缩放级别已知时，按当前像素密度反推需要多粗的步长才能保持标签可读间距——放大后
  // 同样的间距能塞进更细的时间步长，标尺因此自然变密。挂载瞬间/未测出可视宽度时
  // （pixelsPerMs <= 0）退回旧启发式：把总时长切成约 8 段。
  const minStepMs = pixelsPerMs > 0 ? MIN_MARKER_SPACING_PX / pixelsPerMs : safeDurationMs / 8
  const stepMs = TIME_MARKER_STEPS_MS.find((step) => step >= minStepMs)
    ?? TIME_MARKER_STEPS_MS[TIME_MARKER_STEPS_MS.length - 1]!
  const markers: number[] = []
  for (let timeMs = 0; timeMs < safeDurationMs; timeMs += stepMs) markers.push(timeMs)
  if (markers[markers.length - 1] !== safeDurationMs) markers.push(safeDurationMs)
  return { markers, stepMs }
}

function playbackModeLabel(mode: ComposeAnimationPlaybackMode, locale: Locale) {
  const t = messages[locale]
  if (mode === 'loop') return t.loop
  if (mode === 'ping-pong') return t.pingPong
  return t.playOnce
}

/**
 * 为分置的时间线和属性面板提供同一动画会话。
 *
 * @remarks
 * Provider 不读取或修改 ComposeDocument；默认演示数据和所有交互均属于当前 React 会话。
 * @public
 */
export function ComposeAnimationPanelProvider(props: ComposeAnimationPanelProviderProps) {
  return <AnimationPanelProvider {...props} />
}

/** 渲染可置于编辑器底部的时间线。 @public */
export function ComposeAnimationTimeline({
  className,
  style,
  ...htmlProps
}: ComposeAnimationTimelineProps) {
  const i18n = useComposeI18nContext()
  const theme = useComposeThemeContext()
  const {
    value,
    notice,
    addKeyframe,
    moveKeyframe,
    selectClip,
    selectKeyframe,
    selectProperty,
    selectTrack,
    selectInterpolationSegment,
    setCurrentTime,
    setDuration,
    setPlaybackMode,
    setPlaying,
    toggleAutoRecord,
    toggleTrack,
    updateClipRange,
  } = useAnimationPanelSession()
  const locale = i18n?.locale ?? 'zh-CN'
  const t = messages[locale]
  const classNames = ['compose-animation-panel', 'compose-animation-timeline', className]
    .filter(Boolean)
    .join(' ')
  const currentRatio = timelineRatio(value.currentTimeMs, value.model.durationMs)
  const scaleScrollRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef<HTMLDivElement>(null)
  // 缩放会改变 `.scale` 的行内宽度，必须等这次渲染真正提交到 DOM 后再写 scrollLeft，
  // 否则浏览器会按旧宽度把请求的滚动位置钳掉。
  const pendingScrollLeftRef = useRef<number | null>(null)
  const [containerWidthPx, setContainerWidthPx] = useState(0)
  // null 表示用户还没有主动缩放过：此时按可视宽度铺满显示，和缩放能力上线前的行为完全一致。
  const [pixelsPerMs, setPixelsPerMs] = useState<number | null>(null)
  // 记录"上一次钳制时用的可视宽度/时长"，用来判断本次渲染是否需要重新钳制（回弹）。
  const [clampedForWidthPx, setClampedForWidthPx] = useState(0)
  const [clampedForDurationMs, setClampedForDurationMs] = useState(value.model.durationMs)
  const effectiveContainerWidthPx = Math.max(0, containerWidthPx - SCALE_HORIZONTAL_MARGIN_PX)

  // 容器宽度或时长变化后，把已经设置过的缩放级别重新钳制（回弹），而不是重置成铺满宽度；
  // 还没缩放过（pixelsPerMs 为 null）时不需要处理，下面的 effectivePixelsPerMs 会自动跟着派生。
  // 用渲染期条件性 setState 而不是 effect：本仓库的 react-hooks/set-state-in-effect 规则把
  // effect 里的 setState 判定为 error，这是 React 官方文档给出的等价替代写法。
  if (
    pixelsPerMs !== null
    && effectiveContainerWidthPx > 0
    && (clampedForWidthPx !== effectiveContainerWidthPx || clampedForDurationMs !== value.model.durationMs)
  ) {
    const clamped = clampComposeAnimationPixelsPerMs(pixelsPerMs, effectiveContainerWidthPx, value.model.durationMs)
    setClampedForWidthPx(effectiveContainerWidthPx)
    setClampedForDurationMs(value.model.durationMs)
    if (clamped !== pixelsPerMs) setPixelsPerMs(clamped)
  }

  const effectivePixelsPerMs = pixelsPerMs ?? (
    effectiveContainerWidthPx > 0 && value.model.durationMs > 0
      ? effectiveContainerWidthPx / value.model.durationMs
      : 0
  )
  const scaleWidthPx = Math.max(0, value.model.durationMs * effectivePixelsPerMs)
  const { markers: timeMarkers, stepMs: timeMarkerStepMs } = createTimeMarkers(value.model.durationMs, effectivePixelsPerMs)

  useEffect(() => {
    const element = scaleScrollRef.current
    if (!element) return
    const measure = () => setContainerWidthPx(element.getBoundingClientRect().width)
    measure()
    // jsdom 等无布局环境没有 ResizeObserver：退化为只测一次挂载时的宽度，
    // 和 packages/stage 里 compose-stage.tsx 对 surfaceRef 的处理方式一致。
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    if (pendingScrollLeftRef.current === null) return
    if (scaleScrollRef.current) scaleScrollRef.current.scrollLeft = pendingScrollLeftRef.current
    pendingScrollLeftRef.current = null
  }, [scaleWidthPx])

  const applyZoom = (clientX: number, factor: number) => {
    const scrollElement = scaleScrollRef.current
    const scaleBounds = scaleRef.current?.getBoundingClientRect()
    const scrollBounds = scrollElement?.getBoundingClientRect()
    if (!scrollElement || !scaleBounds || !scrollBounds || effectivePixelsPerMs <= 0) return
    const anchorTimeMs = Math.min(
      value.model.durationMs,
      Math.max(0, (clientX - scaleBounds.left) / effectivePixelsPerMs),
    )
    const anchorOffsetPx = clientX - scrollBounds.left
    const result = zoomComposeAnimationTimelineAt(
      effectivePixelsPerMs,
      factor,
      anchorTimeMs,
      anchorOffsetPx,
      effectiveContainerWidthPx,
      value.model.durationMs,
    )
    pendingScrollLeftRef.current = result.scrollLeft
    setPixelsPerMs(result.pixelsPerMs)
  }
  const handleTimelineWheel = (event: WheelEvent<HTMLDivElement>) => {
    const scrollElement = scaleScrollRef.current
    if (!scrollElement) return
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      applyZoom(event.clientX, Math.exp(-event.deltaY * 0.002))
      return
    }
    event.preventDefault()
    scrollElement.scrollLeft = panComposeAnimationTimeline(
      scrollElement.scrollLeft,
      event.deltaY !== 0 ? event.deltaY : event.deltaX,
      effectiveContainerWidthPx,
      value.model.durationMs,
      effectivePixelsPerMs,
    )
  }
  const handleZoomButtonClick = (factor: number) => {
    const scrollBounds = scaleScrollRef.current?.getBoundingClientRect()
    if (!scrollBounds) return
    applyZoom(scrollBounds.left + scrollBounds.width / 2, factor)
  }
  const handlePlayheadKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setCurrentTime(value.currentTimeMs - 10)
    }
    else if (event.key === 'ArrowRight') {
      event.preventDefault()
      setCurrentTime(value.currentTimeMs + 10)
    }
    else if (event.key === 'Home') {
      event.preventDefault()
      setCurrentTime(0)
    }
    else if (event.key === 'End') {
      event.preventDefault()
      setCurrentTime(value.model.durationMs)
    }
  }

  return (
    <section
      {...htmlProps}
      aria-label={htmlProps['aria-label'] ?? t.timeline}
      className={classNames}
      data-compose-theme={theme?.resolvedTheme}
      data-compose-ui="animation-timeline"
      lang={locale}
      role={htmlProps.role ?? 'region'}
      style={{ ...(theme ? createComposeThemeStyle(theme.tokens) : {}), ...style } as CSSProperties}
    >
      <div className="compose-animation-timeline__content">
        <div className="compose-animation-timeline__tracks">
          {/* 这里混着数字输入框与下拉，无法满足 toolbar 要求的方向键漫游；group 只表达"一组相关控件"，没有键盘契约。 */}
          <div
            aria-label={t.toolbar}
            className="compose-animation-timeline__tracks-header"
            data-timeline-header="true"
            role="group"
          >
            <div className="compose-animation-timeline__button-cluster">
              <button
                aria-label={value.isPlaying ? t.pause : t.play}
                className="compose-animation-timeline__icon-button"
                type="button"
                onClick={() => setPlaying(!value.isPlaying)}
              >
                {value.isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>
              <span aria-hidden="true" className="compose-animation-timeline__control-separator" />
              <button
                aria-label={t.addKeyframe}
                className="compose-animation-timeline__icon-button"
                type="button"
                onClick={addKeyframe}
              ><DiamondIcon /></button>
              <span aria-hidden="true" className="compose-animation-timeline__control-separator" />
              {/* 滚轮缩放需要按住 Ctrl/Cmd，无法使用该手势的用户仍需要一个可发现、可键盘操作的入口。 */}
              <button
                aria-label={t.zoomOut}
                className="compose-animation-timeline__icon-button"
                type="button"
                onClick={() => handleZoomButtonClick(1 / ZOOM_BUTTON_STEP_FACTOR)}
              ><ZoomOutIcon /></button>
              <button
                aria-label={t.zoomIn}
                className="compose-animation-timeline__icon-button"
                type="button"
                onClick={() => handleZoomButtonClick(ZOOM_BUTTON_STEP_FACTOR)}
              ><ZoomInIcon /></button>
            </div>
            {/* 隐式 role 是 status：播放时每帧都会变化，必须显式关掉播报，否则读屏会被刷屏。 */}
            <output aria-label={t.currentTime} aria-live="off" className="compose-animation-timeline__time-readout">
              {value.currentTimeMs}<small>ms</small>
            </output>
            <label className="compose-animation-timeline__duration-control">
              <CommittedInput
                aria-label={t.duration}
                inputMode="numeric"
                key={value.model.durationMs}
                min={10}
                step={10}
                type="number"
                value={String(value.model.durationMs)}
                onCommit={(draft) => {
                  const durationMs = Number.parseInt(draft, 10)
                  if (!Number.isFinite(durationMs)) return false
                  setDuration(durationMs)
                  return true
                }}
              />
              <small>ms</small>
            </label>
            <label className="compose-animation-timeline__playback-mode">
              <LoopIcon />
              <select
                aria-label={t.playbackMode}
                value={value.playbackMode}
                onChange={(event) => setPlaybackMode(event.target.value as ComposeAnimationPlaybackMode)}
              >
                {(['play-once', 'loop', 'ping-pong'] as const).map((mode) => (
                  <option key={mode} value={mode}>{playbackModeLabel(mode, locale)}</option>
                ))}
              </select>
            </label>
            <button
              aria-label={t.autoRecord}
              aria-pressed={value.autoRecord}
              className="compose-animation-timeline__record-button"
              type="button"
              onClick={toggleAutoRecord}
            >
              <span aria-hidden="true" />
            </button>
          </div>
          <div aria-label={t.trackList} className="compose-animation-timeline__track-list" role="list">
          {value.model.tracks.map((track) => {
            const trackLabel = displayTrackLabel(track.id, track.label, locale)
            const trackSelected = value.selectedTrackId === track.id
            return (
              <div className="compose-animation-timeline__track-group" key={track.id} role="listitem">
                <div
                  className="compose-animation-timeline__track-row"
                  data-object-row={track.id}
                  data-selected={trackSelected || undefined}
                >
                  <button
                    aria-current={trackSelected || undefined}
                    aria-label={t.selectTrack(trackLabel)}
                    className="compose-animation-timeline__row-hit"
                    data-object-row={track.id}
                    type="button"
                    onClick={() => selectTrack(track.id)}
                  />
                  <button
                    aria-expanded={track.expanded}
                    aria-label={t.trackToggle(trackLabel)}
                    className="compose-animation-timeline__track-toggle"
                    type="button"
                    onClick={() => toggleTrack(track.id)}
                  ><ChevronIcon /></button>
                  <span className="compose-animation-timeline__track-label">{trackLabel}</span>
                </div>
                {track.expanded ? track.properties.map((property) => {
                  const propertyLabel = displayPropertyLabel(property.id, property.label, locale)
                  const propertySelected = value.selectedPropertyId === property.id
                  return (
                    <div
                      className="compose-animation-timeline__property-row"
                      data-selected={propertySelected || undefined}
                      key={property.id}
                    >
                      <button
                        aria-current={propertySelected || undefined}
                        aria-label={t.selectProperty(propertyLabel)}
                        className="compose-animation-timeline__row-hit"
                        data-property-row={property.id}
                        type="button"
                        onClick={() => selectProperty(property.id)}
                      />
                      <ChevronIcon />
                      <span className="compose-animation-timeline__property-label">{propertyLabel}</span>
                    </div>
                  )
                }) : null}
              </div>
            )
          })}
          </div>
        </div>
        <TimelineScale
          currentRatio={currentRatio}
          markers={timeMarkers}
          onSelectClip={selectClip}
          onSelectProperty={selectProperty}
          value={value}
          onUpdateClipRange={updateClipRange}
          onKeyDown={handlePlayheadKeyDown}
          onMoveKeyframe={moveKeyframe}
          onSelectKeyframe={selectKeyframe}
          onSelectInterpolationSegment={selectInterpolationSegment}
          onSetCurrentTime={setCurrentTime}
          onWheel={handleTimelineWheel}
          scaleRef={scaleRef}
          scaleScrollRef={scaleScrollRef}
          scaleWidthPx={scaleWidthPx}
          markerStepMs={timeMarkerStepMs}
        />
      </div>
      {/* 常驻挂载：live region 必须先于内容变化就存在于 DOM 中，AT 才能可靠捕获后续的文本变化。
          必须是 section 的最后一个子节点、.content 的兄弟节点，而不是 .tracks 的子节点：
          .tracks 是纵向 flex 列，插入一个带默认 margin 的块级元素会把整个左列（进而与右侧时间线
          刻度）永久错位，即使没有冲突、提示为空也一样。视觉样式通过 --active 修饰类切换，
          避免无冲突时出现一个空的提示框。 */}
      <p
        aria-live="polite"
        className={['compose-animation-timeline__notice', notice ? 'compose-animation-timeline__notice--active' : '']
          .filter(Boolean)
          .join(' ')}
        role="status"
      >
        {notice ? t.duplicateTime : ''}
      </p>
    </section>
  )
}

function TimelineScale({
  currentRatio,
  markers,
  markerStepMs,
  onKeyDown,
  onMoveKeyframe,
  onSelectClip,
  onSelectProperty,
  onSelectKeyframe,
  onSelectInterpolationSegment,
  onSetCurrentTime,
  onUpdateClipRange,
  onWheel,
  scaleRef,
  scaleScrollRef,
  scaleWidthPx,
  value,
}: {
  readonly currentRatio: number
  readonly markers: readonly number[]
  readonly markerStepMs: number
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  readonly onMoveKeyframe: (keyframeId: string, timeMs: number) => void
  readonly onSelectClip: (clipId: string) => void
  readonly onSelectProperty: (propertyId: string) => void
  readonly onSelectKeyframe: (keyframeId: string) => void
  readonly onSelectInterpolationSegment: (endKeyframeId: string) => void
  readonly onSetCurrentTime: (timeMs: number) => void
  readonly onUpdateClipRange: (clipId: string, startTimeMs: number, endTimeMs: number) => void
  readonly onWheel: (event: WheelEvent<HTMLDivElement>) => void
  readonly scaleRef: RefObject<HTMLDivElement | null>
  readonly scaleScrollRef: RefObject<HTMLDivElement | null>
  readonly scaleWidthPx: number
  readonly value: ReturnType<typeof useAnimationPanelSession>['value']
}) {
  const i18n = useComposeI18nContext()
  const locale = i18n?.locale ?? 'zh-CN'
  const t = messages[locale]
  const keyframeMoveHelpId = useId()
  const clipMoveHelpId = useId()
  const [dragging, setDragging] = useState<{ readonly keyframeId: string; readonly pointerId: number } | null>(null)
  const [clipDragging, setClipDragging] = useState<{
    readonly clipId: string
    readonly endTimeMs: number
    readonly kind: 'move' | 'start' | 'end'
    readonly pointerId: number
    readonly pointerTimeMs: number
    readonly startTimeMs: number
  } | null>(null)
  const getTimeAtClientX = (clientX: number) => {
    const bounds = scaleRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width <= 0) return value.currentTimeMs
    const rawTime = timelineRatio(clientX - bounds.left, bounds.width) * value.model.durationMs
    return Math.min(
      value.model.durationMs,
      Math.max(0, Math.round(rawTime / 10) * 10),
    )
  }
  const handleKeyframePointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    keyframeId: string,
  ) => {
    if (event.button !== 0) return
    event.preventDefault()
    const element = event.currentTarget
    element.focus()
    if ('setPointerCapture' in element) element.setPointerCapture(event.pointerId)
    onSelectKeyframe(keyframeId)
    setDragging({ keyframeId, pointerId: event.pointerId })
  }
  const handleKeyframePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragging || dragging.pointerId !== event.pointerId) return
    event.preventDefault()
    onMoveKeyframe(dragging.keyframeId, getTimeAtClientX(event.clientX))
  }
  const endKeyframeDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragging || dragging.pointerId !== event.pointerId) return
    if ('releasePointerCapture' in event.currentTarget) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setDragging(null)
  }
  const beginClipDrag = (
    event: PointerEvent<HTMLButtonElement>,
    clip: { readonly id: string; readonly startTimeMs: number; readonly endTimeMs: number },
    kind: 'move' | 'start' | 'end',
  ) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.focus()
    if ('setPointerCapture' in event.currentTarget) event.currentTarget.setPointerCapture(event.pointerId)
    onSelectClip(clip.id)
    setClipDragging({
      clipId: clip.id,
      endTimeMs: clip.endTimeMs,
      kind,
      pointerId: event.pointerId,
      pointerTimeMs: getTimeAtClientX(event.clientX),
      startTimeMs: clip.startTimeMs,
    })
  }
  const moveClip = (event: PointerEvent<HTMLButtonElement>) => {
    if (!clipDragging || clipDragging.pointerId !== event.pointerId) return
    event.preventDefault()
    const pointerTimeMs = getTimeAtClientX(event.clientX)
    if (clipDragging.kind === 'move') {
      const durationMs = clipDragging.endTimeMs - clipDragging.startTimeMs
      const startTimeMs = Math.min(
        value.model.durationMs - durationMs,
        Math.max(0, clipDragging.startTimeMs + pointerTimeMs - clipDragging.pointerTimeMs),
      )
      onUpdateClipRange(clipDragging.clipId, startTimeMs, startTimeMs + durationMs)
      return
    }
    if (clipDragging.kind === 'start') {
      onUpdateClipRange(
        clipDragging.clipId,
        Math.min(clipDragging.endTimeMs - 10, Math.max(0, pointerTimeMs)),
        clipDragging.endTimeMs,
      )
      return
    }
    onUpdateClipRange(
      clipDragging.clipId,
      clipDragging.startTimeMs,
      Math.max(clipDragging.startTimeMs + 10, pointerTimeMs),
    )
  }
  const endClipDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (!clipDragging || clipDragging.pointerId !== event.pointerId) return
    if ('releasePointerCapture' in event.currentTarget) event.currentTarget.releasePointerCapture(event.pointerId)
    setClipDragging(null)
  }
  const adjustClipWithKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
    clip: { readonly id: string; readonly startTimeMs: number; readonly endTimeMs: number },
    kind: 'move' | 'start' | 'end',
  ) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const deltaMs = event.key === 'ArrowLeft' ? -10 : 10
    onSelectClip(clip.id)
    if (kind === 'move') {
      const durationMs = clip.endTimeMs - clip.startTimeMs
      const startTimeMs = Math.min(
        value.model.durationMs - durationMs,
        Math.max(0, clip.startTimeMs + deltaMs),
      )
      onUpdateClipRange(clip.id, startTimeMs, startTimeMs + durationMs)
      return
    }
    if (kind === 'start') {
      onUpdateClipRange(clip.id, clip.startTimeMs + deltaMs, clip.endTimeMs)
      return
    }
    onUpdateClipRange(clip.id, clip.startTimeMs, clip.endTimeMs + deltaMs)
  }
  const clips = getComposeAnimationClips(value.model)
  return (
    <div className="compose-animation-timeline__scale-scroll" ref={scaleScrollRef} onWheel={onWheel}>
      <div
        className="compose-animation-timeline__scale"
        ref={scaleRef}
        style={{ '--animation-playhead': `${currentRatio * 100}%`, width: `${scaleWidthPx}px` } as CSSProperties}
      >
        <div
          aria-hidden="true"
          className="compose-animation-timeline__ruler"
          // 次刻度按主刻度步长的 1/5 换算成百分比：主刻度变密/变疏时次刻度网格自动跟着换算，
          // 不再是与实际时间脱节的固定 30 等分。
          style={{ '--ruler-minor-step': `${timelineRatio(markerStepMs / 5, value.model.durationMs) * 100}%` } as CSSProperties}
        >
          {markers.map((marker) => (
            <span key={marker} style={{ left: `${timelineRatio(marker, value.model.durationMs) * 100}%` }}>
              <b>{marker}</b><i />
            </span>
          ))}
        </div>
        {value.model.tracks.map((track, trackIndex) => {
          const trackClips = trackIndex === 0 ? clips : []
          return (
            <div className="compose-animation-timeline__track-lanes" key={track.id}>
              <div
                className="compose-animation-timeline__clip-row"
                data-object-lane={track.id}
                data-selected={value.selectedTrackId === track.id || undefined}
              >
                {trackClips.map((clip) => {
                  const label = clip.label === 'Fault' ? t.track : clip.label
                  const startRatio = timelineRatio(clip.startTimeMs, value.model.durationMs)
                  const endRatio = timelineRatio(clip.endTimeMs, value.model.durationMs)
                  const selected = value.selectedClipId === clip.id
                  const draggingClip = clipDragging?.clipId === clip.id
                  return (
                    <div className="compose-animation-timeline__clip" key={clip.id}>
                      <button
                        aria-current={selected || undefined}
                        aria-describedby={clipMoveHelpId}
                        aria-label={t.animationClip(label, clip.startTimeMs, clip.endTimeMs)}
                        className="compose-animation-timeline__clip-body"
                        data-dragging={draggingClip || undefined}
                        style={{ left: `${startRatio * 100}%`, width: `${(endRatio - startRatio) * 100}%` }}
                        type="button"
                        onClick={() => onSelectClip(clip.id)}
                        onKeyDown={(event) => adjustClipWithKeyboard(event, clip, 'move')}
                        onPointerCancel={endClipDrag}
                        onPointerDown={(event) => beginClipDrag(event, clip, 'move')}
                        onPointerMove={moveClip}
                        onPointerUp={endClipDrag}
                      />
                      <button
                        aria-label={t.clipStart(label)}
                        className="compose-animation-timeline__clip-handle compose-animation-timeline__clip-handle--start"
                        data-selected={selected || undefined}
                        style={{ left: `${startRatio * 100}%` }}
                        type="button"
                        onKeyDown={(event) => adjustClipWithKeyboard(event, clip, 'start')}
                        onPointerCancel={endClipDrag}
                        onPointerDown={(event) => beginClipDrag(event, clip, 'start')}
                        onPointerMove={moveClip}
                        onPointerUp={endClipDrag}
                      />
                      <button
                        aria-label={t.clipEnd(label)}
                        className="compose-animation-timeline__clip-handle compose-animation-timeline__clip-handle--end"
                        data-selected={selected || undefined}
                        style={{ left: `${endRatio * 100}%` }}
                        type="button"
                        onKeyDown={(event) => adjustClipWithKeyboard(event, clip, 'end')}
                        onPointerCancel={endClipDrag}
                        onPointerDown={(event) => beginClipDrag(event, clip, 'end')}
                        onPointerMove={moveClip}
                        onPointerUp={endClipDrag}
                      />
                    </div>
                  )
                })}
              </div>
              {track.expanded ? track.properties.map((property) => {
                const keyframes = [...property.keyframes].sort((left, right) => left.timeMs - right.timeMs)
                const label = displayPropertyLabel(property.id, property.label, locale)
                const propertySelected = value.selectedPropertyId === property.id
                return (
                  <div
                    className="compose-animation-timeline__property-lane"
                    data-property-lane={property.id}
                    data-selected={propertySelected || undefined}
                    key={property.id}
                  >
                    <button
                      aria-current={propertySelected || undefined}
                      aria-label={t.selectPropertyLane(label)}
                      className="compose-animation-timeline__lane-hit"
                      data-property-lane-hit={property.id}
                      type="button"
                      onClick={() => onSelectProperty(property.id)}
                    />
                    {keyframes.slice(1).map((keyframe, keyframeIndex) => {
                      const startKeyframe = keyframes[keyframeIndex]!
                      const selected = value.selectedKeyframeId === keyframe.id
                      const startRatio = timelineRatio(startKeyframe.timeMs, value.model.durationMs)
                      const endRatio = timelineRatio(keyframe.timeMs, value.model.durationMs)
                      return (
                        <button
                          aria-current={selected || undefined}
                          aria-label={t.interpolationSegment(startKeyframe.timeMs, keyframe.timeMs, label)}
                          className="compose-animation-timeline__interpolation-segment"
                          data-interpolation={keyframe.interpolation}
                          key={`${keyframe.id}-segment`}
                          style={{ left: `${startRatio * 100}%`, width: `${(endRatio - startRatio) * 100}%` }}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            onSelectInterpolationSegment(keyframe.id)
                          }}
                        ><CurveIcon /></button>
                      )
                    })}
                    {keyframes.map((keyframe) => {
                      const selected = value.selectedKeyframeId === keyframe.id
                      return (
                        <button
                          aria-current={selected || undefined}
                          aria-label={t.keyframe(keyframe.timeMs, label)}
                          aria-describedby={keyframeMoveHelpId}
                          className="compose-animation-timeline__keyframe"
                          data-dragging={dragging?.keyframeId === keyframe.id || undefined}
                          key={keyframe.id}
                          style={{ left: `${timelineRatio(keyframe.timeMs, value.model.durationMs) * 100}%` }}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            onSelectKeyframe(keyframe.id)
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                            event.preventDefault()
                            onSelectKeyframe(keyframe.id)
                            onMoveKeyframe(keyframe.id, keyframe.timeMs + (event.key === 'ArrowLeft' ? -10 : 10))
                          }}
                          onPointerCancel={endKeyframeDrag}
                          onPointerDown={(event) => handleKeyframePointerDown(event, keyframe.id)}
                          onPointerMove={handleKeyframePointerMove}
                          onPointerUp={endKeyframeDrag}
                        ><DiamondIcon /></button>
                      )
                    })}
                  </div>
                )
              }) : null}
            </div>
          )
        })}
        <input
          aria-label={t.currentTime}
          className="compose-animation-timeline__playhead-input compose-animation-timeline__playhead-input--ruler"
          max={value.model.durationMs}
          min={0}
          step={10}
          type="range"
          value={value.currentTimeMs}
          onChange={(event) => onSetCurrentTime(Number(event.target.value))}
          onKeyDown={onKeyDown}
        />
        <span className="compose-animation-panel__sr-only" id={keyframeMoveHelpId}>{t.keyframeMove}</span>
        <span className="compose-animation-panel__sr-only" id={clipMoveHelpId}>{t.clipMove}</span>
        <div aria-hidden="true" className="compose-animation-timeline__playhead"><span /><i /></div>
      </div>
    </div>
  )
}

/** 渲染可置于编辑器右侧的关键帧属性面板。 @public */
export function ComposeAnimationInspector({
  className,
  style,
  ...htmlProps
}: ComposeAnimationInspectorProps) {
  const i18n = useComposeI18nContext()
  const theme = useComposeThemeContext()
  const { notice, selectedKeyframe, setEasingEditor, updateSelectedKeyframe, value } = useAnimationPanelSession()
  const locale = i18n?.locale ?? 'zh-CN'
  const t = messages[locale]
  const rootClassName = ['compose-animation-panel', 'compose-animation-inspector', className]
    .filter(Boolean)
    .join(' ')
  const keyframes = value.model.tracks.flatMap((track) => track.properties.flatMap((property) => property.keyframes))
  const selectedIndex = keyframes.findIndex(({ id }) => id === selectedKeyframe?.keyframe.id)
  const selectedProperty = selectedKeyframe?.property
  const selectedTrack = selectedKeyframe?.track
  const propertyLabel = selectedProperty
    ? displayPropertyLabel(selectedProperty.id, selectedProperty.label, locale)
    : ''
  const trackLabel = selectedTrack
    ? displayTrackLabel(selectedTrack.id, selectedTrack.label, locale)
    : ''
  const color = selectedKeyframe?.keyframe.value ?? '#FF6B6B'
  const interpolation = selectedKeyframe?.keyframe.interpolation ?? 'linear'
  const previousKeyframe = selectedKeyframe && selectedKeyframe.location.keyframeIndex > 0
    ? selectedKeyframe.property.keyframes[selectedKeyframe.location.keyframeIndex - 1]
    : undefined
  const interpolationRange = previousKeyframe && selectedKeyframe
    ? `${previousKeyframe.timeMs} ms → ${selectedKeyframe.keyframe.timeMs} ms`
    : ''
  const noticeId = useId()
  const easingId = useId()
  const curveTabId = `${easingId}-curve-tab`
  const springTabId = `${easingId}-spring-tab`
  const easingPanelId = `${easingId}-panel`
  const curveTabRef = useRef<HTMLButtonElement>(null)
  const springTabRef = useRef<HTMLButtonElement>(null)
  const activeTabId = value.easingEditor === 'curve' ? curveTabId : springTabId
  // Tabs 采用自动激活模式：方向键切换的同时把焦点带到新标签，否则漫游 tabindex 会把焦点留在旧标签上。
  const focusEasingTab = (editor: 'curve' | 'spring') => {
    setEasingEditor(editor)
    const target = editor === 'curve' ? curveTabRef.current : springTabRef.current
    target?.focus()
  }
  const handleEasingTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      focusEasingTab(value.easingEditor === 'curve' ? 'spring' : 'curve')
    }
    else if (event.key === 'Home') {
      event.preventDefault()
      focusEasingTab('curve')
    }
    else if (event.key === 'End') {
      event.preventDefault()
      focusEasingTab('spring')
    }
  }

  return (
    <aside
      {...htmlProps}
      aria-label={htmlProps['aria-label'] ?? t.inspector}
      className={rootClassName}
      data-compose-theme={theme?.resolvedTheme}
      data-compose-ui="animation-inspector"
      lang={locale}
      role={htmlProps.role ?? 'complementary'}
      style={{ ...(theme ? createComposeThemeStyle(theme.tokens) : {}), ...style } as CSSProperties}
    >
      <header className="compose-animation-inspector__header">
        <h2>{t.keyframeHeading}</h2>
        <div>
          <strong>{selectedKeyframe ? `${trackLabel} / ${propertyLabel}` : t.noSelection}</strong>
          <span>{selectedIndex >= 0 ? selectedIndex + 1 : '—'} / {keyframes.length}</span>
        </div>
      </header>
      <div className="compose-animation-inspector__fields">
        <label>
          <span>{t.time}</span>
          <span className="compose-animation-inspector__unit-field">
            <CommittedInput
              aria-describedby={notice ? noticeId : undefined}
              aria-label={t.time}
              inputMode="numeric"
              key={`${selectedKeyframe?.keyframe.id ?? 'none'}-${selectedKeyframe?.keyframe.timeMs ?? 0}`}
              readOnly={!selectedKeyframe}
              value={selectedKeyframe ? String(selectedKeyframe.keyframe.timeMs) : ''}
              onCommit={(draft) => {
                const timeMs = Number.parseInt(draft, 10)
                if (!Number.isFinite(timeMs)) return false
                return updateSelectedKeyframe({ timeMs })
              }}
            />
            <small>ms</small>
          </span>
        </label>
        <label><span>{t.propertyField}</span><input aria-label={t.propertyField} readOnly value={propertyLabel} /></label>
        {interpolationRange ? <label><span>{t.interpolationRange}</span><input aria-label={t.interpolationRange} readOnly value={interpolationRange} /></label> : null}
        <label>
          <span>{t.value}</span>
          <span className="compose-animation-inspector__color-field">
            <i aria-hidden="true" style={{ backgroundColor: color }} />
            <CommittedInput
              aria-label={t.value}
              key={`${selectedKeyframe?.keyframe.id ?? 'none'}-${color}`}
              readOnly={!selectedKeyframe}
              spellCheck={false}
              value={color}
              onCommit={(draft) => {
                const next = draft.trim().toUpperCase()
                if (!/^#[0-9A-F]{6}$/.test(next)) return false
                return updateSelectedKeyframe({ value: next })
              }}
            />
          </span>
        </label>
        <label>
          <span>{t.interpolation}</span>
          <select
            aria-label={t.interpolation}
            value={interpolation}
            onChange={(event) => updateSelectedKeyframe({
              interpolation: event.target.value as 'linear' | 'ease-in' | 'ease-out',
            })}
          >
            <option value="linear">{t.linear}</option>
            <option value="ease-in">{t.easeIn}</option>
            <option value="ease-out">{t.easeOut}</option>
          </select>
        </label>
      </div>
      <div className="compose-animation-inspector__easing-editor">
        <div aria-label={t.easingEditor} className="compose-animation-inspector__tabs" role="tablist">
          <button
            aria-controls={value.easingEditor === 'curve' ? easingPanelId : undefined}
            aria-selected={value.easingEditor === 'curve'}
            id={curveTabId}
            ref={curveTabRef}
            role="tab"
            tabIndex={value.easingEditor === 'curve' ? 0 : -1}
            type="button"
            onClick={() => setEasingEditor('curve')}
            onKeyDown={handleEasingTabKeyDown}
          >{t.curve}</button>
          <button
            aria-controls={value.easingEditor === 'spring' ? easingPanelId : undefined}
            aria-selected={value.easingEditor === 'spring'}
            id={springTabId}
            ref={springTabRef}
            role="tab"
            tabIndex={value.easingEditor === 'spring' ? 0 : -1}
            type="button"
            onClick={() => setEasingEditor('spring')}
            onKeyDown={handleEasingTabKeyDown}
          >{t.spring}</button>
        </div>
        <div
          aria-labelledby={activeTabId}
          className="compose-animation-inspector__curve"
          id={easingPanelId}
          role="tabpanel"
          tabIndex={0}
        >
          <svg aria-label={value.easingEditor === 'curve' ? t[interpolation === 'ease-in' ? 'easeIn' : interpolation === 'ease-out' ? 'easeOut' : 'linear'] : t.spring} viewBox="0 0 220 180">
            <path className="compose-animation-inspector__curve-grid" d="M18 162H202V18M18 126H202M18 90H202M18 54H202M64 18V162M110 18V162M156 18V162" />
            <path className="compose-animation-inspector__curve-path" d={value.easingEditor === 'curve'
              ? interpolation === 'ease-in'
                ? 'M18 162C80 160 170 116 202 18'
                : interpolation === 'ease-out'
                  ? 'M18 162C50 64 140 20 202 18'
                  : 'M18 162 202 18'
              : 'M18 162C55 162 58 20 105 20S135 130 157 75 178 18 202 18'} />
            <circle cx="18" cy="162" r="4.5" /><circle cx="202" cy="18" r="4.5" />
          </svg>
          <strong>{value.easingEditor === 'curve' ? t[interpolation === 'ease-in' ? 'easeIn' : interpolation === 'ease-out' ? 'easeOut' : 'linear'] : t.spring}</strong>
        </div>
      </div>
      {/* 播报由时间线的 live region 负责：两个组件同时挂载时重复播报比没有播报更糟。
          这里只做常驻可见说明，并通过 aria-describedby 挂到时间字段上。 */}
      {notice ? <p className="compose-animation-inspector__notice" id={noticeId}>{t.duplicateTime}</p> : null}
    </aside>
  )
}
