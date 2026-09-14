import { describe, expect, it } from 'vitest'
import {
  flattenComposeCurves,
  resolveComposeCurveBoolean,
  type ComposeBooleanOperand,
} from './curve-boolean'
import { composeCurveSegments, isPointInsideComposeCurve } from './curve'
import { composeCurveFromOutline } from './curve-arrangement'
import type { ComposeCurve } from './curve'
import type { ComposeOutlinePiece } from './curve-geometry'

const rect = (x: number, y: number, w: number, h: number): ComposeCurve => ({
  kind: 'polyline',
  vertices: [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ],
  closed: true,
})

/** 两条曲线拍平前后的轮廓采样点集；用于断「轮廓一个像素都不变」。 */
function outlineBounds(curve: ComposeCurve) {
  const segments = composeCurveSegments(curve)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  segments.forEach(({ start, end }) => {
    minX = Math.min(minX, start.x, end.x)
    minY = Math.min(minY, start.y, end.y)
    maxX = Math.max(maxX, start.x, end.x)
    maxY = Math.max(maxY, start.y, end.y)
  })
  return { minX, minY, maxX, maxY }
}

describe('flattenComposeCurves', () => {
  it('单个矩形也落 path——最窄 kind 那条在这里被有意豁免', () => {
    const result = flattenComposeCurves([rect(0, 0, 100, 60)])
    expect(result.kind).toBe('path')
    expect(result.subpaths).toHaveLength(1)
    expect(result.subpaths[0]!.closed).toBe(true)
    // 四条边各一段三次贝塞尔；闭合那条边由 `closed` 表达，不重复顶点。
    expect(result.subpaths[0]!.segments).toHaveLength(4)
  })

  it('圆角矩形拍平后轮廓不变', () => {
    const rounded: ComposeCurve = { ...rect(0, 0, 100, 60), cornerRadius: 12 }
    const before = outlineBounds(rounded)
    const after = outlineBounds(flattenComposeCurves([rounded]))
    expect(after.minX).toBeCloseTo(before.minX, 6)
    expect(after.minY).toBeCloseTo(before.minY, 6)
    expect(after.maxX).toBeCloseTo(before.maxX, 6)
    expect(after.maxY).toBeCloseTo(before.maxY, 6)
  })

  it('圆角走的是命中与渲染读的那一列片段，因此角上有弧段', () => {
    const rounded: ComposeCurve = { ...rect(0, 0, 100, 60), cornerRadius: 12 }
    const result = flattenComposeCurves([rounded])
    // 四条缩短的直段 + 四个角弧（每个角 < 90°，各一段贝塞尔）。
    expect(result.subpaths[0]!.segments).toHaveLength(8)
  })

  it('两个分离的形状得到两条子路径', () => {
    const result = flattenComposeCurves([rect(0, 0, 20, 20), rect(50, 50, 20, 20)])
    expect(result.subpaths).toHaveLength(2)
  })

  it('整圆闭合，一段弧不闭合', () => {
    const circle: ComposeCurve = {
      kind: 'arc',
      center: { x: 50, y: 50 },
      radius: 30,
      startAngle: 0,
      sweep: 360,
    }
    const quarter: ComposeCurve = { ...circle, sweep: 90 }
    expect(flattenComposeCurves([circle]).subpaths[0]!.closed).toBe(true)
    expect(flattenComposeCurves([quarter]).subpaths[0]!.closed).toBe(false)
    // 整圆每 90° 一段。
    expect(flattenComposeCurves([circle]).subpaths[0]!.segments).toHaveLength(4)
  })

  it('整圆拍平后半径误差在闭式解的量级内', () => {
    const circle: ComposeCurve = {
      kind: 'arc',
      center: { x: 0, y: 0 },
      radius: 500,
      startAngle: 0,
      sweep: 360,
    }
    const bounds = outlineBounds(flattenComposeCurves([circle]))
    // 每 90° 一段时最大径向误差约半径的 2.7e-4，即 500px 上 0.14px。
    expect(Math.abs(bounds.maxX - 500)).toBeLessThan(0.2)
    expect(Math.abs(bounds.minY + 500)).toBeLessThan(0.2)
  })

  it('直线拍平成一条不闭合的子路径', () => {
    const line: ComposeCurve = { kind: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 4 } }
    const result = flattenComposeCurves([line])
    expect(result.subpaths[0]!.closed).toBe(false)
    expect(result.subpaths[0]!.segments).toHaveLength(1)
    expect(result.subpaths[0]!.segments[0]!.to).toEqual({ x: 10, y: 4 })
  })

  it('path 的子路径原样搬过来，不再走一遍转换', () => {
    const path: ComposeCurve = {
      kind: 'path',
      subpaths: [{
        start: { x: 0, y: 0 },
        segments: [{ c1: { x: 1, y: 9 }, c2: { x: 7, y: 9 }, to: { x: 8, y: 0 } }],
        closed: true,
      }],
    }
    const result = flattenComposeCurves([path])
    expect(result.subpaths[0]).toBe(path.subpaths[0])
  })

  it('任一操作数带 evenodd 时结果也带——洞不能被填平', () => {
    const holed: ComposeCurve = {
      kind: 'path',
      subpaths: [
        { start: { x: 0, y: 0 }, segments: [], closed: true },
        { start: { x: 2, y: 2 }, segments: [], closed: true },
      ],
      fillRule: 'evenodd',
    }
    expect(flattenComposeCurves([holed]).fillRule).toBe('evenodd')
    expect(flattenComposeCurves([holed, rect(0, 0, 10, 10)]).fillRule).toBe('evenodd')
    expect(flattenComposeCurves([rect(0, 0, 10, 10)]).fillRule).toBeUndefined()
  })

  it('空输入得到一条没有子路径的 path', () => {
    expect(flattenComposeCurves([])).toEqual({ kind: 'path', subpaths: [] })
  })
})

