/**
 * 平面图：把一组轮廓片段按彼此的交点切开，建成半边图，并在它上面绕环。
 *
 * @remarks
 * 本模块是**求面与布尔运算共用的那一层**：求面只要围住落点的那**一个**面，布尔要**全部**的
 * 面加一次内外分类，而「把图建出来、在图上绕一圈」这件事两边逐字相同。各写一份的话，下一个
 * 改退化处理的人只会改到其中一处，而漏掉的那处的症状是「某些形状填不上色」或者「某些形状
 * 算不出并集」——两句话是同一个原因。
 *
 * 输入是**已经在同一个坐标空间里**的片段（调用方把每条候选曲线投影进自己的盒、再乘世界矩阵，
 * 与命中、框选、特征点同一条链）。本模块不认识任何文档协议。
 *
 * 退化由两处承担，而不是靠逐交点的特判：**叠在一起的两条边收成一条**（两条画在一起的边界线
 * 在图上就是一条边界），以及**射线换方向重来**（擦过节点或与某条边相切时朝向读不出来）。
 *
 * @packageDocumentation
 */

import {
  composeArcPointAt,
  composeArcToCubicShapes,
  intersectComposeArcs,
  intersectComposeSegmentArc,
  intersectComposeSegments,
  isComposeFullCircle,
  type ComposeArcShape,
  type ComposeOutlinePiece,
  type ComposePlanarPoint,
  type ComposeSegmentShape,
  type ComposeShapeIntersection,
} from './curve-geometry'
import type {
  ComposeCubicSegment,
  ComposeCurve,
  ComposeSubpath,
} from './curve'
import type { ComposePosition } from './document-types'

/**
 * 节点合并容差。
 *
 * @remarks
 * 这**不是间隙容差**——它是浮点卫生：弧 × 弧的闭式解在同一个交点上算两遍会差到 1e-12 相对
 * 量级，不合并的话同一个点会变成两个节点，绕行走到那里就断了。取相对量而不是绝对量，因为
 * 世界坐标的量级由图纸比例决定。
 *
 * 真正的间隙（用户画的两条线差 0.5px）比这大七个数量级，因此这条容差碰不到它。
 */
export const NODE_EPSILON_RATIO = 1e-7


/**
 * 节点合并容差：相对量与量化步长推出的下限，取较大者。
 *
 * @remarks
 * 相对量是**浮点卫生**（弧 × 弧的闭式解在同一个交点上算两遍能差 1e-12 相对量级）。下限说的
 * 是另一件事：同一个角点被两个对象各自写进文档时，每一轴上差一个步长来自几何自身的舍入、
 * 再差一个步长来自归一化偏移的舍入，因此两轴合起来的距离上界是 `2√2` 个步长。
 *
 * 这条下限**单独不成立**，它与 {@link weldComposeOutlineSupports} 是一对：量过——只抬容差
 * 而不归一，两块共用弧边界的填充求并集仍然报「求解退化」；另一个夹具上它会跨过报错那一关而
 * 静默产出一个几像素大的形状，把一个看得见的失败换成一个看不见的错误。
 *
 * 代价写在明处：图上真的相距不到三个步长的两个角会被并成一个——它们在存储精度上本来就分不开。
 *
 * @param scale - 这批片段包围盒的尺度
 * @param quantum - 这批片段所在空间里的坐标量化步长
 */
export function composeNodeEpsilon(scale: number, quantum: number) {
  return Math.max(NODE_EPSILON_RATIO * scale, 2 * Math.SQRT2 * quantum)
}

/** 参数空间上「同一个切点」的容差；与 `curve-geometry` 的 `TOUCH_TOLERANCE` 同源。 */
export const PARAMETER_EPSILON = 1e-6

const TO_RADIANS = Math.PI / 180

/**
 * 射线方向的候选序列。
 *
 * @remarks
 * 正 +x 是第一个（与「射线进面」这条规则的表述一致）。射线**恰好穿过一个节点**或**与某条边
 * 相切**时结果读不出来，此时换一个方向重来——这些角度取得互不成比例，是为了让同一处退化不会
 * 在下一个方向上重演。
 */
export const RAY_ANGLES = [0, 0.01234, 0.61803, 1.41421, 2.23607, 3.14159 / 1.7] as const

