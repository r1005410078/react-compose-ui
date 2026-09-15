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

/** 把一组片段按彼此的交点切开，并建成平面图。 */
export function buildGraph(pieces: readonly ComposeOutlinePiece[], epsilon: number) {
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
