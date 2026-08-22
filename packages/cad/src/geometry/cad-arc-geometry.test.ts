import { describe, expect, it } from 'vitest'
import {
  arcBounds,
  arcContainsAngle,
  arcMidpoint,
  arcQuadrants,
  arcThroughPoints,
  flattenCadArc,
  pointToArcDistanceSquared,
  type CadArcShape,
} from './cad-arc-geometry'
import { curveWithinBounds, segmentCurve, arcCurve } from './cad-curve'

/** 圆心在原点、半径 10、从 0° 顺时针扫 90° 的四分之一弧。 */
const quarter: CadArcShape = { center: { x: 0, y: 0 }, radius: 10, startAngle: 0, sweep: 90 }
const circle: CadArcShape = { center: { x: 0, y: 0 }, radius: 10, startAngle: 0, sweep: 360 }

describe('OpenSpec: cad-document / CAD 圆弧的命中与框选 / 点到弧的距离', () => {
  it('扫掠内取到圆的径向距离', () => {
    // 45° 方向、距圆心 12 的点：到弧的距离是 2。
    const point = { x: 12 * Math.cos(Math.PI / 4), y: 12 * Math.sin(Math.PI / 4) }
    expect(pointToArcDistanceSquared(quarter, point)).toBeCloseTo(4)
  })

  it('圆心不算命中', () => {
    // 包围盒判定会把圆心算成命中；距离判定给出的是半径。
    expect(pointToArcDistanceSquared(quarter, { x: 0, y: 0 })).toBeCloseTo(100)
  })

  it('扫掠外按到端点的较小距离', () => {
    // 180° 方向上的点不在 0–90° 的弧上，最近的是端点 (0,10)。
    const distance = pointToArcDistanceSquared(quarter, { x: -10, y: 0 })
    expect(distance).toBeCloseTo(200)
  })

  it('整圆的角度判断永远为真', () => {
    expect(arcContainsAngle(circle, 123)).toBe(true)
    // 归一化会把 360 变成 0，不先短路就会把整圆判成零长弧。
    expect(arcContainsAngle(circle, 0)).toBe(true)
    expect(pointToArcDistanceSquared(circle, { x: -12, y: 0 })).toBeCloseTo(4)
  })

  it('负扫掠与正扫掠共用一条角度判断', () => {
    const reversed: CadArcShape = { ...quarter, startAngle: 90, sweep: -90 }
    expect(arcContainsAngle(reversed, 45)).toBe(true)
    expect(arcContainsAngle(reversed, 180)).toBe(false)
  })
})

describe('OpenSpec: cad-document / CAD 圆弧的命中与框选 / 紧包围盒', () => {
  /** `cos(90°)` 是 6.1e-17 而不是 0，逐字段近似比较。 */
  const expectBounds = (
    actual: ReturnType<typeof arcBounds>,
    expected: ReturnType<typeof arcBounds>,
  ) => {
    expect(actual.minX).toBeCloseTo(expected.minX)
    expect(actual.minY).toBeCloseTo(expected.minY)
    expect(actual.maxX).toBeCloseTo(expected.maxX)
    expect(actual.maxY).toBeCloseTo(expected.maxY)
  }

  it('四分之一弧的盒子只有该象限', () => {
    expectBounds(arcBounds(quarter), { minX: 0, minY: 0, maxX: 10, maxY: 10 })
  })

  it('整圆的盒子是整圈', () => {
    expectBounds(arcBounds(circle), { minX: -10, minY: -10, maxX: 10, maxY: 10 })
  })

  it('窗口框选用紧盒因此框得住四分之一弧', () => {
    // 这个框套不住整圆的包围盒，但套得住这段弧。
    const bounds = { minX: -1, minY: -1, maxX: 11, maxY: 11 }
    expect(curveWithinBounds(arcCurve(quarter), bounds)).toBe(true)
    expect(curveWithinBounds(arcCurve(circle), bounds)).toBe(false)
  })

  it('线段的盒子照旧', () => {
    const bounds = { minX: 0, minY: 0, maxX: 10, maxY: 10 }
    expect(curveWithinBounds(segmentCurve({ start: { x: 1, y: 1 }, end: { x: 9, y: 9 } }), bounds))
      .toBe(true)
  })
})

describe('OpenSpec: cad-document / CAD 圆心与象限点捕捉 / 象限点', () => {
  it('只给落在扫掠内的方位', () => {
    const quadrants = arcQuadrants(quarter)
    expect(quadrants).toHaveLength(2)
    expect(quadrants[0]!.x).toBeCloseTo(10)
    expect(quadrants[1]!.y).toBeCloseTo(10)
  })

  it('整圆给四个', () => {
    expect(arcQuadrants(circle)).toHaveLength(4)
  })

  it('弧的中点是半扫掠处', () => {
    const mid = arcMidpoint(quarter)
    expect(mid.x).toBeCloseTo(10 * Math.cos(Math.PI / 4))
    expect(mid.y).toBeCloseTo(10 * Math.sin(Math.PI / 4))
  })
})

describe('拍扁', () => {
  it('段数按弦高误差而不是固定值', () => {
    const small = flattenCadArc({ ...circle, radius: 5 })
    const large = flattenCadArc({ ...circle, radius: 500 })
    // 半径越大，同样的弦高要求需要越多段——固定段数会让大圆的误差发散。
    expect(large.length).toBeGreaterThan(small.length)
    for (const segment of large) {
      const midX = (segment.start.x + segment.end.x) / 2
      const midY = (segment.start.y + segment.end.y) / 2
      expect(500 - Math.hypot(midX, midY)).toBeLessThanOrEqual(0.25 + 1e-9)
    }
  })

  it('首尾相接且覆盖整段扫掠', () => {
    const segments = flattenCadArc(quarter)
    expect(segments[0]!.start).toEqual({ x: 10, y: 0 })
    const last = segments[segments.length - 1]!.end
    expect(last.x).toBeCloseTo(0)
    expect(last.y).toBeCloseTo(10)
  })
})

describe('OpenSpec: cad-document / CAD CIRCLE 与 ARC 命令 / 三点定弧', () => {
  it('弧经过三个点', () => {
    // 屏幕坐标 Y 向下，因此 (10,-10) 在两端点上方。
    const arc = arcThroughPoints({ x: 0, y: 0 }, { x: 10, y: -10 }, { x: 20, y: 0 })!
    expect(arc.center).toEqual({ x: 10, y: 0 })
    expect(arc.radius).toBeCloseTo(10)
    expect(arcMidpoint(arc).x).toBeCloseTo(10)
    expect(arcMidpoint(arc).y).toBeCloseTo(-10)
  })

  it('中间点换一侧，弧就往另一侧鼓', () => {
    const arc = arcThroughPoints({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 })!
    expect(arc.sweep).toBeCloseTo(-180)
    expect(arcMidpoint(arc).y).toBeCloseTo(10)
  })

  it('三点共线时无解', () => {
    expect(arcThroughPoints({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 })).toBeNull()
    // 重合点同样退化。
    expect(arcThroughPoints({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 20, y: 0 })).toBeNull()
  })
})