export function subtract(a: ComposePlanarPoint, b: ComposePlanarPoint): ComposePlanarPoint {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function cross(a: ComposePlanarPoint, b: ComposePlanarPoint) {
  return a.x * b.y - a.y * b.x
}

export function dot(a: ComposePlanarPoint, b: ComposePlanarPoint) {
  return a.x * b.x + a.y * b.y
}

function negate(a: ComposePlanarPoint): ComposePlanarPoint {
  return { x: -a.x, y: -a.y }
}

export function normalize(a: ComposePlanarPoint): ComposePlanarPoint {
  const length = Math.hypot(a.x, a.y)
  return length === 0 ? { x: 1, y: 0 } : { x: a.x / length, y: a.y / length }
}

/**
 * 平面点搬进文档协议的位置。
 *
 * @remarks
 * `ComposePlanarPoint` 只做算术、不带 `JsonObject` 的索引签名，因此写进 `Curve` 之前要过这
 * 一道——`curve-geometry` 那条「本模块只做算术」的边界正是靠这个差别立住的。
 */
export function toPosition(point: ComposePlanarPoint): ComposePosition {
  return { x: point.x, y: point.y }
}

export function lerp(a: ComposePlanarPoint, b: ComposePlanarPoint, t: number): ComposePlanarPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** 弧上走过 `travelled` 度处的方位角。 */
function bearingAt(arc: ComposeArcShape, travelled: number) {
  return arc.startAngle + Math.sign(arc.sweep || 1) * travelled
}

/** 弧上某个方位角处的前进方向（跟随扫掠符号）。 */
function arcTangent(arc: ComposeArcShape, degrees: number): ComposePlanarPoint {
  const radians = degrees * TO_RADIANS
  const sign = Math.sign(arc.sweep || 1)
  return normalize({ x: -Math.sin(radians) * sign, y: Math.cos(radians) * sign })
}

export function pieceStart(piece: ComposeOutlinePiece): ComposePlanarPoint {
  return piece.kind === 'segment'
    ? piece.segment.start
    : composeArcPointAt(piece.arc, piece.arc.startAngle)
}

export function pieceEnd(piece: ComposeOutlinePiece): ComposePlanarPoint {
  return piece.kind === 'segment'
    ? piece.segment.end
    : composeArcPointAt(piece.arc, piece.arc.startAngle + piece.arc.sweep)
}

function pieceStartTangent(piece: ComposeOutlinePiece): ComposePlanarPoint {
  return piece.kind === 'segment'
    ? normalize(subtract(piece.segment.end, piece.segment.start))
    : arcTangent(piece.arc, piece.arc.startAngle)
}

function pieceEndTangent(piece: ComposeOutlinePiece): ComposePlanarPoint {
  return piece.kind === 'segment'
    ? normalize(subtract(piece.segment.end, piece.segment.start))
    : arcTangent(piece.arc, piece.arc.startAngle + piece.arc.sweep)
}

/** 片段的参数上界：线段是 1，弧是走过的总角量。 */
export function pieceSpan(piece: ComposeOutlinePiece) {
  return piece.kind === 'segment' ? 1 : Math.abs(piece.arc.sweep)
}

export function piecePointAt(piece: ComposeOutlinePiece, parameter: number): ComposePlanarPoint {
  return piece.kind === 'segment'
    ? lerp(piece.segment.start, piece.segment.end, parameter)
    : composeArcPointAt(piece.arc, bearingAt(piece.arc, parameter))
}

function pieceTangentAt(piece: ComposeOutlinePiece, parameter: number): ComposePlanarPoint {
  return piece.kind === 'segment'
    ? pieceStartTangent(piece)
    : arcTangent(piece.arc, bearingAt(piece.arc, parameter))
}

/** 取片段上 `[from, to]` 这一截。 */
function slicePiece(
  piece: ComposeOutlinePiece,
  from: number,
  to: number,
): ComposeOutlinePiece {
  if (piece.kind === 'segment') {
    return {
      kind: 'segment',
      segment: {
        start: lerp(piece.segment.start, piece.segment.end, from),
        end: lerp(piece.segment.start, piece.segment.end, to),
      },
    }
  }
  const sign = Math.sign(piece.arc.sweep || 1)
  return {
    kind: 'arc',
    arc: {
      ...piece.arc,
      startAngle: piece.arc.startAngle + sign * from,
      sweep: sign * (to - from),
    },
  }
}

function reversePiece(piece: ComposeOutlinePiece): ComposeOutlinePiece {
  if (piece.kind === 'segment') {
    return { kind: 'segment', segment: { start: piece.segment.end, end: piece.segment.start } }
  }
  return {
    kind: 'arc',
    arc: {
      ...piece.arc,
      startAngle: piece.arc.startAngle + piece.arc.sweep,
      sweep: -piece.arc.sweep,
    },
  }
}

/** 两条片段的交点，参数按 `(first, second)` 的次序给出。 */
function intersectPieces(
  first: ComposeOutlinePiece,
  second: ComposeOutlinePiece,
): readonly ComposeShapeIntersection[] {
  if (first.kind === 'segment' && second.kind === 'segment') {
    return intersectComposeSegments(first.segment, second.segment)
  }
  if (first.kind === 'segment' && second.kind === 'arc') {
    return intersectComposeSegmentArc(first.segment, second.arc)
  }
  if (first.kind === 'arc' && second.kind === 'segment') {
    // 换了次序求，因此参数要换回来：那支的 `a` 是线段上的、`b` 是弧上的。
    return intersectComposeSegmentArc(second.segment, first.arc).map((hit) => ({
      point: hit.point,
      a: hit.b,
      b: hit.a,
    }))
  }
  if (first.kind === 'arc' && second.kind === 'arc') {
    return intersectComposeArcs(first.arc, second.arc)
  }
  return []
}

/** 世界空间的一条子边：切完之后不再有任何片段从它中间穿过。 */
export interface RegionSubEdge {
  readonly piece: ComposeOutlinePiece
  /** 它出自 `pieces` 的哪一条。 */
  readonly source: number
  readonly fromNode: number
  readonly toNode: number
  readonly startTangent: ComposePlanarPoint
  readonly endTangent: ComposePlanarPoint
}

/** 半边 id：`子边下标 * 2 + 是否反向`。 */
export type HalfEdgeId = number

/** 绕行时「这条半边许不许走」。 @public */
export type StageHalfEdgeFilter = (half: HalfEdgeId) => boolean

export const edgeOf = (half: HalfEdgeId) => half >> 1
export const isReversed = (half: HalfEdgeId) => (half & 1) === 1
export const opposite = (half: HalfEdgeId) => half ^ 1

/**
 * 片段的**支撑**：它落在哪条直线、哪个圆上。
 *
 * @remarks
 * 直线取规范式 `n·p = c` 且单位法向定向到 `nx > 0`（`nx` 为零时取 `ny > 0`）——同一条直线上
 * 方向相反的两条线段因此得到同一组数，这是「重合的两条按数值比较」能成立的前提。
 */
export type ComposeOutlineSupport =
  | { readonly kind: 'line'; readonly nx: number; readonly ny: number; readonly c: number }
  | { readonly kind: 'circle'; readonly cx: number; readonly cy: number; readonly r: number }

/** 轨迹取样的段数；两端算进去，中间够密即可。 */
const SUPPORT_SAMPLES = 8

/**
 * 法向定向用的浮点卫生量。
 *
 * @remarks
 * 这**不是**一条几何容差：轴对齐的线段算出来的法向分量是 0 还是 1e-17 由浮点决定，而定向
 * 规则若直接读它的符号，同一条竖线上的两条线段会得到方向相反的法向、于是被判成两条支撑。
 */
const ORIENTATION_EPSILON = 1e-12

function lineSupportOf(segment: ComposeSegmentShape): ComposeOutlineSupport {
  const direction = normalize(subtract(segment.end, segment.start))
  let nx = -direction.y
  let ny = direction.x
  if (nx < -ORIENTATION_EPSILON || (Math.abs(nx) <= ORIENTATION_EPSILON && ny < 0)) {
    nx = -nx
    ny = -ny
  }
  const c = nx * segment.start.x + ny * segment.start.y
  // 负零归正：`-0` 与 `0` 在比较里相等，却让同一条支撑在逐位比较下读成两条。
  return { kind: 'line', nx: nx + 0, ny: ny + 0, c: c + 0 }
}

/** 片段落在哪条支撑上。 */
export function composeOutlineSupport(piece: ComposeOutlinePiece): ComposeOutlineSupport {
  return piece.kind === 'arc'
    ? { kind: 'circle', cx: piece.arc.center.x, cy: piece.arc.center.y, r: piece.arc.radius }
    : lineSupportOf(piece.segment)
}

/** 片段上等间距的取样点。 */
function supportSamples(piece: ComposeOutlinePiece): readonly ComposePlanarPoint[] {
  const span = pieceSpan(piece)
  return Array.from({ length: SUPPORT_SAMPLES + 1 }, (_, index) =>
    piecePointAt(piece, (span * index) / SUPPORT_SAMPLES))
}

/**
 * 一组点的代数圆拟合（Kåsa）。
 *
 * @remarks
 * 最小化 `Σ(|p − c|² − r²)²`，法方程是二阶线性组，闭式解。点近似共线时行列式趋零——那一档
 * 没有圆可言，交回 `null` 由调用方当作「拟合不出来」。
 */
function fitCircleSupport(points: readonly ComposePlanarPoint[]): ComposeOutlineSupport | null {
  const count = points.length
  if (count < 3) return null
  let sx = 0
  let sy = 0
  let sxx = 0
  let syy = 0
  let sxy = 0
  let sxz = 0
  let syz = 0
  let sz = 0
  points.forEach(({ x, y }) => {
    const z = x * x + y * y
    sx += x
    sy += y
    sxx += x * x
    syy += y * y
    sxy += x * y
    sxz += x * z
    syz += y * z
    sz += z
  })
  const a11 = 2 * (sxx - (sx * sx) / count)
  const a12 = 2 * (sxy - (sx * sy) / count)
  const a22 = 2 * (syy - (sy * sy) / count)
  const b1 = sxz - (sx * sz) / count
  const b2 = syz - (sy * sz) / count
  const determinant = a11 * a22 - a12 * a12
  if (!Number.isFinite(determinant) || determinant === 0) return null
  const cx = (b1 * a22 - b2 * a12) / determinant
  const cy = (a11 * b2 - a12 * b1) / determinant
  let sumSquared = 0
  points.forEach((point) => {
    sumSquared += (point.x - cx) ** 2 + (point.y - cy) ** 2
  })
  const r = Math.sqrt(sumSquared / count)
  return Number.isFinite(cx) && Number.isFinite(cy) && Number.isFinite(r)
    ? { kind: 'circle', cx, cy, r }
    : null
}

/** 一组点的总体最小二乘直线拟合：过质心、方向取协方差矩阵的主轴。 */
function fitLineSupport(points: readonly ComposePlanarPoint[]): ComposeOutlineSupport | null {
  const count = points.length
  if (count < 2) return null
  let mx = 0
  let my = 0
  points.forEach(({ x, y }) => {
    mx += x / count
    my += y / count
  })
  let sxx = 0
  let syy = 0
  let sxy = 0
  points.forEach(({ x, y }) => {
    sxx += (x - mx) ** 2
    syy += (y - my) ** 2
    sxy += (x - mx) * (y - my)
  })
  // 主轴方向：对称二阶矩阵的最大特征向量。
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  const direction = { x: Math.cos(angle), y: Math.sin(angle) }
  return lineSupportOf({ start: { x: mx, y: my }, end: { x: mx + direction.x, y: my + direction.y } })
}

/** 某个点到支撑的距离。 */
function supportDistance(point: ComposePlanarPoint, support: ComposeOutlineSupport) {
  return support.kind === 'line'
    ? Math.abs(support.nx * point.x + support.ny * point.y - support.c)
    : Math.abs(Math.hypot(point.x - support.cx, point.y - support.cy) - support.r)
}

/**
 * 一组点共同拟合出来的支撑，以及最大残差。
 *
 * @remarks
 * 判据落在**共同拟合**上而不是「一条片段到另一条拟合出来的支撑的偏差」：后者是一次**外推**
 * ——一条 48° 的短弧由量化过的控制点反解出来的圆，圆心误差被放大 `1/(1 − cos(θ/2))` 倍，评估
 * 到半圈之外时误差跟着放大（量到 0.054，是点本身存储误差的五倍还多），而放大倍数由弧的跨度
 * 决定，于是容差没有可推导的来源。共同拟合问的是「有没有一条支撑同时容得下这些点」，那是
 * **内插**，误差上界就是点自身的存储误差。
 */
function commonSupport(
  points: readonly ComposePlanarPoint[],
  kind: ComposeOutlineSupport['kind'],
): { readonly support: ComposeOutlineSupport; readonly residual: number } | null {
  const support = kind === 'line' ? fitLineSupport(points) : fitCircleSupport(points)
  if (!support) return null
  let residual = 0
  points.forEach((point) => {
    residual = Math.max(residual, supportDistance(point, support))
  })
  return { support, residual }
}

/** 片段重算到给定支撑上。 */
function reprojectPiece(
  piece: ComposeOutlinePiece,
  support: ComposeOutlineSupport,
): ComposeOutlinePiece {
  if (piece.kind === 'segment' && support.kind === 'line') {
    const onto = (point: ComposePlanarPoint): ComposePlanarPoint => {
      const offset = support.nx * point.x + support.ny * point.y - support.c
      return { x: point.x - support.nx * offset, y: point.y - support.ny * offset }
    }
    return { kind: 'segment', segment: { start: onto(piece.segment.start), end: onto(piece.segment.end) } }
  }
  if (piece.kind === 'arc' && support.kind === 'circle') {
    const center = { x: support.cx, y: support.cy }
    // 整圆没有端点可投影，换个圆心半径即可；起始角与扫掠原样保留。
    if (isComposeFullCircle(piece.arc)) {
      return { kind: 'arc', arc: { ...piece.arc, center, radius: support.r } }
    }
    const bearing = (point: ComposePlanarPoint) =>
      Math.atan2(point.y - center.y, point.x - center.x) / TO_RADIANS
    // `atan2` 的主值与原值可能差整圈：各取最接近原值的那个代表，否则一段 350° 的弧会翻成 −10°。
    const nearest = (value: number, reference: number) =>
      value + 360 * Math.round((reference - value) / 360)
    const startAngle = nearest(bearing(pieceStart(piece)), piece.arc.startAngle)
    const sweep = nearest(bearing(pieceEnd(piece)) - startAngle, piece.arc.sweep)
    return { kind: 'arc', arc: { ...piece.arc, center, radius: support.r, startAngle, sweep } }
  }
  return piece
}

/**
 * 把重合的片段归到同一条支撑上。
 *
 * @remarks
 * 同一段边界会在图里存下**两份**——两块填充各自把它写进文档，几何与盒尺寸都按文档精度舍入，
 * 读回来再由三点定圆反解。两份因此差到一个量化步长的量级：比浮点误差大五个数量级，比真正
 * 不同的两条边小三个数量级。不归一的话近似共圆的两条弧会求出**无意义的交点**，射线又在几乎
 * 同一个距离上穿过它们，于是每个候选方向都退化——用户看到的是「明明贴在一起的两块面算不出
 * 并集」。
 *
 * 分组取**连通分量**：两两成立的关系不传递（同一个圆被切成好几段时，隔得最远的两段各自只和
 * 中间那几段成立），而连通分量与扫描顺序无关。规范支撑是整组取样点的共同拟合，累加次序由
 * 成员自身的数值定死。
 *
 * 只有一个成员的组原样保留自己的支撑：没有东西要和它对齐，而重算会让一条没有邻居的边界在
 * 归一前后差出一点点。
 *
 * 只在**同种**支撑之间归一：一条浅弧与一条线段可能在容差内重合，而把弧压平会改掉作者画下的
 * 曲率；那一档退回今天的行为，是一个看得见的失败。
 *
 * @param quantum - 这批片段所在空间里的坐标量化步长；`0` 表示不做归一
 */
export function weldComposeOutlineSupports(
  pieces: readonly ComposeOutlinePiece[],
  quantum: number,
): readonly ComposeOutlinePiece[] {
  if (quantum <= 0 || pieces.length < 2) return pieces
  const supports = pieces.map(composeOutlineSupport)
  const samples = pieces.map(supportSamples)
  const parent = pieces.map((_, index) => index)
  const find = (index: number): number => {
    let root = index
    while (parent[root] !== root) root = parent[root]!
    return root
  }
  for (let i = 0; i < pieces.length; i += 1) {
    for (let j = i + 1; j < pieces.length; j += 1) {
      if (supports[i]!.kind !== supports[j]!.kind || find(i) === find(j)) continue
      const fitted = commonSupport([...samples[i]!, ...samples[j]!], supports[i]!.kind)
      if (!fitted || fitted.residual > quantum) continue
      parent[find(j)] = find(i)
    }
  }

  const members = new Map<number, number[]>()
  pieces.forEach((_, index) => {
    const root = find(index)
    const list = members.get(root)
    if (list) list.push(index)
    else members.set(root, [index])
  })

  const canonical = new Map<number, ComposeOutlineSupport>()
  members.forEach((list, root) => {
    // 累加次序按成员自身的数值定死：浮点加法不满足结合律，顺序不定会让产物差在末位上。
    const ordered = [...list].sort((left, right) => compareSupports(supports[left]!, supports[right]!))
    /*
     * 组内本来就逐位落在同一条支撑上时原样留着（一条边被画了两遍就是这一档）：拟合会在末位上
     * 引入 1e-14 的噪声，而那一档没有任何东西要对齐，重算只会让「归一前后一个字节不差」不成立。
     * 只有一个成员的组同理——没有邻居要对齐。
     */
    if (ordered.every((index) => compareSupports(supports[index]!, supports[ordered[0]!]!) === 0)) {
      canonical.set(root, supports[ordered[0]!]!)
      return
    }
    const fitted = commonSupport(ordered.flatMap((index) => [...samples[index]!]), supports[ordered[0]!]!.kind)
    canonical.set(root, fitted?.support ?? supports[ordered[0]!]!)
  })

  return pieces.map((piece, index) => {
    const support = canonical.get(find(index))!
    return compareSupports(supports[index]!, support) === 0 ? piece : reprojectPiece(piece, support)
  })
}

/** 支撑自身数值的字典序；只用于把组内成员排成一个与输入顺序无关的次序。 */
function compareSupports(a: ComposeOutlineSupport, b: ComposeOutlineSupport) {
  if (a.kind !== b.kind) return a.kind === 'line' ? -1 : 1
  const left = a.kind === 'line' ? [a.nx, a.ny, a.c] : [a.cx, a.cy, a.r]
  const right = b.kind === 'line' ? [b.nx, b.ny, b.c] : [b.cx, b.cy, b.r]
  for (let index = 0; index < left.length; index += 1) {
    if (left[index]! !== right[index]!) return left[index]! < right[index]! ? -1 : 1
  }
  return 0
}

/** 支撑的比较键；归一之后同组成员逐位相同，因此字符串相等就是同一条支撑。 */
function supportKey(support: ComposeOutlineSupport) {
  return support.kind === 'line'
    ? `L${support.nx},${support.ny},${support.c}`
    : `C${support.cx},${support.cy},${support.r}`
}

/**
 * 某个点落在片段上的参数；不在这条片段**内部**时给 `null`。
 *
 * @remarks
 * 只用于同支撑的两条片段互相切开，因此不再验证点是否真的落在支撑上——调用处已经归一过了。
 */
function parameterOnPiece(
  piece: ComposeOutlinePiece,
  point: ComposePlanarPoint,
): number | null {
  if (piece.kind === 'segment') {
    const direction = subtract(piece.segment.end, piece.segment.start)
    const lengthSquared = dot(direction, direction)
    if (lengthSquared === 0) return null
    const parameter = dot(subtract(point, piece.segment.start), direction) / lengthSquared
    return parameter > 0 && parameter < 1 ? parameter : null
  }
  const { arc } = piece
  const bearing = Math.atan2(point.y - arc.center.y, point.x - arc.center.x) / TO_RADIANS
  const sign = Math.sign(arc.sweep || 1)
  let travelled = sign * (bearing - arc.startAngle)
  travelled -= 360 * Math.floor(travelled / 360)
  const span = Math.abs(arc.sweep)
  return travelled > 0 && travelled < span ? travelled : null
}

/** 把一组片段按彼此的交点切开，并建成平面图。 */
export function buildGraph(
  pieces: readonly ComposeOutlinePiece[],
  epsilon: number,
  quantum = 0,
) {
  const welded = weldComposeOutlineSupports(pieces, quantum)
  const keys = welded.map((piece) => supportKey(composeOutlineSupport(piece)))
  const cuts: number[][] = welded.map(() => [])
  for (let i = 0; i < welded.length; i += 1) {
    for (let j = i + 1; j < welded.length; j += 1) {
      /*
       * 同一条支撑上的两条片段之间没有横穿的交点，只有**重叠**：求交在这一档给不出有意义的
       * 答案（近似共圆的两个圆，径向线本身就是病态的）。改为按对方的端点把自己切开，重叠的
       * 那一截于是逐位相同，交给下面的叠边去重收掉。
       */
      if (keys[i] === keys[j]) {
        const cutAt = (index: number, point: ComposePlanarPoint) => {
          const parameter = parameterOnPiece(welded[index]!, point)
          if (parameter !== null) cuts[index]!.push(parameter)
        }
        cutAt(i, pieceStart(welded[j]!))
        cutAt(i, pieceEnd(welded[j]!))
        cutAt(j, pieceStart(welded[i]!))
        cutAt(j, pieceEnd(welded[i]!))
        continue
      }
      intersectPieces(welded[i]!, welded[j]!).forEach((hit) => {
        cuts[i]!.push(hit.a)
        cuts[j]!.push(hit.b)
      })
    }
  }

  const nodes: ComposePlanarPoint[] = []
  const nodeOf = (point: ComposePlanarPoint) => {
    for (let i = 0; i < nodes.length; i += 1) {
      if (Math.hypot(nodes[i]!.x - point.x, nodes[i]!.y - point.y) <= epsilon) return i
    }
    nodes.push(point)
    return nodes.length - 1
  }

  const subEdges: RegionSubEdge[] = []
  welded.forEach((piece, index) => {
    const span = pieceSpan(piece)
    const closed = piece.kind === 'arc' && isComposeFullCircle(piece.arc)
    const parameters = [...cuts[index]!, 0, span]
      .filter((value) => value >= -PARAMETER_EPSILON && value <= span + PARAMETER_EPSILON)
      .map((value) => Math.min(span, Math.max(0, value)))
      .sort((a, b) => a - b)
    const unique: number[] = []
    parameters.forEach((value) => {
      const last = unique[unique.length - 1]
      if (last === undefined || value - last > PARAMETER_EPSILON) unique.push(value)
    })
    // 整圆没有天然的端头：只有一个切点时它仍是一条首尾同节点的闭合子边，绕行走到那里会原路
    // 再走一圈。切点多于一个时首尾两段要接起来，因此这里不为它补 0 与 span 之外的东西。
    for (let i = 0; i + 1 < unique.length; i += 1) {
      const sub = slicePiece(piece, unique[i]!, unique[i + 1]!)
      const start = pieceStart(sub)
      const end = pieceEnd(sub)
      /*
       * 两端并成同一个节点的子边一律丢掉，**不只丢线段**：按对方端点切开之后，重叠段两侧会各
       * 留一条长度在容差之内的尾巴，而它在弧上同样会出现——绕行走到一条零长的弧上读不出朝向。
       */
      if (!closed && Math.hypot(end.x - start.x, end.y - start.y) <= epsilon) {
        continue
      }
      subEdges.push({
        piece: sub,
        source: index,
        fromNode: nodeOf(start),
        toNode: nodeOf(end),
        startTangent: pieceStartTangent(sub),
        endTangent: pieceEndTangent(sub),
      })
    }
  })

  /*
   * 叠在一起的两条边收成一条。两条画在一起的边界线在图上就是一条边界，留两份的代价很具体：
   * 射线穿过它们会在**同一个距离上**得到两个交点，而那一档分不出「穿过去了」还是「擦到了」，
   * 于是每一个射线方向都退化、整块面求不出来——用户看到的是一个明明围好了的矩形填不上色。
   * 判据是两端节点相同且中点重合：这足以把同一位置上的线段与弧分开。
   */
  const deduped: RegionSubEdge[] = []
  subEdges.forEach((edge) => {
    const midpoint = piecePointAt(edge.piece, pieceSpan(edge.piece) / 2)
    const duplicate = deduped.some((kept) => {
      const sameEnds = (kept.fromNode === edge.fromNode && kept.toNode === edge.toNode)
        || (kept.fromNode === edge.toNode && kept.toNode === edge.fromNode)
      if (!sameEnds) return false
      const keptMid = piecePointAt(kept.piece, pieceSpan(kept.piece) / 2)
      return Math.hypot(keptMid.x - midpoint.x, keptMid.y - midpoint.y) <= epsilon
    })
    if (!duplicate) deduped.push(edge)
  })

  const outgoing: HalfEdgeId[][] = nodes.map(() => [])
  deduped.forEach((edge, index) => {
    outgoing[edge.fromNode]!.push(index * 2)
    outgoing[edge.toNode]!.push(index * 2 + 1)
  })

  return { nodes, subEdges: deduped, outgoing }
}

export type RegionGraph = ReturnType<typeof buildGraph>

function halfTarget(graph: RegionGraph, half: HalfEdgeId) {
  const edge = graph.subEdges[edgeOf(half)]!
  return isReversed(half) ? edge.fromNode : edge.toNode
}

function halfLeaveDirection(graph: RegionGraph, half: HalfEdgeId) {
  const edge = graph.subEdges[edgeOf(half)]!
  return isReversed(half) ? negate(edge.endTangent) : edge.startTangent
}

function halfArriveDirection(graph: RegionGraph, half: HalfEdgeId) {
  const edge = graph.subEdges[edgeOf(half)]!
  return isReversed(half) ? negate(edge.startTangent) : edge.endTangent
}

export function halfPiece(graph: RegionGraph, half: HalfEdgeId): ComposeOutlinePiece {
  const { piece } = graph.subEdges[edgeOf(half)]!
  return isReversed(half) ? reversePiece(piece) : piece
}

/**
 * 到达 `half` 的终点之后，最靠右的那条出边。
 *
 * @remarks
 * 「最靠右」在 y 向下的屏幕坐标里就是**顺时针转角最大**，因此走出来的环恒把面留在右手边——
 * 起手那一条半边按「落点在它右边」挑，两句话是同一条约定的两半。
 *
 * **自由端上掉头**（只剩来路一条）：这不是把间隙放过去，而是把一根伸进面里的线头绕过去。
 * 掉头之后环仍然闭合，只是多出一条零宽的缝；缝在裁掉之后一个像素都不剩。真正没闭合的边界
 * 会由此走到外面去，那时落点不在环内，由调用处判出来。
 */
function rightmostTurn(
  graph: RegionGraph,
  half: HalfEdgeId,
  permit?: StageHalfEdgeFilter,
): HalfEdgeId | null {
  const node = halfTarget(graph, half)
  const arrive = halfArriveDirection(graph, half)
  const back = opposite(half)
  let best: HalfEdgeId | null = null
  let bestAngle = Number.NEGATIVE_INFINITY
  graph.outgoing[node]!.forEach((candidate) => {
    if (candidate === back) return
    if (permit && !permit(candidate)) return
    const leave = halfLeaveDirection(graph, candidate)
    const angle = Math.atan2(cross(arrive, leave), dot(arrive, leave))
    if (angle > bestAngle) {
      bestAngle = angle
      best = candidate
    }
  })
  if (best !== null) return best
  // 自由端：来路就是唯一的路，掉头走回去。
  return graph.outgoing[node]!.includes(back) ? back : null
}

/**
 * 沿最靠右的转向绕一圈。
 *
 * @remarks
 * `permit` 限定只许走哪些**半边**。绕岛时必须给它——岛与外环共用节点是常事（一条内部隔断的
 * 两端都顶在外框上），不限定的话绕岛会从共用节点溜到外环上去，绕回来的是整块外环而不是那座岛。
 *
 * 它是**半边**级而不是子边级：求面那一侧只关心「这条边在不在范围里」，而布尔运算绕的是保留
 * 面的**边界**，同一条边的两个朝向里只有一个是边界——按子边过滤会让绕行有机会顺着反向那一个
 * 走出去，而走出去的是另一块面。
 */
export function traceLoop(
  graph: RegionGraph,
  start: HalfEdgeId,
  permit?: StageHalfEdgeFilter,
): readonly HalfEdgeId[] | null {
  const loop: HalfEdgeId[] = []
  const limit = graph.subEdges.length * 2 + 8
  let current = start
  for (let step = 0; step < limit; step += 1) {
    loop.push(current)
    const next = rightmostTurn(graph, current, permit)
    if (next === null) return null
    if (next === start) return loop
    current = next
  }
  return null
}

/**
 * 裁掉环上的零宽缝：相邻的一对「去了又回」抵消掉。
 *
 * @remarks
 * 掉头留下的那条缝面积为零，画出来一个像素都看不见，但它会让产物多出一串重复顶点，而顶点
 * 是用户接下来要拖的东西。环是首尾相接的，因此抵消要**绕着**做——缝正好跨在接缝处时，只按
 * 线性扫一遍是裁不掉的。
 */
export function pruneSpurs(loop: readonly HalfEdgeId[]): readonly HalfEdgeId[] {
  let current = [...loop]
  for (;;) {
    const count = current.length
    if (count < 2) return current.length === 0 ? [] : current
    let removed = false
    for (let i = 0; i < count; i += 1) {
      const next = (i + 1) % count
      if (current[next] === opposite(current[i]!)) {
        current = current.filter((_, index) => index !== i && index !== next)
        removed = true
        break
      }
    }
    if (!removed) return current
  }
}

/** 环拍扁成多边形，用于包含判定与定向。 */
export function flattenLoop(graph: RegionGraph, loop: readonly HalfEdgeId[]): ComposePlanarPoint[] {
  const points: ComposePlanarPoint[] = []
  loop.forEach((half) => {
    const piece = halfPiece(graph, half)
    if (piece.kind === 'segment') {
      points.push(piece.segment.start)
      return
    }
    const steps = Math.max(2, Math.ceil(Math.abs(piece.arc.sweep) / 5))
    for (let i = 0; i < steps; i += 1) {
      points.push(composeArcPointAt(piece.arc, piece.arc.startAngle + (piece.arc.sweep * i) / steps))
    }
  })
  return points
}

/** 奇偶规则的多边形内部判定。 */
export function polygonContains(polygon: readonly ComposePlanarPoint[], point: ComposePlanarPoint) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!
    const b = polygon[j]!
    if ((a.y > point.y) === (b.y > point.y)) continue
    const x = a.x + ((point.y - a.y) * (b.x - a.x)) / (b.y - a.y)
    if (point.x < x) inside = !inside
  }
  return inside
}

