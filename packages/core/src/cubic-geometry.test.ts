import { describe, expect, it } from 'vitest'
import {
  composeCubicBoundsPoints,
  composeCubicPointAt,
  flattenComposeCubic,
  nearestComposeCubicT,
  pointToComposeCubicDistance,
  splitComposeCubic,
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

/*
 * 判别性来自**形状逐像素不变**：只断言「分成了两段」的用例，在一个随手挑两个控制点的实现上
 * 同样会绿。因此这里在整条参数域上逐点比对分割前后的位置。
 */
describe('OpenSpec: stage-engine / 几何编辑会话内插入与删除顶点 / de Casteljau 分割', () => {
  const curved: ComposeCubicShape = {
    start: { x: 0, y: 0 },
    c1: { x: 20, y: 120 },
    c2: { x: 180, y: -60 },
    end: { x: 200, y: 40 },
  }

  it('两段拼起来与原段逐点相同', () => {
    const t = 0.37
    const [left, right] = splitComposeCubic(curved, t)
    // 接缝处：左段的终点、右段的起点与原段在 t 处的点是同一个点。
    const seam = composeCubicPointAt(curved, t)
    expect(left.end).toEqual(right.start)
    expect(left.end.x).toBeCloseTo(seam.x, 9)
    expect(left.end.y).toBeCloseTo(seam.y, 9)

    for (let step = 0; step <= 20; step += 1) {
      const u = step / 20
      const expected = composeCubicPointAt(curved, u * t)
      const actual = composeCubicPointAt(left, u)
      expect(actual.x).toBeCloseTo(expected.x, 9)
      expect(actual.y).toBeCloseTo(expected.y, 9)
    }
    for (let step = 0; step <= 20; step += 1) {
      const u = step / 20
      const expected = composeCubicPointAt(curved, t + u * (1 - t))
      const actual = composeCubicPointAt(right, u)
      expect(actual.x).toBeCloseTo(expected.x, 9)
      expect(actual.y).toBeCloseTo(expected.y, 9)
    }
  })

  it('端点处分割产出一段退化段与一段原段', () => {
    const [left, right] = splitComposeCubic(curved, 0)
    expect(left.start).toEqual(curved.start)
    expect(left.end).toEqual(curved.start)
    expect(composeCubicPointAt(right, 0.5)).toEqual(composeCubicPointAt(curved, 0.5))
  })
})

describe('OpenSpec: stage-engine / 几何编辑会话内插入与删除顶点 / 最近处的参数', () => {
  const curved: ComposeCubicShape = {
    start: { x: 0, y: 0 },
    c1: { x: 0, y: 100 },
    c2: { x: 100, y: 100 },
    end: { x: 100, y: 0 },
  }

  it('曲线上的点还原出它自己的参数', () => {
    for (const t of [0.1, 0.25, 0.5, 0.73, 0.9]) {
      const point = composeCubicPointAt(curved, t)
      // 容差是一条弦的尺度：最近点没有闭式解，落在最近那条弦上再按比例插值。
      expect(nearestComposeCubicT(curved, point)).toBeCloseTo(t, 3)
    }
  })

  it('离曲线很远的点取投影最近的那一处，而不是端点', () => {
    // 正上方一点：顶点在 t = 0.5（y = 75），它比两个端点近得多。
    expect(nearestComposeCubicT(curved, { x: 50, y: 400 })).toBeCloseTo(0.5, 2)
  })

  it('参数恒落在 [0, 1] 内，分割因此永不产出反向段', () => {
    // 起点外侧的延长线上：投影会跑到负数去，必须钳回 0。
    expect(nearestComposeCubicT(curved, { x: -500, y: -500 })).toBe(0)
    expect(nearestComposeCubicT(curved, { x: 600, y: -500 })).toBe(1)
  })
})