/*
 * 量过一次上界：两个 256 边形求并集约 16.6ms，128 边约 7.6ms，24 边约 6.8ms（本机 bun，
 * `resolveComposeCurveBoolean` 单次）。符号库里路径命令最多的那个（`储能电机开关.svg`，123 条）
 * 落在 128 边那一档。
 *
 * 这个数之所以够用，是因为布尔是**一次性**的、不进每帧路径——与填充跟随不同，那一条每次
 * solve 都要跑，因此它才要「只在存下来的那几个边界里求」。这里没有那个约束。
 *
 * 不把它写成断言：机器快慢差一个量级，那样的用例只会变成一条随机红。
 */
describe('OpenSpec: compose-document / 曲线布尔运算按面分类求解', () => {
  const seg = (
    from: [number, number],
    to: [number, number],
  ): ComposeOutlinePiece => ({
    kind: 'segment',
    segment: { start: { x: from[0], y: from[1] }, end: { x: to[0], y: to[1] } },
  })

  /** 一个轴对齐矩形的四条边。 */
  const boxPieces = (x: number, y: number, w: number, h: number): ComposeOutlinePiece[] => [
    seg([x, y], [x + w, y]),
    seg([x + w, y], [x + w, y + h]),
    seg([x + w, y + h], [x, y + h]),
    seg([x, y + h], [x, y]),
  ]
  const box = (x: number, y: number, w: number, h: number): ComposeBooleanOperand => (
    { pieces: boxPieces(x, y, w, h) }
  )
  const circlePieces = (cx: number, cy: number, r: number): ComposeOutlinePiece[] => [
    { kind: 'arc', arc: { center: { x: cx, y: cy }, radius: r, startAngle: 0, sweep: 360 } },
  ]

  /** 产物的面积；断「留了哪几块面」比断顶点坐标稳，也更接近用户看见的东西。 */
  function areaOf(curve: ComposeCurve): number {
    const rings = curve.kind === 'path'
      ? curve.subpaths.map((subpath) => subpath)
      : []
    if (curve.kind === 'polyline') {
      const v = curve.vertices
      let total = 0
      for (let i = 0, j = v.length - 1; i < v.length; j = i, i += 1) {
        total += (v[j]!.x + v[i]!.x) * (v[j]!.y - v[i]!.y)
      }
      return Math.abs(total) / 2
    }
    // `path` 的面积按子路径顶点估：直线段的控制点落在弦上，因此顶点序列就够。
    return rings.reduce((sum, subpath) => {
      const points = [subpath.start, ...subpath.segments.map((segment) => segment.to)]
      let total = 0
      for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
        total += (points[j]!.x + points[i]!.x) * (points[j]!.y - points[i]!.y)
      }
      return sum + Math.abs(total) / 2
    }, 0)
  }

  it('两个重叠矩形求并集：全是直边且没有洞，落成闭合多段线', () => {
    const result = resolveComposeCurveBoolean([box(0, 0, 10, 10), box(5, 5, 10, 10)], 'union')
    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    expect(result.curve.kind).toBe('polyline')
    expect(result.islandCount).toBe(0)
    // 100 + 100 − 25 = 175。
    expect(areaOf(result.curve)).toBeCloseTo(175, 6)
  })

  it('交集只留重叠的那一块', () => {
    const result = resolveComposeCurveBoolean([box(0, 0, 10, 10), box(5, 5, 10, 10)], 'intersect')
    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    expect(areaOf(result.curve)).toBeCloseTo(25, 6)
  })

  it('差集减的是第一个操作数，也就是层序最靠下那个', () => {
    const result = resolveComposeCurveBoolean([box(0, 0, 10, 10), box(5, 5, 10, 10)], 'subtract')
    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    expect(areaOf(result.curve)).toBeCloseTo(75, 6)
  })

  it('异或留下各自独有的两块，重叠处挖空', () => {
    const result = resolveComposeCurveBoolean([box(0, 0, 10, 10), box(5, 5, 10, 10)], 'exclude')
    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    expect(areaOf(result.curve)).toBeCloseTo(150, 6)
  })

  it('三个形状求异或：只有落在奇数个里的面被保留', () => {
    const result = resolveComposeCurveBoolean(
      [box(0, 0, 10, 10), box(5, 0, 10, 10), box(8, 0, 10, 10)],
      'exclude',
    )
    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    /*
     * 三条带子在 x 上分成 [0,5) 一层、[5,8) 两层、[8,10) 三层、[10,15) 两层、[15,18) 一层。
     * 奇数层的是 5 + 2 + 3 = 10 宽，高 10。
     */
    expect(areaOf(result.curve)).toBeCloseTo(100, 6)
  })

  it('小形状整个落在大形状里面：差集挖出一个洞，写 evenodd', () => {
    const result = resolveComposeCurveBoolean(
      [box(0, 0, 100, 100), box(40, 40, 20, 20)],
      'subtract',
    )
    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    expect(result.curve).toMatchObject({ kind: 'path', fillRule: 'evenodd' })
    expect(result.islandCount).toBe(1)
  })

  it('不相交的两个形状求交集：报「没有面积」而不是求解退化', () => {
    const result = resolveComposeCurveBoolean([box(0, 0, 10, 10), box(50, 50, 10, 10)], 'intersect')
    expect(result.status).toBe('empty')
  })

  it('沿网格共享一整条边的两个矩形求并集——边裁剪要特判而面分类不用', () => {
    const result = resolveComposeCurveBoolean([box(0, 0, 10, 10), box(10, 0, 10, 10)], 'union')
    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    expect(areaOf(result.curve)).toBeCloseTo(200, 6)
  })

  it('弧边参与：矩形减一个整圆仍然求得出来', () => {
    const result = resolveComposeCurveBoolean(
      [box(0, 0, 40, 40), { pieces: circlePieces(40, 20, 12) }],
      'subtract',
    )
    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    // 圆压在右边缘上，半个圆被减掉：400 − π·144/2 ≈ 174。
    expect(result.curve.kind).toBe('path')
  })

  it('小圆整个落在大矩形里面：让开量要被圆自己的半径钳住', () => {
    /*
     * 判别性用例，两条都要：圆**整个在内部**（不与任何边相交，因此它是一条独立的子边），
     * 而且**离其余每条边都远**。取样让开量由「中点到其余每条边的最近距离」推出，这里是 ≈395，
     * 让开一半就是 197——远大于半径 5，取样点直接跨到圆的另一侧去，于是这一圈的内外判定整个
     * 反过来，症状是**洞不见了而且不报错**。
     *
     * 上面那条弧用例挡不住它：那个圆压在矩形右边缘上、被切成几段，每段中点离别的边都很近。
     */
    const result = resolveComposeCurveBoolean(
      [box(0, 0, 1000, 800), { pieces: circlePieces(500, 400, 5) }],
      'subtract',
    )
    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    expect(result.islandCount).toBe(1)
    // 洞真的在圆心处，而矩形的其余部分还在——只断 islandCount 读不出朝向对不对。
    expect(isPointInsideComposeCurve(result.curve, { x: 500, y: 400 })).toBe(false)
    expect(isPointInsideComposeCurve(result.curve, { x: 200, y: 200 })).toBe(true)
  })

  it('互不相连的两个形状求并集：两条外环，靠 evenodd 一起填上', () => {
    // 这一档正是「枚举面」做不对的那一类：两个形状不连通，绕半边绕不出「大的挖掉小的」。
    const result = resolveComposeCurveBoolean([box(0, 0, 10, 10), box(50, 50, 10, 10)], 'union')
    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') return
    expect(result.curve).toMatchObject({ kind: 'path', fillRule: 'evenodd' })
    if (result.curve.kind !== 'path') return
    expect(result.curve.subpaths).toHaveLength(2)
    // 两条都是外环，一个洞都没有。
    expect(result.islandCount).toBe(0)
    expect(areaOf(result.curve)).toBeCloseTo(200, 6)
  })

  it('少于两个操作数时不求解', () => {
    expect(resolveComposeCurveBoolean([box(0, 0, 10, 10)], 'union').status).toBe('empty')
    expect(resolveComposeCurveBoolean([], 'union').status).toBe('empty')
  })
})

