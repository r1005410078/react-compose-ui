import { describe, expect, it } from 'vitest'
import {
  composeCubicBoundsPoints,
  composeCubicPointAt,
  flattenComposeCubic,
  pointToComposeCubicDistance,
  type ComposeCubicShape,
} from './curve-geometry'

/*
 * 判别性全部来自「控制点凸包 ≠ 紧包围盒」这一句：拿一段控制点远在曲线之外的 S 形去问，
 * 只断言「算出来了」的用例在凸包实现上同样会绿。
 */
describe('OpenSpec: compose-document / 曲线是带盒的普通 Entity / 贝塞尔紧包围盒', () => {
  /** 两个控制点都被拉到 y = 100，而曲线本身最远只到 y = 75。 */
  const bulge: ComposeCubicShape = {
    start: { x: 0, y: 0 },
    c1: { x: 0, y: 100 },
    c2: { x: 100, y: 100 },
    end: { x: 100, y: 0 },
  }

  it('极值点在曲线上，不在控制点凸包的边界上', () => {
    const points = composeCubicBoundsPoints(bulge)
    const maxY = Math.max(...points.map((point) => point.y))
    // 对称三次贝塞尔在 t = 0.5 处取到极值：0.75 × 100。
    expect(maxY).toBeCloseTo(75, 9)
    expect(maxY).toBeLessThan(100)
  })

  it('每个极值点都真的落在曲线上', () => {
    const points = composeCubicBoundsPoints(bulge)
    for (const point of points) {
      expect(pointToComposeCubicDistance(bulge, point)).toBeLessThan(0.5)
    }
  })

  it('两端点恒在候选里——它们不必解方程也一定是包围盒的候选', () => {
    const points = composeCubicBoundsPoints(bulge)
    expect(points).toContainEqual(bulge.start)
    expect(points).toContainEqual(bulge.end)
  })

  it('退化成直线的段没有内部极值', () => {
    const straight: ComposeCubicShape = {
      start: { x: 0, y: 0 },
      c1: { x: 10, y: 10 },
      c2: { x: 20, y: 20 },
      end: { x: 30, y: 30 },
    }
    expect(composeCubicBoundsPoints(straight)).toEqual([straight.start, straight.end])
  })

  it('某一轴上是常量时那一轴不产出极值', () => {
    const horizontal: ComposeCubicShape = {
      start: { x: 0, y: 5 },
      c1: { x: 10, y: 5 },
      c2: { x: 20, y: 5 },
      end: { x: 30, y: 5 },
    }
    expect(composeCubicBoundsPoints(horizontal)).toEqual([horizontal.start, horizontal.end])
  })
})

describe('OpenSpec: compose-document / 曲线是带盒的普通 Entity / 贝塞尔拍平', () => {
  const curve: ComposeCubicShape = {
    start: { x: 0, y: 0 },
    c1: { x: 0, y: 120 },
    c2: { x: 200, y: 120 },
    end: { x: 200, y: 0 },
  }

  it('拍平首尾与原段首尾相同', () => {
    const segments = flattenComposeCubic(curve)
    expect(segments[0]!.start).toEqual(curve.start)
    expect(segments[segments.length - 1]!.end).toEqual(curve.end)
  })

  it('每一段的中点离真曲线不超过容差', () => {
    for (const segment of flattenComposeCubic(curve)) {
      const midpoint = {
        x: (segment.start.x + segment.end.x) / 2,
        y: (segment.start.y + segment.end.y) / 2,
      }
      expect(pointToComposeCubicDistance(curve, midpoint)).toBeLessThanOrEqual(0.25)
    }
  })

  it('弯得越厉害段数越多——固定段数的实现在这条上会红', () => {
    const gentle: ComposeCubicShape = {
      start: { x: 0, y: 0 },
      c1: { x: 60, y: 1 },
      c2: { x: 140, y: 1 },
      end: { x: 200, y: 0 },
    }
    expect(flattenComposeCubic(curve).length).toBeGreaterThan(flattenComposeCubic(gentle).length)
  })

  it('已经是直线的段只出一段', () => {
    const straight: ComposeCubicShape = {
      start: { x: 0, y: 0 },
      c1: { x: 10, y: 0 },
      c2: { x: 20, y: 0 },
      end: { x: 30, y: 0 },
    }
    expect(flattenComposeCubic(straight)).toEqual([{ start: straight.start, end: straight.end }])
  })
})

describe('OpenSpec: compose-document / 曲线是带盒的普通 Entity / 点到贝塞尔的距离', () => {
  const curve: ComposeCubicShape = {
    start: { x: 0, y: 0 },
    c1: { x: 0, y: 100 },
    c2: { x: 100, y: 100 },
    end: { x: 100, y: 0 },
  }

  it('曲线上的点距离约等于零', () => {
    expect(pointToComposeCubicDistance(curve, composeCubicPointAt(curve, 0.5))).toBeLessThan(0.01)
  })

  it('包围盒里的空处不算命中——这正是曲线不按盒判定的理由', () => {
    // 盒的左上角 (0, 0) 是起点，因此取盒内那块空的中间偏上处。
    expect(pointToComposeCubicDistance(curve, { x: 50, y: 20 })).toBeGreaterThan(10)
  })
})
