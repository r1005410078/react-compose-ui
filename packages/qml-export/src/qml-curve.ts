import {
  composeArcEndpoints,
  composeArcPointAt,
  composeCurveViewBox,
  composePolylineOutline,
  isComposeFullCircle,
  type ComposeArcShape,
  type ComposeCurve,
  type JsonObject,
} from '@compose-ui/core'
import { qmlColor, qmlNumber, type QmlObject } from './qml-writer'
import { STATIC_VALUE, type QmlBoundValue } from './qml-binding'

interface Point {
  readonly x: number
  readonly y: number
}

/**
 * 几何空间到盒空间的映射。
 *
 * @remarks
 * 预览把几何放进自己的 `viewBox`、`preserveAspectRatio="none"` 拉到盒上，因此这是一个**逐轴
 * 缩放 + 平移**。这里照搬同一个仿射，而不是走 `projectComposeCurveToBox`：后者在非等比时把
 * 弧拍扁成折线（那是命中与捕捉的近似），而预览画的是被拉扁的**真椭圆弧**——导出要对得上的是
 * 预览，所以弧在这里映射成两个半径各自缩放的椭圆弧，逐像素与 SVG 一致。
 */
interface BoxMapping {
  readonly scaleX: number
  readonly scaleY: number
  map(point: Point): Point
}

function boxMapping(curve: ComposeCurve, size: { readonly width: number; readonly height: number }): BoxMapping {
  const view = composeCurveViewBox(curve)
  const scaleX = size.width / view.width
  const scaleY = size.height / view.height
  return {
    scaleX,
    scaleY,
    map: (point) => ({ x: (point.x - view.x) * scaleX, y: (point.y - view.y) * scaleY }),
  }
}

function obj(type: string, properties: QmlObject['properties'], children: QmlObject[] = []): QmlObject {
  return { type, properties, children }
}

function pathLine(point: Point): QmlObject {
  return obj('PathLine', [['x', qmlNumber(point.x)], ['y', qmlNumber(point.y)]])
}

/**
 * 一段弧在盒空间里的 `PathArc`。
 *
 * @remarks
 * SVG 的 sweep-flag 1 与 Qt 的 `Clockwise` 在 y 向下的坐标里是同一个方向；文档里正的扫掠角
 * 也是这个方向（`composeArcPointAt` 按 y 向下取点）。
 */
function pathArc(arc: ComposeArcShape, mapping: BoxMapping, end: Point): QmlObject {
  return obj('PathArc', [
    ['x', qmlNumber(end.x)],
    ['y', qmlNumber(end.y)],
    ['radiusX', qmlNumber(arc.radius * mapping.scaleX)],
    ['radiusY', qmlNumber(arc.radius * mapping.scaleY)],
    ...(Math.abs(arc.sweep) > 180 ? [['useLargeArc', 'true'] as const] : []),
    ['direction', arc.sweep >= 0 ? 'PathArc.Clockwise' : 'PathArc.Counterclockwise'],
  ])
}

/** 一条子路径：起点与它后面的路径元素。 */
interface Subpath {
  readonly start: Point
  readonly elements: readonly QmlObject[]
}

/**
 * 按 kind 产出盒空间里的子路径。
 *
 * @remarks
 * 闭合不靠「首尾相同」推断，而是显式补一段回到起点：`ShapePath` 只在**整条路径**的终点等于
 * 起点时才把它当闭合处理，多子路径时这条推断对后面的子路径不成立。
 */