export function polygonArea(polygon: readonly ComposePlanarPoint[]) {
  let total = 0
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    total += (polygon[j]!.x + polygon[i]!.x) * (polygon[j]!.y - polygon[i]!.y)
  }
  return Math.abs(total) / 2
}

/** 环上只连着一条边的节点——也就是自由端。 */
export function freeEnds(graph: RegionGraph, loop: readonly HalfEdgeId[]): readonly ComposePlanarPoint[] {
  const found: ComposePlanarPoint[] = []
  const seen = new Set<number>()
  loop.forEach((half) => {
    const node = halfTarget(graph, half)
    if (seen.has(node) || graph.outgoing[node]!.length !== 1) return
    seen.add(node)
    found.push(graph.nodes[node]!)
  })
  return found
}

export interface RayCrossing {
  readonly half: HalfEdgeId
  readonly distance: number
}

/**
 * 从落点射一条线，按距离由近及远列出穿过的边。
 *
 * @remarks
 * 每条穿过的边都给出「落点在它右边」的那个朝向。射线**擦过节点**或**与某条边相切**时这个
 * 朝向读不出来，此时整条射线作废、换个方向重来——猜一个会让求出的面与用户看到的差一整块。
 */
export function castRay(
  graph: RegionGraph,
  seed: ComposePlanarPoint,
  angle: number,
  reach: number,
  epsilon: number,
): readonly RayCrossing[] | null {
  const direction = { x: Math.cos(angle), y: Math.sin(angle) }
  const ray: ComposeSegmentShape = {
    start: seed,
    end: { x: seed.x + direction.x * reach, y: seed.y + direction.y * reach },
  }
  const rayPiece: ComposeOutlinePiece = { kind: 'segment', segment: ray }
  const crossings: RayCrossing[] = []
  for (let index = 0; index < graph.subEdges.length; index += 1) {
    const edge = graph.subEdges[index]!
    const span = pieceSpan(edge.piece)
    const hits = intersectPieces(rayPiece, edge.piece)
    for (const hit of hits) {
      // 擦到端头：这一下分不出「穿过去了」还是「只是碰了一下」。
      if (hit.b <= PARAMETER_EPSILON * span || hit.b >= span - PARAMETER_EPSILON * span) return null
      if (hit.a <= PARAMETER_EPSILON) return null
      const tangent = pieceTangentAt(edge.piece, hit.b)
      const rightward = { x: -tangent.y, y: tangent.x }
      const towardSeed = negate(direction)
      const side = dot(rightward, towardSeed)
      // 相切：射线贴着边走，哪边是「右边」没有答案。
      if (Math.abs(side) <= 1e-9) return null
      crossings.push({
        half: side > 0 ? index * 2 : index * 2 + 1,
        distance: hit.a * reach,
      })
    }
  }
  // 同一个距离上的两条：射线正好穿过两条边的公共端点，上面的端头判据没能挡住的那一档。
  crossings.sort((a, b) => a.distance - b.distance)
  for (let i = 1; i < crossings.length; i += 1) {
    if (Math.abs(crossings[i]!.distance - crossings[i - 1]!.distance) <= epsilon) return null
  }
  return crossings
}

