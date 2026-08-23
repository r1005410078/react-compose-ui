import {
  composeArcEndpoints,
  getComposeCurve,
  isComposeFullCircle,
  type ComposeArcCurve,
  type ComposeCurve,
  type ComposePolylineCurve,
} from '@compose-ui/core'
import type { ComposeRendererProps } from '@compose-ui/component-registry'
import { DEFAULT_CURVE_GEOMETRY } from './defaults'

type StrokeLinecap = 'butt' | 'round' | 'square'

/** 命中 stroke 的最小屏幕宽度；细线只有 1–2px，按视觉宽度取命中会让用户反复点空。 */
const MIN_HIT_WIDTH = 12

function linecap(value: unknown): StrokeLinecap {
  return value === 'round' || value === 'square' ? value : 'butt'
}

function dasharray(value: unknown, strokeWidth: number): string | undefined {
  if (value === '8 4') return `${strokeWidth * 4} ${strokeWidth * 2}`
  // 零长度 dash 配合 round cap 才是圆点；间距随线宽变化，避免粗线退化成密集短竖条。
  if (value === '1 4') return `0 ${strokeWidth * 2}`
  return undefined
}

/**
 * 曲线 Renderer。
 *
 * @remarks
 * 几何来自 `Curve` Component 而不是 Props——它是文档级契约，命中、捕捉与未来的导线求解
 * 都读同一份。Props 只承载描边。
 *
 * 命中由**透明的加宽 stroke** 承担，SVG 自身 `pointer-events: none`：一条对角线的外接矩形
 * 里绝大部分是空的，让整个盒可点会让空白区抢走下层内容的点击。
 *
 * @internal
 */
/**
 * 弧的 SVG `path` 数据。
 *
 * @remarks
 * 整圆不走这里：`A` 命令在起终点重合时**画不出东西**，因此整圆用 `<circle>`。这是「整圆是
 * 扫掠 ±360 的弧」这条判断里唯一需要分支的地方。
 */
function arcPathData(curve: ComposeArcCurve): string {
  const [start, end] = composeArcEndpoints(curve)
  const sweepFlag = curve.sweep >= 0 ? 1 : 0
  const largeArc = Math.abs(curve.sweep) > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${curve.radius} ${curve.radius} 0 ${largeArc} ${sweepFlag} ${end.x} ${end.y}`
}

function polylinePoints(curve: ComposePolylineCurve): string {
  return curve.vertices.map(({ x, y }) => `${x},${y}`).join(' ')
}

/**
 * 按 `kind` 产出几何元素。
 *
 * @remarks
 * 多段线是**一个** `<polyline>` / `<polygon>` 而不是 N 个 `<line>`：命中由
 * `pointer-events: stroke` 天然承担，与直线用的是同一个机制。CAD 侧那句「一条多段线在 DOM 里
 * 是 N 个 `<line>`」的代价在这边不存在。
 */
function geometryElement(
  curve: ComposeCurve,
  shared: Record<string, unknown>,
) {
  if (curve.kind === 'line') {
    return <line {...shared} x1={curve.start.x} x2={curve.end.x} y1={curve.start.y} y2={curve.end.y} />
  }
  if (curve.kind === 'arc') {
    if (isComposeFullCircle(curve)) {
      return <circle {...shared} cx={curve.center.x} cy={curve.center.y} r={curve.radius} />
    }
    return <path {...shared} d={arcPathData(curve)} />
  }
  const points = polylinePoints(curve)
  return curve.closed
    ? <polygon {...shared} points={points} />
    : <polyline {...shared} points={points} />
}

export function CurveRenderer({ entity, props }: ComposeRendererProps) {
  const curve = getComposeCurve(entity) ?? DEFAULT_CURVE_GEOMETRY
  const stroke = typeof props.stroke === 'string' ? props.stroke : '#d8e2f1'
  const strokeWidth = typeof props.strokeWidth === 'number' && props.strokeWidth >= 0
    ? props.strokeWidth
    : 2
  const cap = linecap(props.strokeLinecap)
  const pattern = dasharray(props.strokeDasharray, strokeWidth)

  return (
    <svg
      aria-label="Curve"
      className="compose-material compose-material--curve"
      data-testid={`compose-material-curve-${entity.id}`}
      fill="none"
      role="img"
    >
      {geometryElement(curve, {
        'data-testid': 'compose-material-curve-hit',
        pointerEvents: 'stroke',
        stroke: 'transparent',
        strokeLinecap: 'round',
        strokeWidth: Math.max(MIN_HIT_WIDTH, strokeWidth * 2),
      })}
      {geometryElement(curve, {
        'data-testid': 'compose-material-curve-stroke',
        stroke,
        strokeDasharray: pattern,
        // 圆点线型必须配 round cap，否则零长度 dash 画不出任何东西。
        strokeLinecap: props.strokeDasharray === '1 4' ? 'round' : cap,
        strokeWidth,
      })}
    </svg>
  )
}
