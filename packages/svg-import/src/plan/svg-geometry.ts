import svgpath from 'svgpath'
import type {
  ComposeCubicSegment,
  ComposeCurve,
  ComposePosition,
  ComposeSubpath,
} from '@compose-ui/core'
import type { SvgNode } from '../parser/svg-parser'
import type { createSvgDiagnosticCollector } from '../parser/svg-diagnostics'
import {
  applySvgMatrix,
  isUniformSvgMatrix,
  svgMatrixScale,
  type SvgMatrix,
} from './svg-transform'

type Diagnostics = ReturnType<typeof createSvgDiagnosticCollector>

/** 能映射成 `Curve` 的元素。 @public */
export const SVG_SHAPE_TAGS = new Set([
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
])

function number(node: SvgNode, name: string, fallback = 0): number {
  const raw = Number.parseFloat(node.attributes[name] ?? '')
  return Number.isFinite(raw) ? raw : fallback
}

function point(x: number, y: number): ComposePosition {
  return { x, y }
}

/**
 * 把一个图元映射成曲线，几何已经烘进了传入的矩阵。
 *
 * @remarks
 * **取能表达这个几何的最窄 kind**：直线、圆与折线各落成自己的那一种，只有真的含曲率或含多条
 * 子路径的才落成 `path`。理由是 `path` 眼下没有逐顶点的夹点——一份工程符号图导进来一个 `path`
 * 都没有，而那类图纸的用户接下来要做的正是拖顶点。
 *
 * 变换在这里烘死：`Transform` 只有 `rotation` 与 `pivot`，没有 scale、skew 或 matrix，SVG 的
 * 变换在文档里没有别的地方可放。v1 连纯旋转也一起烘——形状因此永远正确，代价是导入那一刻的
 * 旋转不再是一个活属性（用户仍然可以自己转它）。
 *
 * @returns 不是图元、或几何退化（半径为零、点数不足）时返回 `null`。
 * @public
 */
export function svgShapeToCurve(
  node: SvgNode,
  matrix: SvgMatrix,
  diagnostics: Diagnostics,
): ComposeCurve | null {
  const map = (x: number, y: number) => {
    const mapped = applySvgMatrix(matrix, { x, y })
    return point(mapped.x, mapped.y)
  }
  if (node.tag === 'line') {
    const start = map(number(node, 'x1'), number(node, 'y1'))
    const end = map(number(node, 'x2'), number(node, 'y2'))
    return start.x === end.x && start.y === end.y ? null : { kind: 'line', start, end }
  }
  if (node.tag === 'polyline' || node.tag === 'polygon') {
    const vertices = parsePoints(node.attributes.points ?? '').map(({ x, y }) => map(x, y))
    if (vertices.length < 2) return null
    return { kind: 'polyline', vertices, closed: node.tag === 'polygon' }
  }
  if (node.tag === 'rect') return rectCurve(node, matrix, map, diagnostics)
  if (node.tag === 'circle' || node.tag === 'ellipse') {
    return ellipseCurve(node, matrix, diagnostics)
  }
  if (node.tag === 'path') return pathDataToCurve(node.attributes.d ?? '', matrix)
  return null
}

/** `points="0,0 10,10"`；分隔符可以是逗号或空白，两者混用也合法。 */
function parsePoints(value: string): readonly { readonly x: number; readonly y: number }[] {
  const numbers = value
    .split(/[\s,]+/)
    .map((raw) => Number.parseFloat(raw))
    .filter((parsed) => Number.isFinite(parsed))
  const points: { x: number; y: number }[] = []
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    points.push({ x: numbers[index]!, y: numbers[index + 1]! })
  }
  return points
}

/**
 * `<rect>` 落成四顶点闭合多段线，`rx` 落成既有的 `cornerRadius`。
 *
 * @remarks
 * 不另立圆角矩形类型：矩形没有任何多段线没有的性质。圆角在非等比变换下不再是圆——`cornerRadius`
 * 只有一个数，因此取两轴的平均并诊断，MUST NOT 静默取其中一轴。
 */