/** 弧转三次贝塞尔段；闭式解住 `curve-geometry`，这里只换一层类型。 */
function arcToCubics(arc: ComposeArcShape): readonly ComposeCubicSegment[] {
  return composeArcToCubicShapes(arc).map((shape) => ({
    c1: toPosition(shape.c1),
    c2: toPosition(shape.c2),
    to: toPosition(shape.end),
  }))
}

/** 直线段规范化成控制点落在弦上的三次段。 */
function segmentToCubic(segment: ComposeSegmentShape): ComposeCubicSegment {
  return {
    c1: toPosition(lerp(segment.start, segment.end, 1 / 3)),
    c2: toPosition(lerp(segment.start, segment.end, 2 / 3)),
    to: toPosition(segment.end),
  }
}

/**
 * 环上相邻且共线的两段直边并成一段。
 *
 * @remarks
 * 节点是**交点**造出来的，而交点不一定是这块面的**角**：一根线头顶在底边中间，会把底边切成
 * 两条子边，绕行之后那个位置就多出一个顶点。它不携带任何形状信息，而顶点正是用户接下来要拖
 * 的东西——留着它等于在图上放一个拖起来什么都不改变的把手。
 *
 * 判据是两段单位切向的叉积近零，这是**浮点共线**而不是一条容差：真正差一点点的两段边在图上
 * 就是一个角，必须留住那个顶点。环首尾相接，因此这一步也要绕着做。
 */
