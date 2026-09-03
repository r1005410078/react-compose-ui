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
  composeCubicBoundsPoints,
  composeRoundedPolylineOutline,
  flattenComposeArc,
  flattenComposeCubic,
  flattenComposeOutline,
  isComposeFullCircle,
  pointToComposeArcDistance,
  pointToComposeCubicDistance,
  pointToComposeSegmentDistance,
  type ComposeCubicShape,
  type ComposeOutlinePiece,
  type ComposeSegmentShape,
} from './curve-geometry'
import { resolveComposeAppearance } from './appearance'
import { COMPOSE_GEOMETRY_PRECISION, roundComposeGeometry } from './geometry-precision'

/**
 * 曲线的几何种类。
 *
 * @remarks
 * 新增 kind 是新增分支，既有文档一行不动——这正是当初把它留成联合类型的理由。
 * @public
 */
export type ComposeCurveKind = 'line' | 'arc' | 'polyline' | 'path'

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
 * 用 `JsonObject &` 交叉而不是 `extends`：索引签名的 `JsonValue` 不接受 `undefined`，而
 * `cornerRadius` 是可选的；`ComposeWire` 与 `ComposeAppearance` 出于同样原因采用这种写法。
 *
 * @public
 */
export type ComposePolylineCurve = JsonObject & {
  readonly kind: 'polyline'
  readonly vertices: readonly ComposePosition[]
  readonly closed: boolean
  /**
   * 四角联动的圆角半径，几何空间；**缺席即尖角**。
   *
   * @remarks
   * 缺席即尖角这条回退让既有文档逐像素不变，因此本字段**不需要迁移**、协议版本不变。
   * 它同时是唯一的表示：半径拖回 0 时写入方 MUST 删掉这个字段而不是写 0——缺席与 0 是同一
   * 件事，留两种表示会让「有没有圆角」在两处读出不同答案。
   *
   * **一个值管所有角**而不是每个顶点一个。这让顶点类型保持 `{x, y}`，归一化、平移、DXF
   * 导入与已经画好的每一条折线都一个字节不改。每角独立是本字段向后兼容的一次扩展。
   *
   * 每个角实际画多大**在读取时钳制**（切线长不超过相邻两段各自长度的一半），钳制结果
   * **不回写**：这个数是作者的意图，此刻画多大是当前几何说了算。盒被拉窄时圆角自动收，
   * 拉回去原样回来。
   */
  readonly cornerRadius?: number
}

/**
 * 一段三次贝塞尔：两个控制点与终点，起点由前一段（或子路径起点）给出。
 *
 * @remarks
 * 不存起点是因为它**永远等于**前一段的终点，存两份就会有两份能对不上的事实；这与「`closed`
 * 是布尔而不是首尾顶点重复」是同一条判断。
 *
 * @public
 */
export interface ComposeCubicSegment extends JsonObject {
  readonly c1: ComposePosition
  readonly c2: ComposePosition
  readonly to: ComposePosition
}

/**
 * `path` 的一条子路径：一个起点、一列三次贝塞尔段与一个闭合标志。
 *
 * @remarks
 * 带洞的图形（字母 O、有孔的垫片）是**一条**路径的两条子路径，靠 `fillRule` 决定内圈是不是
 * 洞。拆成两个 Entity 会把洞画成一块实心的覆盖物，而用户看见的是「导进来多了一块色块」。
 *
 * @public
 */
export interface ComposeSubpath extends JsonObject {
  readonly start: ComposePosition
  readonly segments: readonly ComposeCubicSegment[]
  readonly closed: boolean
}

/**
 * 自由路径：子路径序列加可选的填充规则。
 *
 * @remarks
 * 段**全部是三次贝塞尔**，直线段规范化成控制点落在段上的三次段。多留一种段类型只会让归一化、
 * 平移、距离、包围盒、渲染与校验六条路径各多一支逐字相同的实现——与「整圆是扫掠 ±360 的弧」
 * 「矩形是四顶点的闭合多段线」是同一条判断。
 *
 * 写入方 MUST 取能表达该几何的**最窄** kind：能用 `line`、`arc` 或 `polyline` 表达的几何不落
 * 成 `path`。落错 kind 的症状是「这条线看起来一样却拖不动顶点」。
 *
 * 用 `JsonObject &` 交叉而不是 `extends`：索引签名的 `JsonValue` 不接受 `undefined`，而
 * `fillRule` 是可选的；`ComposePolylineCurve` 与 `ComposeWire` 出于同样原因采用这种写法。
 *
 * @public
 */
