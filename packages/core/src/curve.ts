/**
 * `Curve` Component 的类型、校验、几何与归一化。
 *
 * @remarks
 * 曲线 Entity 是**带盒的普通 Entity**：位置的事实来源仍是 `LayoutItem.offset`，形状的事实
 * 来源是本 Component，盒尺寸是几何的派生（紧包围盒）。这样移动、位置/旋转关键帧、场景树、
 * 预览与撤销全部零改动可用——去掉盒才需要为每一条既有轨道再写一份曲线专用分支。
 *
 * 几何点使用**盒局部坐标**，且归一化后紧包围盒的左上角恒等于盒原点（见
 * {@link normalizeComposeCurveGeometry}）。
 * @packageDocumentation
 */

import {
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  type ComposeEntity,
  type ComposePosition,
  type ComposeSize,
  type JsonObject,
} from './document-types'
import {
  composeArcBoundsPoints,
  composePolylineSegments,
  flattenComposeArc,
  isComposeFullCircle,
  pointToComposeArcDistance,
  pointToComposeSegmentDistance,
} from './curve-geometry'
import { roundComposeGeometry } from './geometry-precision'

/**
 * 曲线的几何种类。
 *
 * @remarks
 * 新增 kind 是新增分支，既有文档一行不动——这正是当初把它留成联合类型的理由。
 * @public
 */
export type ComposeCurveKind = 'line' | 'arc' | 'polyline'

/** 直线段：两个盒局部端点。 @public */
export interface ComposeLineCurve extends JsonObject {
  readonly kind: 'line'
  readonly start: ComposePosition
  readonly end: ComposePosition
}

/**
 * 圆弧：盒局部圆心、半径、起始角与**带符号的扫掠角**。
 *
 * @remarks
 * **整圆是 `sweep` 绝对值为 360 的弧，不另立类型**：归一化、平移、距离、特征点、渲染与校验
 * 六条路径因此各只有一份实现，整圆自然退化成「角度包含判断永远为真」的那一支。渲染是唯一
 * 分支的地方——SVG 的 `A` 命令在起终点重合时画不出东西，整圆走 `<circle>`。
 *
 * 用扫掠角而不是终止角：单给终止角分不出 10° 的短弧与 350° 的长弧，而这个歧义只在特定角度
 * 组合下现形。
 *
 * @public
 */
export interface ComposeArcCurve extends JsonObject {
  readonly kind: 'arc'
  readonly center: ComposePosition
  readonly radius: number
  readonly startAngle: number
  readonly sweep: number
}

/**
 * 多段线：盒局部顶点序列加闭合标志。
 *
 * @remarks
 * **矩形是四顶点的闭合多段线，不另立类型**：矩形没有任何多段线没有的性质，另立类型只会让
 * 六条路径各多一支逐字相同的实现；它唯一多出来的「四角是直角」在用户拖动某个顶点之后就
 * 不再成立。
 *
 * `closed` 是布尔而不是「首尾顶点重复」：重复表示法里 `[A,B,C,A]` 是闭合三角形还是回到起点
 * 的开放折线无法区分，而两者在框选与捕捉上给出不同候选——重复的那个顶点会产生两个端点候选。
 *
 * @public
 */
export interface ComposePolylineCurve extends JsonObject {
  readonly kind: 'polyline'
  readonly vertices: readonly ComposePosition[]
  readonly closed: boolean
}

/**
 * 可选的 `Curve` Component。
 *
 * @remarks
 * MUST 与 `Renderer` 组合（曲线要被画出来），MUST NOT 与 `Hierarchy` 组合（曲线不是容器）。
 * 组合规则由 `validateComposeDocument` 强制。
 * @public
 */
export type ComposeCurve = ComposeLineCurve | ComposeArcCurve | ComposePolylineCurve

/**
 * 归一化后盒在退化轴上的最小尺寸。
 *
 * @remarks
 * 水平线的紧包围盒高为 0，而 `LayoutItem` 的尺寸校验要求**有限正数**。为一根线放宽整个盒
 * 协议不值，因此退化轴钳到这个值；几何点不受影响——渲染与命中都读几何而不读盒。
 * @public
 */
export const COMPOSE_CURVE_MIN_EXTENT = 1

/** Curve 候选值的字段级问题。 @internal */
export interface ComposeCurveValidationIssue {
  readonly path: readonly (string | number)[]
  readonly message: string
}

const LINE_FIELDS = ['kind', 'start', 'end'] as const
const ARC_FIELDS = ['kind', 'center', 'radius', 'startAngle', 'sweep'] as const
const POLYLINE_FIELDS = ['kind', 'vertices', 'closed'] as const
const POINT_FIELDS = ['x', 'y'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collectUnknownFields(
  value: Record<string, unknown>,
  known: readonly string[],
  basePath: readonly (string | number)[],
  issues: ComposeCurveValidationIssue[],
) {
  const allowed = new Set<string>(known)
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) {
      issues.push({ path: [...basePath, key], message: `未知字段 ${key}` })
    }
  })
}

