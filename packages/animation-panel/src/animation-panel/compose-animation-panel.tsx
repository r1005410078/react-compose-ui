import { useId, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'
import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import { useAnimationPanelSession } from './animation-panel-context'
import { getComposeAnimationClips } from './animation-panel-model'
import { AnimationPanelProvider } from './animation-panel-provider'
import { CommittedInput } from './committed-input'
import {
  ChevronIcon,
  CurveIcon,
  DiamondIcon,
  LoopIcon,
  MoreIcon,
  PauseIcon,
  PlayIcon,
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
    more: '更多操作',
    keyframe: (timeMs: number, label: string) => `关键帧 ${timeMs} ms：${label}`,
    interpolationSegment: (startMs: number, endMs: number, label: string) => `编辑 ${startMs} ms 至 ${endMs} ms 的${label}动画曲线`,
    keyframeMove: '使用左右方向键每次移动 10 毫秒，也可以水平拖动',
    keyframeHeading: '关键帧',
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
    more: 'More actions',
    keyframe: (timeMs: number, label: string) => `Keyframe ${timeMs} ms: ${label}`,
    interpolationSegment: (startMs: number, endMs: number, label: string) => `Edit ${label} animation curve from ${startMs} ms to ${endMs} ms`,
    keyframeMove: 'Use the left and right arrow keys to move by 10 milliseconds, or drag horizontally',
    keyframeHeading: 'Keyframe',
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

function createTimeMarkers(durationMs: number) {
  const safeDurationMs = Math.max(0, Math.round(Number.isFinite(durationMs) ? durationMs : 0))
  const markerStep = [100, 200, 500, 1000, 2000, 5000]
    .find((step) => step >= safeDurationMs / 8) ?? 10_000
  const markers: number[] = []
  for (let timeMs = 0; timeMs < safeDurationMs; timeMs += markerStep) markers.push(timeMs)
  if (markers[markers.length - 1] !== safeDurationMs) markers.push(safeDurationMs)
  return markers
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
  const timeMarkers = createTimeMarkers(value.model.durationMs)
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
          <div
            aria-label={t.toolbar}
            className="compose-animation-timeline__tracks-header"
            data-timeline-header="true"
            role="toolbar"
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
            </div>
            <output aria-label={t.currentTime} className="compose-animation-timeline__time-readout">
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
                    aria-label={t.selectTrack(trackLabel)}
                    aria-pressed={trackSelected}
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
                  <button
                    aria-label={`${trackLabel} ${t.more}`}
                    className="compose-animation-timeline__more-button"
                    type="button"
                  ><MoreIcon /></button>
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
                        aria-label={t.selectProperty(propertyLabel)}
                        aria-pressed={propertySelected}
                        className="compose-animation-timeline__row-hit"
                        data-property-row={property.id}
                        type="button"
                        onClick={() => selectProperty(property.id)}
                      />
                      <ChevronIcon />
                      <span className="compose-animation-timeline__property-label">{propertyLabel}</span>
                      <button
                        aria-label={`${propertyLabel} ${t.more}`}
                        className="compose-animation-timeline__more-button"
                        type="button"
                      ><MoreIcon /></button>
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
        />
      </div>
    </section>
  )
}

function TimelineScale({
  currentRatio,
  markers,
  onKeyDown,
  onMoveKeyframe,
  onSelectClip,
  onSelectProperty,
  onSelectKeyframe,
  onSelectInterpolationSegment,
  onSetCurrentTime,
  onUpdateClipRange,
  value,
}: {
  readonly currentRatio: number
  readonly markers: readonly number[]
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  readonly onMoveKeyframe: (keyframeId: string, timeMs: number) => void
  readonly onSelectClip: (clipId: string) => void
  readonly onSelectProperty: (propertyId: string) => void
  readonly onSelectKeyframe: (keyframeId: string) => void
  readonly onSelectInterpolationSegment: (endKeyframeId: string) => void
  readonly onSetCurrentTime: (timeMs: number) => void
  readonly onUpdateClipRange: (clipId: string, startTimeMs: number, endTimeMs: number) => void
  readonly value: ReturnType<typeof useAnimationPanelSession>['value']
}) {
  const i18n = useComposeI18nContext()
  const locale = i18n?.locale ?? 'zh-CN'
  const t = messages[locale]
  const keyframeMoveHelpId = useId()
  const clipMoveHelpId = useId()
  const scaleRef = useRef<HTMLDivElement>(null)
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
    <div className="compose-animation-timeline__scale-scroll">
      <div className="compose-animation-timeline__scale" ref={scaleRef} style={{ '--animation-playhead': `${currentRatio * 100}%` } as CSSProperties}>
        <div className="compose-animation-timeline__ruler" aria-hidden="true">
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
                        aria-describedby={clipMoveHelpId}
                        aria-label={t.animationClip(label, clip.startTimeMs, clip.endTimeMs)}
                        aria-pressed={selected}
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
                        aria-pressed={selected}
                        className="compose-animation-timeline__clip-handle compose-animation-timeline__clip-handle--start"
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
                        aria-pressed={selected}
                        className="compose-animation-timeline__clip-handle compose-animation-timeline__clip-handle--end"
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
                      aria-label={t.selectPropertyLane(label)}
                      aria-pressed={propertySelected}
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
                          aria-label={t.interpolationSegment(startKeyframe.timeMs, keyframe.timeMs, label)}
                          aria-pressed={selected}
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
                          aria-label={t.keyframe(keyframe.timeMs, label)}
                          aria-describedby={keyframeMoveHelpId}
                          aria-pressed={selected}
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
  const selectedIndex = {
    index: Math.max(0, keyframes.findIndex(({ id }) => id === selectedKeyframe?.keyframe.id)),
    total: keyframes.length,
  }
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
        <div><strong>{trackLabel} / {propertyLabel}</strong><span>{selectedIndex.index + 1} / {selectedIndex.total}</span></div>
      </header>
      <div className="compose-animation-inspector__fields">
        <label>
          <span>{t.time}</span>
          <span className="compose-animation-inspector__unit-field">
            <CommittedInput
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
          <button aria-controls="animation-curve-view" aria-selected={value.easingEditor === 'curve'} id="animation-curve-tab" role="tab" type="button" onClick={() => setEasingEditor('curve')}>{t.curve}</button>
          <button aria-controls="animation-spring-view" aria-selected={value.easingEditor === 'spring'} id="animation-spring-tab" role="tab" type="button" onClick={() => setEasingEditor('spring')}>{t.spring}</button>
        </div>
        <div
          aria-labelledby={value.easingEditor === 'curve' ? 'animation-curve-tab' : 'animation-spring-tab'}
          className="compose-animation-inspector__curve"
          id={value.easingEditor === 'curve' ? 'animation-curve-view' : 'animation-spring-view'}
          role="tabpanel"
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
      <p aria-live="polite" className="compose-animation-panel__sr-only" role="status">{notice ? t.duplicateTime : ''}</p>
    </aside>
  )
}