export type ComposePathCurve = JsonObject & {
  readonly kind: 'path'
  readonly subpaths: readonly ComposeSubpath[]
  /**
   * 填充规则；**缺席即非零绕数**（`nonzero`）。
   *
   * @remarks
   * 缺席即 `nonzero` 这条回退让本字段不需要迁移，也让它与 SVG 的默认值一致——渲染与命中因此
   * 自动读出同一个答案。`nonzero` MUST NOT 写成显式值：缺席与显式是同一件事，留两种表示会让
   * 「填充规则是什么」在两处读出不同答案，与 `cornerRadius` 归零时删掉字段是同一条判断。
   */
  readonly fillRule?: 'evenodd'
}

/**
 * 可选的 `Curve` Component。
 *
 * @remarks
 * MUST 与 `Renderer` 组合（曲线要被画出来），MUST NOT 与 `Hierarchy` 组合（曲线不是容器）。
 * 组合规则由 `validateComposeDocument` 强制。
 * @public
 */
export type ComposeCurve =
  | ComposeLineCurve
  | ComposeArcCurve
  | ComposePolylineCurve
  | ComposePathCurve

/**
 * 归一化后盒在退化轴上的最小尺寸。
 *
 * @remarks
 * 水平线的紧包围盒高为 0，而 `LayoutItem` 的尺寸校验要求**有限正数**。为一根线放宽整个盒
 * 协议不值，因此退化轴钳到这个值；几何点不受影响——渲染与命中都读几何而不读盒。
 * @public
 */
export const COMPOSE_CURVE_MIN_EXTENT = 1

/**
 * 曲线的拾取容差：点到几何的距离，单位是**屏幕 CSS 像素**。
 *
 * @remarks
 * 值照抄 AutoCAD `PICKBOX` 的默认值。它是抄来的而不是推来的——容差的对错只能在真实密度的
 * 图纸上判断，而这个默认值是几十年密集图纸用出来的。同一个仓库里已有反例：十字线臂长曾按
 * 「臂长与拾取框的比例」推导，理由听起来很硬，推出的值在实机上仍明显偏长，最终回到
 * `CURSORSIZE` 的默认值。
 *
 * 它住在 `core` 而不是各消费者本地，因为读它的是两个**互不依赖**的包：`materials`（命中层
 * 的 stroke 宽度）与 `stage`（点选那一档拾取框的默认半边长）。这与
 * `COMPOSE_SCENE_SIZE_PRESETS` 是同一条判断——各写一份必然漂移，而这里漂移的症状恰恰是
 * 「画出来的框与真实容差对不上」。
 *
 * **是屏幕量而不是世界量**：它表达鼠标能瞄多准，不随画布缩放变化。屏幕像素到世界单位的换算
 * 留在各消费者，`core` 因此不需要认识 DOM 或缩放。
 * @public
 */
export const COMPOSE_CURVE_PICK_TOLERANCE = 3

/** Curve 候选值的字段级问题。 @internal */
export interface ComposeCurveValidationIssue {
  readonly path: readonly (string | number)[]
  readonly message: string
}