function curveSubpaths(curve: ComposeCurve, mapping: BoxMapping): readonly Subpath[] {
  if (curve.kind === 'line') {
    return [{ start: mapping.map(curve.start), elements: [pathLine(mapping.map(curve.end))] }]
  }
  if (curve.kind === 'arc') {
    if (isComposeFullCircle(curve)) {
      // 整圆拆成两个半圆：起终点重合的单段弧画不出东西（SVG 的 `A` 与 Qt 的 `PathArc` 都是）。
      // 起点取 0° 并顺时针走，与 SVG `<circle>` 的描边起点与方向一致，虚线因此从同一处开始。
      const half = { ...curve, startAngle: 0, sweep: 180 }
      const start = mapping.map(composeArcPointAt(curve, 0))
      return [{
        start,
        elements: [
          pathArc(half, mapping, mapping.map(composeArcPointAt(curve, 180))),
          pathArc(half, mapping, start),
        ],
      }]
    }
    const [start, end] = composeArcEndpoints(curve)
    return [{ start: mapping.map(start), elements: [pathArc(curve, mapping, mapping.map(end))] }]
  }
  if (curve.kind === 'polyline') {
    const first = curve.vertices[0]
    if (!first) return []
    if (curve.cornerRadius) {
      // 圆角走 core 求出的那一列轮廓片段——命中、框选与预览读的也是这一列。片段在几何空间里
      // 求，再整体映射：预览就是先在几何空间画圆角、再交给 viewBox 拉伸的。
      const pieces = composePolylineOutline(curve)
      const head = pieces[0]
      if (!head) return []
      const origin = head.kind === 'segment' ? head.segment.start : composeArcEndpoints(head.arc)[0]
      const elements = pieces.map((piece) => (piece.kind === 'segment'
        ? pathLine(mapping.map(piece.segment.end))
        : pathArc(piece.arc, mapping, mapping.map(composeArcEndpoints(piece.arc)[1]))))
      return [{
        start: mapping.map(origin),
        elements: curve.closed ? [...elements, pathLine(mapping.map(origin))] : elements,
      }]
    }
    const elements = curve.vertices.slice(1).map((vertex) => pathLine(mapping.map(vertex)))
    return [{
      start: mapping.map(first),
      elements: curve.closed ? [...elements, pathLine(mapping.map(first))] : elements,
    }]
  }
  return curve.subpaths.map((subpath) => {
    const start = mapping.map(subpath.start)
    const elements = subpath.segments.map((segment) => {
      const c1 = mapping.map(segment.c1)
      const c2 = mapping.map(segment.c2)
      const to = mapping.map(segment.to)
      return obj('PathCubic', [
        ['control1X', qmlNumber(c1.x)],
        ['control1Y', qmlNumber(c1.y)],
        ['control2X', qmlNumber(c2.x)],
        ['control2Y', qmlNumber(c2.y)],
        ['x', qmlNumber(to.x)],
        ['y', qmlNumber(to.y)],
      ])
    })
    return { start, elements: subpath.closed ? [...elements, pathLine(start)] : elements }
  })
}

/**
 * 一条曲线在几何空间里两端的切向（指向曲线外侧）。
 *
 * @remarks
 * 箭头 marker 用 `orient="auto-start-reverse"`：终点沿行进方向、起点**反向**，两端的箭头都
 * 朝外。这里直接给出朝外的方向，调用方不必再区分两端。
 */
function outwardTangents(curve: ComposeCurve): { readonly start: Point; readonly end: Point } | null {
  const diff = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })
  if (curve.kind === 'line') {
    return { start: diff(curve.start, curve.end), end: diff(curve.end, curve.start) }
  }
  if (curve.kind === 'polyline') {
    const vertices = curve.vertices
    if (vertices.length < 2) return null
    return {
      start: diff(vertices[0]!, vertices[1]!),
      end: diff(vertices[vertices.length - 1]!, vertices[vertices.length - 2]!),
    }
  }
  if (curve.kind === 'arc') {
    // 沿角度增大方向的切向是 (−sin, cos)；扫掠为负时行进方向相反。
    const tangentAt = (degrees: number, sign: number): Point => {
      const radians = (degrees * Math.PI) / 180
      return { x: -Math.sin(radians) * sign, y: Math.cos(radians) * sign }
    }
    const sign = curve.sweep >= 0 ? 1 : -1
    return {
      start: tangentAt(curve.startAngle, -sign),
      end: tangentAt(curve.startAngle + curve.sweep, sign),
    }
  }
  const first = curve.subpaths[0]
  const last = curve.subpaths[curve.subpaths.length - 1]
  const head = first?.segments[0]
  const tail = last?.segments[last.segments.length - 1]
  if (!first || !last || !head || !tail) return null
  // 控制点可能与端点重合（直线段升阶时就是这样），取第一个与端点不重合的点量方向。
  const away = (from: Point, candidates: readonly Point[]) => {
    const other = candidates.find((point) => point.x !== from.x || point.y !== from.y)
    return other ? diff(from, other) : { x: 0, y: 0 }
  }
  return {
    start: away(first.start, [head.c1, head.c2, head.to]),
    end: away(tail.to, [tail.c2, tail.c1, last.segments.length > 1 ? last.segments[last.segments.length - 2]!.to : last.start]),
  }
}

