import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  adjacentComposeAnimationKeyframeTime,
  advanceComposeAnimationPlayback,
  addComposeAnimationKeyframe,
  getComposeAnimationSoleSelectedKeyframeId,
  moveComposeAnimationKeyframes,
  removeComposeAnimationKeyframe,
  removeComposeAnimationKeyframes,
  removeComposeAnimationPropertyTrack,
  removeComposeAnimationTrackGroup,
  clampComposeAnimationTime,
  findComposeAnimationKeyframe,
  getComposeAnimationClips,
  toggleComposeAnimationTrack,
  updateComposeAnimationDuration,
  updateComposeAnimationClip,
  updateComposeAnimationKeyframe,
} from './animation-panel-model'
import { AnimationPanelContext } from './animation-panel-context'
import { createEmptyComposeAnimationPanelValue } from './default-value'
import type {
  ComposeAnimationKeyframe,
  ComposeAnimationPanelAction,
  ComposeAnimationPanelProviderProps,
  ComposeAnimationPanelValue,
  ComposeAnimationPlaybackMode,
} from './types'

/** 关键帧选择的两种模式：替换选区，或切换该帧在选区里的去留（`Shift` + 点击）。 */
export type ComposeAnimationKeyframeSelectMode = 'replace' | 'toggle'

export interface ComposeAnimationPanelSession {
  readonly value: ComposeAnimationPanelValue
  /** 选区恰好一个成员时的定位结果；多选或无选择时为 `undefined`。 */
  readonly selectedKeyframe: ReturnType<typeof findComposeAnimationKeyframe>
  readonly notice: 'duplicate-time' | null
  readonly setCurrentTime: (timeMs: number) => void
  readonly setDuration: (durationMs: number) => void
  readonly setPlaying: (isPlaying: boolean) => void
  readonly setPlaybackMode: (mode: ComposeAnimationPlaybackMode) => void
  readonly toggleAutoRecord: () => void
  readonly selectKeyframe: (keyframeId: string, mode?: ComposeAnimationKeyframeSelectMode) => void
  /** 框选落地：替换选区，或把这批加进既有选区（`Shift` + 框选）。 */
  readonly selectKeyframes: (keyframeIds: readonly string[], mode: 'replace' | 'add') => void
  readonly selectTrack: (trackId: string) => void
  readonly selectProperty: (propertyId: string) => void
  readonly selectClip: (clipId: string) => void
  readonly updateClipRange: (clipId: string, startTimeMs: number, endTimeMs: number) => void
  readonly selectInterpolationSegment: (startKeyframeId: string) => void
  readonly moveKeyframe: (keyframeId: string, timeMs: number) => void
  /**
   * 时间线手势：以 `anchorKeyframeId` 为锚点把整个选区平移到 `timeMs`。
   *
   * @remarks
   * 锚点不在选区里时只移动锚点自己。单选就是选区一个成员的情形，拖动与方向键只走这一个入口。
   */
  readonly moveKeyframes: (anchorKeyframeId: string, timeMs: number) => void
  readonly removeKeyframe: (keyframeId: string) => void
  /** 删除整个选区；选区为空时什么都不做。 */
  readonly removeSelectedKeyframes: () => void
  /** 删除一条属性轨道及其全部关键帧。 */
  readonly removeTrack: (propertyId: string) => void
  /** 删除一个对象轨道下的全部属性轨道。 */
  readonly removeTrackGroup: (trackId: string) => void
  /** 请求在指定时间打点；值由宿主决定，面板不本地写入关键帧。 */
  readonly addKeyframeAtTime: (propertyId: string, timeMs: number) => void
  /** 把播放头移到该属性轨道在当前时间之前/之后最近的关键帧；没有则不动。 */
  readonly seekAdjacentKeyframe: (propertyId: string, direction: 'previous' | 'next') => void
  readonly updateSelectedKeyframe: (
    update: Partial<Pick<ComposeAnimationKeyframe, 'timeMs' | 'value' | 'interpolation'>>,
  ) => boolean
  readonly toggleTrack: (trackId: string) => void
  readonly addKeyframe: () => void
}

