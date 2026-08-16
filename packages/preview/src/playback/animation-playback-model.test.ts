import { describe, expect, it } from 'vitest'
import {
  INITIAL_COMPOSE_ANIMATION_PLAYBACK,
  advanceComposeAnimationPlayback,
} from './animation-playback-model'
import type { ComposeAnimationPlaybackState } from './animation-playback-model'

const at = (timeMs: number, running: boolean, lastPlaying: boolean): ComposeAnimationPlaybackState => ({
  playhead: { timeMs, direction: 1 },
  running,
  lastPlaying,
})

describe('advanceComposeAnimationPlayback', () => {
  it('OpenSpec: page-script-runtime / 动画播放控制的脚本驱动语义 / 上升沿从头播放', () => {
    const midway = at(180, false, false)
    const next = advanceComposeAnimationPlayback(midway, { playing: true }, 16, 400, 'play-once')
    // 上升沿先复位到 0 再开始推进，而不是从 180 ms 继续。
    expect(next).toEqual(at(0, true, true))
  })

  it('OpenSpec: page-script-runtime / 动画播放控制的脚本驱动语义 / 下降沿停在当前帧', () => {
    const playing = at(180, true, true)
    const next = advanceComposeAnimationPlayback(playing, { playing: false }, 16, 400, 'loop')
    expect(next).toEqual(at(180, false, false))
  })

  it('OpenSpec: page-script-runtime / 动画播放控制的脚本驱动语义 / 重新触发可重播', () => {
    // play-once 播到末尾后停住（running false，lastPlaying 仍为 true）。
    let state = at(390, true, true)
    state = advanceComposeAnimationPlayback(state, { playing: true }, 20, 400, 'play-once')
    expect(state).toEqual(at(400, false, true))
    // 布尔保持 true：不重播、不推进。
    state = advanceComposeAnimationPlayback(state, { playing: true }, 16, 400, 'play-once')
    expect(state).toEqual(at(400, false, true))
    // false → true 的新一轮上升沿：从 0 重新播放。
    state = advanceComposeAnimationPlayback(state, { playing: false }, 16, 400, 'play-once')
    state = advanceComposeAnimationPlayback(state, { playing: true }, 16, 400, 'play-once')
    expect(state).toEqual(at(0, true, true))
  })

  it('loop 与 ping-pong 在边界折返并保持推进', () => {
    const looping = advanceComposeAnimationPlayback(at(390, true, true), { playing: true }, 20, 400, 'loop')
    expect(looping.playhead.timeMs).toBe(10)
    expect(looping.running).toBe(true)
    const bouncing = advanceComposeAnimationPlayback(at(390, true, true), { playing: true }, 20, 400, 'ping-pong')
    expect(bouncing.playhead).toEqual({ timeMs: 390, direction: -1 })
    expect(bouncing.running).toBe(true)
  })

  it('OpenSpec: page-script-runtime / 动画播放控制的脚本驱动语义 / 脚本接管时间轴', () => {
    const next = advanceComposeAnimationPlayback(
      at(0, true, true),
      // playing 同时为 true 也不改变行为：currentTime 存在即完全接管。
      { playing: true, currentTimeMs: 150 },
      16,
      400,
      'loop',
    )
    expect(next.playhead.timeMs).toBe(150)
    expect(next.running).toBe(false)
  })

  it('OpenSpec: page-script-runtime / 动画播放控制的脚本驱动语义 / 当前时间越界被钳制', () => {
    expect(
      advanceComposeAnimationPlayback(INITIAL_COMPOSE_ANIMATION_PLAYBACK, { currentTimeMs: -20 }, 0, 400, 'loop')
        .playhead.timeMs,
    ).toBe(0)
    expect(
      advanceComposeAnimationPlayback(INITIAL_COMPOSE_ANIMATION_PLAYBACK, { currentTimeMs: 900 }, 0, 400, 'loop')
        .playhead.timeMs,
    ).toBe(400)
  })

  it('无绑定读数时停在原地且不推进', () => {
    expect(advanceComposeAnimationPlayback(INITIAL_COMPOSE_ANIMATION_PLAYBACK, {}, 16, 400, 'loop'))
      .toBe(INITIAL_COMPOSE_ANIMATION_PLAYBACK)
  })
})
