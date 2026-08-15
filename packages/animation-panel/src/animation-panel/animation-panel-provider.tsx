import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  advanceComposeAnimationPlayback,
  addComposeAnimationKeyframe,
  clampComposeAnimationTime,
  findComposeAnimationKeyframe,
  getComposeAnimationClips,
  toggleComposeAnimationTrack,
  updateComposeAnimationDuration,
  updateComposeAnimationClip,
  updateComposeAnimationKeyframe,
} from './animation-panel-model'
import { AnimationPanelContext } from './animation-panel-context'
import { createDefaultComposeAnimationPanelValue } from './default-value'
import type {
  ComposeAnimationKeyframe,
  ComposeAnimationPanelProviderProps,
  ComposeAnimationPanelValue,
  ComposeAnimationPlaybackMode,
} from './types'

export interface ComposeAnimationPanelSession {
  readonly value: ComposeAnimationPanelValue
  readonly selectedKeyframe: ReturnType<typeof findComposeAnimationKeyframe>
  readonly notice: 'duplicate-time' | null
  readonly setCurrentTime: (timeMs: number) => void
  readonly setDuration: (durationMs: number) => void
  readonly setPlaying: (isPlaying: boolean) => void
  readonly setPlaybackMode: (mode: ComposeAnimationPlaybackMode) => void
  readonly toggleAutoRecord: () => void
  readonly selectKeyframe: (keyframeId: string) => void
  readonly selectTrack: (trackId: string) => void
  readonly selectProperty: (propertyId: string) => void
  readonly selectClip: (clipId: string) => void
  readonly updateClipRange: (clipId: string, startTimeMs: number, endTimeMs: number) => void
  readonly selectInterpolationSegment: (endKeyframeId: string) => void
  readonly moveKeyframe: (keyframeId: string, timeMs: number) => void
  readonly updateSelectedKeyframe: (
    update: Partial<Pick<ComposeAnimationKeyframe, 'timeMs' | 'value' | 'interpolation'>>,
  ) => boolean
  readonly toggleTrack: (trackId: string) => void
  readonly addKeyframe: () => void
  readonly setEasingEditor: (editor: 'curve' | 'spring') => void
}

