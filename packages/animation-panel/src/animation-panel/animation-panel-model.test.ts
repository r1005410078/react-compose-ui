import { describe, expect, it } from 'vitest'
import {
  addComposeAnimationKeyframe,
  advanceComposeAnimationPlayback,
  updateComposeAnimationDuration,
  updateComposeAnimationClip,
  updateComposeAnimationKeyframe,
} from './animation-panel-model'
import { createDefaultComposeAnimationPanelValue } from './default-value'

describe('animation panel model', () => {
  it('OpenSpec: animation-panel / 本地时间线与关键帧交互 / 选择并编辑关键帧', () => {
    const initial = createDefaultComposeAnimationPanelValue()
    const moved = updateComposeAnimationKeyframe(initial, 'fault-background-fill-200', {
      timeMs: 250,
      value: '#FF8080',
      interpolation: 'ease-out',
    })

    expect(moved.conflict).toBe(false)
    expect(moved.value.model.tracks[0]?.properties[0]?.keyframes[2]).toMatchObject({
      id: 'fault-background-fill-200',
      interpolation: 'ease-out',
      timeMs: 250,
      value: '#FF8080',
    })

    const conflict = updateComposeAnimationKeyframe(moved.value, 'fault-background-fill-200', {
      timeMs: 300,
    })
    expect(conflict.conflict).toBe(true)
    expect(conflict.value).toBe(moved.value)
  })

  it('OpenSpec: animation-panel / 本地时间线与关键帧交互 / 选择并编辑关键帧 - 添加关键帧', () => {
    const value = { ...createDefaultComposeAnimationPanelValue(), currentTimeMs: 150 }
    const next = addComposeAnimationKeyframe(value)

    expect(next.selectedKeyframeId).toBe('background-fill-150')
    expect(next.model.tracks[0]?.properties[0]?.keyframes.map(({ timeMs }) => timeMs))
      .toEqual([0, 100, 150, 200, 300])
  })

  it('OpenSpec: animation-panel / 播放模式 / 依播放一次、循环和往返规则推进播放头', () => {
    expect(advanceComposeAnimationPlayback(280, 300, 'play-once', 30, 1))
      .toEqual({ timeMs: 300, isPlaying: false, direction: 1 })
    expect(advanceComposeAnimationPlayback(280, 300, 'loop', 30, 1))
      .toEqual({ timeMs: 10, isPlaying: true, direction: 1 })

    const bounced = advanceComposeAnimationPlayback(280, 300, 'ping-pong', 30, 1)
    expect(bounced).toEqual({ timeMs: 290, isPlaying: true, direction: -1 })
    expect(advanceComposeAnimationPlayback(bounced.timeMs, 300, 'ping-pong', 30, bounced.direction))
      .toEqual({ timeMs: 260, isPlaying: true, direction: -1 })
  })

  it('OpenSpec: animation-panel / 尾帧时长 / 调整时长时同步移动尾帧并保留关键帧间距', () => {
    const initial = createDefaultComposeAnimationPanelValue()
    const extended = updateComposeAnimationDuration(initial, 500)
    expect(extended.model.durationMs).toBe(500)
    expect(extended.model.tracks[0]?.properties[0]?.keyframes.map(({ timeMs }) => timeMs))
      .toEqual([0, 100, 200, 500])
    expect(extended.model.clips).toMatchObject([{ startTimeMs: 0, endTimeMs: 500 }])

    const shortened = updateComposeAnimationDuration(initial, 100)
    expect(shortened.model.durationMs).toBe(210)
    expect(shortened.model.tracks[0]?.properties[0]?.keyframes.map(({ timeMs }) => timeMs))
      .toEqual([0, 100, 200, 210])
  })

  it('OpenSpec: animation-panel / 可调整动画片段 / 保持片段范围在时间轴内且至少 10 ms', () => {
    const initial = createDefaultComposeAnimationPanelValue()
    const resized = updateComposeAnimationClip(initial, 'fault-animation', {
      startTimeMs: 40,
      endTimeMs: 250,
    })
    expect(resized.selectedClipId).toBe('fault-animation')
    expect(resized.model.clips).toMatchObject([{ startTimeMs: 40, endTimeMs: 250 }])

    const constrained = updateComposeAnimationClip(resized, 'fault-animation', {
      startTimeMs: 300,
      endTimeMs: 300,
    })
    expect(constrained.model.clips).toMatchObject([{ startTimeMs: 290, endTimeMs: 300 }])
  })

  it('OpenSpec: animation-panel / 本地时间线与关键帧交互 / 在已用过的时间再次添加关键帧不会重复 ID', () => {
    const added = addComposeAnimationKeyframe({
      ...createDefaultComposeAnimationPanelValue(),
      currentTimeMs: 150,
    })
    const moved = updateComposeAnimationKeyframe(added, 'background-fill-150', { timeMs: 250 })
    expect(moved.conflict).toBe(false)

    // 150 ms 已空出来，但 `background-fill-150` 这个 ID 仍被移动后的关键帧占用。
    const readded = addComposeAnimationKeyframe({
      ...moved.value,
      currentTimeMs: 150,
      selectedKeyframeId: null,
    })
    const ids = readded.model.tracks[0]?.properties[0]?.keyframes.map(({ id }) => id) ?? []
    expect(new Set(ids).size).toBe(ids.length)
    expect(readded.selectedKeyframeId).toBe('background-fill-150-2')
  })
})
