/**
 * 求出包含一点的那块面。
 *
 * @remarks
 * 输入是一组**已经在同一个坐标空间里**的轮廓片段（调用方把每条候选曲线投影进自己的盒、再乘
 * 世界矩阵，与命中、框选、特征点同一条链），输出是围住落点的那块面。
 *
 * 算法一句话：两两求交把片段切成互不穿越的子边 → 从落点射一条射线找到面的**外**边界 →
 * 沿边走，每到一个节点取最靠右的转向 → 回到起点即闭合。落在外环内部而又走不到的每个连通
 * 分量各成一条子路径（岛），整体写 `evenodd`。
 *
 * 与 `TRIM` 是**同一份数学的另一种用法**：那边在一维上排序取邻居，这边在二维上绕一圈。求交
 * 复用 `curve-geometry.ts` 的那三支（线 × 线、线 × 弧、弧 × 弧），参数轴也照它的约定——线段
 * 是 `[0, 1]`，弧是**走过的角量**。
 *
 * @packageDocumentation
 */

import {
  composeArcPointAt,
  intersectComposeArcs,
  intersectComposeSegmentArc,
  intersectComposeSegments,
  isComposeFullCircle,
  pointToComposeSegmentDistance,
  type ComposeArcShape,
  type ComposeOutlinePiece,
  type ComposePlanarPoint,
  type ComposeSegmentShape,
  type ComposeShapeIntersection,
} from './curve-geometry'
import {
  composeCurveSegments,
  isPointInsideComposeCurve,
  type ComposeCubicSegment,
  type ComposeCurve,
  type ComposeSubpath,
} from './curve'
import type { ComposePosition } from './document-types'

/**
 * 求面的结果。
 *
 * @remarks
 * 三种结局互相可分，这是刻意的——「边界没闭合」与「你点在图外面」要给用户两句不同的话。
 * @public
 */
export type ComposeCurveRegionResult =
  /** 求出了一块面。 */
  | {
    readonly status: 'resolved'
    /** 世界空间的几何；调用方负责归一化进盒。 */
    readonly curve: ComposeCurve
    /** 外环之内被挖空的岛数量；为 0 时 `curve` 没有 `fillRule`。 */
    readonly islandCount: number
    /** 外环用到的每一条输入片段的出处。 */
    readonly sources: readonly ComposeCurveRegionSource[]
  }
  /**
   * 边界没有闭合。
   *
   * @remarks
   * `gaps` 是绕行时走到的**自由端**（只连着一条边的节点）。没有间隙容差，因此这些位置是
   * 用户唯一能据以修图的信息——把一次挫败变成一次诊断。
   */
  | { readonly status: 'open'; readonly gaps: readonly ComposePlanarPoint[] }
  /** 落点不在任何一块围起来的面里。 */
  | { readonly status: 'outside' }

/**
 * 一条输入片段在外环上的出处。
 *
 * @remarks
 * 本函数不认识文档，因此只报**输入片段的下标**，由调用方翻回它自己的对象。
 *
 * 有了它，「这块面的边界恰好是某一个对象的**完整**几何吗」才答得出来——那正是油漆桶该改一个
 * 已有形状的填充、还是该新建一块填充的分水岭。判据要**两半**：出处全来自同一个对象，且那个
 * 对象的每一条片段都**整条**用上了（`used === subEdges`）。少了后半句，一条 8 字形折线的一个
 * 环会被判成「是它自己」，而改它的填充会把**两个**环一起填上，不是用户点的那一个。
 *
 * @public
 */
export interface ComposeCurveRegionSource {
  /** 在 `pieces` 里的下标。 */
  readonly index: number
  /** 这条片段被交点切成了几条子边。 */
  readonly subEdges: number
  /** 其中有几条落在外环上。 */
  readonly used: number
}

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
const NODE_EPSILON_RATIO = 1e-7

/** 参数空间上「同一个切点」的容差；与 `curve-geometry` 的 `TOUCH_TOLERANCE` 同源。 */
const PARAMETER_EPSILON = 1e-6

/** 弧转三次贝塞尔时每段最多走多少度。 */
const MAX_CUBIC_ARC_DEGREES = 90

const TO_RADIANS = Math.PI / 180