function collectPointIssues(
  value: unknown,
  basePath: readonly (string | number)[],
  issues: ComposeCurveValidationIssue[],
) {
  if (!isRecord(value)) {
    issues.push({ path: basePath, message: '端点必须是对象' })
    return
  }
  collectUnknownFields(value, POINT_FIELDS, basePath, issues)
  POINT_FIELDS.forEach((key) => {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) {
      issues.push({ path: [...basePath, key], message: `${key} 必须是有限数` })
    }
  })
}

/**
 * 收集 Curve 候选值的字段级问题。
 *
 * @internal
 */
export function collectComposeCurveValidationIssues(
  value: unknown,
): readonly ComposeCurveValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path: [], message: 'Curve 必须是对象' }]
  }
  // 未知 kind 必须拒绝而不是静默忽略：静默忽略会让一条画好的曲线在升级后无声消失。
  if (value.kind !== 'line' && value.kind !== 'arc' && value.kind !== 'polyline') {
    return [{ path: ['kind'], message: `不支持的 kind ${String(value.kind)}` }]
  }
  const issues: ComposeCurveValidationIssue[] = []
  if (value.kind === 'line') {
    collectUnknownFields(value, LINE_FIELDS, [], issues)
    collectPointIssues(value.start, ['start'], issues)
    collectPointIssues(value.end, ['end'], issues)
    return issues
  }

  if (value.kind === 'arc') {
    collectUnknownFields(value, ARC_FIELDS, [], issues)
    collectPointIssues(value.center, ['center'], issues)
    // 半径为零的圆与扫掠为零的弧是同一类幽灵：屏幕上什么都没有，点不中也删不掉。
    if (typeof value.radius !== 'number' || !Number.isFinite(value.radius) || value.radius <= 0) {
      issues.push({ path: ['radius'], message: 'radius 必须是有限正数' })
    }
    if (typeof value.startAngle !== 'number' || !Number.isFinite(value.startAngle)) {
      issues.push({ path: ['startAngle'], message: 'startAngle 必须是有限数' })
    }
    if (typeof value.sweep !== 'number' || !Number.isFinite(value.sweep) || value.sweep === 0) {
      issues.push({ path: ['sweep'], message: 'sweep 必须是非零有限数' })
    }
    return issues
  }

  collectUnknownFields(value, POLYLINE_FIELDS, [], issues)
  if (typeof value.closed !== 'boolean') {
    issues.push({ path: ['closed'], message: 'closed 必须是布尔' })
  }
  if (!Array.isArray(value.vertices) || value.vertices.length < 2) {
    issues.push({ path: ['vertices'], message: 'vertices 至少要有两个顶点' })
    return issues
  }
  value.vertices.forEach((vertex, index) => {
    collectPointIssues(vertex, ['vertices', index], issues)
  })
  return issues
}

/** 判断未知输入是否为完整、严格的 Curve。 @public */
export function isValidComposeCurve(value: unknown): value is ComposeCurve {
  return collectComposeCurveValidationIssues(value).length === 0
}

/** 读取 Entity 上可选的 Curve。 @public */
export function getComposeCurve(entity: ComposeEntity | undefined): ComposeCurve | undefined {
  return entity?.components[COMPOSE_BUILTIN_COMPONENT_KEYS.curve] as ComposeCurve | undefined
}

/**
 * 创建一条直线段 Curve。
 *
 * @remarks
 * 端点接受任意 `{ x, y }`：调用方手里通常是屏幕/世界坐标这类结构类型，逼它们先转成带索引
 * 签名的 `ComposePosition` 只会让每个调用点多一次重建。
 *
 * @public
 */
export function createComposeLineCurve(
  start: { readonly x: number; readonly y: number },
  end: { readonly x: number; readonly y: number },
): ComposeLineCurve {
  return { kind: 'line', start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } }
}

/**
 * 决定曲线**紧包围盒**的那组点。
 *
 * @remarks
 * 只服务包围盒。**不要拿它当端点集合用**：对弧它返回的是端点加落在扫掠内的象限点，
 * 当成端点会让象限点以端点优先级参与捕捉，还会凭空造出一批相邻点的中点。捕捉的特征点由
 * `stage-engine` 自己按 kind 分派。
 *
 * 平移也不复用它：弧平移只搬圆心，半径与角度是形状本身。
 * @public
 */