/**
 * 一端的箭头三角形，盒空间坐标。
 *
 * @remarks
 * 照搬预览的 marker：`viewBox 0 0 6 6`、路径 `M0,0 L6,3 L0,6 Z`、参考点 `(5,3)` 落在端点上、
 * `markerUnits="strokeWidth"`。marker 画在几何空间里、跟着 `viewBox` 一起被拉伸（非等比盒里
 * 箭头跟着扁），所以先在几何空间求三个顶点再整体映射。
 */
function arrowHead(tip: Point, direction: Point, strokeWidth: number, mapping: BoxMapping): readonly Point[] {
  const length = Math.hypot(direction.x, direction.y)
  if (length === 0) return []
  const ux = direction.x / length
  const uy = direction.y / length
  const place = (mx: number, my: number): Point => {
    const along = (mx - 5) * strokeWidth
    const across = (my - 3) * strokeWidth
    return mapping.map({ x: tip.x + ux * along - uy * across, y: tip.y + uy * along + ux * across })
  }
  return [place(0, 0), place(6, 3), place(0, 6)]
}

function curveEndpoints(curve: ComposeCurve): { readonly start: Point; readonly end: Point } | null {
  if (curve.kind === 'line') return { start: curve.start, end: curve.end }
  if (curve.kind === 'polyline') {
    const first = curve.vertices[0]
    const last = curve.vertices[curve.vertices.length - 1]
    return first && last ? { start: first, end: last } : null
  }
  if (curve.kind === 'arc') {
    const [start, end] = composeArcEndpoints(curve)
    return { start, end }
  }
  const first = curve.subpaths[0]
  const last = curve.subpaths[curve.subpaths.length - 1]
  const tail = last?.segments[last.segments.length - 1]
  return first && tail ? { start: first.start, end: tail.to } : null
}

function linecap(value: unknown): 'butt' | 'round' | 'square' {
  return value === 'round' || value === 'square' ? value : 'butt'
}

const CAP_STYLE = {
  butt: 'ShapePath.FlatCap',
  round: 'ShapePath.RoundCap',
  square: 'ShapePath.SquareCap',
} as const

/**
 * 一条曲线的 `Shape`。
 *
 * @param curve - 几何空间中的曲线
 * @param props - Renderer props（描边、线帽、虚线、箭头）
 * @param fill - `getComposeCurveFill` 的结果；`null` 即空心
 * @param size - 盒尺寸
 * @param bound - 被绑定 prop 的表达式；缺省一律静态
 */
