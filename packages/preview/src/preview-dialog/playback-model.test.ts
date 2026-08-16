import { describe, expect, it } from 'vitest'
import { advanceComposePreviewPlayhead } from './playback-model'

const at = (timeMs: number, direction: 1 | -1 = 1) => ({ timeMs, direction })

describe('advanceComposePreviewPlayhead', () => {
  it('play-once 停在末尾并报告完成', () => {
    expect(advanceComposePreviewPlayhead(at(100), 50, 400, 'play-once')).toEqual({
      state: at(150),
      done: false,
    })
    expect(advanceComposePreviewPlayhead(at(390), 50, 400, 'play-once')).toEqual({
      state: at(400),
      done: true,
    })
  })

  it('loop 到末尾回绕，超大时间差取模', () => {
    expect(advanceComposePreviewPlayhead(at(390), 20, 400, 'loop')).toEqual({
      state: at(10),
      done: false,
    })
    expect(advanceComposePreviewPlayhead(at(0), 1250, 400, 'loop')).toEqual({
      state: at(50),
      done: false,
    })
  })

  it('ping-pong 在两端反射并翻转方向', () => {
    expect(advanceComposePreviewPlayhead(at(390), 20, 400, 'ping-pong')).toEqual({
      state: at(390, -1),
      done: false,
    })
    expect(advanceComposePreviewPlayhead(at(10, -1), 20, 400, 'ping-pong')).toEqual({
      state: at(10),
      done: false,
    })
  })

  it('时长为零或无推进量时不移动', () => {
    expect(advanceComposePreviewPlayhead(at(0), 16, 0, 'loop').done).toBe(true)
    expect(advanceComposePreviewPlayhead(at(120), 0, 400, 'loop')).toEqual({
      state: at(120),
      done: false,
    })
  })
})
