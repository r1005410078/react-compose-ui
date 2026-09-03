import { describe, expect, it } from 'vitest'
import { composeCurveBounds, type ComposePathCurve, type ComposePolylineCurve } from '@compose-ui/core'
import { createSvgDiagnosticCollector } from '../parser/svg-diagnostics'
import { parseSvg } from '../parser/svg-parser'
import { svgShapeToCurve } from './svg-geometry'
import { parseSvgTransform, SVG_IDENTITY } from './svg-transform'

/** 取 `<svg>` 下的第一个子元素——用例只关心那一个图元。 */
function shape(markup: string) {
  const diagnostics = createSvgDiagnosticCollector()
  const root = parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`, diagnostics)
  const node = root?.children[0]
  if (!node) throw new Error('用例的 SVG 里没有图元')
  return { node, diagnostics }
}

function curveOf(markup: string, transform = '') {
  const { node, diagnostics } = shape(markup)
  const curve = svgShapeToCurve(node, parseSvgTransform(transform), diagnostics)
  return { curve, diagnostics: diagnostics.collect() }
}

/*
 * 这一组的判别性来自「最窄 kind」这一句：只断言「产出了曲线」的用例在一个一律落成 `path` 的
 * 实现上同样会绿，因此每条都断 `kind`。
 */
describe('OpenSpec: svg-import / 图元映射到最窄的曲线 kind', () => {
  it('直线落成 line', () => {
    const { curve } = curveOf('<line x1="0" y1="0" x2="10" y2="10"/>')
    expect(curve).toEqual({ kind: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 10 } })
  })

  it('polygon 落成闭合多段线，polyline 落成开放的', () => {
    expect(curveOf('<polygon points="0,0 10,0 10,10"/>').curve)
      .toMatchObject({ kind: 'polyline', closed: true })
    expect(curveOf('<polyline points="0,0 10,0 10,10"/>').curve)
      .toMatchObject({ kind: 'polyline', closed: false })
  })

  it('矩形落成四顶点闭合多段线，不另立类型', () => {
    const curve = curveOf('<rect x="5" y="5" width="20" height="10"/>').curve as ComposePolylineCurve
    expect(curve.kind).toBe('polyline')
    expect(curve.closed).toBe(true)
    expect(curve.vertices).toEqual([
      { x: 5, y: 5 }, { x: 25, y: 5 }, { x: 25, y: 15 }, { x: 5, y: 15 },
    ])
  })

  it('圆角矩形复用既有的 cornerRadius 字段', () => {
    const curve = curveOf('<rect width="20" height="10" rx="3"/>').curve as ComposePolylineCurve
    expect(curve.cornerRadius).toBe(3)
  })

  it('正圆落成扫掠 360 的弧', () => {
    expect(curveOf('<circle cx="10" cy="10" r="4"/>').curve)
      .toEqual({ kind: 'arc', center: { x: 10, y: 10 }, radius: 4, startAngle: 0, sweep: 360 })
  })

  it('椭圆落成 path 的精确贝塞尔，而不是拍扁的多段线', () => {
    const curve = curveOf('<ellipse cx="10" cy="10" rx="8" ry="4"/>').curve as ComposePathCurve
    expect(curve.kind).toBe('path')
    // 四段弧展开成的贝塞尔，紧包围盒仍然是 16 × 8——拍扁成多段线会小一圈。
    const bounds = composeCurveBounds(curve)
    expect(bounds.width).toBeCloseTo(16, 6)
    expect(bounds.height).toBeCloseTo(8, 6)
  })

  it('只含直线命令的单条子路径落成 polyline', () => {
    const curve = curveOf('<path d="M0 0 L10 0 L10 10 Z"/>').curve as ComposePolylineCurve
    expect(curve.kind).toBe('polyline')
    expect(curve.closed).toBe(true)
    // `Z` 之后不重复首顶点：闭合是布尔，两种表示同时存在会多出一个重合的顶点。
    expect(curve.vertices).toHaveLength(3)
  })

  it('相对命令与简写命令都被规范化', () => {
    const curve = curveOf('<path d="m0 0 h10 v10 z"/>').curve as ComposePolylineCurve
    expect(curve.vertices).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])
  })

  it('两条直线子路径落成 path 而不是 polyline——第二条不该被丢掉', () => {
    const curve = curveOf('<path d="M0 0 L10 0 Z M20 0 L30 0 Z"/>').curve as ComposePathCurve
    expect(curve.kind).toBe('path')
    expect(curve.subpaths).toHaveLength(2)
  })

  it('含曲率的路径落成 path，且段全是三次贝塞尔', () => {
    const curve = curveOf('<path d="M0 0 Q 5 10 10 0"/>').curve as ComposePathCurve
    expect(curve.kind).toBe('path')
    expect(curve.subpaths[0]!.segments).toHaveLength(1)
    expect(Object.keys(curve.subpaths[0]!.segments[0]!).sort()).toEqual(['c1', 'c2', 'to'])
  })

  it('退化几何返回 null 而不是一个画不出来的曲线', () => {
    expect(curveOf('<circle cx="1" cy="1" r="0"/>').curve).toBeNull()
    expect(curveOf('<rect width="0" height="10"/>').curve).toBeNull()
    expect(curveOf('<line x1="1" y1="1" x2="1" y2="1"/>').curve).toBeNull()
  })
})

describe('OpenSpec: svg-import / transform 在导入期烘进几何', () => {
  it('嵌套变换按从左到右相乘', () => {
    // 先平移再缩放：写反的话点会落在 (20, 40)。
    const curve = curveOf('<line x1="0" y1="0" x2="1" y2="1"/>', 'translate(10,20) scale(2)').curve
    expect(curve).toMatchObject({ start: { x: 10, y: 20 }, end: { x: 12, y: 22 } })
  })

  it('rotate 的三参数形式绕给定中心', () => {
    const curve = curveOf('<line x1="10" y1="0" x2="10" y2="0"/>', 'rotate(90 0 0)').curve
    // 退化线返回 null，因此改用一条真线验证。
    expect(curve).toBeNull()
    const real = curveOf('<line x1="10" y1="0" x2="20" y2="0"/>', 'rotate(90 0 0)').curve
    // 三角函数留下的浮点残渣由写入漏斗的量化清掉，这一层不做取整。
    expect(real).toMatchObject({ kind: 'line' })
    const line = real as { start: { x: number; y: number }; end: { x: number; y: number } }
    expect(line.start.x).toBeCloseTo(0, 9)
    expect(line.start.y).toBeCloseTo(10, 9)
    expect(line.end.x).toBeCloseTo(0, 9)
    expect(line.end.y).toBeCloseTo(20, 9)
  })

  it('非等比缩放下的圆落成 path，并报告', () => {
    const { curve, diagnostics } = curveOf('<circle cx="0" cy="0" r="10"/>', 'scale(2,1)')
    expect(curve?.kind).toBe('path')
    expect(diagnostics.map(({ code }) => code)).toContain('svg.unsupported-paint-effect')
    const bounds = composeCurveBounds(curve!)
    expect(bounds.width).toBeCloseTo(40, 6)
    expect(bounds.height).toBeCloseTo(20, 6)
  })

  it('等比缩放下的圆仍然是弧', () => {
    expect(curveOf('<circle cx="0" cy="0" r="10"/>', 'scale(3)').curve)
      .toMatchObject({ kind: 'arc', radius: 30 })
  })

  it('缺席 transform 时几何原样落地', () => {
    const { node, diagnostics } = shape('<line x1="1" y1="2" x2="3" y2="4"/>')
    expect(svgShapeToCurve(node, SVG_IDENTITY, diagnostics))
      .toEqual({ kind: 'line', start: { x: 1, y: 2 }, end: { x: 3, y: 4 } })
  })
})
