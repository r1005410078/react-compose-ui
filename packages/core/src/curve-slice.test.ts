import { describe, expect, it } from 'vitest'
import {
  composeCurveParameterSpan,
  composeCurvePointAtParameter,
  nearestComposeCurveParameter,
  sliceComposeCurve,
  type ComposeCurve,
} from './curve'

const rect: ComposeCurve = {
  kind: 'polyline',
  closed: true,
  vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }],
}
const zigzag: ComposeCurve = {
  kind: 'polyline',
  closed: false,
  vertices: [{ x: 0, y: 100 }, { x: 50, y: 100 }, { x: 50, y: 0 }, { x: 150, y: 0 }, { x: 150, y: 100 }],
}
const line: ComposeCurve = { kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }
const circle: ComposeCurve = { kind: 'arc', center: { x: 50, y: 50 }, radius: 50, startAngle: 0, sweep: 360 }

describe('OpenSpec: compose-document / 曲线相交与切片住在 core', () => {
  describe('参数', () => {
    it('折线的参数是段下标加段内比例', () => {
      expect(composeCurveParameterSpan(zigzag)).toBe(4)
      expect(composeCurveParameterSpan(rect)).toBe(4)
      expect(composeCurveParameterSpan(line)).toBe(1)
      expect(nearestComposeCurveParameter(zigzag, { x: 100, y: 5 })).toBeCloseTo(2.5)
      expect(composeCurvePointAtParameter(zigzag, 2.5)).toEqual({ x: 100, y: 0 })
    })

    it('闭合折线的收尾段也有参数', () => {
      expect(nearestComposeCurveParameter(rect, { x: -3, y: 30 })).toBeCloseTo(3.5)
      expect(composeCurvePointAtParameter(rect, 3.5)).toEqual({ x: 0, y: 30 })
    })

    it('弧的参数是走过的角量', () => {
      expect(composeCurveParameterSpan(circle)).toBe(360)
      expect(nearestComposeCurveParameter(circle, { x: 50, y: 120 })).toBeCloseTo(90)
      const point = composeCurvePointAtParameter(circle, 90)!
      expect(point.x).toBeCloseTo(50)
      expect(point.y).toBeCloseTo(100)
    })

    it('扫掠外的点取离得近的端头', () => {
      const lower: ComposeCurve = { ...circle, startAngle: 0, sweep: 180 }
      expect(nearestComposeCurveParameter(lower, { x: 60, y: -40 })).toBe(0)
      expect(nearestComposeCurveParameter(lower, { x: 40, y: -40 })).toBe(180)
    })

    it('path 没有参数轴', () => {
      const path: ComposeCurve = {
        kind: 'path',
        subpaths: [{ start: { x: 0, y: 0 }, closed: false, segments: [{ c1: { x: 1, y: 1 }, c2: { x: 2, y: 2 }, to: { x: 3, y: 3 } }] }],
      }
      expect(composeCurveParameterSpan(path)).toBeNull()
      expect(sliceComposeCurve(path, 0, 1)).toBeNull()
    })
  })

  describe('切片', () => {
    it('矩形去掉一条边变成三段开放折线，顶点从缺口处开始', () => {
      const slice = sliceComposeCurve(rect, 1, 2)!
      expect(slice.remaining).toHaveLength(1)
      expect(slice.remaining[0]).toEqual({
        kind: 'polyline',
        closed: false,
        vertices: [{ x: 100, y: 60 }, { x: 0, y: 60 }, { x: 0, y: 0 }, { x: 100, y: 0 }],
      })
      expect(slice.removed).toEqual({ kind: 'line', start: { x: 100, y: 0 }, end: { x: 100, y: 60 } })
    })

    it('矩形去掉越过收尾点的一截', () => {
      const slice = sliceComposeCurve(rect, 3.5, 0.5)!
      expect(slice.removed).toEqual({
        kind: 'polyline',
        closed: false,
        vertices: [{ x: 0, y: 30 }, { x: 0, y: 0 }, { x: 50, y: 0 }],
      })
      expect(slice.remaining[0]).toEqual({
        kind: 'polyline',
        closed: false,
        vertices: [{ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }, { x: 0, y: 30 }],
      })
    })

    it('圆角保留在剩下的折线上', () => {
      const rounded: ComposeCurve = { ...rect, cornerRadius: 8 } as ComposeCurve
      const slice = sliceComposeCurve(rounded, 1, 2)!
      expect((slice.remaining[0] as { cornerRadius?: number }).cornerRadius).toBe(8)
    })

    it('折线中段的一截去掉成两条，交点成为各自的新端点', () => {
      const slice = sliceComposeCurve(zigzag, 2.25, 2.75)!
      expect(slice.remaining).toEqual([
        { kind: 'polyline', closed: false, vertices: [{ x: 0, y: 100 }, { x: 50, y: 100 }, { x: 50, y: 0 }, { x: 75, y: 0 }] },
        { kind: 'polyline', closed: false, vertices: [{ x: 125, y: 0 }, { x: 150, y: 0 }, { x: 150, y: 100 }] },
      ])
    })

    it('整段去掉时两半各自少一个顶点、不重复', () => {
      const slice = sliceComposeCurve(zigzag, 2, 3)!
      expect(slice.remaining).toEqual([
        { kind: 'polyline', closed: false, vertices: [{ x: 0, y: 100 }, { x: 50, y: 100 }, { x: 50, y: 0 }] },
        { kind: 'line', start: { x: 150, y: 0 }, end: { x: 150, y: 100 } },
      ])
    })

    it('端段缩短、单段直线整条去掉', () => {
      expect(sliceComposeCurve(zigzag, 0, 1)!.remaining).toEqual([
        { kind: 'polyline', closed: false, vertices: [{ x: 50, y: 100 }, { x: 50, y: 0 }, { x: 150, y: 0 }, { x: 150, y: 100 }] },
      ])
      const whole = sliceComposeCurve(line, 0, 1)!
      expect(whole.remaining).toEqual([])
      expect(whole.removed).toEqual(line)
      expect(sliceComposeCurve(line, 0.25, 0.5)!.remaining).toEqual([
        { kind: 'line', start: { x: 0, y: 0 }, end: { x: 25, y: 0 } },
        { kind: 'line', start: { x: 50, y: 0 }, end: { x: 100, y: 0 } },
      ])
    })

    it('整圆切成弧', () => {
      const slice = sliceComposeCurve(circle, 180, 360)!
      expect(slice.remaining).toEqual([{ ...circle, startAngle: 0, sweep: 180 }])
      expect(slice.removed).toEqual({ ...circle, startAngle: 180, sweep: 180 })
    })

    it('整圆越过起始角的一截', () => {
      const slice = sliceComposeCurve(circle, 300, 60)!
      expect(slice.removed).toEqual({ ...circle, startAngle: 300, sweep: 120 })
      expect(slice.remaining).toEqual([{ ...circle, startAngle: 60, sweep: 240 }])
    })

    it('一段弧被剪中间成两段', () => {
      const arc: ComposeCurve = { ...circle, startAngle: 0, sweep: -180 }
      const slice = sliceComposeCurve(arc, 60, 120)!
      expect(slice.remaining).toEqual([
        { ...arc, startAngle: 0, sweep: -60 },
        { ...arc, startAngle: -120, sweep: -60 },
      ])
    })

    it('开放几何的非法区间返回 null', () => {
      expect(sliceComposeCurve(line, 0.5, 0.5)).toBeNull()
      expect(sliceComposeCurve(line, 0.7, 0.2)).toBeNull()
    })
  })
})