export function curveShape(
  curve: ComposeCurve,
  props: JsonObject,
  fill: string | null,
  size: { readonly width: number; readonly height: number },
  bound: QmlBoundValue = STATIC_VALUE,
): QmlObject {
  const mapping = boxMapping(curve, size)
  const stroke = typeof props.stroke === 'string' ? props.stroke : '#d8e2f1'
  const strokeWidth = typeof props.strokeWidth === 'number' && props.strokeWidth >= 0 ? props.strokeWidth : 1
  const dotted = props.strokeDasharray === '1 4'
  // 圆点线型必须配 round cap，否则零长度 dash 画不出任何东西——与预览同一条规则。
  const cap = dotted ? 'round' : linecap(props.strokeLinecap)
  const subpaths = curveSubpaths(curve, mapping)
  const [first, ...rest] = subpaths

  const strokeProperties: (readonly [string, string])[] = strokeWidth === 0
    // SVG 的线宽 0 什么都不画；Qt 的线宽 0 是一像素的 cosmetic 线。
    ? [['strokeColor', qmlColor('transparent')]]
    : [['strokeColor', bound('stroke', 'color', qmlColor(stroke))], ['strokeWidth', qmlNumber(strokeWidth)]]
  // Qt 的 dashPattern 与 dashOffset 以**线宽**为单位，SVG 是绝对长度；预览的图案本身又是线宽的
  // 倍数（`8 4` → 4w 2w，`1 4` → 0 2w），换算之后正好是与线宽无关的常数。
  const dash = strokeWidth > 0 && (props.strokeDasharray === '8 4' || dotted)
    ? [
        ['strokeStyle', 'ShapePath.DashLine'] as const,
        ['dashPattern', dotted ? '[0, 2]' : '[4, 2]'] as const,
        ...(typeof props.strokeDashoffset === 'number' && props.strokeDashoffset !== 0
          ? [['dashOffset', qmlNumber(props.strokeDashoffset / strokeWidth)] as const]
          : []),
      ]
    : []

  const paths: QmlObject[] = []
  if (first) {
    paths.push(obj('ShapePath', [
      ...strokeProperties,
      ['fillColor', qmlColor(fill ?? 'transparent')],
      // SVG 缺省是 nonzero，而 Qt 的缺省是 OddEvenFill；不显式写出，带洞以外的自交图形会多出洞。
      ['fillRule', curve.kind === 'path' && curve.fillRule === 'evenodd' ? 'ShapePath.OddEvenFill' : 'ShapePath.WindingFill'],
      ['capStyle', CAP_STYLE[cap]],
      // SVG 缺省是 miter、斜接上限 4；Qt 缺省是 bevel、上限 2。
      ['joinStyle', 'ShapePath.MiterJoin'],
      ['miterLimit', '4'],
      ...dash,
      ['startX', qmlNumber(first.start.x)],
      ['startY', qmlNumber(first.start.y)],
    ], [
      ...first.elements,
      ...rest.flatMap((subpath) => [
        obj('PathMove', [['x', qmlNumber(subpath.start.x)], ['y', qmlNumber(subpath.start.y)]]),
        ...subpath.elements,
      ]),
    ]))
  }

  const endpoints = curveEndpoints(curve)
  const tangents = outwardTangents(curve)
  const arrows = endpoints && tangents && strokeWidth > 0
    ? [
        props.markerStart === 'arrow' ? arrowHead(endpoints.start, tangents.start, strokeWidth, mapping) : [],
        props.markerEnd === 'arrow' ? arrowHead(endpoints.end, tangents.end, strokeWidth, mapping) : [],
      ].filter((points) => points.length === 3)
    : []
  for (const [a, b, c] of arrows) {
    paths.push(obj('ShapePath', [
      ['strokeColor', qmlColor('transparent')],
      // 箭头是描边色的实心三角，跟着同一个绑定走。
      ['fillColor', bound('stroke', 'color', qmlColor(stroke))],
      ['startX', qmlNumber(a!.x)],
      ['startY', qmlNumber(a!.y)],
    ], [pathLine(b!), pathLine(c!), pathLine(a!)]))
  }

  return obj('Shape', [
    ['width', qmlNumber(size.width)],
    ['height', qmlNumber(size.height)],
    // 细线与斜线的抗锯齿：CurveRenderer 在 GPU 上按曲线方程着色，不依赖多重采样。
    ['preferredRendererType', 'Shape.CurveRenderer'],
  ], paths)
}
