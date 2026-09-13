import { describe, expect, it } from 'vitest'
import { resolveComposeCurveRegion } from './curve-region'
import { composeRoundedPolylineOutline } from './curve-geometry'
import type { ComposeOutlinePiece, ComposePlanarPoint } from './curve-geometry'

function segment(
  from: readonly [number, number],
  to: readonly [number, number],
): ComposeOutlinePiece {
  return { kind: 'segment', segment: { start: { x: from[0], y: from[1] }, end: { x: to[0], y: to[1] } } }
}

/** 四条独立线段围出的矩形——刻意不是一条闭合多段线，边界天生跨对象。 */
function rectangleEdges(x: number, y: number, width: number, height: number) {
  return [
    segment([x, y], [x + width, y]),
    segment([x + width, y], [x + width, y + height]),
    segment([x + width, y + height], [x, y + height]),
    segment([x, y + height], [x, y]),
  ]
}

function circle(cx: number, cy: number, radius: number): ComposeOutlinePiece {
  return { kind: 'arc', arc: { center: { x: cx, y: cy }, radius, startAngle: 0, sweep: 360 } }
}

/** 把产物拍成一列点，用来量它围住了什么。 */
function outlinePoints(result: ReturnType<typeof resolveComposeCurveRegion>): ComposePlanarPoint[] {
  if (result.status !== 'resolved') throw new Error(`expected resolved, got ${result.status}`)
  const { curve } = result
  if (curve.kind === 'polyline') return [...curve.vertices]
  if (curve.kind !== 'path') throw new Error(`unexpected kind ${curve.kind}`)
  const first = curve.subpaths[0]!
  return [first.start, ...first.segments.map((cubic) => cubic.to)]
}

function boundsOf(points: readonly ComposePlanarPoint[]) {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  }
}