export function AnimationPanelProvider({
  children,
  defaultValue,
  onAction,
  onValueChange,
  value: controlledValue,
}: ComposeAnimationPanelProviderProps) {
  // 缺省从空会话开始：回退到演示数据会让初始空页面伪装成"已经有动画"。
  const [uncontrolledValue, setUncontrolledValue] = useState(() => (
    defaultValue ?? createEmptyComposeAnimationPanelValue()
  ))
  const [notice, setNotice] = useState<'duplicate-time' | null>(null)
  const value = controlledValue ?? uncontrolledValue
  const valueRef = useRef(value)
  const onValueChangeRef = useRef(onValueChange)
  const onActionRef = useRef(onAction)
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
    onActionRef.current = onAction
  }, [onAction, onValueChange, value])

  const commit = useCallback((next: ComposeAnimationPanelValue) => {
    valueRef.current = next
    if (!controlledRef.current) setUncontrolledValue(next)
    onValueChangeRef.current?.(next)
  }, [])
  // 通过 ref 调用保持稳定引用：emit 出现在多数会话回调里，不能让宿主换 onAction 就重建全部回调。
  const emit = useCallback((action: ComposeAnimationPanelAction) => {
    onActionRef.current?.(action)
  }, [])
  const setCurrentTime = useCallback((timeMs: number) => {
    const current = valueRef.current
    const clamped = clampComposeAnimationTime(timeMs, current.model.durationMs)
    commit({ ...current, currentTimeMs: clamped })
    emit({ kind: 'set-current-time', timeMs: clamped })
  }, [commit, emit])
  const setDuration = useCallback((durationMs: number) => {
    setNotice(null)
    const next = updateComposeAnimationDuration(valueRef.current, durationMs)
    commit(next)
    emit({ kind: 'set-duration', durationMs: next.model.durationMs })
  }, [commit, emit])
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
    emit({ kind: 'set-playback-mode', mode: playbackMode })
  }, [commit, emit])
  const toggleAutoRecord = useCallback(() => {
    commit({ ...valueRef.current, autoRecord: !valueRef.current.autoRecord })
    emit({ kind: 'toggle-auto-record' })
  }, [commit, emit])
  const selectKeyframe = useCallback((keyframeId: string, mode: ComposeAnimationKeyframeSelectMode = 'replace') => {
    const current = valueRef.current
    const located = findComposeAnimationKeyframe(current.model, keyframeId)
    if (!located) return
    setNotice(null)
    const alreadySelected = current.selectedKeyframeIds.includes(keyframeId)
    const selectedKeyframeIds = mode === 'toggle'
      ? (alreadySelected
          ? current.selectedKeyframeIds.filter((id) => id !== keyframeId)
          : [...current.selectedKeyframeIds, keyframeId])
      : [keyframeId]
    commit({
      ...current,
      selectedKeyframeIds,
      selectedPropertyId: located.property.id,
      selectedTrackId: null,
    })
    emit({ kind: 'select', trackId: null, propertyId: located.property.id, keyframeIds: selectedKeyframeIds })
  }, [commit, emit])
  const selectKeyframes = useCallback((keyframeIds: readonly string[], mode: 'replace' | 'add') => {
    const current = valueRef.current
    const existing = keyframeIds.filter((id) => findComposeAnimationKeyframe(current.model, id))
    const merged = mode === 'add'
      ? [...current.selectedKeyframeIds, ...existing.filter((id) => !current.selectedKeyframeIds.includes(id))]
      : existing
    setNotice(null)
    // 属性轨道的选中态跟着「恰好一个成员」走：多选横跨多条轨道，没有哪一条能代表整个选区。
    const sole = merged.length === 1 ? findComposeAnimationKeyframe(current.model, merged[0]!) : undefined
    const selectedPropertyId = sole ? sole.property.id : (merged.length === 0 ? current.selectedPropertyId : null)
    commit({
      ...current,
      selectedKeyframeIds: merged,
      selectedPropertyId,
      selectedTrackId: merged.length === 0 ? current.selectedTrackId : null,
    })
    emit({ kind: 'select', trackId: null, propertyId: selectedPropertyId ?? null, keyframeIds: merged })
  }, [commit, emit])
  const selectTrack = useCallback((trackId: string) => {
    const current = valueRef.current
    if (!current.model.tracks.some((track) => track.id === trackId)) return
    setNotice(null)
    // 选对象轨道不连带选中片段：片段代表"动画本身"（宿主据此切换动画检查器），
    // 对象行代表 Entity。片段 → 轨道的联动保留在 selectClip 里，让所在行仍然高亮。
    commit({
      ...current,
      selectedTrackId: trackId,
      selectedPropertyId: null,
      selectedClipId: null,
    })
    emit({ kind: 'select', trackId, propertyId: null, keyframeIds: current.selectedKeyframeIds })
  }, [commit, emit])
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
    emit({ kind: 'select', trackId: null, propertyId, keyframeIds: current.selectedKeyframeIds })
  }, [commit, emit])
  const selectClip = useCallback((clipId: string) => {
    const current = valueRef.current
    const clip = getComposeAnimationClips(current.model).find((candidate) => candidate.id === clipId)
    if (!clip) return
    const trackId = current.model.tracks.some((track) => track.id === clip.trackId)
      ? clip.trackId
      : null
    setNotice(null)
    commit({
      ...current,
      selectedClipId: clipId,
      selectedTrackId: trackId,
      selectedPropertyId: null,
    })
    emit({ kind: 'select', trackId, propertyId: null, keyframeIds: current.selectedKeyframeIds })
  }, [commit, emit])
  const updateClipRange = useCallback((clipId: string, startTimeMs: number, endTimeMs: number) => {
    setNotice(null)
    commit(updateComposeAnimationClip(valueRef.current, clipId, { startTimeMs, endTimeMs }))
  }, [commit])
  const selectInterpolationSegment = useCallback((startKeyframeId: string) => {
    const current = valueRef.current
    const located = findComposeAnimationKeyframe(current.model, startKeyframeId)
    // 插值挂出向段：段由起点关键帧控制，末帧没有出向段因此不可选。
    if (!located || located.location.keyframeIndex >= located.property.keyframes.length - 1) return
    setNotice(null)
    commit({
      ...current,
      selectedKeyframeIds: [startKeyframeId],
      selectedPropertyId: located.property.id,
      selectedTrackId: null,
    })
    emit({
      kind: 'select',
      trackId: null,
      propertyId: located.property.id,
      keyframeIds: [startKeyframeId],
    })
  }, [commit, emit])
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
      selectedKeyframeIds: [keyframeId],
    })
    const located = findComposeAnimationKeyframe(result.value.model, keyframeId)
    if (located) {
      const propertyId = located.property.id
      if (update.timeMs !== undefined) {
        emit({ kind: 'move-keyframe', propertyId, keyframeId, timeMs: located.keyframe.timeMs })
      }
      if (update.value !== undefined) {
        emit({ kind: 'set-keyframe-value', propertyId, keyframeId, value: located.keyframe.value })
      }
      if (update.interpolation !== undefined) {
        emit({
          kind: 'set-interpolation',
          propertyId,
          keyframeId,
          interpolation: located.keyframe.interpolation,
        })
      }
    }
    return true
  }, [commit, emit])
  const updateSelectedKeyframe = useCallback((update: Partial<Pick<ComposeAnimationKeyframe, 'timeMs' | 'value' | 'interpolation'>>) => {
    const keyframeId = getComposeAnimationSoleSelectedKeyframeId(valueRef.current)
    return keyframeId ? updateKeyframe(keyframeId, update) : false
  }, [updateKeyframe])
  const moveKeyframe = useCallback((keyframeId: string, timeMs: number) => {
    updateKeyframe(keyframeId, { timeMs })
  }, [updateKeyframe])
  const moveKeyframes = useCallback((anchorKeyframeId: string, timeMs: number) => {
    const current = valueRef.current
    const anchor = findComposeAnimationKeyframe(current.model, anchorKeyframeId)
    if (!anchor) return
    const keyframeIds = current.selectedKeyframeIds.includes(anchorKeyframeId)
      ? current.selectedKeyframeIds
      : [anchorKeyframeId]
    const deltaMs = clampComposeAnimationTime(timeMs, current.model.durationMs) - anchor.keyframe.timeMs
    const result = moveComposeAnimationKeyframes(current, keyframeIds, deltaMs)
    if (result.conflict) {
      setNotice('duplicate-time')
      return
    }
    setNotice(null)
    if (result.deltaMs === 0) return
    commit(result.value)
    const items = keyframeIds.flatMap((keyframeId) => {
      const located = findComposeAnimationKeyframe(result.value.model, keyframeId)
      return located
        ? [{ propertyId: located.property.id, keyframeId, timeMs: located.keyframe.timeMs }]
        : []
    })
    emit({ kind: 'move-keyframes', items })
  }, [commit, emit])
  const removeKeyframe = useCallback((keyframeId: string) => {
    const current = valueRef.current
    const located = findComposeAnimationKeyframe(current.model, keyframeId)
    if (!located) return
    setNotice(null)
    commit(removeComposeAnimationKeyframe(current, keyframeId))
    emit({ kind: 'remove-keyframe', propertyId: located.property.id, keyframeId })
  }, [commit, emit])
  const removeSelectedKeyframes = useCallback(() => {
    const current = valueRef.current
    const items = current.selectedKeyframeIds.flatMap((keyframeId) => {
      const located = findComposeAnimationKeyframe(current.model, keyframeId)
      return located ? [{ propertyId: located.property.id, keyframeId }] : []
    })
    if (items.length === 0) return
    setNotice(null)
    commit(removeComposeAnimationKeyframes(current, items.map((item) => item.keyframeId)))
    emit({ kind: 'remove-keyframes', items })
  }, [commit, emit])
  const removeTrack = useCallback((propertyId: string) => {
    const current = valueRef.current
    const next = removeComposeAnimationPropertyTrack(current, propertyId)
    if (next === current) return
    setNotice(null)
    commit(next)
    emit({ kind: 'remove-track', propertyId })
  }, [commit, emit])
  const removeTrackGroup = useCallback((trackId: string) => {
    const current = valueRef.current
    const next = removeComposeAnimationTrackGroup(current, trackId)
    if (next === current) return
    setNotice(null)
    commit(next)
    emit({ kind: 'remove-track-group', trackId })
  }, [commit, emit])
  const addKeyframeAtTime = useCallback((propertyId: string, timeMs: number) => {
    // 只发动作不本地改模型：值是宿主的事实，面板复制一份插值实现只会与宿主漂移。
    emit({
      kind: 'add-keyframe-at-time',
      propertyId,
      timeMs: clampComposeAnimationTime(timeMs, valueRef.current.model.durationMs),
    })
  }, [emit])
  const seekAdjacentKeyframe = useCallback((
    propertyId: string,
    direction: 'previous' | 'next',
  ) => {
    const current = valueRef.current
    const target = adjacentComposeAnimationKeyframeTime(
      current,
      propertyId,
      current.currentTimeMs,
      direction,
    )
    if (target === null) return
    setCurrentTime(target)
  }, [setCurrentTime])
  const toggleTrack = useCallback((trackId: string) => {
    commit(toggleComposeAnimationTrack(valueRef.current, trackId))
  }, [commit])
  const addKeyframe = useCallback(() => {
    const current = valueRef.current
    const next = addComposeAnimationKeyframe(current)
    commit(next)
    const keyframeId = getComposeAnimationSoleSelectedKeyframeId(next)
    // 命中已有帧时模型只改选择；只有真正新增时才发编辑动作。
    if (!keyframeId || findComposeAnimationKeyframe(current.model, keyframeId)) return
    const located = findComposeAnimationKeyframe(next.model, keyframeId)
    if (!located) return
    emit({
      kind: 'add-keyframe',
      propertyId: located.property.id,
      keyframeId,
      timeMs: located.keyframe.timeMs,
      value: located.keyframe.value,
    })
  }, [commit, emit])
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
      // 播放只报播放头位置，绝不混入编辑动作；宿主据此把播放头留在会话态而不进文档。
      emit({ kind: 'set-current-time', timeMs: next.timeMs })
      if (next.isPlaying) frame = requestAnimationFrame(tick)
    })
    // 暂停或卸载时丢弃上一帧时间戳与余量：暂停期间流逝的真实时间不计入播放头。
    return () => {
      cancelAnimationFrame(frame)
      previousFrameTimeRef.current = null
      frameRemainderRef.current = 0
    }
  }, [commit, emit, value.isPlaying])

  // Provider 挂在编辑器根节点上：不记忆化时，宿主任何一次无关重渲染都会换掉 session 引用，
  // 把整条时间线一起刷新。所有回调都是稳定的 useCallback，依赖只剩会话值与提示。
  const session = useMemo<ComposeAnimationPanelSession>(() => ({
    value,
    selectedKeyframe: findComposeAnimationKeyframe(value.model, getComposeAnimationSoleSelectedKeyframeId(value)),
    notice,
    setCurrentTime,
    setDuration,
    setPlaying,
    setPlaybackMode,
    toggleAutoRecord,
    selectKeyframe,
    selectKeyframes,
    selectTrack,
    selectProperty,
    selectClip,
    updateClipRange,
    selectInterpolationSegment,
    moveKeyframe,
    moveKeyframes,
    removeKeyframe,
    removeSelectedKeyframes,
    removeTrack,
    removeTrackGroup,
    addKeyframeAtTime,
    seekAdjacentKeyframe,
    updateSelectedKeyframe,
    toggleTrack,
    addKeyframe,
  }), [
    addKeyframe, addKeyframeAtTime, moveKeyframe, moveKeyframes, notice, removeKeyframe,
    removeSelectedKeyframes, removeTrack, removeTrackGroup, seekAdjacentKeyframe, selectClip,
    selectInterpolationSegment, selectKeyframe, selectKeyframes, selectProperty, selectTrack,
    setCurrentTime, setDuration,
    setPlaybackMode, setPlaying, toggleAutoRecord, toggleTrack, updateClipRange,
    updateSelectedKeyframe, value,
  ])
  return <AnimationPanelContext.Provider value={session}>{children}</AnimationPanelContext.Provider>
}
