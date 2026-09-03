import { describe, expect, it } from 'vitest'
import {
  composeCurveBounds,
  composeCurveSegments,
  composePathCubics,
  distanceToComposeCurve,
  isComposeClosedCurve,
  isPointInsideComposeCurve,
  isValidComposeCurve,
  normalizeComposeCurveGeometry,
  projectComposeCurveToBox,
  translateComposeCurve,
  type ComposeCurve,
  type ComposePathCurve,
  type ComposeSubpath,
} from './curve'
import { validateComposeDocument } from './document'
import type { DocumentValidationIssueCode } from './document-types'
import { documentFixture, rendererEntity } from './test-fixtures'

/** 一段向下鼓出的弧形子路径：控制点在 y = 100，曲线本身最远到 y = 75。 */
const bulge: ComposeSubpath = {
  start: { x: 0, y: 0 },
  segments: [{ c1: { x: 0, y: 100 }, c2: { x: 100, y: 100 }, to: { x: 100, y: 0 } }],
  closed: false,
}

function pathCurve(subpaths: readonly ComposeSubpath[], fillRule?: 'evenodd'): ComposePathCurve {
  return fillRule ? { kind: 'path', subpaths, fillRule } : { kind: 'path', subpaths }
}

/** 一个轴对齐方环，四条边各一段直的三次段。 */
function squareSubpath(x: number, y: number, size: number): ComposeSubpath {
  const corners = [
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ]
  let from = { x, y }
  const segments = corners.map((to) => {
    const segment = {
      c1: { x: from.x + (to.x - from.x) / 3, y: from.y + (to.y - from.y) / 3 },
      c2: { x: from.x + ((to.x - from.x) * 2) / 3, y: from.y + ((to.y - from.y) * 2) / 3 },
      to,
    }
    from = to
    return segment
  })
  return { start: { x, y }, segments, closed: true }
}

describe('OpenSpec: compose-document / 曲线是带盒的普通 Entity / path 校验', () => {
  it('合法 path 通过校验', () => {
    expect(isValidComposeCurve(pathCurve([bulge]))).toBe(true)
  })

  it('显式写 nonzero 非法——缺席与显式必须只有一种表示', () => {
    expect(isValidComposeCurve({ ...pathCurve([bulge]), fillRule: 'nonzero' })).toBe(false)
  })

  it('evenodd 合法', () => {
    expect(isValidComposeCurve(pathCurve([bulge], 'evenodd'))).toBe(true)
  })

  it('没有子路径时拒绝', () => {
    expect(isValidComposeCurve(pathCurve([]))).toBe(false)
  })

  it('一条没有段的子路径拒绝——它只是一个点，画不出也点不中', () => {
    expect(isValidComposeCurve(pathCurve([{ ...bulge, segments: [] }]))).toBe(false)
  })

  it('控制点不是有限数时拒绝', () => {
    const broken: ComposeSubpath = {
      ...bulge,
      segments: [{ ...bulge.segments[0]!, c1: { x: Number.NaN, y: 0 } }],
    }
    expect(isValidComposeCurve(pathCurve([broken]))).toBe(false)
  })

  it('未知字段拒绝', () => {
    expect(isValidComposeCurve({ ...pathCurve([bulge]), extra: 1 })).toBe(false)
  })

  it('文档校验以既有机器码拒绝坏 path', () => {
    const document = documentFixture({
      'curve-1': rendererEntity('curve-1', {
        components: {
          Renderer: { type: 'curve', props: {} },
          Curve: pathCurve([]),
        },
      }),
    })
    const result = validateComposeDocument(document)
    const codes = result.valid ? [] : result.issues.map((issue) => issue.code as DocumentValidationIssueCode)
    expect(codes).toContain('curve.invalid')
  })
})

describe('OpenSpec: compose-document / 曲线是带盒的普通 Entity / path 的盒与展开', () => {
  it('紧包围盒由极值点决定，不是控制点凸包', () => {
    const bounds = composeCurveBounds(pathCurve([bulge]))
    expect(bounds.height).toBeCloseTo(75, 9)
    expect(bounds.height).toBeLessThan(100)
  })

  it('闭合子路径的收尾直段被补上，且不重复补零长度段', () => {
    const square = squareSubpath(0, 0, 10)
    expect(composePathCubics(pathCurve([square]))).toHaveLength(4)
    // 末点已经落回起点时不补：那一段零长度，对形状没有贡献。
    const explicit: ComposeSubpath = {
      ...square,
      segments: [
        ...square.segments,
        { c1: { x: 0, y: 7 }, c2: { x: 0, y: 3 }, to: { x: 0, y: 0 } },
      ],
    }
    expect(composePathCubics(pathCurve([explicit]))).toHaveLength(4)
  })

  it('全部子路径闭合才算闭合曲线', () => {
    expect(isComposeClosedCurve(pathCurve([squareSubpath(0, 0, 10)]))).toBe(true)
    expect(isComposeClosedCurve(pathCurve([squareSubpath(0, 0, 10), bulge]))).toBe(false)
  })

  it('平移搬走全部控制点', () => {
    const moved = translateComposeCurve(pathCurve([bulge]), 5, 7) as ComposePathCurve
    expect(moved.subpaths[0]!.start).toEqual({ x: 5, y: 7 })
    expect(moved.subpaths[0]!.segments[0]!.c1).toEqual({ x: 5, y: 107 })
  })

  it('归一化把紧包围盒左上角搬到原点', () => {
    const shifted = translateComposeCurve(pathCurve([bulge]), 30, 40)
    const next = normalizeComposeCurveGeometry(shifted)
    expect(next.offset).toEqual({ x: 30, y: 40 })
    expect(composeCurveBounds(next.curve).x).toBeCloseTo(0, 9)
    expect(composeCurveBounds(next.curve).y).toBeCloseTo(0, 9)
  })
})

