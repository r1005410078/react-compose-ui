import { describe, expect, it } from 'vitest'
import {
  RULER_MINOR_TICK_TOP,
  RULER_TICK_TOP,
  paintRuler,
  type ComposeRulerPaintInput,
} from './ruler-painter'

/** 记录调用而不依赖真实 Canvas；断言的是几何，不是像素。 */
function recordingContext() {
  const calls: { name: string; args: readonly unknown[] }[] = []
  const record = (name: string) => (...args: unknown[]) => { calls.push({ name, args }) }
  const ctx = {
    canvas: { width: 0, height: 0 },
    fillRect: record('fillRect'),
    clearRect: record('clearRect'),
    fillText: record('fillText'),
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    rotate: record('rotate'),
    setTransform: record('setTransform'),
    measureText: () => ({ width: 12 }),
    fillStyle: '',
    font: '',
    textAlign: '' as CanvasTextAlign,
    textBaseline: '' as CanvasTextBaseline,
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

const palette = {
  tick: '#87919e',
  tickMajor: '#c7ced7',
  label: '#c0c7d1',
  selection: '#f29b64',
  selectionLabel: '#ffd0b3',
  selectionShadow: '#303338',
  cursor: '#68a9ff',
}

function input(overrides: Partial<ComposeRulerPaintInput> = {}): ComposeRulerPaintInput {
  return {
    axis: 'x',
    ticks: [
      { value: 0, screen: 384, major: true, label: '0' },
      { value: 8, screen: 392, major: false },
      { value: 64, screen: 448, major: false, label: '64' },
    ],
    size: { width: 566, height: 24 },
    devicePixelRatio: 1,
    palette,
    selection: null,
    cursor: null,
    ...overrides,
  }
}

describe('OpenSpec: stage / 自适应网格标尺与世界原点 / 刻度线与网格线落在同一像素列', () => {
  it('刻度以世界坐标为左边界覆盖 1 CSS 像素', () => {
    const { ctx, calls } = recordingContext()
    paintRuler(ctx, input())
    const bands = calls.filter((call) => call.name === 'fillRect')
    expect(bands[0]?.args).toEqual([384, RULER_TICK_TOP, 1, 24 - RULER_TICK_TOP])
    // 细刻度更短，但左边界规则与带数字的刻度完全一致。
    expect(bands[1]?.args).toEqual([392, RULER_MINOR_TICK_TOP, 1, 24 - RULER_MINOR_TICK_TOP])
    expect(bands[2]?.args).toEqual([448, RULER_TICK_TOP, 1, 24 - RULER_TICK_TOP])
  })

  it('数字以刻度线为中心绘制', () => {
    const { ctx, calls } = recordingContext()
    paintRuler(ctx, input())
    const labels = calls.filter((call) => call.name === 'fillText')
    expect(ctx.textAlign).toBe('center')
    // 刻度带覆盖 [384, 385)，因此中心是 384.5。
    expect(labels[0]?.args[0]).toBe('0')
    expect(labels[0]?.args[1]).toBe(384.5)
  })

  it('按设备像素比设置 backing store 变换', () => {
    const { ctx, calls } = recordingContext()
    paintRuler(ctx, input({ devicePixelRatio: 2 }))
    expect(calls[0]).toEqual({ name: 'setTransform', args: [2, 0, 0, 2, 0, 0] })
  })
})

describe('OpenSpec: stage / 自适应网格标尺与世界原点 / 标记选择尺寸', () => {
  it('绘制区间高亮、起止端点与居中尺寸数字', () => {
    const { ctx, calls } = recordingContext()
    paintRuler(ctx, input({ selection: { start: 100, end: 260, label: '160' } }))
    const labels = calls.filter((call) => call.name === 'fillText')
    const last = labels[labels.length - 1]
    expect(last?.args[0]).toBe('160')
    expect(last?.args[1]).toBe(180)
  })
})

describe('OpenSpec: stage / 标尺指针游标线 / 指针移动时更新游标', () => {
  it('有指针位置时绘制游标带', () => {
    const { ctx, calls } = recordingContext()
    const withCursor = calls.length
    paintRuler(ctx, input({ cursor: 210 }))
    const bands = calls.slice(withCursor).filter((call) => call.name === 'fillRect')
    expect(bands.some((band) => band.args[0] === 210 && band.args[2] === 1)).toBe(true)
  })

  it('没有指针位置时不绘制游标带', () => {
    const { ctx, calls } = recordingContext()
    paintRuler(ctx, input())
    const bands = calls.filter((call) => call.name === 'fillRect')
    expect(bands.every((band) => band.args[0] !== 210)).toBe(true)
  })
})