export function mergeCollinearPieces(
  pieces: readonly ComposeOutlinePiece[],
): readonly ComposeOutlinePiece[] {
  let current = [...pieces]
  for (;;) {
    if (current.length < 2) return current
    let merged = false
    for (let i = 0; i < current.length; i += 1) {
      const next = (i + 1) % current.length
      const a = current[i]!
      const b = current[next]!
      if (a.kind !== 'segment' || b.kind !== 'segment') continue
      const da = normalize(subtract(a.segment.end, a.segment.start))
      const db = normalize(subtract(b.segment.end, b.segment.start))
      if (Math.abs(cross(da, db)) > 1e-9 || dot(da, db) <= 0) continue
      const joined: ComposeOutlinePiece = {
        kind: 'segment',
        segment: { start: a.segment.start, end: b.segment.end },
      }
      const kept = current.filter((_, index) => index !== i && index !== next)
      // 绕过接缝合并时，并出来的那一段要回到环的开头，否则顺序就断了。
      current = next === 0 ? [joined, ...kept] : [...kept.slice(0, i), joined, ...kept.slice(i)]
      merged = true
      break
    }
    if (!merged) return current
  }
}

/**
 * 一列首尾相接的轮廓片段转成一条子路径。
 *
 * @remarks
 * `closed` **由调用方给**而不是恒为真：求面与布尔的区域运算产出的都是闭合环，而**拍平**要
 * 如实搬运作者画下的东西——一段弧、一条没闭合的折线拍完仍然是开的，硬闭合会凭空多出一条弦。
 *
 * 调用方 MUST 传非空的片段列表：空列表没有起点可言，那一档由调用方自己判掉。
 */
