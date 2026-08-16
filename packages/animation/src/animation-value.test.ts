import { describe, expect, it } from 'vitest'
import { isComposeAnimationValue, mixComposeAnimationValue } from './animation-value'

describe('动画值形状判定', () => {
  it('OpenSpec: scene-animation / 动画数据校验 / number 只接受有限数字', () => {
    expect(isComposeAnimationValue(12.5, 'number')).toBe(true)
    expect(isComposeAnimationValue(0, 'number')).toBe(true)
    expect(isComposeAnimationValue(Number.NaN, 'number')).toBe(false)
    expect(isComposeAnimationValue(Number.POSITIVE_INFINITY, 'number')).toBe(false)
    expect(isComposeAnimationValue('12', 'number')).toBe(false)
    expect(isComposeAnimationValue({ x: 1, y: 2 }, 'number')).toBe(false)
  })

  it('OpenSpec: scene-animation / 动画数据校验 / vector2 只接受恰好 x 与 y', () => {
    expect(isComposeAnimationValue({ x: 1, y: 2 }, 'vector2')).toBe(true)
    expect(isComposeAnimationValue({ x: 1 }, 'vector2')).toBe(false)
    // 多余字段会在采样时被静默丢弃，所以在校验期就拒绝，避免文档里躺着读不出来的数据。
    expect(isComposeAnimationValue({ x: 1, y: 2, z: 3 }, 'vector2')).toBe(false)
    expect(isComposeAnimationValue({ x: 1, y: Number.NaN }, 'vector2')).toBe(false)
    expect(isComposeAnimationValue([1, 2], 'vector2')).toBe(false)
  })

  it('OpenSpec: scene-animation / 动画数据校验 / color 只接受已规范化的文档颜色', () => {
    expect(isComposeAnimationValue('#ff0000', 'color')).toBe(true)
    expect(isComposeAnimationValue('#ff0000cc', 'color')).toBe(true)
    expect(isComposeAnimationValue('transparent', 'color')).toBe(true)
    // core 的 `expandHex` 强制小写，所以大写与简写都不是规范形态。
    expect(isComposeAnimationValue('#FF0000', 'color')).toBe(false)
    expect(isComposeAnimationValue('#f00', 'color')).toBe(false)
    expect(isComposeAnimationValue('red', 'color')).toBe(false)
    expect(isComposeAnimationValue(0, 'color')).toBe(false)
  })
})

describe('动画值插值', () => {
  it('OpenSpec: scene-animation / 动画采样器 / 数值线性插值', () => {
    expect(mixComposeAnimationValue('number', 0, 10, 0)).toBe(0)
    expect(mixComposeAnimationValue('number', 0, 10, 0.5)).toBe(5)
    expect(mixComposeAnimationValue('number', 0, 10, 1)).toBe(10)
    expect(mixComposeAnimationValue('number', -4, 4, 0.25)).toBe(-2)
  })

  it('OpenSpec: scene-animation / 动画采样器 / vector2 按分量插值', () => {
    expect(mixComposeAnimationValue('vector2', { x: 0, y: 10 }, { x: 100, y: 30 }, 0.5))
      .toEqual({ x: 50, y: 20 })
  })

  // 输出统一用小写十六进制：`toString(16)` 的自然形态，也与文档里既有的 `#3b82f6` 一致。
  it('OpenSpec: scene-animation / 动画采样器 / 颜色按分量插值', () => {
    expect(mixComposeAnimationValue('color', '#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mixComposeAnimationValue('color', '#000000ff', '#ffffff00', 0)).toBe('#000000')
    expect(mixComposeAnimationValue('color', '#000000ff', '#ffffff00', 1)).toBe('transparent')
  })

  it('OpenSpec: scene-animation / 动画采样器 / 颜色 alpha 参与插值', () => {
    // #ffffff00 会被 core 规范化成 transparent，所以这里用非零 alpha 表达半透明终点。
    expect(mixComposeAnimationValue('color', '#00000000', '#000000ff', 0.5)).toBe('#00000080')
  })

  it('OpenSpec: scene-animation / 动画采样器 / transparent 端点不穿过黑色', () => {
    // 红色淡出时应当一路保持红色只降 alpha，而不是先变黑再消失。
    const middle = mixComposeAnimationValue('color', '#ff0000', 'transparent', 0.5)
    expect(middle).toBe('#ff000080')
    const back = mixComposeAnimationValue('color', 'transparent', '#00ff00', 0.5)
    expect(back).toBe('#00ff0080')
  })

  it('OpenSpec: scene-animation / 动画采样器 / 两端都是 transparent 时保持透明', () => {
    expect(mixComposeAnimationValue('color', 'transparent', 'transparent', 0.5)).toBe('transparent')
  })
})