const LINE_FIELDS = ['kind', 'start', 'end'] as const
const ARC_FIELDS = ['kind', 'center', 'radius', 'startAngle', 'sweep'] as const
const POLYLINE_FIELDS = ['kind', 'vertices', 'closed', 'cornerRadius'] as const
const PATH_FIELDS = ['kind', 'subpaths', 'fillRule'] as const
const SUBPATH_FIELDS = ['start', 'segments', 'closed'] as const
const CUBIC_FIELDS = ['c1', 'c2', 'to'] as const
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
  if (
    value.kind !== 'line'
    && value.kind !== 'arc'
    && value.kind !== 'polyline'
    && value.kind !== 'path'
  ) {
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

  if (value.kind === 'path') {
    collectUnknownFields(value, PATH_FIELDS, [], issues)
    // 缺席即 nonzero，因此显式写 `nonzero` 非法：同一件事留两种表示会让它在两处读出不同答案。
    if (value.fillRule !== undefined && value.fillRule !== 'evenodd') {
      issues.push({ path: ['fillRule'], message: 'fillRule 在场时只能是 evenodd' })
    }
    if (!Array.isArray(value.subpaths) || value.subpaths.length === 0) {
      issues.push({ path: ['subpaths'], message: 'subpaths 至少要有一条子路径' })
      return issues
    }
    value.subpaths.forEach((subpath, index) => {
      const base = ['subpaths', index] as const
      if (!isRecord(subpath)) {
        issues.push({ path: [...base], message: '子路径必须是对象' })
        return
      }
      collectUnknownFields(subpath, SUBPATH_FIELDS, base, issues)
      collectPointIssues(subpath.start, [...base, 'start'], issues)
      if (typeof subpath.closed !== 'boolean') {
        issues.push({ path: [...base, 'closed'], message: 'closed 必须是布尔' })
      }
      // 一条没有段的子路径只是一个点：画不出东西，也点不中——与半径为零的圆是同一类幽灵。
      if (!Array.isArray(subpath.segments) || subpath.segments.length === 0) {
        issues.push({ path: [...base, 'segments'], message: 'segments 至少要有一段' })
        return
      }
      subpath.segments.forEach((segment, segmentIndex) => {
        const segmentBase = [...base, 'segments', segmentIndex] as const
        if (!isRecord(segment)) {
          issues.push({ path: [...segmentBase], message: '贝塞尔段必须是对象' })
          return
        }
        collectUnknownFields(segment, CUBIC_FIELDS, segmentBase, issues)
        CUBIC_FIELDS.forEach((key) => {
          collectPointIssues(segment[key], [...segmentBase, key], issues)
        })
      })
    })
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
  // 在场就必须是有限正数：0 与缺席是同一件事，允许写 0 会让同一个状态有两种表示。
  if (value.cornerRadius !== undefined && (
    typeof value.cornerRadius !== 'number'
    || !Number.isFinite(value.cornerRadius)
    || value.cornerRadius <= 0
  )) {
    issues.push({ path: ['cornerRadius'], message: 'cornerRadius 在场时必须是有限正数' })
  }
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
 * 把 `path` 展开成有序的三次贝塞尔段。
 *
 * @remarks
 * 这是 `path` 的**唯一**展开入口：包围盒、距离、拍平与内部判定全部读它。各自遍历一遍
 * `subpaths` 的话，下一个改闭合语义的人只会改到其中一处，而漏掉的那处的症状是「看得见的形状
 * 与点得中的形状不是同一个」——这与圆角多段线收敛成一列轮廓片段是同一条判断。
 *
 * 闭合子路径的**收尾直段升阶成三次**（控制点落在弦上），因此下游不需要为「直的还是弯的」
 * 分两支；`flattenComposeCubic` 对这样一段恰好只产出一条线段。
 *
 * @public
 */
export function composePathCubics(curve: ComposePathCurve): readonly ComposeCubicShape[] {
  return curve.subpaths.flatMap(subpathCubics)
}

/** 一条子路径展开成的三次贝塞尔段；填充判定要按**子路径**取环，因此单独一份。 */
function subpathCubics(subpath: ComposeSubpath): readonly ComposeCubicShape[] {
  const cubics: ComposeCubicShape[] = []
  let start: ComposePosition = subpath.start
  subpath.segments.forEach((segment) => {
    cubics.push({ start, c1: segment.c1, c2: segment.c2, end: segment.to })
    start = segment.to
  })
  // 末点已经落在起点上时不补——那会产出一段零长度的段，它对形状没有贡献，却会在特征点与
  // 夹点派生里凭空多出一个重合的候选。
  if (subpath.closed && (start.x !== subpath.start.x || start.y !== subpath.start.y)) {
    cubics.push(straightCubic(start, subpath.start))
  }
  return cubics
}

/** 一条直段升阶成的三次贝塞尔：控制点落在弦的三等分点上，形状逐像素相同。 */
function straightCubic(start: ComposePosition, end: ComposePosition): ComposeCubicShape {
  return {
    start,
    c1: { x: start.x + (end.x - start.x) / 3, y: start.y + (end.y - start.y) / 3 },
    c2: { x: start.x + ((end.x - start.x) * 2) / 3, y: start.y + ((end.y - start.y) * 2) / 3 },
    end,
  }
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
  if (curve.kind === 'path') {
    // 端点之外还要算上导数为零处的极值点：控制点凸包是紧包围盒的超集，在 S 形段上肉眼可见地
    // 大一圈。这与弧要算象限点是同一条规则。子路径起点单列，一条只有起点的子路径校验会拒，
    // 但包围盒不该因此把它丢掉。
    return [
      ...curve.subpaths.map((subpath) => subpath.start),
      ...composePathCubics(curve).flatMap((cubic) => (
        composeCubicBoundsPoints(cubic).map(({ x, y }) => ({ x, y }))
      )),
    ]
  }
  // 弧不能只用两个端点：90° 到 270° 的弧鼓出来的那一侧在端点之外，盒会把弧裁掉一块，
  // 而这只在跨象限的弧上出现。落在扫掠内的象限点必须一并纳入。
  return composeArcBoundsPoints(curve).map(({ x, y }) => ({ x, y }))
}

/**
 * 这条曲线是不是一块**闭合的面积**。
 *
 * @remarks
 * 它回答的是既有那条判据：**盒是不是这个对象的轮廓**。一个闭合图形占据的就是它盒里那块面积，
 * 四条边都被顶点顶到，盒宣称的是真话；而一条对角线的包围盒里绝大部分是空的——线越接近 45 度
 * 它越大，拖端点时还一直在变。因此闭合的画普通包围盒与八个手柄（与矩形物料、图片、容器一致），
 * 开放的画几何轮廓。
 *
 * **矩形不是特例，是这条规则的一个实例**：它就是闭合四顶点多段线。圆角同样不改变答案——角弧
 * 与四条边相切，盒仍是它占据的那块面积。旋转过的形状也一样，`Transform.rotation` 不在几何里。
 *
 * **整圆算闭合，一段弧不算**：整圆是一块面积（填自己盒的 78.5%，四条边都被切到），一段弧是
 * 一条开放的线。`arc` 上没有 `closed` 字段也不该加——整圆本来就是「扫掠 ±360 的弧」，
 * `projectComposeCurveToBox` 早就在用 `closed: isComposeFullCircle(curve)` 表达同一件事。
 *
 * **刻意不取「几何面积占包围盒的比例」**，哪怕那更贴近判据本身（闭合三角形只填盒的一半，
 * L 形闭合折线更空）：那个阈值是一个魔法数，而更糟的是同一个形状会在用户**拖一个顶点时**
 * 突然换一套 chrome——盒与手柄凭空出现或消失，屏幕上没有任何东西解释为什么。闭合不是完美的
 * 代理，这是一次明知不完美而选它的取舍。
 *
 * @public
 */
export function isComposeClosedCurve(curve: ComposeCurve): boolean {
  if (curve.kind === 'polyline') return curve.closed
  // 一条子路径没闭合就有一段开放的轮廓，盒因此不再是这个对象的轮廓——判据是「盒宣称的是不是
  // 真话」，而只要有一处开口它就不是。
  // 空 `subpaths` 校验会拒，但这里仍要显式挡住：`[].every` 为真，那会让一条画不出东西的曲线
  // 自称是闭合的面积，而选区 chrome 读的正是这个答案。
  if (curve.kind === 'path') {
    return curve.subpaths.length > 0 && curve.subpaths.every((subpath) => subpath.closed)
  }
  return curve.kind === 'arc' && isComposeFullCircle(curve)
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
  if (curve.kind === 'path') {
    return {
      ...curve,
      subpaths: curve.subpaths.map((subpath) => ({
        ...subpath,
        start: shift(subpath.start),
        segments: subpath.segments.map((segment) => ({
          c1: shift(segment.c1),
          c2: shift(segment.c2),
          to: shift(segment.to),
        })),
      })),
    }
  }
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

/** 几何数值的量化步长；盒尺寸写进文档时被舍到这个格子上。 */
const GEOMETRY_QUANTUM = 10 ** -COMPOSE_GEOMETRY_PRECISION

/**
 * 两个轴向比例是否可以当作等比。
 *
 * @remarks
 * 容差**由盒尺寸的量化步长推出**，不是一个凭手感取的小数：盒尺寸写进文档时经
 * `roundComposeGeometry` 舍到 {@link COMPOSE_GEOMETRY_PRECISION} 位，而几何本身不舍，因此
 * 每个轴的比例天生就只知道到 `±步长/2 ÷ 取景框边长` 这么准。取一个绝对小量（曾经是 1e-6）
 * 等于要求比例比它自己的存储精度还精确——症状是**每一条画出来的弧都被判成非等比**：一段
 * 270×95 的弧两轴比例差 4e-5，于是它在命中、捕捉与几何编辑里全都退化成二十来个顶点的
 * 多段线，而渲染仍按 `viewBox` 画着真正的弧。用户看见的是一条光滑的弧上排着一串方顶点。
 *
 * 真正的非等比拉伸比这个量级大好几个数量级，因此这条容差不会把它放过去。
 */
function isUniformBoxScale(view: ComposeCurveViewBox, scaleX: number, scaleY: number) {
  const slack = GEOMETRY_QUANTUM / 2
  return Math.abs(scaleX - scaleY) <= slack / view.width + slack / view.height
}

/**
 * 把几何映射进盒坐标系。
 *
 * @remarks
 * 这是**盒与几何之间唯一的换算**：渲染由浏览器按 `viewBox` 完成，而命中与捕捉调用本函数，
 * 之后下游（`distanceToComposeCurve`、特征点、包围盒）一行不改——它们拿到的已经是盒坐标系
 * 里的几何。各自算一遍的话，下一个改盒语义的人只会改到其中一处，而漏掉的那处症状是
 * 「某些缩放下点不中」。
 *
 * **弧按缩放是否等比分流**：等比仍是精确弧，非等比拍扁成多段线。按某一轴的比例硬算成圆会
 * 画出一个用户从未画过的形状；一律拍扁又会让圆心与象限点消失，而它们不是任何线段的特征点。
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
  // 贝塞尔的控制点在仿射变换下**精确**，因此 `path` 没有弧那条等比/非等比分流：非等比拉伸
  // 之后它仍然是同一条贝塞尔，只是被拉扁了。
  if (curve.kind === 'path') {
    return {
      ...curve,
      subpaths: curve.subpaths.map((subpath) => ({
        ...subpath,
        start: map(subpath.start),
        segments: subpath.segments.map((segment) => ({
          c1: map(segment.c1),
          c2: map(segment.c2),
          to: map(segment.to),
        })),
      })),
    }
  }
  if (isUniformBoxScale(view, scaleX, scaleY)) {
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
  if (curve.kind === 'path') {
    return composePathCubics(curve).reduce(
      (nearest, cubic) => Math.min(nearest, pointToComposeCubicDistance(cubic, point)),
      // 一条段都没有（校验会拒）时退化成到各子路径起点的距离，与多段线那一支的处理一致。
      curve.subpaths.reduce(
        (nearest, { start }) => Math.min(nearest, Math.hypot(point.x - start.x, point.y - start.y)),
        Number.POSITIVE_INFINITY,
      ),
    )
  }
  const pieces = composePolylineOutline(curve)
  // 单顶点多段线（校验会拒，但命中不该因此抛错）退化成到那个点的距离。
  if (pieces.length === 0) {
    const first = curve.vertices[0]
    return first ? Math.hypot(point.x - first.x, point.y - first.y) : Number.POSITIVE_INFINITY
  }
  // 角弧走闭式解而不是拍扁：拍扁的弦高误差在命中上是**可见**的（贴着圆角外沿点不中），
  // 而框选那一头产出的只是一个布尔，两者能接受的误差不是一回事。
  return pieces.reduce(
    (nearest, piece) => Math.min(nearest, piece.kind === 'segment'
      ? pointToComposeSegmentDistance(piece.segment, point)
      : pointToComposeArcDistance(piece.arc, point)),
    Number.POSITIVE_INFINITY,
  )
}

/**
 * 把曲线归约成一组线段。
 *
 * @remarks
 * 供框选按几何判定使用：把「框与曲线相交吗」收敛成「框与这些线段中的任意一条相交吗」，
 * 三种 `kind` 因此共用同一个下游判定。
 *
 * 弧走 {@link flattenComposeArc} 拍扁。**弦高误差是有意接受的**：同一条选择已经在非等比缩放
 * 的渲染上做过，而框选产出的是「选中或不选中」的布尔判断，误差不以任何方式呈现给用户。
 *
 * **返回的不是特征点集合**：它只回答「几何占据了哪些线段」，端点、中点与象限点的优先级语义
 * 与本函数无关，那由捕捉自己按 `kind` 分派。
 *
 * @public
 */
export function composeCurveSegments(curve: ComposeCurve): readonly ComposeSegmentShape[] {
  if (curve.kind === 'line') return [{ start: curve.start, end: curve.end }]
  if (curve.kind === 'arc') return flattenComposeArc(curve)
  if (curve.kind === 'path') return composePathCubics(curve).flatMap(flattenComposeCubic)
  const pieces = composePolylineOutline(curve)
  // 单顶点多段线（校验会拒，但判定不该因此认为它不存在）退化成一条零长度线段：
  // 下游的裁剪判定对它天然退化成「点是否落在框内」。
  if (pieces.length === 0) {
    const only = curve.vertices[0]
    return only ? [{ start: only, end: only }] : []
  }
  return flattenComposeOutline(pieces)
}

/**
 * 一条多段线的有序轮廓片段。
 *
 * @remarks
 * 命中、框选、内部判定与渲染读的是**同一列**片段——各自按 `cornerRadius` 再算一遍的话，
 * 下一个改圆角数学的人只会改到其中一处，而漏掉的那处的症状是「看得见的形状与点得中的
 * 形状不是同一个」。
 *
 * @public
 */
export function composePolylineOutline(
  curve: ComposePolylineCurve,
): readonly ComposeOutlinePiece[] {
  return composeRoundedPolylineOutline(curve.vertices, curve.closed, curve.cornerRadius ?? 0)
}

/**
 * 点是否落在曲线几何的内部。
 *
 * @remarks
 * 填充过的区域是用户看见的墨，因此它参与命中——「按距离而不是按包围盒」挡的是空白，不是墨。
 * **没有填充时调用方不该问这个问题**：空心图形的内部正是「一条对角线的包围盒里绝大部分是
 * 空的」覆盖的情形。
 *
 * **不检查 `closed`**：开放几何按**隐式闭合**处理，与 SVG 填充开放几何的规则相同（
 * `<polyline fill>` 画的就是首尾相连围出的那块）。渲染与命中因此自动一致，不需要在两处
 * 各写一遍「什么算封闭」。直线没有可填充的面积，恒为假。
 *
 * **按 `fillRule` 分派，缺席即非零绕数**——SVG 的默认值也是它。对单条不自交的轮廓两条规则
 * 给出相同答案，因此既有的多段线与弧逐点不变；自交轮廓（五角星那样一笔画出来的）上两者不同，
 * 而此前这里写死奇偶、渲染却按 SVG 的非零绕数填充，星心是**画着实心却点不中**的。改成读同一
 * 条规则顺带修掉了它。
 *
 * 输入几何 MUST 已经由 `projectComposeCurveToBox` 投影进盒坐标系——盒到几何的换算只有一个
 * 入口，这里再做一次就会有第二份。
 *
 * @public
 */
export function isPointInsideComposeCurve(
  curve: ComposeCurve,
  point: { readonly x: number; readonly y: number },
): boolean {
  const rings = composeCurveFillRings(curve).filter((ring) => ring.length >= 3)
  if (rings.length === 0) return false
  if (curve.kind === 'path' && curve.fillRule === 'evenodd') {
    // 奇偶规则：数射线穿过**全部**环的次数，奇数即内部。带洞图形的内圈因此被减掉。
    const crossings = rings.reduce((total, ring) => total + ringCrossings(ring, point), 0)
    return crossings % 2 === 1
  }
  return rings.reduce((total, ring) => total + ringWinding(ring, point), 0) !== 0
}

/**
 * 曲线的填充轮廓环；每个环按**隐式闭合**处理。
 *
 * @remarks
 * `path` 一条子路径一个环，其余 kind 至多一个环。直线没有可填充的面积，返回空。
 */
function composeCurveFillRings(
  curve: ComposeCurve,
): readonly (readonly ComposePosition[])[] {
  if (curve.kind === 'line') return []
  if (curve.kind === 'polyline') return [outlineVertices(curve)]
  if (curve.kind === 'arc') return [segmentsOutline(flattenComposeArc(curve))]
  return curve.subpaths.map((subpath) => (
    segmentsOutline(subpathCubics(subpath).flatMap(flattenComposeCubic))
  ))
}

/**
 * 射线向 +x 穿过一个环的次数。
 *
 * @remarks
 * 半开区间 `[y0, y1)` 让顶点恰好落在射线上时只被计一次，否则穿过顶点的射线会数出两次而把
 * 内外判反。
 */
function ringCrossings(
  ring: readonly ComposePosition[],
  point: { readonly x: number; readonly y: number },
): number {
  let crossings = 0
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i]!
    const b = ring[(i + 1) % ring.length]!
    if ((a.y > point.y) === (b.y > point.y)) continue
    const crossX = a.x + ((point.y - a.y) / (b.y - a.y)) * (b.x - a.x)
    if (point.x < crossX) crossings += 1
  }
  return crossings
}

/**
 * 一个环绕点的绕数。
 *
 * @remarks
 * 与 {@link ringCrossings} 的差别只在**方向**：穿越向上记 +1、向下记 −1。两个同向的环因此
 * 叠加（内圈仍是实心），反向的环相消（内圈是洞）——这正是 `nonzero` 与 `evenodd` 的全部差别。
 *
 * 屏幕坐标 Y 朝下会让整体符号反过来，而判据是「绕数是不是零」，与符号无关。
 */
function ringWinding(
  ring: readonly ComposePosition[],
  point: { readonly x: number; readonly y: number },
): number {
  let winding = 0
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i]!
    const b = ring[(i + 1) % ring.length]!
    const side = (b.x - a.x) * (point.y - a.y) - (point.x - a.x) * (b.y - a.y)
    if (a.y <= point.y) {
      if (b.y > point.y && side > 0) winding += 1
    }
    else if (b.y <= point.y && side < 0) winding -= 1
  }
  return winding
}