function rectCurve(
  node: SvgNode,
  matrix: SvgMatrix,
  map: (x: number, y: number) => ComposePosition,
  diagnostics: Diagnostics,
): ComposeCurve | null {
  const x = number(node, 'x')
  const y = number(node, 'y')
  const width = number(node, 'width')
  const height = number(node, 'height')
  if (!(width > 0) || !(height > 0)) return null
  const vertices = [
    map(x, y),
    map(x + width, y),
    map(x + width, y + height),
    map(x, y + height),
  ]
  const rx = Math.abs(number(node, 'rx', number(node, 'ry')))
  if (rx <= 0) return { kind: 'polyline', vertices, closed: true }
  const scale = svgMatrixScale(matrix)
  if (!isUniformSvgMatrix(matrix)) diagnostics.add('svg.unsupported-paint-effect', 'rx')
  const radius = rx * ((scale.x + scale.y) / 2)
  return radius > 0
    ? { kind: 'polyline', vertices, closed: true, cornerRadius: radius }
    : { kind: 'polyline', vertices, closed: true }
}

/**
 * `<circle>` 与 `<ellipse>`。
 *
 * @remarks
 * 等比变换下的正圆落成扫掠 360 的弧（**不另立整圆类型**）；椭圆与非等比变换下的圆落成 `path`
 * ——四段三次贝塞尔是椭圆的**精确**表示，而拍扁成多段线只是近似。`path` 落地之前这里只能拍扁，
 * 现在不必了。
 */
function ellipseCurve(
  node: SvgNode,
  matrix: SvgMatrix,
  diagnostics: Diagnostics,
): ComposeCurve | null {
  const cx = number(node, 'cx')
  const cy = number(node, 'cy')
  const rx = node.tag === 'circle' ? number(node, 'r') : number(node, 'rx')
  const ry = node.tag === 'circle' ? number(node, 'r') : number(node, 'ry')
  if (!(rx > 0) || !(ry > 0)) return null
  if (rx === ry && isUniformSvgMatrix(matrix)) {
    const center = applySvgMatrix(matrix, { x: cx, y: cy })
    return {
      kind: 'arc',
      center: point(center.x, center.y),
      radius: rx * svgMatrixScale(matrix).x,
      startAngle: 0,
      sweep: 360,
    }
  }
  if (node.tag === 'circle') diagnostics.add('svg.unsupported-paint-effect', 'circle')
  // 两段半弧拼一个整圆：`A` 在起终点重合时画不出东西，这与渲染那一头是同一条限制。
  const data = `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy}`
    + ` A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`
  return pathDataToCurve(data, matrix)
}

/**
 * `<path>` 的 `d`。
 *
 * @remarks
 * 走 `svgpath` 的 `abs → unshort → matrix`：相对坐标、简写命令与变换烘焙都是这条链上最容易
 * 写错、且错了只在特定角度组合下现形的一段，交给一个被大量输入验证过的库比自己写第二遍安全。
 *
 * 只含直线命令且只有一条子路径时落成 `polyline`——那是最窄的 kind。其余 `unarc()` 展开成三次
 * 贝塞尔：`A` 到贝塞尔是**精确**转换，因此这一步不损失任何形状。
 */
export function pathDataToCurve(data: string, matrix: SvgMatrix): ComposeCurve | null {
  if (data.trim() === '') return null
  const normalized = svgpath(data).abs().unshort().matrix([...matrix]).abs()
  const straight = collectStraight(normalized)
  if (straight && straight.vertices.length >= 2) {
    return { kind: 'polyline', vertices: straight.vertices, closed: straight.closed }
  }
  const subpaths = collectSubpaths(normalized.unarc().abs())
  return subpaths.length > 0 ? { kind: 'path', subpaths } : null
}

/**
 * 只由直线命令构成的**单条**子路径。
 *
 * @remarks
 * 多条子路径即使全是直线也不能落成 `polyline`——那个 kind 只有一条轮廓，第二条会被丢掉，
 * 而带洞图形正是这么来的。
 */
