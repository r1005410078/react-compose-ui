import { describe, expect, it } from 'vitest'
import {
  intersectComposeArcs,
  intersectComposeSegmentArc,
  intersectComposeSegments,
} from './curve-geometry'

const segment = (x1: number, y1: number, x2: number, y2: number) => (
  { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } }
)

describe('OpenSpec: compose-document / 曲线相交与切片住在 core', () => {
  describe('线段 × 线段', () => {
    it('相交给出交点与两条上的 t', () => {
      const hits = intersectComposeSegments(segment(0, 100, 200, 100), segment(50, 0, 50, 200))
      expect(hits).toHaveLength(1)
      expect(hits[0]!.point).toEqual({ x: 50, y: 100 })
      expect(hits[0]!.a).toBeCloseTo(0.25)
      expect(hits[0]!.b).toBeCloseTo(0.5)
    })

    it('平行与共线返回空', () => {
      expect(intersectComposeSegments(segment(0, 0, 100, 0), segment(0, 10, 100, 10))).toEqual([])
      expect(intersectComposeSegments(segment(0, 0, 100, 0), segment(50, 0, 150, 0))).toEqual([])
    })

    it('端点落在另一条线身上算相交（T 形相接）', () => {
      const hits = intersectComposeSegments(segment(0, 0, 100, 0), segment(40, 0, 40, 80))
      expect(hits).toHaveLength(1)
      expect(hits[0]!.b).toBe(0)
      expect(hits[0]!.a).toBeCloseTo(0.4)
    })

    it('延长线上的交点不算', () => {
      expect(intersectComposeSegments(segment(0, 0, 100, 0), segment(150, -10, 150, 10))).toEqual([])
    })
  })

  describe('线段 × 弧', () => {
    const circle = { center: { x: 100, y: 100 }, radius: 50, startAngle: 0, sweep: 360 }

    it('穿过整圆得到两个交点，带 t 与走过的角量', () => {
      const hits = intersectComposeSegmentArc(segment(0, 100, 200, 100), circle)
      expect(hits).toHaveLength(2)
      const sorted = [...hits].sort((left, right) => left.a - right.a)
      expect(sorted[0]!.point.x).toBeCloseTo(50)
      expect(sorted[0]!.a).toBeCloseTo(0.25)
      expect(sorted[0]!.b).toBeCloseTo(180)
      expect(sorted[1]!.point.x).toBeCloseTo(150)
      expect(sorted[1]!.b).toBeCloseTo(0)
    })

    it('相切只有一个交点', () => {
      const hits = intersectComposeSegmentArc(segment(0, 50, 200, 50), circle)
      expect(hits).toHaveLength(1)
      expect(hits[0]!.point.x).toBeCloseTo(100)
    })

    it('相离返回空', () => {
      expect(intersectComposeSegmentArc(segment(0, 0, 200, 0), circle)).toEqual([])
    })

    it('落在扫掠之外的根不算', () => {
      // 上半圆（屏幕坐标里 180° → 360° 是上半）；水平线在圆心下方只碰下半圆。
      const upper = { ...circle, startAngle: 180, sweep: 180 }
      expect(intersectComposeSegmentArc(segment(0, 130, 200, 130), upper)).toEqual([])
      const lowerHits = intersectComposeSegmentArc(segment(0, 130, 200, 130), { ...circle, sweep: 180 })
      expect(lowerHits).toHaveLength(2)
    })
  })

  describe('弧 × 弧', () => {
    it('相交两个点，各带自己的角量', () => {
      const first = { center: { x: 0, y: 0 }, radius: 50, startAngle: 0, sweep: 360 }
      const second = { center: { x: 60, y: 0 }, radius: 50, startAngle: 0, sweep: 360 }
      const hits = intersectComposeArcs(first, second)
      expect(hits).toHaveLength(2)
      hits.forEach((hit) => {
        expect(hit.point.x).toBeCloseTo(30)
        expect(Math.hypot(hit.point.x, hit.point.y)).toBeCloseTo(50)
        expect(Math.hypot(hit.point.x - 60, hit.point.y)).toBeCloseTo(50)
      })
    })

    it('内切一个点', () => {
      const first = { center: { x: 0, y: 0 }, radius: 50, startAngle: 0, sweep: 360 }
      const second = { center: { x: 20, y: 0 }, radius: 30, startAngle: 0, sweep: 360 }
      const hits = intersectComposeArcs(first, second)
      expect(hits).toHaveLength(1)
      expect(hits[0]!.point).toEqual({ x: 50, y: 0 })
    })

    it('同心与相离返回空', () => {
      const first = { center: { x: 0, y: 0 }, radius: 50, startAngle: 0, sweep: 360 }
      expect(intersectComposeArcs(first, { ...first, radius: 20 })).toEqual([])
      expect(intersectComposeArcs(first, { ...first, center: { x: 200, y: 0 } })).toEqual([])
    })

    it('交点要落在两条弧的扫掠内', () => {
      const first = { center: { x: 0, y: 0 }, radius: 50, startAngle: 0, sweep: 360 }
      // 只有下半（屏幕坐标 0° → 180°）的弧，与第一个圆的两个交点里只有 y > 0 的那个在它身上。
      const lower = { center: { x: 60, y: 0 }, radius: 50, startAngle: 90, sweep: 90 }
      const hits = intersectComposeArcs(first, lower)
      expect(hits).toHaveLength(1)
      expect(hits[0]!.point.y).toBeGreaterThan(0)
    })
  })
})