/**
 * 多段线的填充轮廓：没有圆角时就是顶点本身。
 *
 * @remarks
 * 有圆角时按轮廓片段拍扁——用尖角顶点判会把每个角上被削掉的那一小块也算成内部，而那块正是
 * 用户看得见的空白。
 */
function outlineVertices(curve: ComposePolylineCurve): readonly ComposePosition[] {
  if (!(curve.cornerRadius ?? 0)) return curve.vertices
  const outline = segmentsOutline(flattenComposeOutline(composePolylineOutline(curve)))
  return outline.length > 0 ? outline : curve.vertices
}

/** 把一串首尾相接的线段收成顶点序列。 */
function segmentsOutline(
  segments: readonly ComposeSegmentShape[],
): readonly ComposePosition[] {
  const first = segments[0]
  if (!first) return []
  return [
    { x: first.start.x, y: first.start.y },
    ...segments.map(({ end }) => ({ x: end.x, y: end.y })),
  ]
}

/**
 * 曲线的可见填充色，没有则 `null`。
 *
 * @remarks
 * 填充复用 `Appearance.backgroundPaint` 而不是新开一个 Renderer prop：填充要参与命中，而
 * **命中路径读的字段必须是文档级契约**。复用还让外观 Inspector、数据绑定与外观动画轨道一样
 * 都不用做。
 *
 * v1 只认 `solid`：非纯色 Paint 由共享 Paint 层绘制，而那一层画的是盒形的矩形，在曲线上
 * 只会是一块摆在形状后面的色块。
 *
 * **全透明等于没填充**：一块看不见的墨若参与命中，就等于把刚拆掉的「整个盒接管点击」那个
 * bug 换个地方装回来。
 *
 * 渲染与命中 MUST 共用本函数，两处各判一次必然漂移——症状是「看得见的填充点不中」或者反过来。
 *
 * @public
 */
