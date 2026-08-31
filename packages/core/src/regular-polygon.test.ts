import { describe, expect, it } from 'vitest'
import { composeRegularPolygonVertices } from './curve-geometry'

/*
 * 内接与外切的差别只有一句话——落点是顶点，还是边的中点。这些用例都从那一句话反推：
 * 判别性来自「同一个中心、同一个落点，两档产出不同」，只断言「画出来了」两档都会绿。
 */
describe('OpenSpec: stage-engine / POLYGON 命令画正多边形 / 内接与外切', () => {
  const center = { x: 100, y: 100 }
  const through = { x: 160, y: 100 }

  it('内接的全部顶点等距，且落点本身就是一个顶点', () => {
    const vertices = composeRegularPolygonVertices(center, through, 6, 'inscribed')!
    expect(vertices).toHaveLength(6)
    for (const vertex of vertices) {
      expect(Math.hypot(vertex.x - center.x, vertex.y - center.y)).toBeCloseTo(60, 9)
    }
    expect(vertices[0]!.x).toBeCloseTo(through.x, 9)
    expect(vertices[0]!.y).toBeCloseTo(through.y, 9)
  })

  it('外切的某条边中点落在落点上，顶点则在圆外', () => {
    const vertices = composeRegularPolygonVertices(center, through, 6, 'circumscribed')!
    // 落点是首顶点与末顶点之间那条边的中点——首顶点从它转过了半步。
    const midpoint = {
      x: (vertices[0]!.x + vertices[vertices.length - 1]!.x) / 2,
      y: (vertices[0]!.y + vertices[vertices.length - 1]!.y) / 2,
    }
    expect(midpoint.x).toBeCloseTo(through.x, 9)
    expect(midpoint.y).toBeCloseTo(through.y, 9)
    for (const vertex of vertices) {
      expect(Math.hypot(vertex.x - center.x, vertex.y - center.y)).toBeGreaterThan(60)
    }
  })

  it('同一落点下外切的外接圆半径是内接的 1 / cos(π/n) 倍', () => {
    for (const sides of [3, 5, 6, 12]) {
      const inscribed = composeRegularPolygonVertices(center, through, sides, 'inscribed')!
      const circumscribed = composeRegularPolygonVertices(center, through, sides, 'circumscribed')!
      const radiusOf = (vertex: { x: number, y: number }) => (
        Math.hypot(vertex.x - center.x, vertex.y - center.y)
      )
      expect(radiusOf(circumscribed[0]!) / radiusOf(inscribed[0]!))
        .toBeCloseTo(1 / Math.cos(Math.PI / sides), 9)
    }
  })

  it('绕向是屏幕顺时针，与 RECTANGLE 产出的四顶点一致', () => {
    const vertices = composeRegularPolygonVertices(center, through, 4, 'inscribed')!
    // Y 轴向下：右 → 下 → 左 → 上。
    expect(vertices[1]!.y).toBeGreaterThan(vertices[0]!.y)
    expect(vertices[2]!.x).toBeLessThan(vertices[1]!.x)
  })

  it('相位跟着落点走', () => {
    const rotated = composeRegularPolygonVertices(center, { x: 100, y: 40 }, 6, 'inscribed')!
    expect(rotated[0]!.x).toBeCloseTo(100, 9)
    expect(rotated[0]!.y).toBeCloseTo(40, 9)
  })

  it('三边与一千零二十四边都算得出', () => {
    expect(composeRegularPolygonVertices(center, through, 3, 'inscribed')).toHaveLength(3)
    expect(composeRegularPolygonVertices(center, through, 1024, 'inscribed')).toHaveLength(1024)
  })

  it('落点与中心重合或边数无效时无解', () => {
    expect(composeRegularPolygonVertices(center, center, 6, 'inscribed')).toBeNull()
    expect(composeRegularPolygonVertices(center, through, 2, 'inscribed')).toBeNull()
    expect(composeRegularPolygonVertices(center, through, 5.5, 'inscribed')).toBeNull()
  })
})