describe('resolveComposeCurveRegion', () => {
  it('四条独立线段围出的矩形，产物是闭合多段线', () => {
    const result = resolveComposeCurveRegion(rectangleEdges(0, 0, 100, 60), { x: 50, y: 30 })
    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    expect(result.curve.kind).toBe('polyline')
    expect(result.islandCount).toBe(0)
    expect(boundsOf(outlinePoints(result))).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 60 })
  })

  it('多个对象拼出的面：矩形三条边加一段圆弧', () => {
    // 一个圆压在矩形右边上：点矩形内、圆外那块，边界由三条边与一段弧组成。
    const edges = [...rectangleEdges(0, 0, 100, 100), circle(100, 50, 30)]
    const result = resolveComposeCurveRegion(edges, { x: 20, y: 50 })
    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    // 含弧边，因此只能落成 path。
    expect(result.curve.kind).toBe('path')
    expect(result.islandCount).toBe(0)
    const points = outlinePoints(result)
    // 圆咬进去的那一块：最右边不再是 100，而是圆与矩形右边的交点一带。
    expect(Math.max(...points.map((point) => point.x))).toBeCloseTo(100, 6)
    // 弧上的点被咬进矩形里，因此产物含 x 明显小于 100 的边界点。
    expect(points.some((point) => point.x > 68 && point.x < 72)).toBe(true)
  })

  it('两个边界对象一个字节不动', () => {
    const edges = [...rectangleEdges(0, 0, 100, 100), circle(100, 50, 30)]
    const snapshot = JSON.parse(JSON.stringify(edges))
    resolveComposeCurveRegion(edges, { x: 20, y: 50 })
    expect(edges).toEqual(snapshot)
  })

  it('内部的岛被挖空，写 evenodd', () => {
    const edges = [...rectangleEdges(0, 0, 200, 200), circle(100, 100, 40)]
    const result = resolveComposeCurveRegion(edges, { x: 20, y: 20 })
    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    expect(result.islandCount).toBe(1)
    expect(result.curve.kind).toBe('path')
    if (result.curve.kind !== 'path') return
    expect(result.curve.subpaths).toHaveLength(2)
    expect(result.curve.fillRule).toBe('evenodd')
  })

  it('没有岛时不写 fillRule——缺席即 nonzero', () => {
    const edges = [...rectangleEdges(0, 0, 100, 100), circle(100, 50, 30)]
    const result = resolveComposeCurveRegion(edges, { x: 20, y: 50 })
    if (result.status !== 'resolved' || result.curve.kind !== 'path') throw new Error('expected path')
    expect('fillRule' in result.curve).toBe(false)
  })

  it('点在一个岛里时求出的是那个岛', () => {
    const edges = [...rectangleEdges(0, 0, 200, 200), circle(100, 100, 40)]
    const result = resolveComposeCurveRegion(edges, { x: 100, y: 100 })
    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    expect(result.islandCount).toBe(0)
    const bounds = boundsOf(outlinePoints(result))
    expect(bounds.minX).toBeCloseTo(60, 3)
    expect(bounds.maxX).toBeCloseTo(140, 3)
  })

  it('一条线穿过矩形时只填被点的那半边', () => {
    const edges = [...rectangleEdges(0, 0, 100, 100), segment([50, 0], [50, 100])]
    const result = resolveComposeCurveRegion(edges, { x: 20, y: 50 })
    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    expect(result.curve.kind).toBe('polyline')
    expect(boundsOf(outlinePoints(result))).toEqual({ minX: 0, minY: 0, maxX: 50, maxY: 100 })
  })

  it('不封闭时报出自由端', () => {
    // 左上角缺一小段：两条边的自由端隔着 0.5px。
    const edges = [
      segment([0, 0.5], [100, 0]),
      segment([100, 0], [100, 100]),
      segment([100, 100], [0, 100]),
      segment([0, 100], [0, 1]),
    ]
    const result = resolveComposeCurveRegion(edges, { x: 50, y: 50 })
    expect(result.status).toBe('open')
    if (result.status !== 'open') return
    expect(result.gaps).toHaveLength(2)
    const ys = result.gaps.map((gap) => gap.y).sort((a, b) => a - b)
    expect(ys[0]).toBeCloseTo(0.5, 6)
    expect(ys[1]).toBeCloseTo(1, 6)
  })

  it('伸进面里的线头被绕过去，不当成断口', () => {
    // 一根从底边伸进矩形的线头：它不分割任何东西，因此填充照常成立。
    const edges = [...rectangleEdges(0, 0, 100, 100), segment([50, 100], [50, 60])]
    const result = resolveComposeCurveRegion(edges, { x: 20, y: 50 })
    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    expect(boundsOf(outlinePoints(result))).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 100 })
    // 零宽的缝被裁掉了，因此顶点数仍是四个。
    expect(outlinePoints(result)).toHaveLength(4)
  })

  it('落点在图外面时说的是另一句话', () => {
    const result = resolveComposeCurveRegion(rectangleEdges(0, 0, 100, 100), { x: 200, y: 50 })
    expect(result.status).toBe('outside')
  })

  it('圆角矩形的边界沿圆角后的轮廓，不越过角弧', () => {
    const radius = 20
    const vertices = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]
    const edges = composeRoundedPolylineOutline(vertices, true, radius)
    const result = resolveComposeCurveRegion(edges, { x: 50, y: 50 })
    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    // 尖角顶点在 (0,0)；圆角之后那一块不属于这块面。
    expect(result.curve.kind).toBe('path')
    const points = outlinePoints(result)
    expect(points.some((point) => point.x < 1 && point.y < 1)).toBe(false)
    // 切点确实落在圆角的起止处。
    expect(points.some((point) => Math.abs(point.x - radius) < 1e-6 && Math.abs(point.y) < 1e-6))
      .toBe(true)
  })

  it('弧转三次贝塞尔的径向误差在上界之内', () => {
    const radius = 500
    const result = resolveComposeCurveRegion([circle(0, 0, radius)], { x: 0, y: 0 })
    if (result.status !== 'resolved' || result.curve.kind !== 'path') throw new Error('expected path')
    const subpath = result.curve.subpaths[0]!
    // 每 90° 一段：四段贝塞尔。
    expect(subpath.segments).toHaveLength(4)
    let worst = 0
    let previous = subpath.start
    subpath.segments.forEach((cubic) => {
      for (let i = 0; i <= 16; i += 1) {
        const t = i / 16
        const u = 1 - t
        const x = u * u * u * previous.x + 3 * u * u * t * cubic.c1.x
          + 3 * u * t * t * cubic.c2.x + t * t * t * cubic.to.x
        const y = u * u * u * previous.y + 3 * u * u * t * cubic.c1.y
          + 3 * u * t * t * cubic.c2.y + t * t * t * cubic.to.y
        worst = Math.max(worst, Math.abs(Math.hypot(x, y) - radius))
      }
      previous = cubic.to
    })
    // 每 90° 一段的最大径向误差约为半径的 2.7e-4。
    expect(worst).toBeLessThan(radius * 3e-4)
  })

  it('共线重叠的两条边不产生节点，绕行从其中一条走过去', () => {
    // 右边画了两遍：`intersectComposeSegments` 对共线一律返回空，因此没有多出来的节点。
    const edges = [...rectangleEdges(0, 0, 100, 100), segment([100, 0], [100, 100])]
    const result = resolveComposeCurveRegion(edges, { x: 50, y: 50 })
    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    expect(boundsOf(outlinePoints(result))).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 100 })
  })

  it('两座岛各成一条子路径', () => {
    const edges = [
      ...rectangleEdges(0, 0, 300, 200),
      circle(80, 100, 30),
      ...rectangleEdges(180, 60, 60, 60),
    ]
    const result = resolveComposeCurveRegion(edges, { x: 10, y: 10 })
    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved' || result.curve.kind !== 'path') return
    expect(result.islandCount).toBe(2)
    expect(result.curve.subpaths).toHaveLength(3)
    expect(result.curve.fillRule).toBe('evenodd')
  })

  it('岛与外环共用节点时绕出来的仍是那座岛', () => {
    // 一条隔断两端都顶在外框上，但只伸到一半——它不分割任何东西，绕岛不得溜到外环上去。
    const edges = [
      ...rectangleEdges(0, 0, 200, 200),
      segment([0, 100], [60, 100]),
      circle(140, 100, 30),
    ]
    const result = resolveComposeCurveRegion(edges, { x: 10, y: 10 })
    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved' || result.curve.kind !== 'path') return
    // 伸进去的那一段是线头（绕行时掉头绕过去），圆才是岛。
    expect(result.islandCount).toBe(1)
    const island = result.curve.subpaths[1]!
    const xs = [island.start.x, ...island.segments.map((cubic) => cubic.to.x)]
    expect(Math.min(...xs)).toBeCloseTo(110, 3)
    expect(Math.max(...xs)).toBeCloseTo(170, 3)
  })

  it('落点在大比例图纸上同样求得出来', () => {
    // 世界坐标的量级由图纸比例决定，节点容差是相对量——放大一万倍结果不变。
    const scale = 10_000
    const edges = rectangleEdges(0, 0, 100 * scale, 60 * scale)
    const result = resolveComposeCurveRegion(edges, { x: 50 * scale, y: 30 * scale })
    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    expect(boundsOf(outlinePoints(result)))
      .toEqual({ minX: 0, minY: 0, maxX: 100 * scale, maxY: 60 * scale })
  })

  it('出处报出外环用到的每一条输入片段', () => {
    const result = resolveComposeCurveRegion(rectangleEdges(0, 0, 100, 60), { x: 50, y: 30 })
    if (result.status !== 'resolved') throw new Error('expected resolved')
    // 四条边各一条子边，四条都在环上——这就是「边界恰好是这一个对象的完整几何」。
    expect(result.sources).toEqual([
      { index: 0, subEdges: 1, used: 1 },
      { index: 1, subEdges: 1, used: 1 },
      { index: 2, subEdges: 1, used: 1 },
      { index: 3, subEdges: 1, used: 1 },
    ])
  })

  it('被切开的那条片段用不满，出处如实说出来', () => {
    const edges = [...rectangleEdges(0, 0, 100, 100), segment([50, 0], [50, 100])]
    const result = resolveComposeCurveRegion(edges, { x: 20, y: 50 })
    if (result.status !== 'resolved') throw new Error('expected resolved')
    // 上下两条边各被切成两条，环上只用了左边那一半。
    const top = result.sources.find((entry) => entry.index === 0)
    expect(top).toEqual({ index: 0, subEdges: 2, used: 1 })
    // 右边整条不在环上，因此根本不出现。
    expect(result.sources.some((entry) => entry.index === 1)).toBe(false)
  })

  it('8 字形的一个环用不满它自己', () => {
    // 一条自交的闭合折线：两个环都出自它，但点中的只是其中一个。
    const lobes: ComposeOutlinePiece[] = [
      segment([0, 0], [100, 100]),
      segment([100, 100], [0, 100]),
      segment([0, 100], [100, 0]),
      segment([100, 0], [0, 0]),
    ]
    const result = resolveComposeCurveRegion(lobes, { x: 50, y: 80 })
    if (result.status !== 'resolved') throw new Error('expected resolved')
    // 交叉点把两条对角边各切成两段，下面那个环只用得到其中一段。
    expect(result.sources.some((entry) => entry.used < entry.subEdges)).toBe(true)
  })
})