export function getComposeCurveFill(entity: ComposeEntity): string | null {
  const paint = resolveComposeAppearance(entity).backgroundPaint
  if (paint.kind !== 'solid') return null
  const color = paint.color.trim()
  if (color === '' || color === 'transparent' || color === 'none') return null
  if (/^#(?:[0-9a-f]{4}|[0-9a-f]{8})$/i.test(color) && /00$/i.test(color)) return null
  if (/^rgba?\([^)]*,\s*0(?:\.0+)?\s*\)$/i.test(color)) return null
  return color
}

/**
 * 在一个落点处把曲线拆开的结果。
 *
 * @remarks
 * `at-end` 与 `split` 是两件不同的事而不是同一件事的两个程度：落点就在首尾顶点上时那里没有
 * 需要断开的线身，接线只改绑定；落在线身中间才要断。合成一种会产出一段零长度的残线，而它在
 * 图上看不见、却出现在场景树里。
 *
 * @public
 */
export type ComposeCurveSplit =
  | { readonly kind: 'split'; readonly first: ComposeCurve; readonly second: ComposeCurve }
  | { readonly kind: 'at-end'; readonly end: 'start' | 'end' }

/** 两个顶点收成 `line`、更多收成 `polyline`；拆出来的半条不该凭空变一种 kind。 */
function curveFromVertices(vertices: readonly ComposePosition[]): ComposeCurve | null {
  if (vertices.length < 2) return null
  const [first, second] = vertices
  if (vertices.length === 2 && first && second) return { kind: 'line', start: first, end: second }
  return { kind: 'polyline', vertices, closed: false }
}