function collectStraight(
  path: ReturnType<typeof svgpath>,
): { readonly vertices: readonly ComposePosition[]; readonly closed: boolean } | null {
  const vertices: ComposePosition[] = []
  let closed = false
  let subpaths = 0
  let curved = false
  path.iterate((segment, _index, x, y) => {
    const command = segment[0]
    if (command === 'M') {
      subpaths += 1
      vertices.push(point(segment[1] as number, segment[2] as number))
      return
    }
    if (command === 'L') {
      vertices.push(point(segment[1] as number, segment[2] as number))
      return
    }
    if (command === 'H') {
      vertices.push(point(segment[1] as number, y))
      return
    }
    if (command === 'V') {
      vertices.push(point(x, segment[1] as number))
      return
    }
    if (command === 'Z' || command === 'z') {
      closed = true
      return
    }
    curved = true
  })
  if (curved || subpaths !== 1) return null
  // `Z` 之后重复的那个顶点要去掉：`closed` 是布尔而不是「首尾顶点重复」，两种表示同时存在会
  // 让闭合三角形多出一个与首点重合的顶点。
  const first = vertices[0]
  const last = vertices[vertices.length - 1]
  if (closed && first && last && vertices.length > 2 && first.x === last.x && first.y === last.y) {
    vertices.pop()
  }
  return { vertices, closed }
}

/** 展开成三次贝塞尔之后按 `M` 切分子路径。 */
function collectSubpaths(path: ReturnType<typeof svgpath>): readonly ComposeSubpath[] {
  const subpaths: { start: ComposePosition; segments: ComposeCubicSegment[]; closed: boolean }[] = []
  let current: (typeof subpaths)[number] | null = null
  path.iterate((segment, _index, x, y) => {
    const command = segment[0]
    if (command === 'M') {
      current = { start: point(segment[1] as number, segment[2] as number), segments: [], closed: false }
      subpaths.push(current)
      return
    }
    if (!current) return
    if (command === 'Z' || command === 'z') {
      current.closed = true
      return
    }
    const from = point(x, y)
    if (command === 'C') {
      current.segments.push({
        c1: point(segment[1] as number, segment[2] as number),
        c2: point(segment[3] as number, segment[4] as number),
        to: point(segment[5] as number, segment[6] as number),
      })
      return
    }
    // 二次贝塞尔精确升阶成三次：控制点取 `P + 2/3·(Q − P)`，形状逐像素相同。`svgpath` 只有
    // `unarc()` 而没有「去二次」，因此这一步必须在这里做——漏掉它的症状是带 `Q` 的路径整条
    // 消失，而 `Q` 是设计稿导出里很常见的一种。
    if (command === 'Q') {
      const control = point(segment[1] as number, segment[2] as number)
      const to = point(segment[3] as number, segment[4] as number)
      current.segments.push({
        c1: point(from.x + (2 / 3) * (control.x - from.x), from.y + (2 / 3) * (control.y - from.y)),
        c2: point(to.x + (2 / 3) * (control.x - to.x), to.y + (2 / 3) * (control.y - to.y)),
        to,
      })
      return
    }
    // 直线命令升阶成控制点落在弦上的三次段：段类型只有一种，下游因此不必为「直的还是弯的」
    // 分两支，而 `flattenComposeCubic` 对这样一段恰好只产出一条线段。
    const to = command === 'L'
      ? point(segment[1] as number, segment[2] as number)
      : command === 'H'
        ? point(segment[1] as number, y)
        : command === 'V'
          ? point(x, segment[1] as number)
          : null
    if (to) current.segments.push(straightSegment(from, to))
  })
  return subpaths.filter((subpath) => subpath.segments.length > 0)
}

function straightSegment(from: ComposePosition, to: ComposePosition): ComposeCubicSegment {
  return {
    c1: point(from.x + (to.x - from.x) / 3, from.y + (to.y - from.y) / 3),
    c2: point(from.x + ((to.x - from.x) * 2) / 3, from.y + ((to.y - from.y) * 2) / 3),
    to,
  }
}
