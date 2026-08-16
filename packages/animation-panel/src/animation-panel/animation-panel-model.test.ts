import { describe, expect, it } from 'vitest'
import {
  addComposeAnimationKeyframe,
  advanceComposeAnimationPlayback,
  clampComposeAnimationPixelsPerMs,
  getComposeAnimationClips,
  panComposeAnimationTimeline,
  updateComposeAnimationDuration,
  updateComposeAnimationClip,
  updateComposeAnimationKeyframe,
  zoomComposeAnimationTimelineAt,
} from './animation-panel-model'
import { createDefaultComposeAnimationPanelValue } from './default-value'

describe('animation panel model', () => {
  it('OpenSpec: animation-panel / 本地时间线与关键帧交互 / 选择并编辑关键帧', () => {
    const initial = createDefaultComposeAnimationPanelValue()
    const moved = updateComposeAnimationKeyframe(initial, 'fault-background-fill-200', {
      timeMs: 250,
      value: '#FF8080',
      interpolation: { kind: 'cubic', control: [0, 0, 0.58, 1] },
    })

    expect(moved.conflict).toBe(false)
    expect(moved.value.model.tracks[0]?.properties[0]?.keyframes[2]).toMatchObject({
      id: 'fault-background-fill-200',
      interpolation: { kind: 'cubic', control: [0, 0, 0.58, 1] },
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
    expect(extended.model.clips?.find((clip) => clip.id === 'fault-animation'))
      .toMatchObject({ startTimeMs: 0, endTimeMs: 500 })

    const shortened = updateComposeAnimationDuration(initial, 100)
    // 多物体演示会话中，其它轨道可能有更靠后的关键帧，尾帧下限取全局最晚非尾帧 + 10
    const lastContentKeyframeMs = initial.model.tracks
      .flatMap((track) => track.properties)
      .flatMap((property) => property.keyframes)
      .filter((keyframe) => keyframe.timeMs < initial.model.durationMs)
      .reduce((maximum, keyframe) => Math.max(maximum, keyframe.timeMs), 0)
    const minDurationMs = lastContentKeyframeMs + 10
    expect(shortened.model.durationMs).toBe(minDurationMs)
    expect(shortened.model.tracks[0]?.properties[0]?.keyframes.map(({ timeMs }) => timeMs))
      .toEqual([0, 100, 200, minDurationMs])
  })

  it('OpenSpec: animation-panel / 可调整动画片段 / 保持片段范围在时间轴内且至少 10 ms', () => {
    const initial = createDefaultComposeAnimationPanelValue()
    const resized = updateComposeAnimationClip(initial, 'fault-animation', {
      startTimeMs: 40,
      endTimeMs: 250,
    })
    expect(resized.selectedClipId).toBe('fault-animation')
    expect(resized.model.clips?.find((clip) => clip.id === 'fault-animation'))
      .toMatchObject({ startTimeMs: 40, endTimeMs: 250 })

    const constrained = updateComposeAnimationClip(resized, 'fault-animation', {
      startTimeMs: 300,
      endTimeMs: 300,
    })
    expect(constrained.model.clips?.find((clip) => clip.id === 'fault-animation'))
      .toMatchObject({ startTimeMs: 290, endTimeMs: 300 })
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

  it('OpenSpec: animation-panel / 缩放边界钳制 / 缩小到下限后停止响应', () => {
    // 300 ms 动画塞进 700 px 容器：下限是"总宽度等于可视宽度"，即 700 / 300 px/ms。
    expect(clampComposeAnimationPixelsPerMs(0.1, 700, 300)).toBeCloseTo(700 / 300)
    expect(clampComposeAnimationPixelsPerMs(700 / 300, 700, 300)).toBeCloseTo(700 / 300)
  })

  it('OpenSpec: animation-panel / 缩放边界钳制 / 放大到上限后停止响应', () => {
    expect(clampComposeAnimationPixelsPerMs(999, 700, 300)).toBe(20)
    expect(clampComposeAnimationPixelsPerMs(20, 700, 300)).toBe(20)
  })

  it('OpenSpec: animation-panel / 缩放边界钳制 / 上下限之间的值原样通过', () => {
    expect(clampComposeAnimationPixelsPerMs(5, 700, 300)).toBe(5)
  })

  it('OpenSpec: animation-panel / 缩放边界钳制 / 容器宽度变化后钳制边界随之更新', () => {
    // 用户已缩小到旧容器（700 px）的下限，容器又被进一步缩窄到 400 px：
    // 下限降为 400/300，当前缩放仍在新下限之上，因此保持不变；
    // 但如果容器反而变宽到 1400 px，新下限升到 1400/300，当前缩放低于新下限，必须回弹。
    const oldFloor = clampComposeAnimationPixelsPerMs(0.1, 700, 300)
    expect(clampComposeAnimationPixelsPerMs(oldFloor, 400, 300)).toBeCloseTo(oldFloor)
    expect(clampComposeAnimationPixelsPerMs(oldFloor, 1400, 300)).toBeCloseTo(1400 / 300)
  })

  it('OpenSpec: animation-panel / 时间线滚轮缩放与平移 / 缩放前后光标下方的时间点保持对齐', () => {
    // 100 ms 处的关键帧在放大前位于像素 500（5 px/ms），鼠标在视口内偏移 50 px 处。
    const result = zoomComposeAnimationTimelineAt(5, 2, 100, 50, 700, 300)
    expect(result.pixelsPerMs).toBe(10)
    // 新缩放下 100 ms 对应像素 1000；scrollLeft 必须让视口内偏移仍是 50 px：1000 - 950 = 50。
    expect(result.scrollLeft).toBe(950)
    expect(100 * result.pixelsPerMs - result.scrollLeft).toBe(50)
  })

  it('OpenSpec: animation-panel / 时间线滚轮缩放与平移 / 锚点滚动位置钳制在有效范围内', () => {
    // 请求把已经贴着右边界的锚点继续放大，理论 scrollLeft 会超出内容宽度，必须钳制到 maxScrollLeft。
    const overshoot = zoomComposeAnimationTimelineAt(5, 4, 300, 690, 700, 300)
    const totalWidthPx = 300 * overshoot.pixelsPerMs
    const maxScrollLeft = totalWidthPx - 700
    expect(overshoot.scrollLeft).toBeCloseTo(maxScrollLeft)

    // 请求缩小到贴着左边界的锚点，理论 scrollLeft 会小于 0，必须钳制到 0。
    const undershoot = zoomComposeAnimationTimelineAt(5, 0.1, 0, 10, 700, 300)
    expect(undershoot.scrollLeft).toBe(0)
  })

  it('OpenSpec: animation-panel / 时间线滚轮缩放与平移 / 请求的缩放超出边界时用钳制后的值求解滚动位置', () => {
    // 请求缩放到 999（会被钳制到上限 20），滚动位置必须用钳制后的 20 px/ms 计算，而不是未钳制的 999。
    const result = zoomComposeAnimationTimelineAt(5, 999 / 5, 100, 50, 700, 300)
    expect(result.pixelsPerMs).toBe(20)
    expect(result.scrollLeft).toBe(100 * 20 - 50)
  })

  it('OpenSpec: animation-panel / 时间线滚轮缩放与平移 / 不带修饰键的滚动做横向平移', () => {
    expect(panComposeAnimationTimeline(100, 50, 700, 300, 10)).toBe(150)
    // 平移量能让滚动位置越界时钳制在 0 和 maxScrollLeft 之间。
    expect(panComposeAnimationTimeline(10, -50, 700, 300, 10)).toBe(0)
    expect(panComposeAnimationTimeline(2900, 50, 700, 300, 10)).toBe(2300)
  })
})

describe('片段与轨道的显式归属', () => {
  const model = {
    durationMs: 300,
    tracks: [
      { id: 'a', label: 'A', expanded: true, properties: [] },
      { id: 'b', label: 'A', expanded: true, properties: [] },
    ],
  }

  it('OpenSpec: animation-panel / 显式片段归属与宿主提供的文案 / 缺省片段按轨道各生成一条', () => {
    const clips = getComposeAnimationClips(model)
    expect(clips.map((clip) => clip.trackId)).toEqual(['a', 'b'])
    expect(clips.every((clip) => clip.startTimeMs === 0 && clip.endTimeMs === 300)).toBe(true)
  })

  it('OpenSpec: animation-panel / 显式片段归属与宿主提供的文案 / 同名轨道不会互相认领片段', () => {
    // 两条轨道 label 相同：按 label 猜测归属的旧启发式会把两条片段都算到第一条轨道上。
    const clips = getComposeAnimationClips({
      ...model,
      clips: [
        { id: 'c1', trackId: 'b', label: 'A', startTimeMs: 0, endTimeMs: 100 },
        { id: 'c2', trackId: 'a', label: 'A', startTimeMs: 100, endTimeMs: 200 },
      ],
    })
    expect(clips.filter((clip) => clip.trackId === 'a').map((clip) => clip.id)).toEqual(['c2'])
    expect(clips.filter((clip) => clip.trackId === 'b').map((clip) => clip.id)).toEqual(['c1'])
  })
})
