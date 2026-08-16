import type { ComposeAnimationPlaybackMode } from '@compose-ui/core'

/** 预览播放头的会话状态；`direction` 只在 ping-pong 模式下取 -1。 */
export interface ComposePreviewPlayheadState {
  readonly timeMs: number
  readonly direction: 1 | -1
}

/** 一次推进的结果；`done` 为 true 表示 play-once 已到末尾，应停止播放。 */
export interface ComposePreviewPlayheadAdvance {
  readonly state: ComposePreviewPlayheadState
  readonly done: boolean
}

/**
 * 按播放模式推进预览播放头。
 *
 * @remarks
 * 纯函数：rAF 回调只负责取时间差，边界行为都在这里——`play-once` 停在末尾、`loop` 回绕、
 * `ping-pong` 在两端反射。`deltaMs` 大于时长（帧率骤降或标签页切回）时 loop 用取模、
 * ping-pong 用往返周期取模，不会越界或抖动。
 */
export function advanceComposePreviewPlayhead(
  state: ComposePreviewPlayheadState,
  deltaMs: number,
  durationMs: number,
  mode: ComposeAnimationPlaybackMode,
): ComposePreviewPlayheadAdvance {
  if (durationMs <= 0 || deltaMs <= 0) {
    return { state, done: durationMs <= 0 }
  }
  if (mode === 'play-once') {
    const next = state.timeMs + deltaMs
    if (next >= durationMs) {
      return { state: { timeMs: durationMs, direction: 1 }, done: true }
    }
    return { state: { timeMs: next, direction: 1 }, done: false }
  }
  if (mode === 'loop') {
    return {
      state: { timeMs: (state.timeMs + deltaMs) % durationMs, direction: 1 },
      done: false,
    }
  }
  // ping-pong：把状态展开到 [0, 2*duration) 的往返周期上再折回。
  const cycle = durationMs * 2
  const unfolded = state.direction === 1 ? state.timeMs : cycle - state.timeMs
  const position = (unfolded + deltaMs) % cycle
  return {
    state: position < durationMs
      ? { timeMs: position, direction: 1 }
      : { timeMs: cycle - position, direction: -1 },
    done: false,
  }
}