export function piecesToSubpath(
  pieces: readonly ComposeOutlinePiece[],
  closed: boolean,
): ComposeSubpath {
  const segments: ComposeCubicSegment[] = []
  pieces.forEach((piece) => {
    if (piece.kind === 'segment') segments.push(segmentToCubic(piece.segment))
    else arcToCubics(piece.arc).forEach((cubic) => segments.push(cubic))
  })
  return { start: toPosition(pieceStart(pieces[0]!)), segments, closed }
}

export function piecesAreStraight(pieces: readonly ComposeOutlinePiece[]) {
  return pieces.every((piece) => piece.kind === 'segment')
}

/**
 * 把若干环收成一条**最窄 kind** 的曲线。
 *
 * @remarks
 * 第一环是外环，其余是岛。产物只有两种：只有一个环且全是直边时落成闭合 `polyline`（顶点可拖、
 * 圆角可调），否则落成 `path`；环多于一个时写 `fillRule: 'evenodd'`，与
 * `isPointInsideComposeCurve` 已有的分派读出同一个答案——因此**看得见的洞与点不中的洞是同一个
 * 洞**。没有岛时 MUST NOT 写 `fillRule`：缺席即 `nonzero`，而单条子路径上两种规则给出同一个
 * 答案，留两种表示只会让「填充规则是什么」在两处读出不同的话。
 *
 * 求面与布尔运算 MUST 共用本函数：两处各写一遍的话，下一个改「最窄 kind」的人只会改到其中
 * 一处，而漏掉的那处的症状是「看得见的形状与点得中的形状不是同一个」。
 *
 * @param rings - 每环是一列首尾相接的轮廓片段；空环跳过。
 * @returns 一条曲线；一个有效的环都没有时返回 `undefined`。
 * @public
 */
export function composeCurveFromOutline(
  rings: readonly (readonly ComposeOutlinePiece[])[],
): ComposeCurve | undefined {
  const usable = rings.filter((ring) => ring.length > 0)
  const outer = usable[0]
  if (!outer) return undefined
  const islands = usable.slice(1)
  if (islands.length === 0 && piecesAreStraight(outer)) {
    return {
      kind: 'polyline',
      vertices: outer.map((piece) => toPosition(pieceStart(piece))),
      closed: true,
    }
  }
  return {
    kind: 'path',
    // 环恒闭合：`usable` 里每一条都是绕出来的一圈，首尾本来就接在一起。
    subpaths: usable.map((ring) => piecesToSubpath(ring, true)),
    // 没有岛时不写：缺席即 `nonzero`，而单条子路径上两种规则读出同一个答案。
    ...(islands.length > 0 ? { fillRule: 'evenodd' as const } : {}),
  }
}