/**
 * 射线方向的候选序列。
 *
 * @remarks
 * 正 +x 是第一个（与「射线进面」这条规则的表述一致）。射线**恰好穿过一个节点**或**与某条边
 * 相切**时结果读不出来，此时换一个方向重来——这些角度取得互不成比例，是为了让同一处退化不会
 * 在下一个方向上重演。
 */
const RAY_ANGLES = [0, 0.01234, 0.61803, 1.41421, 2.23607, 3.14159 / 1.7] as const

function subtract(a: ComposePlanarPoint, b: ComposePlanarPoint): ComposePlanarPoint {
  return { x: a.x - b.x, y: a.y - b.y }
}

function cross(a: ComposePlanarPoint, b: ComposePlanarPoint) {
  return a.x * b.y - a.y * b.x
}

function dot(a: ComposePlanarPoint, b: ComposePlanarPoint) {
  return a.x * b.x + a.y * b.y
}

function negate(a: ComposePlanarPoint): ComposePlanarPoint {
  return { x: -a.x, y: -a.y }
}

function normalize(a: ComposePlanarPoint): ComposePlanarPoint {
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
function toPosition(point: ComposePlanarPoint): ComposePosition {
  return { x: point.x, y: point.y }
}

function lerp(a: ComposePlanarPoint, b: ComposePlanarPoint, t: number): ComposePlanarPoint {
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

function pieceStart(piece: ComposeOutlinePiece): ComposePlanarPoint {
  return piece.kind === 'segment'
    ? piece.segment.start
    : composeArcPointAt(piece.arc, piece.arc.startAngle)
}

function pieceEnd(piece: ComposeOutlinePiece): ComposePlanarPoint {
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
function pieceSpan(piece: ComposeOutlinePiece) {
  return piece.kind === 'segment' ? 1 : Math.abs(piece.arc.sweep)
}

function piecePointAt(piece: ComposeOutlinePiece, parameter: number): ComposePlanarPoint {
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
interface RegionSubEdge {
  readonly piece: ComposeOutlinePiece
  /** 它出自 `pieces` 的哪一条。 */
  readonly source: number
  readonly fromNode: number
  readonly toNode: number
  readonly startTangent: ComposePlanarPoint
  readonly endTangent: ComposePlanarPoint
}

/** 半边 id：`子边下标 * 2 + 是否反向`。 */
type HalfEdgeId = number

const edgeOf = (half: HalfEdgeId) => half >> 1
const isReversed = (half: HalfEdgeId) => (half & 1) === 1
const opposite = (half: HalfEdgeId) => half ^ 1

/** 把一组片段按彼此的交点切开，并建成平面图。 */
function buildGraph(pieces: readonly ComposeOutlinePiece[], epsilon: number) {
  const cuts: number[][] = pieces.map(() => [])
  for (let i = 0; i < pieces.length; i += 1) {
    for (let j = i + 1; j < pieces.length; j += 1) {
      intersectPieces(pieces[i]!, pieces[j]!).forEach((hit) => {
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
  pieces.forEach((piece, index) => {
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
      if (!closed && Math.hypot(end.x - start.x, end.y - start.y) <= epsilon && sub.kind === 'segment') {
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

type RegionGraph = ReturnType<typeof buildGraph>

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

function halfPiece(graph: RegionGraph, half: HalfEdgeId): ComposeOutlinePiece {
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
  allowed?: ReadonlySet<number>,
): HalfEdgeId | null {
  const node = halfTarget(graph, half)
  const arrive = halfArriveDirection(graph, half)
  const back = opposite(half)
  let best: HalfEdgeId | null = null
  let bestAngle = Number.NEGATIVE_INFINITY
  graph.outgoing[node]!.forEach((candidate) => {
    if (candidate === back) return
    if (allowed && !allowed.has(edgeOf(candidate))) return
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
 * `allowed` 限定只许走哪些子边。绕岛时必须给它——岛与外环共用节点是常事（一条内部隔断的两端
 * 都顶在外框上），不限定的话绕岛会从共用节点溜到外环上去，绕回来的是整块外环而不是那座岛。
 */
function traceLoop(
  graph: RegionGraph,
  start: HalfEdgeId,
  allowed?: ReadonlySet<number>,
): readonly HalfEdgeId[] | null {
  const loop: HalfEdgeId[] = []
  const limit = graph.subEdges.length * 2 + 8
  let current = start
  for (let step = 0; step < limit; step += 1) {
    loop.push(current)
    const next = rightmostTurn(graph, current, allowed)
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
function pruneSpurs(loop: readonly HalfEdgeId[]): readonly HalfEdgeId[] {
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
function flattenLoop(graph: RegionGraph, loop: readonly HalfEdgeId[]): ComposePlanarPoint[] {
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
function polygonContains(polygon: readonly ComposePlanarPoint[], point: ComposePlanarPoint) {
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

function polygonArea(polygon: readonly ComposePlanarPoint[]) {
  let total = 0
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    total += (polygon[j]!.x + polygon[i]!.x) * (polygon[j]!.y - polygon[i]!.y)
  }
  return Math.abs(total) / 2
}

/** 环上只连着一条边的节点——也就是自由端。 */
function freeEnds(graph: RegionGraph, loop: readonly HalfEdgeId[]): readonly ComposePlanarPoint[] {
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

interface RayCrossing {
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
function castRay(
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

/** 弧转三次贝塞尔段；每段最多走 90°。 */
function arcToCubics(arc: ComposeArcShape): readonly ComposeCubicSegment[] {
  const total = arc.sweep
  const count = Math.max(1, Math.ceil(Math.abs(total) / MAX_CUBIC_ARC_DEGREES))
  const step = total / count
  const segments: ComposeCubicSegment[] = []
  for (let i = 0; i < count; i += 1) {
    const from = (arc.startAngle + step * i) * TO_RADIANS
    const to = (arc.startAngle + step * (i + 1)) * TO_RADIANS
    // 经典闭式解：控制点沿两端切线各伸出 (4/3)·tan(Δ/4)·r。每 90° 一段时最大径向误差约
    // 半径的 2.7e-4（半径 500px 上 0.14px）。
    const handle = ((4 / 3) * Math.tan((to - from) / 4)) * arc.radius
    const start = { x: Math.cos(from), y: Math.sin(from) }
    const end = { x: Math.cos(to), y: Math.sin(to) }
    segments.push({
      c1: toPosition({
        x: arc.center.x + arc.radius * start.x - handle * start.y,
        y: arc.center.y + arc.radius * start.y + handle * start.x,
      }),
      c2: toPosition({
        x: arc.center.x + arc.radius * end.x + handle * end.y,
        y: arc.center.y + arc.radius * end.y - handle * end.x,
      }),
      to: toPosition({
        x: arc.center.x + arc.radius * end.x,
        y: arc.center.y + arc.radius * end.y,
      }),
    })
  }
  return segments
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
function mergeCollinearPieces(
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

function loopPieces(graph: RegionGraph, loop: readonly HalfEdgeId[]) {
  return mergeCollinearPieces(loop.map((half) => halfPiece(graph, half)))
}

function piecesToSubpath(pieces: readonly ComposeOutlinePiece[]): ComposeSubpath {
  const segments: ComposeCubicSegment[] = []
  pieces.forEach((piece) => {
    if (piece.kind === 'segment') segments.push(segmentToCubic(piece.segment))
    else arcToCubics(piece.arc).forEach((cubic) => segments.push(cubic))
  })
  return { start: toPosition(pieceStart(pieces[0]!)), segments, closed: true }
}

function piecesAreStraight(pieces: readonly ComposeOutlinePiece[]) {
  return pieces.every((piece) => piece.kind === 'segment')
}

/** 找出外环内部那些没被外环用掉的连通分量，各绕出一条闭合环。 */
function resolveIslands(
  graph: RegionGraph,
  outerEdges: ReadonlySet<number>,
  outerPolygon: readonly ComposePlanarPoint[],
): readonly (readonly HalfEdgeId[])[] {
  const usedEdges = outerEdges
  const inside: number[] = []
  graph.subEdges.forEach((edge, index) => {
    if (usedEdges.has(index)) return
    const midpoint = piecePointAt(edge.piece, pieceSpan(edge.piece) / 2)
    if (polygonContains(outerPolygon, midpoint)) inside.push(index)
  })
  if (inside.length === 0) return []

  // 按共享节点分组：一个连通分量就是一座岛。
  const parent = new Map<number, number>()
  const find = (value: number): number => {
    const next = parent.get(value)
    if (next === undefined || next === value) return value
    const root = find(next)
    parent.set(value, root)
    return root
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  inside.forEach((index) => parent.set(index, index))
  const byNode = new Map<number, number[]>()
  inside.forEach((index) => {
    const edge = graph.subEdges[index]!;
    [edge.fromNode, edge.toNode].forEach((node) => {
      const list = byNode.get(node)
      if (list) list.push(index)
      else byNode.set(node, [index])
    })
  })
  byNode.forEach((list) => list.forEach((index) => union(index, list[0]!)))

  const components = new Map<number, number[]>()
  inside.forEach((index) => {
    const root = find(index)
    const list = components.get(root)
    if (list) list.push(index)
    else components.set(root, [index])
  })

  const islands: (readonly HalfEdgeId[])[] = []
  components.forEach((edges) => {
    // 两个朝向各绕一圈，取围出面积更大的那一个——那是这座岛的**外**边界。简单闭合曲线上两者
    // 是同一组边，取哪个都一样；这一步只在岛自己还带着结构时才起作用。
    let best: readonly HalfEdgeId[] | null = null
    let bestArea = 0
    const scope = new Set(edges)
    for (const half of [edges[0]! * 2, edges[0]! * 2 + 1]) {
      const traced = traceLoop(graph, half, scope)
      if (!traced) continue
      const pruned = pruneSpurs(traced)
      if (pruned.length === 0) continue
      const area = polygonArea(flattenLoop(graph, pruned))
      if (area > bestArea) {
        bestArea = area
        best = pruned
      }
    }
    if (best) islands.push(best)
  })
  return islands
}

/**
 * 求出包含 `seed` 的那块面。
 *
 * @remarks
 * `pieces` 是**同一个坐标空间**里的全部候选边界；调用方负责投影与筛选，本函数不认识任何
 * 文档协议。产物取能表达该几何的**最窄 kind**：没有岛且全是直边时落成闭合 `polyline`，
 * 否则落成 `path`；有岛时写 `fillRule: 'evenodd'`，与 `isPointInsideComposeCurve` 已有的
 * 分派读出同一个答案，因此**看得见的洞与点不中的洞是同一个洞**。
 *
 * @public
 */
export function resolveComposeCurveRegion(
  pieces: readonly ComposeOutlinePiece[],
  seed: ComposePlanarPoint,
): ComposeCurveRegionResult {
  if (pieces.length === 0) return { status: 'outside' }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  pieces.forEach((piece) => {
    const samples = piece.kind === 'segment'
      ? [piece.segment.start, piece.segment.end]
      : [
        { x: piece.arc.center.x - piece.arc.radius, y: piece.arc.center.y - piece.arc.radius },
        { x: piece.arc.center.x + piece.arc.radius, y: piece.arc.center.y + piece.arc.radius },
      ]
    samples.forEach((point) => {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    })
  })
  const scale = Math.max(1, maxX - minX, maxY - minY)
  const epsilon = NODE_EPSILON_RATIO * scale
  const reach = Math.hypot(maxX - minX, maxY - minY) * 2 + scale

  const graph = buildGraph(pieces, epsilon)
  if (graph.subEdges.length === 0) return { status: 'outside' }

  let crossings: readonly RayCrossing[] | null = null
  for (const angle of RAY_ANGLES) {
    crossings = castRay(graph, seed, angle, reach, epsilon)
    if (crossings) break
  }
  if (!crossings || crossings.length === 0) return { status: 'outside' }

  const traversedEdges = new Set<number>()
  const gaps: ComposePlanarPoint[] = []
  for (const crossing of crossings) {
    if (traversedEdges.has(edgeOf(crossing.half))) continue
    const traced = traceLoop(graph, crossing.half)
    if (!traced) continue
    // 用**没裁过**的那一份记账：裁掉的零宽缝仍然是这次绕行走过的边，漏掉它们会让一根伸进面里
    // 的线头在下一步被当成一座岛，于是明明实心的一块面被挖出一条缝。
    const walked = new Set(traced.map(edgeOf))
    walked.forEach((edge) => traversedEdges.add(edge))
    const loop = pruneSpurs(traced)
    if (loop.length === 0) {
      freeEnds(graph, traced).forEach((point) => gaps.push(point))
      continue
    }
    const polygon = flattenLoop(graph, loop)
    if (!polygonContains(polygon, seed)) {
      // 走出去的是外面那一圈：把它经过的自由端记下来，那正是边界没闭合的地方。
      freeEnds(graph, traced).forEach((point) => gaps.push(point))
      continue
    }
    /*
     * 出处按**去重之后**的子边算：叠在一起的两条边收成了一条，那一条只算在留下的那个出处上。
     * 推论是「两个一模一样的矩形叠在一起」时没有哪一个是完整的，于是走新建那一支——填哪一个
     * 本来就没有答案，新建至少是用户看得见的那一块。
     */
    const subEdgeTotals = new Map<number, number>()
    graph.subEdges.forEach((edge) => {
      subEdgeTotals.set(edge.source, (subEdgeTotals.get(edge.source) ?? 0) + 1)
    })
    const usedBySource = new Map<number, number>()
    new Set(loop.map(edgeOf)).forEach((edge) => {
      const source = graph.subEdges[edge]!.source
      usedBySource.set(source, (usedBySource.get(source) ?? 0) + 1)
    })
    const sources = [...usedBySource.entries()]
      .map(([index, used]) => ({ index, used, subEdges: subEdgeTotals.get(index) ?? used }))
      .sort((a, b) => a.index - b.index)

    const islands = resolveIslands(graph, walked, polygon).map((island) => loopPieces(graph, island))
    const outline = loopPieces(graph, loop)
    const curve: ComposeCurve = islands.length === 0 && piecesAreStraight(outline)
      ? {
        kind: 'polyline',
        vertices: outline.map((piece) => toPosition(pieceStart(piece))),
        closed: true,
      }
      : {
        kind: 'path',
        subpaths: [piecesToSubpath(outline), ...islands.map((island) => piecesToSubpath(island))],
        // 没有岛时不写：缺席即 `nonzero`，而单条子路径上两种规则读出同一个答案。
        ...(islands.length > 0 ? { fillRule: 'evenodd' as const } : {}),
      }
    return { status: 'resolved', curve, islandCount: islands.length, sources }
  }

  if (gaps.length > 0) {
    const unique: ComposePlanarPoint[] = []
    gaps.forEach((point) => {
      if (unique.some((kept) => Math.hypot(kept.x - point.x, kept.y - point.y) <= epsilon)) return
      unique.push(point)
    })
    return { status: 'open', gaps: unique }
  }
  return { status: 'outside' }
}

/**
 * 求一块面的**最大内切圆圆心**——离每一条边界都尽可能远的那个点。
 *
 * @remarks
 * 它回答的是「这块面的身份放在哪一点」。填充跟着边界走时，锚点如果停在用户当初点的地方，
 * 它**迟早**会在某次变形之后被吞进另一块面——用户点填充时爱点在空的地方，也就是角落，
 * 而角落最容易被吞。重取到内切圆圆心之后它离每条边界都最远，边界要吞掉它就得先把整块面压扁
 * 到比这个内切圆还窄，**而那时求解本来就会失败**——于是结果是「标失效」这个看得见的答案，
 * 而不是「悄悄换成另一块面」这个看不见的答案。
 *
 * 算法是 Mapbox `polylabel` 的那一支：四叉细分 + 优先队列，每个格子用「圆心到边界的距离 +
 * 半对角线」作为它内部可能达到的上界，上界不超过当前最优就整格丢掉。
 *
 * **两个入口都是既有的**：到边界的距离走 `composeCurveSegments`，内外判定走
 * `isPointInsideComposeCurve`（它已经按 `fillRule` 分派）。因此带洞的面天然是对的——
 * 洞里的点判定为外部，距离又把圆心从洞边推开，**看得见的洞与推开圆心的洞是同一个洞**。
 *
 * 弧与贝塞尔边由 `composeCurveSegments` 采样成折线。本函数**只用来选一个点、不产出任何
 * 几何**，因此这处近似不违反「这块画布上每条几何都是真几何」。
 *
 * **不为它做缓存**：`isPointInsideComposeCurve` 每次调用都会把曲线重新拍成环，看起来该缓存
 * 一份，但量下来一次 600×400 矩形 2.6ms、一次整圆 0.1ms——而它**每次跟随只跑一次**，
 * 跟随本身已经是一次 O(N²) 的两两求交。缓存换来的是一条与渲染、命中不共用入口的私有路径，
 * 那正是「看得见的洞与点不中的洞不是同一个洞」的来路。
 *
 * @param curve - 已投影进盒坐标系的几何（与 `isPointInsideComposeCurve` 同一个空间）。
 * @returns 面已经没有内部（面积为零、或细到采样分辨率之下）时返回 `undefined`，
 *          由调用方决定怎么办——**不返回一个落在边界上的点**：那种点下一次变形必然掉出去。
 * @public
 */
export function composeCurveInnerAnchor(curve: ComposeCurve): ComposePosition | undefined {
  const segments = composeCurveSegments(curve)
  if (segments.length === 0) return undefined

  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity
  for (const { start, end } of segments) {
    minX = Math.min(minX, start.x, end.x); maxX = Math.max(maxX, start.x, end.x)
    minY = Math.min(minY, start.y, end.y); maxY = Math.max(maxY, start.y, end.y)
  }
  const width = maxX - minX
  const height = maxY - minY
  if (!(width > 0) || !(height > 0)) return undefined

  /** 带符号的到边界距离：面内为正，面外为负。负值让格子的上界自动把外部区域压下去。 */
  const signedDistance = (point: ComposePlanarPoint) => {
    let best = Infinity
    for (const segment of segments) {
      best = Math.min(best, pointToComposeSegmentDistance(segment, point))
    }
    return isPointInsideComposeCurve(curve, point) ? best : -best
  }

  interface Cell {
    readonly x: number
    readonly y: number
    /** 半边长。 */
    readonly h: number
    readonly d: number
    /** 这个格子内部可能达到的最大距离——细分的上界。 */
    readonly max: number
  }
  const makeCell = (x: number, y: number, h: number): Cell => {
    const d = signedDistance({ x, y })
    return { x, y, h, d, max: d + h * Math.SQRT2 }
  }

  // 精度取短边的千分之一：再细下去换不来可见的位移，而这个点只用来做下一次求解的起点。
  const precision = Math.min(width, height) / 1000
  const cellSize = Math.min(width, height)
  let best = makeCell(minX + width / 2, minY + height / 2, 0)

  /*
   * 种子网格铺满包围盒。只从中心一个格子出发是不够的：凹形（L 形、带大洞的环）的中心可能落在
   * 面外，那一格的上界会把真正的最优区域一起剪掉。
   */
  const queue: Cell[] = []
  const step = cellSize / 2
  for (let x = minX; x < maxX; x += step) {
    for (let y = minY; y < maxY; y += step) {
      queue.push(makeCell(x + step / 2, y + step / 2, step / 2))
    }
  }
  // 包围盒中心单独试一次：矩形上它就是答案，省掉整轮细分。
  for (const cell of queue) {
    if (cell.d > best.d) best = cell
  }

  // 上界最大的先细分——优先队列的效果，而这里的规模（几百个格子）用线性取最大更简单。
  let guard = 20000
  while (queue.length > 0 && guard-- > 0) {
    let index = 0
    for (let i = 1; i < queue.length; i += 1) {
      if (queue[i]!.max > queue[index]!.max) index = i
    }
    const cell = queue.splice(index, 1)[0]!
    // 这一格再怎么细分也超不过已知最优，整格丢掉。
    if (cell.max - best.d <= precision) continue
    const h = cell.h / 2
    for (const [dx, dy] of [[-h, -h], [h, -h], [-h, h], [h, h]] as const) {
      const child = makeCell(cell.x + dx, cell.y + dy, h)
      if (child.d > best.d) best = child
      queue.push(child)
    }
  }

  // 圆心落在边界上或外面，说明这块面没有真正的内部——不返回一个下次必然掉出去的点。
  if (!(best.d > precision)) return undefined
  return toPosition({ x: best.x, y: best.y })
}