export function AnimationPanelProvider({
  children,
  defaultValue,
  onValueChange,
  value: controlledValue,
}: ComposeAnimationPanelProviderProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(() => (
    defaultValue ?? createDefaultComposeAnimationPanelValue()
  ))
  const [notice, setNotice] = useState<'duplicate-time' | null>(null)
  const value = controlledValue ?? uncontrolledValue
  const valueRef = useRef(value)
  const onValueChangeRef = useRef(onValueChange)
  const previousFrameTimeRef = useRef<number | null>(null)
  const playbackDirectionRef = useRef<1 | -1>(1)
  // 不足 1 ms 的帧间隔余量：播放头按整毫秒存储，逐帧四舍五入会在 60 fps 下累积约 2% 的偏快。
  const frameRemainderRef = useRef(0)
  // commit 是播放 rAF effect 的依赖，必须在整个会话内保持同一引用。若它随受控值变化，
  // effect 会在每帧重建并清掉上一帧时间戳，elapsed 永远为 0，受控宿主的播放头再也不会前进。
  const controlledRef = useRef(controlledValue !== undefined)
  controlledRef.current = controlledValue !== undefined

  useEffect(() => {
    valueRef.current = value
    onValueChangeRef.current = onValueChange
  }, [onValueChange, value])

  const commit = useCallback((next: ComposeAnimationPanelValue) => {
    valueRef.current = next
    if (!controlledRef.current) setUncontrolledValue(next)
    onValueChangeRef.current?.(next)
  }, [])
  const setCurrentTime = useCallback((timeMs: number) => {
    const current = valueRef.current
    commit({ ...current, currentTimeMs: clampComposeAnimationTime(timeMs, current.model.durationMs) })
  }, [commit])
  const setDuration = useCallback((durationMs: number) => {
    setNotice(null)
    commit(updateComposeAnimationDuration(valueRef.current, durationMs))
  }, [commit])
  const setPlaying = useCallback((isPlaying: boolean) => {
    const current = valueRef.current
    if (!isPlaying) {
      commit({ ...current, isPlaying: false })
      return
    }
    let currentTimeMs = current.currentTimeMs
    if (!current.isPlaying) {
      if (current.playbackMode === 'ping-pong' && currentTimeMs >= current.model.durationMs) {
        playbackDirectionRef.current = -1
      }
      else {
        playbackDirectionRef.current = 1
        if (currentTimeMs >= current.model.durationMs) currentTimeMs = 0
      }
    }
    commit({ ...current, currentTimeMs, isPlaying: true })
  }, [commit])
  const setPlaybackMode = useCallback((playbackMode: ComposeAnimationPlaybackMode) => {
    playbackDirectionRef.current = 1
    commit({ ...valueRef.current, playbackMode })
  }, [commit])
  const toggleAutoRecord = useCallback(() => {
    commit({ ...valueRef.current, autoRecord: !valueRef.current.autoRecord })
  }, [commit])
  const selectKeyframe = useCallback((keyframeId: string) => {
    const current = valueRef.current
    const located = findComposeAnimationKeyframe(current.model, keyframeId)
    if (!located) return
    setNotice(null)
    commit({
      ...current,
      selectedKeyframeId: keyframeId,
      selectedPropertyId: located.property.id,
      selectedTrackId: null,
    })
  }, [commit])
  const selectTrack = useCallback((trackId: string) => {
    const current = valueRef.current
    if (!current.model.tracks.some((track) => track.id === trackId)) return
    setNotice(null)
    const track = current.model.tracks.find((candidate) => candidate.id === trackId)
    const clipId = getComposeAnimationClips(current.model).find((clip) => (
      clip.label === track?.label || clip.id.startsWith(trackId)
    ))?.id ?? getComposeAnimationClips(current.model)[0]?.id ?? null
    commit({
      ...current,
      selectedTrackId: trackId,
      selectedPropertyId: null,
      selectedClipId: clipId,
    })
  }, [commit])
  const selectProperty = useCallback((propertyId: string) => {
    const current = valueRef.current
    const exists = current.model.tracks.some((track) => (
      track.properties.some((property) => property.id === propertyId)
    ))
    if (!exists) return
    setNotice(null)
    commit({
      ...current,
      selectedPropertyId: propertyId,
      selectedTrackId: null,
      selectedClipId: null,
    })
  }, [commit])
  const selectClip = useCallback((clipId: string) => {
    const current = valueRef.current
    const clip = getComposeAnimationClips(current.model).find((candidate) => candidate.id === clipId)
    if (!clip) return
    const trackId = current.model.tracks.find((track) => (
      track.label === clip.label || clip.id.startsWith(track.id)
    ))?.id ?? current.model.tracks[0]?.id ?? null
    setNotice(null)
    commit({
      ...current,
      selectedClipId: clipId,
      selectedTrackId: trackId,
      selectedPropertyId: null,
    })
  }, [commit])
  const updateClipRange = useCallback((clipId: string, startTimeMs: number, endTimeMs: number) => {
    setNotice(null)
    commit(updateComposeAnimationClip(valueRef.current, clipId, { startTimeMs, endTimeMs }))
  }, [commit])
  const selectInterpolationSegment = useCallback((endKeyframeId: string) => {
    const current = valueRef.current
    const located = findComposeAnimationKeyframe(current.model, endKeyframeId)
    if (!located || located.location.keyframeIndex === 0) return
    setNotice(null)
    commit({
      ...current,
      easingEditor: 'curve',
      selectedKeyframeId: endKeyframeId,
      selectedPropertyId: located.property.id,
      selectedTrackId: null,
    })
  }, [commit])
  const updateKeyframe = useCallback((keyframeId: string, update: Partial<Pick<ComposeAnimationKeyframe, 'timeMs' | 'value' | 'interpolation'>>) => {
    const current = valueRef.current
    const result = updateComposeAnimationKeyframe(current, keyframeId, update)
    if (result.conflict) {
      setNotice('duplicate-time')
      return false
    }
    setNotice(null)
    commit({
      ...result.value,
      selectedKeyframeId: keyframeId,
    })
    return true
  }, [commit])
  const updateSelectedKeyframe = useCallback((update: Partial<Pick<ComposeAnimationKeyframe, 'timeMs' | 'value' | 'interpolation'>>) => {
    const keyframeId = valueRef.current.selectedKeyframeId
    return keyframeId ? updateKeyframe(keyframeId, update) : false
  }, [updateKeyframe])
  const moveKeyframe = useCallback((keyframeId: string, timeMs: number) => {
    updateKeyframe(keyframeId, { timeMs })
  }, [updateKeyframe])
  const toggleTrack = useCallback((trackId: string) => {
    commit(toggleComposeAnimationTrack(valueRef.current, trackId))
  }, [commit])
  const addKeyframe = useCallback(() => {
    commit(addComposeAnimationKeyframe(valueRef.current))
  }, [commit])
  const setEasingEditor = useCallback((easingEditor: 'curve' | 'spring') => {
    commit({ ...valueRef.current, easingEditor })
  }, [commit])

  useEffect(() => {
    if (!value.isPlaying) return
    let frame = requestAnimationFrame(function tick(now) {
      const current = valueRef.current
      const previous = previousFrameTimeRef.current ?? now
      previousFrameTimeRef.current = now
      const elapsed = now - previous + frameRemainderRef.current
      const wholeElapsedMs = Math.floor(elapsed)
      frameRemainderRef.current = elapsed - wholeElapsedMs
      const next = advanceComposeAnimationPlayback(
        current.currentTimeMs,
        current.model.durationMs,
        current.playbackMode,
        wholeElapsedMs,
        playbackDirectionRef.current,
      )
      playbackDirectionRef.current = next.direction
      commit({ ...current, currentTimeMs: next.timeMs, isPlaying: next.isPlaying })
      if (next.isPlaying) frame = requestAnimationFrame(tick)
    })
    // 暂停或卸载时丢弃上一帧时间戳与余量：暂停期间流逝的真实时间不计入播放头。
    return () => {
      cancelAnimationFrame(frame)
      previousFrameTimeRef.current = null
      frameRemainderRef.current = 0
    }
  }, [commit, value.isPlaying])

  // Provider 挂在编辑器根节点上：不记忆化时，宿主任何一次无关重渲染都会换掉 session 引用，
  // 把整条时间线一起刷新。所有回调都是稳定的 useCallback，依赖只剩会话值与提示。
  const session = useMemo<ComposeAnimationPanelSession>(() => ({
    value,
    selectedKeyframe: findComposeAnimationKeyframe(value.model, value.selectedKeyframeId),
    notice,
    setCurrentTime,
    setDuration,
    setPlaying,
    setPlaybackMode,
    toggleAutoRecord,
    selectKeyframe,
    selectTrack,
    selectProperty,
    selectClip,
    updateClipRange,
    selectInterpolationSegment,
    moveKeyframe,
    updateSelectedKeyframe,
    toggleTrack,
    addKeyframe,
    setEasingEditor,
  }), [
    addKeyframe, moveKeyframe, notice, selectClip, selectInterpolationSegment, selectKeyframe,
    selectProperty, selectTrack, setCurrentTime, setDuration, setEasingEditor, setPlaybackMode,
    setPlaying, toggleAutoRecord, toggleTrack, updateClipRange, updateSelectedKeyframe, value,
  ])
  return <AnimationPanelContext.Provider value={session}>{children}</AnimationPanelContext.Provider>
}