/** 两点是否近到该当作同一个顶点；见 {@link splitComposeCurveAt} 为什么用相对量。 */
function isSameVertex(a: ComposePosition, b: ComposePosition, epsilon: number) {
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon
}

/**
 * 把一条导线在它上面的一个落点处拆成两段。
 *
 * @remarks
 * 接线的「断成两段」走这里：被接入的导线在落点处断开，两段各自把靠近落点的那一端绑到节点。
 * 不断的话节点只是**压在**那条线上，那条线一移动就与它分家——而这在屏幕上要过很久才看出来，
 * 正是「端点画在端子上」与「真的接上了」逐像素相同的那个老问题。
 *
 * **弧与闭合多段线返回 `null`**：弧没有首尾顶点可言（协议已经拒绝弧做导线），而闭合几何断开
 * 之后是一条首尾都在落点上的开放折线——那不是「两段」，让调用方少一支特判比让它多一种返回
 * 形状便宜。
 *
 * 落点落在**内部顶点**上时不复制那个顶点：两段共用它即可，多一个重合顶点会让后续的几何编辑
 * 出现一个抓不住、看不见的夹点。
 *
 * 判「是不是端点」不只看 `epsilon`，还要看**拆出来的两半是不是都还成立**：落点由另一条链
 * （世界矩阵来回换算）算出，与顶点数值上不会逐位相等，单靠一个绝对小量会在某些缩放下把
 * 端点判成线身，产出一段零长度的残线。
 *
 * @param epsilon - 判定落点与顶点重合的容差，几何自身的单位。
 * @returns 不可拆（弧、闭合、顶点不足）时为 `null`。
 * @public
 */