describe('OpenSpec: compose-document / 布尔操作数可以自带内外判定用的曲线', () => {
  const seg = (from: [number, number], to: [number, number]): ComposeOutlinePiece => ({
    kind: 'segment',
    segment: { start: { x: from[0], y: from[1] }, end: { x: to[0], y: to[1] } },
  })
  const ring = (x: number, y: number, w: number, h: number): ComposeOutlinePiece[] => [
    seg([x, y], [x + w, y]),
    seg([x + w, y], [x + w, y + h]),
    seg([x + w, y + h], [x, y + h]),
    seg([x, y + h], [x, y]),
  ]

  it('带岛的操作数以自己的规则判内外', () => {
    /*
     * 判别性夹具：一块**甜甜圈**——外环 100×100、中间挖掉 20×20，再拿一个整个落在洞里的
     * 小矩形与它求交集。片段摊平之后是八条边，收成「一条环」会把洞算成实心，于是交集得到
     * 那个小矩形；带上自己那条 `evenodd` 的曲线才读出「洞里不算在里面」。
     *
     * 洞是填充求面天天产出的东西（一个符号压在一块面里），因此这不是边角情形。
     */
    const outer = ring(0, 0, 100, 100)
    const island = ring(40, 40, 20, 20)
    const donutCurve = composeCurveFromOutline([outer, island])
    expect(donutCurve).toMatchObject({ kind: 'path', fillRule: 'evenodd' })

    const donut: ComposeBooleanOperand = {
      pieces: [...outer, ...island],
      curve: donutCurve!,
    }
    const insideHole: ComposeBooleanOperand = { pieces: ring(45, 45, 10, 10) }
    expect(resolveComposeCurveBoolean([donut, insideHole], 'intersect').status).toBe('empty')
  })

  it('缺席时由片段收成单环判内外，与显式传入同一条曲线结果相同', () => {
    const pieces = ring(0, 0, 100, 100)
    const other: ComposeBooleanOperand = { pieces: ring(50, 50, 100, 100) }
    const explicit = resolveComposeCurveBoolean(
      [{ pieces, curve: composeCurveFromOutline([pieces])! }, other],
      'intersect',
    )
    const implicit = resolveComposeCurveBoolean([{ pieces }, other], 'intersect')
    expect(implicit.status).toBe('resolved')
    expect(implicit).toEqual(explicit)
  })
})
