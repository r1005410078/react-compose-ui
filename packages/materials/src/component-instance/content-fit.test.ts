import { describe, expect, it } from 'vitest'
import { componentInstanceContentScale, readComponentInstanceContentFit } from './content-fit'

describe('OpenSpec: basic-materials / 组件实例的内容缩放 / contentFit 读取', () => {
  it('缺席即 layout，只有 scale 这个字面量才进缩放支', () => {
    expect(readComponentInstanceContentFit({})).toBe('layout')
    expect(readComponentInstanceContentFit({ contentFit: null })).toBe('layout')
    expect(readComponentInstanceContentFit({ contentFit: 'layout' })).toBe('layout')
    expect(readComponentInstanceContentFit({ contentFit: 'scale' })).toBe('scale')
    // 形状损坏的值不得落进缩放支：那会让一份非法文档表现成一种合法行为。
    expect(readComponentInstanceContentFit({ contentFit: 'SCALE' })).toBe('layout')
    expect(readComponentInstanceContentFit({ contentFit: 1 })).toBe('layout')
  })
})

describe('OpenSpec: basic-materials / 组件实例的内容缩放 / 两轴比值', () => {
  it('两轴各自取比值，非等比拖动不强行等比', () => {
    expect(componentInstanceContentScale(
      { width: 240, height: 80 },
      { width: 120, height: 80 },
    )).toEqual({ x: 2, y: 1 })
  })

  it('盒未量到或根尺寸非正时回退 1，画未缩放的内容而不是按错误比值画', () => {
    expect(componentInstanceContentScale(null, { width: 120, height: 80 })).toEqual({ x: 1, y: 1 })
    expect(componentInstanceContentScale({ width: 240, height: 160 }, null)).toEqual({ x: 1, y: 1 })
    expect(componentInstanceContentScale(
      { width: 240, height: 160 },
      { width: 0, height: 80 },
    )).toEqual({ x: 1, y: 2 })
  })
})