export function splitComposeCurveAt(
  curve: ComposeCurve,
  point: ComposePosition,
  epsilon = 1e-6,
): ComposeCurveSplit | null {
  // `path` 与弧一样没有可拆的顶点序列——导线几何本来就只允许 line 与 polyline。
  if (curve.kind === 'arc' || curve.kind === 'path') return null
  if (curve.kind === 'polyline' && curve.closed) return null
  const vertices = curve.kind === 'line' ? [curve.start, curve.end] : curve.vertices
  if (vertices.length < 2) return null
  const first = vertices[0]!
  const last = vertices[vertices.length - 1]!
  if (isSameVertex(point, first, epsilon)) return { kind: 'at-end', end: 'start' }
  if (isSameVertex(point, last, epsilon)) return { kind: 'at-end', end: 'end' }

  let index = 0
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < vertices.length - 1; i += 1) {
    const distance = pointToComposeSegmentDistance(
      { start: vertices[i]!, end: vertices[i + 1]! },
      point,
    )
    if (distance < best) {
      best = distance
      index = i
    }
  }
  // 落在内部顶点上：两段共用它，不插入重合的第二个顶点。
  const head = isSameVertex(point, vertices[index]!, epsilon)
    ? vertices.slice(0, index + 1)
    : [...vertices.slice(0, index + 1), point]
  const tail = isSameVertex(point, vertices[index + 1]!, epsilon)
    ? vertices.slice(index + 1)
    : [point, ...vertices.slice(index + 1)]
  const firstHalf = curveFromVertices(head)
  const secondHalf = curveFromVertices(tail)
  // 有一半立不住，说明落点其实就在某一端上——容差没判出来，几何判出来了。
  if (!firstHalf) return { kind: 'at-end', end: 'start' }
  if (!secondHalf) return { kind: 'at-end', end: 'end' }
  return { kind: 'split', first: firstHalf, second: secondHalf }
}

