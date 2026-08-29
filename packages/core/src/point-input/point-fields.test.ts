import { describe, expect, it } from 'vitest'
import {
  applyComposeFieldOverride,
  composeFieldsToPoint,
  composePointToFields,
  isComposeSingleFieldKind,
} from './point-fields'

const origin = { x: 100, y: 100 }

describe('OpenSpec: compose-document / 取点数值字段的正反算', () => {
  it('绝对坐标就是 X 与 Y，不需要原点', () => {
    expect(composePointToFields('absolute', { x: 240, y: -30 })).toEqual({ first: 240, second: -30 })
    expect(composeFieldsToPoint('absolute', { first: 240, second: -30 })).toEqual({ x: 240, y: -30 })
  })

  it('极坐标正反算互逆', () => {
    const point = { x: 320, y: 40 }
    const fields = composePointToFields('polar', point, origin)
    const back = composeFieldsToPoint('polar', fields, origin)
    expect(back.x).toBeCloseTo(point.x, 9)
    expect(back.y).toBeCloseTo(point.y, 9)
  })

  it('角度按逆时针为正，屏幕 Y 轴向下', () => {
    // 正上方是 90°：少了那个负号所有极坐标都会上下翻转，而水平线上完全看不出来。
    expect(composePointToFields('polar', { x: 100, y: 0 }, origin).second).toBeCloseTo(90)
    expect(composePointToFields('polar', { x: 200, y: 100 }, origin).second).toBeCloseTo(0)
  })

  it('覆盖距离时角度不动', () => {
    const point = composeFieldsToPoint('polar', { first: 100, second: 30 }, origin)
    const next = applyComposeFieldOverride('polar', point, origin, 0, 260)
    const fields = composePointToFields('polar', next, origin)
    expect(fields.first).toBeCloseTo(260)
    expect(fields.second).toBeCloseTo(30)
  })

  it('覆盖角度时距离不动', () => {
    const point = composeFieldsToPoint('polar', { first: 100, second: 30 }, origin)
    const next = applyComposeFieldOverride('polar', point, origin, 1, 90)
    const fields = composePointToFields('polar', next, origin)
    expect(fields.first).toBeCloseTo(100)
    expect(fields.second).toBeCloseTo(90)
  })

  it('宽高读作量值', () => {
    // 左上方：两个分量都是负的，读出来仍是 200 与 150。
    expect(composePointToFields('cartesian', { x: -100, y: -50 }, origin))
      .toEqual({ first: 200, second: 150 })
  })

  it('覆盖宽高时沿用当前那一轴的符号', () => {
    const point = { x: -100, y: -50 }
    // 键入的是量值，落点需要符号：少了这一步，往左上拖时键入宽度会把矩形翻到右下去。
    const next = applyComposeFieldOverride('cartesian', point, origin, 0, 300)
    expect(next).toEqual({ x: -200, y: -50 })
  })

  it('分量为 0 时取正', () => {
    const next = applyComposeFieldOverride('cartesian', { x: 100, y: 40 }, origin, 0, 300)
    expect(next.x).toBe(400)
  })

  it('半径与极坐标的数学逐字相同', () => {
    const point = composeFieldsToPoint('polar', { first: 150, second: 30 }, origin)
    expect(composePointToFields('radius', point, origin))
      .toEqual(composePointToFields('polar', point, origin))
  })

  it('直径读作半径的两倍', () => {
    const point = composeFieldsToPoint('polar', { first: 150, second: 30 }, origin)
    expect(composePointToFields('radius', point, origin).first).toBeCloseTo(150)
    expect(composePointToFields('diameter', point, origin).first).toBeCloseTo(300)
  })

  it('直径正反算互逆', () => {
    const point = composeFieldsToPoint('diameter', { first: 300, second: 30 }, origin)
    // 落在 30° 方向、距圆心 150：直径 300 的圆上的那个点。
    expect(composePointToFields('polar', point, origin).first).toBeCloseTo(150)
    expect(composePointToFields('diameter', point, origin).first).toBeCloseTo(300)
  })

  it('覆盖直径时方向不变', () => {
    const point = composeFieldsToPoint('polar', { first: 100, second: 30 }, origin)
    const next = applyComposeFieldOverride('diameter', point, origin, 0, 300)
    const fields = composePointToFields('polar', next, origin)
    expect(fields.first).toBeCloseTo(150)
    expect(fields.second).toBeCloseTo(30)
  })

  it('单字段的判断只有一处实现', () => {
    // 呈现出几个框、`Tab` 接不接管、有没有锁定这一档，三处读同一个判断。
    expect((['radius', 'diameter'] as const).map(isComposeSingleFieldKind)).toEqual([true, true])
    expect((['absolute', 'polar', 'cartesian'] as const).map(isComposeSingleFieldKind))
      .toEqual([false, false, false])
  })
})
