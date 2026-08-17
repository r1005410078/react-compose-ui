import { describe, expect, it } from 'vitest'
import {
  COMPOSE_EASING_PRESETS,
  clampComposeEasingControl,
  composeEasingPresetInterpolation,
  formatComposeEasingControl,
  matchComposeEasingPreset,
  parseComposeEasingControl,
} from './easing-presets'

describe('缓动预设', () => {
  it('OpenSpec: animation-panel / 缓动预设与曲线编辑器 / 每个预设都能被自己识别回来', () => {
    for (const preset of COMPOSE_EASING_PRESETS) {
      expect(matchComposeEasingPreset(preset.interpolation)).toBe(preset.id)
    }
  })

  it('OpenSpec: animation-panel / 缓动预设与曲线编辑器 / 预设只用既有插值判别联合表达', () => {
    for (const preset of COMPOSE_EASING_PRESETS) {
      expect(['hold', 'linear', 'cubic']).toContain(preset.interpolation.kind)
    }
  })

  it('OpenSpec: animation-panel / 缓动预设与曲线编辑器 / 拖拽噪声内仍识别为同一预设', () => {
    expect(matchComposeEasingPreset({
      kind: 'cubic',
      control: [0.42 + 5e-7, 0, 0.58, 1 - 5e-7],
    })).toBe('ease-in-out')
  })

  it('OpenSpec: animation-panel / 缓动预设与曲线编辑器 / 不匹配任何预设时落到自定义', () => {
    expect(matchComposeEasingPreset({ kind: 'cubic', control: [0.11, 0.22, 0.33, 0.44] }))
      .toBe('custom')
  })

  it('OpenSpec: animation-panel / 缓动预设与曲线编辑器 / 回弹预设允许 y 越界', () => {
    const easeOutBack = COMPOSE_EASING_PRESETS.find(({ id }) => id === 'ease-out-back')!
    const control = easeOutBack.interpolation.kind === 'cubic'
      ? easeOutBack.interpolation.control
      : null
    expect(control?.[1]).toBeGreaterThan(1)
    // 钳制只作用于 x：过冲是回弹曲线的表达手段，不能被压回单位区间。
    expect(clampComposeEasingControl(control!)).toEqual(control)
  })

  it('OpenSpec: animation-panel / 缓动预设与曲线编辑器 / x 分量钳制到单位区间', () => {
    expect(clampComposeEasingControl([-0.4, -0.2, 1.8, 1.4])).toEqual([0, -0.2, 1, 1.4])
  })

  it('OpenSpec: animation-panel / 缓动预设与曲线编辑器 / 选择自定义保留当前控制点', () => {
    const current = { kind: 'cubic', control: [0.11, 0.22, 0.33, 0.44] } as const
    expect(composeEasingPresetInterpolation('custom', current)).toBe(current)
    expect(composeEasingPresetInterpolation('custom', { kind: 'linear' }))
      .toEqual({ kind: 'cubic', control: [0.25, 0.1, 0.25, 1] })
  })

  it('OpenSpec: animation-panel / 缓动预设与曲线编辑器 / 控制点格式化为单行文本', () => {
    expect(formatComposeEasingControl([0.5, 0, 0.5, 1])).toBe('0.5, 0, 0.5, 1')
    // 拖拽产生的长尾小数收敛到三位，否则数值行读不成一行。
    expect(formatComposeEasingControl([0.123456, 0, 0.5, 1])).toBe('0.123, 0, 0.5, 1')
  })

  it('OpenSpec: animation-panel / 缓动预设与曲线编辑器 / 逗号与空白都当作分隔符', () => {
    expect(parseComposeEasingControl('0.42, 0, 0.58, 1')).toEqual([0.42, 0, 0.58, 1])
    expect(parseComposeEasingControl('.42 0 .58 1')).toEqual([0.42, 0, 0.58, 1])
  })

  it('OpenSpec: animation-panel / 缓动预设与曲线编辑器 / 非四个有限数一律拒绝', () => {
    expect(parseComposeEasingControl('0.5, 0, abc')).toBeNull()
    expect(parseComposeEasingControl('0.5, 0, 0.5')).toBeNull()
    expect(parseComposeEasingControl('0.5, 0, 0.5, 1, 2')).toBeNull()
    expect(parseComposeEasingControl('')).toBeNull()
  })
})
