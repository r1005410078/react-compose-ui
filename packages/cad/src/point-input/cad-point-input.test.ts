import { describe, expect, it } from 'vitest'
import { parseCadCoordinate } from './cad-coordinate'
import { resolveCadPoint, type CadPointContext } from './cad-point-resolution'

const origin = { x: 0, y: 0 }

function context(overrides: Partial<CadPointContext> = {}): CadPointContext {
  return { ortho: false, grid: { enabled: false, step: 10 }, ...overrides }
}

describe('CAD 坐标语法', () => {
  it('OpenSpec: cad-document / CAD 坐标语法 / 三种写法', () => {
    expect(parseCadCoordinate('100,50')).toEqual({ ok: true, point: { x: 100, y: 50 } })
    expect(parseCadCoordinate('@10,20', { x: 5, y: 5 }))
      .toEqual({ ok: true, point: { x: 15, y: 25 } })

    const polar = parseCadCoordinate('100<45', origin)
    expect(polar.ok).toBe(true)
    if (polar.ok) {
      expect(polar.point.x).toBeCloseTo(70.7107, 3)
      // 屏幕 Y 轴向下，逆时针 45° 因此 y 为负。
      expect(polar.point.y).toBeCloseTo(-70.7107, 3)
    }
  })

  it('OpenSpec: cad-document / CAD 坐标语法 / 100<90 指向屏幕上方', () => {
    const up = parseCadCoordinate('100<90', origin)
    expect(up.ok).toBe(true)
    if (up.ok) {
      expect(up.point.x).toBeCloseTo(0, 6)
      expect(up.point.y).toBeCloseTo(-100, 6)
    }
  })

  it('OpenSpec: cad-document / CAD 坐标语法 / 缺少上一点时拒绝相对写法', () => {
    expect(parseCadCoordinate('@10,20')).toEqual({ ok: false, reason: 'missing-reference' })
    expect(parseCadCoordinate('100<45')).toEqual({ ok: false, reason: 'missing-reference' })
  })

  it('OpenSpec: cad-document / CAD 坐标语法 / 非法写法被拒绝', () => {
    for (const text of ['U', 'F', '', '100', '100,', 'a,b', '100<', '@', '1,2,3']) {
      expect(parseCadCoordinate(text, origin)).toEqual({ ok: false, reason: 'not-a-coordinate' })
    }
  })

  it('接受负数与小数，并容忍空白', () => {
    expect(parseCadCoordinate(' -1.5 , 2.25 ')).toEqual({ ok: true, point: { x: -1.5, y: 2.25 } })
    expect(parseCadCoordinate('@ -3 , -4 ', { x: 10, y: 10 }))
      .toEqual({ ok: true, point: { x: 7, y: 6 } })
  })
})

describe('CAD 点求解管线', () => {
  it('OpenSpec: cad-document / CAD 点输入管线 / 键入坐标不被吸附改写', () => {
    const settings = context({
      reference: origin,
      ortho: true,
      grid: { enabled: true, step: 10 },
    })
    // 既不落在网格上、也不在轴向上，但因为是键入的，原样保留。
    expect(resolveCadPoint({ x: 103, y: 47 }, 'typed', settings)).toEqual({ x: 103, y: 47 })
  })

  it('OpenSpec: cad-document / CAD 点输入管线 / 指针取点依次经过正交与网格', () => {
    const settings = context({
      reference: origin,
      ortho: true,
      grid: { enabled: true, step: 10 },
    })
    // 水平位移更大 → 钳到与参照点等高 → 再按步长取整。
    expect(resolveCadPoint({ x: 103, y: 47 }, 'pointer', settings)).toEqual({ x: 100, y: 0 })

    const plain = context({ reference: origin })
    expect(resolveCadPoint({ x: 103, y: 47 }, 'pointer', plain)).toEqual({ x: 103, y: 47 })
  })

  it('OpenSpec: cad-document / 正交模式 / 钳到位移较大的轴', () => {
    const settings = context({ reference: { x: 10, y: 10 }, ortho: true })
    expect(resolveCadPoint({ x: 100, y: 30 }, 'pointer', settings)).toEqual({ x: 100, y: 10 })
    expect(resolveCadPoint({ x: 30, y: 100 }, 'pointer', settings)).toEqual({ x: 10, y: 100 })
    // 位移相等时保留水平。
    expect(resolveCadPoint({ x: 30, y: 30 }, 'pointer', settings)).toEqual({ x: 30, y: 10 })
  })

  it('OpenSpec: cad-document / 正交模式 / 没有上一点时不生效', () => {
    expect(resolveCadPoint({ x: 37, y: 91 }, 'pointer', context({ ortho: true })))
      .toEqual({ x: 37, y: 91 })
  })

  it('非正步长视为关闭网格', () => {
    for (const step of [0, -10, Number.NaN]) {
      expect(resolveCadPoint({ x: 103, y: 47 }, 'pointer', context({ grid: { enabled: true, step } })))
        .toEqual({ x: 103, y: 47 })
    }
  })
})