export function composeCurvePoints(curve: ComposeCurve): readonly ComposePosition[] {
  if (curve.kind === 'line') return [curve.start, curve.end]
  if (curve.kind === 'polyline') return curve.vertices
  // 弧不能只用两个端点：90° 到 270° 的弧鼓出来的那一侧在端点之外，盒会把弧裁掉一块，
  // 而这只在跨象限的弧上出现。落在扫掠内的象限点必须一并纳入。
  return composeArcBoundsPoints(curve).map(({ x, y }) => ({ x, y }))
}

/** 曲线的紧包围盒；**不**做退化轴钳制。 @public */
export function composeCurveBounds(
  curve: ComposeCurve,
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const points = composeCurvePoints(curve)
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

/** 平移曲线的全部几何点。 @public */
export function translateComposeCurve(
  curve: ComposeCurve,
  dx: number,
  dy: number,
): ComposeCurve {
  // `+ 0` 把 `-0` 归一成 `0`：归一化平移的位移是 `-bounds.x`，正好在原点上产出 `-0`。
  // JSON 序列化会把它写成 `0`，因此内存里的 `-0` 是一个只在 `Object.is` 与断言里现形的
  // 幽灵差异。
  const round = (value: number) => roundComposeGeometry(value) + 0
  const shift = (point: ComposePosition): ComposePosition => ({
    x: round(point.x + dx),
    y: round(point.y + dy),
  })
  if (curve.kind === 'line') return { ...curve, start: shift(curve.start), end: shift(curve.end) }
  if (curve.kind === 'polyline') return { ...curve, vertices: curve.vertices.map(shift) }
  // 弧只动圆心：半径与角度是形状本身，平移不改变它们。
  return { ...curve, center: shift(curve.center) }
}

/** {@link normalizeComposeCurveGeometry} 的结果。 @public */
export interface ComposeNormalizedCurveGeometry {
  /** 盒局部几何；紧包围盒左上角恒为 `(0, 0)`。 */
  readonly curve: ComposeCurve
  /** 盒相对 parent 的位置，等于输入几何紧包围盒的左上角。 */
  readonly offset: ComposePosition
  /** 盒尺寸，退化轴钳到 {@link COMPOSE_CURVE_MIN_EXTENT}。 */
  readonly size: ComposeSize
}

/**
 * 把 parent 局部坐标下的几何归一化成「盒 + 盒局部几何」。
 *
 * @remarks
 * 这是曲线几何写入的**唯一**换算：盒落在紧包围盒左上角，几何随之平移，退化轴钳到最小尺寸。
 * 归一化不变量——盒局部几何的最小 x 与最小 y 恒为 0——让渲染可以直接把几何画进盒坐标系，
 * 也让命中的窄相位不必再补一次偏移。
 *
 * 数值统一经 `roundComposeGeometry` 量化，与 `toComposeTransform` 同一条规矩。
 *
 * @param curve - parent 局部坐标下的几何
 * @public
 */
export function normalizeComposeCurveGeometry(
  curve: ComposeCurve,
): ComposeNormalizedCurveGeometry {
  const bounds = composeCurveBounds(curve)
  return {
    curve: translateComposeCurve(curve, -bounds.x, -bounds.y),
    offset: { x: roundComposeGeometry(bounds.x), y: roundComposeGeometry(bounds.y) },
    size: {
      width: roundComposeGeometry(Math.max(bounds.width, COMPOSE_CURVE_MIN_EXTENT)),
      height: roundComposeGeometry(Math.max(bounds.height, COMPOSE_CURVE_MIN_EXTENT)),
    },
  }
}

/**
 * 几何空间的取景框。
 *
 * @remarks
 * 等于几何的紧包围盒，退化轴钳到 {@link COMPOSE_CURVE_MIN_EXTENT}。它就是渲染时写进 SVG
 * `viewBox` 的那四个数：盒与它的比例决定形状被拉伸多少。
 *
 * @public
 */
export interface ComposeCurveViewBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * 求几何空间的取景框。
 *
 * @remarks
 * 退化轴的钳值 MUST 与 `LayoutItem` 尺寸用的是同一个常量：它同时是渲染的分母与命中的分母，
 * 两处取不同的值会让水平线被拉伸一个说不清的比例。
 *
 * @public
 */
export function composeCurveViewBox(curve: ComposeCurve): ComposeCurveViewBox {
  const bounds = composeCurveBounds(curve)
  return {
    x: bounds.x,
    y: bounds.y,
    width: Math.max(bounds.width, COMPOSE_CURVE_MIN_EXTENT),
    height: Math.max(bounds.height, COMPOSE_CURVE_MIN_EXTENT),
  }
}

/** 盒相对几何空间的按轴比例。 @public */
export interface ComposeCurveBoxScale {
  readonly x: number
  readonly y: number
}

/**
 * 求盒相对几何空间的比例。
 *
 * @remarks
 * **按轴独立**，不取单一标量：盒可以被非等比地拉伸，强行取一个比例会画出一个用户从未画过
 * 的形状。分母来自 {@link composeCurveViewBox}，因此不会除零。
 *
 * @public
 */
export function composeCurveBoxScale(
  curve: ComposeCurve,
  size: { readonly width: number; readonly height: number },
): ComposeCurveBoxScale {
  const view = composeCurveViewBox(curve)
  return { x: size.width / view.width, y: size.height / view.height }
}

/** 等比判定的容差；两个比例差到这个量级以内就当作等比。 */
const UNIFORM_SCALE_EPSILON = 1e-6

/**
 * 把几何映射进盒坐标系。
 *
 * @remarks
 * 这是**盒与几何之间唯一的换算**：渲染由浏览器按 `viewBox` 完成，而命中与捕捉调用本函数，
 * 之后下游（`distanceToComposeCurve`、特征点、包围盒）一行不改——它们拿到的已经是盒坐标系
 * 里的几何。各自算一遍的话，下一个改盒语义的人只会改到其中一处，而漏掉的那处症状是
 * 「某些缩放下点不中」。
 *
 * **弧按缩放是否等比分流**：等比仍是精确弧，非等比拍扁成多段线。照抄 `cad` 侧块内弧的既有
 * 判断——按某一轴的比例硬算成圆会画出一个用户从未画过的形状；一律拍扁会让圆心与象限点消失，
 * 而它们不是任何线段的特征点。
 *
 * 结果是**瞬态**的，不进文档，因此不做几何量化：量化是写入漏斗的规矩，在这里只会白丢精度。
 *
 * @param curve - 几何空间中的曲线
 * @param size - 目标盒尺寸
 * @returns 盒坐标系中的曲线；比例为 1 时原样返回
 * @public
 */
export function projectComposeCurveToBox(
  curve: ComposeCurve,
  size: { readonly width: number; readonly height: number },
): ComposeCurve {
  const view = composeCurveViewBox(curve)
  const scaleX = size.width / view.width
  const scaleY = size.height / view.height
  if (scaleX === 1 && scaleY === 1 && view.x === 0 && view.y === 0) return curve
  const map = (point: { readonly x: number; readonly y: number }): ComposePosition => ({
    x: (point.x - view.x) * scaleX,
    y: (point.y - view.y) * scaleY,
  })
  if (curve.kind === 'line') return { ...curve, start: map(curve.start), end: map(curve.end) }
  if (curve.kind === 'polyline') return { ...curve, vertices: curve.vertices.map(map) }
  if (Math.abs(scaleX - scaleY) <= UNIFORM_SCALE_EPSILON) {
    return { ...curve, center: map(curve.center), radius: curve.radius * scaleX }
  }
  const segments = flattenComposeArc(curve)
  const first = segments[0]
  if (!first) return { ...curve, center: map(curve.center), radius: curve.radius * scaleX }
  return {
    kind: 'polyline',
    vertices: [map(first.start), ...segments.map((segment) => map(segment.end))],
    // 整圆拍扁后是闭合多段线；开放弧的首尾不相接，闭合它会凭空多出一条弦。
    closed: isComposeFullCircle(curve),
  }
}

/**
 * 点到曲线的距离。
 *
 * @remarks
 * 曲线的命中判据是**点到几何的距离**而不是包围盒——一条对角线的包围盒里绝大部分是空的，
 * 按盒判定会让两条交叉线互相遮挡对方的命中区。
 *
 * 点与曲线必须在同一坐标系（通常是 Entity 局部坐标，由调用方完成换算），因此旋转后的命中
 * 自动正确。
 *
 * @public
 */
export function distanceToComposeCurve(
  curve: ComposeCurve,
  point: { readonly x: number; readonly y: number },
): number {
  if (curve.kind === 'line') return pointToComposeSegmentDistance(curve, point)
  // 弧有闭式解，比线段还便宜：方位角落在扫掠内时距离就是 `|到圆心距离 − 半径|`。
  if (curve.kind === 'arc') return pointToComposeArcDistance(curve, point)
  const segments = composePolylineSegments(curve.vertices, curve.closed)
  // 单顶点多段线（校验会拒，但命中不该因此抛错）退化成到那个点的距离。
  if (segments.length === 0) {
    const first = curve.vertices[0]
    return first ? Math.hypot(point.x - first.x, point.y - first.y) : Number.POSITIVE_INFINITY
  }
  return segments.reduce(
    (nearest, segment) => Math.min(nearest, pointToComposeSegmentDistance(segment, point)),
    Number.POSITIVE_INFINITY,
  )
}
