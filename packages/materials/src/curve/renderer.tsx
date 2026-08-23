import {
  composeArcEndpoints,
  composeCurveViewBox,
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

/**
 * 把线宽换算成**屏幕像素**：反向除掉画布发下来的缩放。
 *
 * @remarks
 * 属性上仍留着作者写的那个数（页面单位，也是 jsdom 里读得到的那一份），CSS 覆盖它决定实际
 * 绘制宽度。两处不是两份事实来源——它们是同一个数的两种单位，换算因子只有 `--compose-canvas-zoom`
 * 一个，缺席即 1。
 */
function screenWidth(width: number) {
  return { strokeWidth: `calc(${width}px / var(--compose-canvas-zoom, 1))` }
}

function dasharray(value: unknown, strokeWidth: number): string | undefined {
  if (value === '8 4') return `${strokeWidth * 4} ${strokeWidth * 2}`
  // 零长度 dash 配合 round cap 才是圆点；间距随线宽变化，避免粗线退化成密集短竖条。
  if (value === '1 4') return `0 ${strokeWidth * 2}`
  return undefined
}

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
 * **线宽是显示宽度（AutoCAD 的 lineweight），不跟着画布缩放走。**Stage 的 Scene 是一棵靠
 * `transform: scale(zoom)` 整体缩放的 DOM 树（HTML 物料指着它活），曲线的 `stroke-width`
 * 因此会被浏览器乘一遍 zoom：实测适配缩放 0.376 时屏幕上只剩 0.75px、放大到 4.22 倍时涨到
 * 8.4px。三个症状同一个根因——放大变粗、缩小时落到子像素而**同一批线看起来有粗有细**、
 * 尖角的 round cap 跟着涨到 8px 把 `LINE` 逐段落地的折线顶端磨圆。
 *
 * 做法是**反向除掉画布缩放**：`calc(<宽度>px / var(--compose-canvas-zoom, 1))`。
 * `vector-effect: non-scaling-stroke` 试过，**在这里不管用**——它只中和 SVG 文档片段*内部*
 * 的变换，而这里的缩放来自 SVG 之外的 HTML 祖先；computed 值会老老实实是
 * `non-scaling-stroke` 而描边照样跟着涨，因此只断言属性生效的用例会全绿。判别用的量具是
 * 沿法向扫 `elementFromPoint` 量出**实际触达**。
 *
 * 变量缺席即 1，因此预览与任何不发这个变量的宿主自动回到页面单位——`ComposePreview` 的
 * `fit` 会整体缩放页面，那里的线宽必须跟着缩才是页面的忠实缩略图。物料因此不需要认识
 * 「编辑期还是渲染期」。
 *
 * `strokeDasharray` **不除**：间隔是图上的实际长度（AutoCAD 的 linetype），跟着缩放变才
 * 携带长度信息。两者一个除一个不除是照抄 CAD 的判断，不是漏写。
 *
 * **`vector-effect: non-scaling-stroke` 与上面那条不重复，两者各中和一段变换。**
 *
 * | 变换来源 | 谁中和它 |
 * | --- | --- |
 * | `viewBox` → 盒（非等比时把线宽拉成「横细竖粗」） | `vector-effect` |
 * | Stage Scene 外层 HTML 的 `transform: scale(zoom)` | `calc(px / --compose-canvas-zoom)` |
 *
 * 上面那句「`non-scaling-stroke` 在这里不管用」说的是**外层 HTML 变换**——它只中和 SVG 文档
 * 片段*内部*的变换。而 `viewBox` 恰恰就在片段内部，所以对它管用。两句结论都对，区别只在
 * 变换发生在 SVG 里面还是外面；不写清楚，下一个人会把这里的 `vector-effect` 当成无效代码
 * 删掉。
 *
 * 命中宽度跟着线宽一起除：`MIN_HIT_WIDTH` 表达的是鼠标容差，那本来就是屏幕量，留在世界单位
 * 会让它在缩小时不够点、放大时抢走旁边的东西。
 *
 * @internal
 */
export function CurveRenderer({ entity, props }: ComposeRendererProps) {
  const curve = getComposeCurve(entity) ?? DEFAULT_CURVE_GEOMETRY
  const stroke = typeof props.stroke === 'string' ? props.stroke : '#d8e2f1'
  // 回退值与 `DEFAULT_CURVE_PROPS.strokeWidth` 必须一致：发丝线，与 CAD 画布同值。
  const strokeWidth = typeof props.strokeWidth === 'number' && props.strokeWidth >= 0
    ? props.strokeWidth
    : 1
  const cap = linecap(props.strokeLinecap)
  const pattern = dasharray(props.strokeDasharray, strokeWidth)

  // 几何住在自己的取景框里，盒按比例把它拉开。`preserveAspectRatio="none"` 是重点：
  // 默认值会保持长宽比并留白，那样盒变了形状却不跟着变，等于这条能力没有生效。
  const view = composeCurveViewBox(curve)

  return (
    <svg
      aria-label="Curve"
      className="compose-material compose-material--curve"
      data-testid={`compose-material-curve-${entity.id}`}
      fill="none"
      preserveAspectRatio="none"
      role="img"
      viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
    >
      {geometryElement(curve, {
        'data-testid': 'compose-material-curve-hit',
        pointerEvents: 'stroke',
        vectorEffect: 'non-scaling-stroke',
        stroke: 'transparent',
        strokeLinecap: 'round',
        strokeWidth: Math.max(MIN_HIT_WIDTH, strokeWidth * 2),
        style: screenWidth(Math.max(MIN_HIT_WIDTH, strokeWidth * 2)),
      })}
      {geometryElement(curve, {
        'data-testid': 'compose-material-curve-stroke',
        stroke,
        vectorEffect: 'non-scaling-stroke',
        strokeDasharray: pattern,
        // 圆点线型必须配 round cap，否则零长度 dash 画不出任何东西。
        strokeLinecap: props.strokeDasharray === '1 4' ? 'round' : cap,
        strokeWidth,
        style: screenWidth(strokeWidth),
      })}
    </svg>
  )
}
