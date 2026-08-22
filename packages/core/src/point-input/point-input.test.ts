import { describe, expect, it } from 'vitest'
import { parseComposeCoordinate } from './coordinate'
import { resolveComposePoint, type ComposePointContext } from './point-resolution'

function context(overrides: Partial<ComposePointContext> = {}): ComposePointContext {
  return { ortho: false, grid: { enabled: false, stepX: 10, stepY: 10 }, ...overrides }
}

describe('共享坐标语法', () => {
  it('三种写法', () => {
    expect(parseComposeCoordinate('100,50')).toEqual({ ok: true, point: { x: 100, y: 50 } })
    expect(parseComposeCoordinate('@10,20', { x: 1, y: 2 }))
      .toEqual({ ok: true, point: { x: 11, y: 22 } })
    const polar = parseComposeCoordinate('100<90', { x: 0, y: 0 })
    expect(polar.ok).toBe(true)
    // 屏幕 Y 轴向下，因此 90° 必须指向上方；少了那个负号所有极坐标都会上下翻转。
    if (polar.ok) expect(polar.point.y).toBeCloseTo(-100, 6)
  })

  it('缺少上一点时拒绝相对与极坐标', () => {
    expect(parseComposeCoordinate('@10,20')).toEqual({ ok: false, reason: 'missing-reference' })
    expect(parseComposeCoordinate('100<45')).toEqual({ ok: false, reason: 'missing-reference' })
  })

  it('非坐标文本给出可判别的失败原因', () => {
    expect(parseComposeCoordinate('CLOSE')).toEqual({ ok: false, reason: 'not-a-coordinate' })
  })
})

describe('共享点输入管线', () => {
  it('键入的坐标不被捕捉、正交或网格改写', () => {
    const resolved = resolveComposePoint({ x: 100, y: 50 }, 'typed', context({
      snapped: { x: 0, y: 0 },
      reference: { x: 0, y: 0 },
      ortho: true,
      grid: { enabled: true, stepX: 10, stepY: 10 },
    }))
    expect(resolved).toEqual({ x: 100, y: 50 })
  })

  it('捕捉命中后不再经过正交与网格', () => {
    const resolved = resolveComposePoint({ x: 96, y: 48 }, 'pointer', context({
      snapped: { x: 103, y: 47 },
      reference: { x: 0, y: 0 },
      ortho: true,
      grid: { enabled: true, stepX: 10, stepY: 10 },
    }))
    expect(resolved).toEqual({ x: 103, y: 47 })
  })

  it('指针取点依次经过正交与网格', () => {
    const resolved = resolveComposePoint({ x: 96, y: 12 }, 'pointer', context({
      reference: { x: 0, y: 0 },
      ortho: true,
      grid: { enabled: true, stepX: 10, stepY: 10 },
    }))
    // 正交先把位移较小的 y 钳回参照点，网格再取整。
    expect(resolved).toEqual({ x: 100, y: 0 })
  })

  it('正交与网格都关闭时结果就是原始点', () => {
    expect(resolveComposePoint({ x: 96, y: 12 }, 'pointer', context())).toEqual({ x: 96, y: 12 })
  })
})