/**
 * 节点直径相对导线线宽的倍率。
 *
 * @remarks
 * 3 倍是 KiCad 的量级。**由线宽推出而不是取一个绝对值**：线粗了而点没跟着粗，点就被线自己
 * 盖住，接头在图上再也读不出来。
 *
 * 住在 `core` 与 `COMPOSE_CURVE_PICK_TOLERANCE` 是同一条理由：`materials`（节点 Preset 的
 * 默认尺寸）与 `stage`（接线时按被接入导线的线宽建节点）之间没有依赖关系，各写一份的症状是
 * 「面板拖出来的点与接出来的点不一样大」。
 *
 * @public
 */
export const COMPOSE_JUNCTION_DIAMETER_RATIO = 3

/**
 * 节点端口的 id。
 *
 * @remarks
 * 一个节点只有一个端口，所有支路都绑它。id 稳定是导线绑定不断的前提，因此它是常量而不是
 * 每次新建时铸的随机串。
 *
 * @public
 */
export const COMPOSE_JUNCTION_PORT_ID = 'p'

/**
 * 按线宽推出节点的盒尺寸。
 *
 * @remarks
 * 盒是正方形，几何是内切的整圆——非正方盒里的整圆经 `viewBox` 会被拉成椭圆，而接头是圆的。
 *
 * @public
 */
export function composeJunctionSize(
  strokeWidth: number,
): { readonly width: number; readonly height: number } {
  const diameter = Math.max(1, roundComposeGeometry(strokeWidth * COMPOSE_JUNCTION_DIAMETER_RATIO))
  return { width: diameter, height: diameter }
}

/**
 * 节点的几何：内切于盒的整圆。
 *
 * @remarks
 * 整圆是扫掠 360 的弧，不另立 kind——归一化、平移、距离、特征点、渲染与校验六条路径因此一行
 * 都不必为节点分支。
 *
 * @public
 */
export function composeJunctionGeometry(
  size: { readonly width: number; readonly height: number },
): ComposeCurve {
  const radius = Math.min(size.width, size.height) / 2
  return {
    kind: 'arc',
    center: { x: size.width / 2, y: size.height / 2 },
    radius,
    startAngle: 0,
    sweep: 360,
  }
}
