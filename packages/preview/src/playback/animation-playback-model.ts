import type { ComposeAnimationPlaybackMode } from '@compose-ui/core'
import { advanceComposePreviewPlayhead } from './playback-model'
import type { ComposePreviewPlayheadState } from './playback-model'

/**
 * 一帧的播放控制绑定读数。
 *
 * @remarks
 * `undefined` 表示该目标未绑定或绑定失效（导出不存在、类型不符）——两者都按未绑定处理，
 * 诊断由读取绑定的一层负责，状态机不感知失效原因。
 */
export interface ComposeAnimationBindingReading {
  readonly playing?: boolean
  readonly currentTimeMs?: number
}

/** 脚本驱动的动画播放状态；纯数据，不含任何计时器。 */
export interface ComposeAnimationPlaybackState {
  readonly playhead: ComposePreviewPlayheadState
  /** 是否需要继续逐帧推进；false 时宿主应停掉 rAF，不空转。 */
  readonly running: boolean
  /** 上一帧观测到的 playing 读数，用于上升沿 / 下降沿检测。 */
  readonly lastPlaying: boolean
}

/** 初始状态：停在 0 ms、未推进。 */
export const INITIAL_COMPOSE_ANIMATION_PLAYBACK: ComposeAnimationPlaybackState = {
  playhead: { timeMs: 0, direction: 1 },
  running: false,
  lastPlaying: false,
}

function clampTime(timeMs: number, durationMs: number): number {
  return Math.min(Math.max(timeMs, 0), Math.max(durationMs, 0))
}

/**
 * 按绑定读数推进一帧脚本驱动的动画播放。
 *
 * @remarks
 * 语义（见 page-script-runtime 规范）：
 * - `currentTimeMs` 存在时脚本完全接管：播放头等于其值钳制到 `[0, durationMs]`，
 *   不自行推进，`playing` 与 `playbackMode` 被忽略。
 * - `playing` 上升沿（false → true）先把播放头复位到 0 再开始推进——绑定布尔的主用例是
 *   "条件满足播一次入场"，每次重新满足都应从头播。
 * - 下降沿（true → false）停止推进并停在当前帧。
 * - `play-once` 到达末尾后 `running` 变 false；布尔保持 true 不会重播，需要一次
 *   false → true 才会再次从头播放。
 *
 * 纯函数：不碰 React、不碰 rAF，宿主用 `running` 决定是否继续调度下一帧。
 */
export function advanceComposeAnimationPlayback(
  state: ComposeAnimationPlaybackState,
  reading: ComposeAnimationBindingReading,
  deltaMs: number,
  durationMs: number,
  mode: ComposeAnimationPlaybackMode,
): ComposeAnimationPlaybackState {
  if (reading.currentTimeMs !== undefined) {
    return {
      playhead: { timeMs: clampTime(reading.currentTimeMs, durationMs), direction: 1 },
      running: false,
      lastPlaying: reading.playing === true,
    }
  }
  const playing = reading.playing === true
  if (playing && !state.lastPlaying) {
    return { playhead: { timeMs: 0, direction: 1 }, running: true, lastPlaying: true }
  }
  if (!playing) {
    return state.running || state.lastPlaying
      ? { playhead: state.playhead, running: false, lastPlaying: false }
      : state
  }
  if (!state.running) return state
  const advanced = advanceComposePreviewPlayhead(state.playhead, deltaMs, durationMs, mode)
  return { playhead: advanced.state, running: !advanced.done, lastPlaying: true }
}