describe('OpenSpec: compose-document / 曲线是带盒的普通 Entity / path 在非等比盒里精确投影', () => {
  const curve = pathCurve([bulge])

  it('非等比投影后仍是 path，不像弧那样退化成多段线', () => {
    const projected = projectComposeCurveToBox(curve, { width: 200, height: 75 })
    expect(projected.kind).toBe('path')
  })

  it('控制点按两轴各自的比例精确变换', () => {
    const projected = projectComposeCurveToBox(curve, { width: 200, height: 150 }) as ComposePathCurve
    // 几何空间是 100 × 75，因此两轴比例分别是 2 与 2。
    expect(projected.subpaths[0]!.segments[0]!.c1).toEqual({ x: 0, y: 200 })
    expect(projected.subpaths[0]!.segments[0]!.to).toEqual({ x: 200, y: 0 })
  })
})

describe('OpenSpec: compose-document / 曲线是带盒的普通 Entity / path 的命中', () => {
  const curve = pathCurve([bulge])

  it('曲线上的点距离约等于零', () => {
    expect(distanceToComposeCurve(curve, { x: 50, y: 75 })).toBeLessThan(0.5)
  })

  it('包围盒里的空处不命中——这正是曲线不按盒判定的理由', () => {
    expect(distanceToComposeCurve(curve, { x: 50, y: 10 })).toBeGreaterThan(10)
  })

  it('拍平后的线段覆盖全部子路径', () => {
    const segments = composeCurveSegments(pathCurve([squareSubpath(0, 0, 10), squareSubpath(20, 0, 10)]))
    // 两个方环各四条边，各自只需一段（直段的弦高为零）。
    expect(segments).toHaveLength(8)
  })
})

describe('OpenSpec: compose-document / 点在曲线内部的判定 / 填充规则', () => {
  /** 外环顺时针、内环也顺时针：非零绕数下内圈是实心，奇偶下是洞。 */
  const nested = [squareSubpath(0, 0, 100), squareSubpath(25, 25, 50)]
  const inner = { x: 50, y: 50 }
  const outerRing = { x: 10, y: 50 }

  it('缺席 fillRule 时按非零绕数——同向内环仍是实心', () => {
    expect(isPointInsideComposeCurve(pathCurve(nested), inner)).toBe(true)
  })

  it('evenodd 时同一个内环是洞', () => {
    expect(isPointInsideComposeCurve(pathCurve(nested, 'evenodd'), inner)).toBe(false)
  })

  it('两条规则在外环那圈上给出同一个答案', () => {
    expect(isPointInsideComposeCurve(pathCurve(nested), outerRing)).toBe(true)
    expect(isPointInsideComposeCurve(pathCurve(nested, 'evenodd'), outerRing)).toBe(true)
  })

  it('环外恒为假', () => {
    expect(isPointInsideComposeCurve(pathCurve(nested), { x: 150, y: 50 })).toBe(false)
    expect(isPointInsideComposeCurve(pathCurve(nested, 'evenodd'), { x: 150, y: 50 })).toBe(false)
  })
})

describe('OpenSpec: compose-document / 点在曲线内部的判定 / 既有 kind 不受影响', () => {
  it('不自交的闭合多段线逐点不变', () => {
    const square: ComposeCurve = {
      kind: 'polyline',
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
      closed: true,
    }
    expect(isPointInsideComposeCurve(square, { x: 5, y: 5 })).toBe(true)
    expect(isPointInsideComposeCurve(square, { x: 15, y: 5 })).toBe(false)
  })

  it('整圆的圆心在内部，直线没有内部', () => {
    const circle: ComposeCurve = {
      kind: 'arc',
      center: { x: 50, y: 50 },
      radius: 20,
      startAngle: 0,
      sweep: 360,
    }
    expect(isPointInsideComposeCurve(circle, { x: 50, y: 50 })).toBe(true)
    expect(isPointInsideComposeCurve(
      { kind: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
      { x: 5, y: 5 },
    )).toBe(false)
  })

  it('一笔画的五角星星心算内部——与渲染按 SVG 默认非零绕数填出来的墨一致', () => {
    // 五个外顶点按 2/5 圈的步长连起来，就是一笔画的五角星，星心处绕数为 2。
    const vertices = Array.from({ length: 5 }, (_unused, index) => {
      const angle = ((index * 2) / 5) * Math.PI * 2 - Math.PI / 2
      return { x: 100 + 50 * Math.cos(angle), y: 100 + 50 * Math.sin(angle) }
    })
    const star: ComposeCurve = { kind: 'polyline', vertices, closed: true }
    expect(isPointInsideComposeCurve(star, { x: 100, y: 100 })).toBe(true)
  })
})
