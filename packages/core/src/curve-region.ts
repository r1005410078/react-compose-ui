/**
 * 求出包含一点的那块面。
 *
 * @remarks
 * 输入是一组**已经在同一个坐标空间里**的轮廓片段（调用方把每条候选曲线投影进自己的盒、再乘
 * 世界矩阵，与命中、框选、特征点同一条链），输出是围住落点的那块面。
 *
 * 平面图、绕环与「环 → 曲线」住 `curve-arrangement.ts`——那一层是求面与布尔运算共用的。
 * 本模块只回答**这一个**问题：从落点射一条射线找到面的外边界，落在外环内部而又走不到的每个
 * 连通分量各成一座岛。
 *
 * 与 `TRIM` 是**同一份数学的另一种用法**：那边在一维上排序取邻居，这边在二维上绕一圈。
 *
 * @packageDocumentation
 */

import {
  pointToComposeSegmentDistance,
  type ComposeOutlinePiece,
  type ComposePlanarPoint,
} from './curve-geometry'
import {
  NODE_EPSILON_RATIO,
  RAY_ANGLES,
  buildGraph,
  composeCurveFromOutline,
  castRay,
  edgeOf,
  flattenLoop,
  freeEnds,
  halfPiece,
  mergeCollinearPieces,
  piecePointAt,
  pieceSpan,
  pieceStart,
  polygonArea,
  polygonContains,
  pruneSpurs,
  toPosition,
  traceLoop,
  type HalfEdgeId,
  type RayCrossing,
  type RegionGraph,
} from './curve-arrangement'
import {
  composeCurveSegments,
  isPointInsideComposeCurve,
  type ComposeCurve,
} from './curve'
import { COMPOSE_GEOMETRY_QUANTUM } from './geometry-precision'
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
    /**
     * 产物用到的每一条输入片段的出处，**外环与岛都算**。
     *
     * @remarks
     * 岛一并算进来，是因为一座岛同样是围出这块面的边界——画出来的那个洞就是它。跟随那一侧
     * 拿这份出处推出边界清单，少了挖洞的那个对象，下一次按清单重求时它根本不在输入里，洞会
     * 被悄悄补平。
     */
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

function loopPieces(graph: RegionGraph, loop: readonly HalfEdgeId[]) {
  return mergeCollinearPieces(loop.map((half) => halfPiece(graph, half)))
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
      const traced = traceLoop(graph, half, (candidate) => scope.has(edgeOf(candidate)))
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
 * 把一圈轮廓片段旋转到一个**只由这块面决定**的起点。
 *
 * @remarks
 * 环是一个圈，从哪一段开始写下来在几何上没有区别——但求解从射线**第一次穿过**的那条边起手，
 * 而射线是从落点射出去的，因此**在同一块面里点不同的地方会写出起点不同的同一个环**。
 *
 * 这在屏幕上看不出来，却让「这一次求出来的，是不是上一次求出来的那一个」这句判断失效：
 * 填过一块面之后换个位置再点一次，逐位比较会说「不是同一块」，于是又叠一块上去。
 * 因此起点取**字典序最小的那个顶点**（先 x 后 y）：走向已经由右手法则定死，起点定死之后，
 * 同一块面的产物就只由这块面决定。
 */
function canonicalRing(pieces: readonly ComposeOutlinePiece[]): readonly ComposeOutlinePiece[] {
  if (pieces.length < 2) return pieces
  let best = 0
  for (let index = 1; index < pieces.length; index += 1) {
    const point = pieceStart(pieces[index]!)
    const winner = pieceStart(pieces[best]!)
    if (point.x < winner.x || (point.x === winner.x && point.y < winner.y)) best = index
  }
  return best === 0 ? pieces : [...pieces.slice(best), ...pieces.slice(0, best)]
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
  quantum: number = COMPOSE_GEOMETRY_QUANTUM,
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
  // 与布尔同一条：相对量是浮点卫生，量化步长是「同一个点存了两份」的下限，取较大者。
  const epsilon = Math.max(NODE_EPSILON_RATIO * scale, quantum)
  const reach = Math.hypot(maxX - minX, maxY - minY) * 2 + scale

  const graph = buildGraph(pieces, epsilon, quantum)
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
    const islandLoops = resolveIslands(graph, walked, polygon)
    const islands = islandLoops.map((island) => canonicalRing(loopPieces(graph, island)))
    const outline = canonicalRing(loopPieces(graph, loop))
    /*
     * 出处按**去重之后**的子边算：叠在一起的两条边收成了一条，那一条只算在留下的那个出处上。
     * 推论是「两个一模一样的矩形叠在一起」时没有哪一个是完整的，于是走新建那一支——填哪一个
     * 本来就没有答案，新建至少是用户看得见的那一块。
     *
     * **岛的边一并算进来**：一座岛同样是围出这块面的边界，画出来的洞就是它。只报外环那一份
     * 的症状不在这一步——它在**跟随**那一侧：清单里少了挖洞的那个对象，下一次按清单重求时它
     * 根本不在输入里，于是洞被悄悄补平，而用户没有动过它。
     */
    const subEdgeTotals = new Map<number, number>()
    graph.subEdges.forEach((edge) => {
      subEdgeTotals.set(edge.source, (subEdgeTotals.get(edge.source) ?? 0) + 1)
    })
    const usedBySource = new Map<number, number>()
    new Set([loop, ...islandLoops].flat().map(edgeOf)).forEach((edge) => {
      const source = graph.subEdges[edge]!.source
      usedBySource.set(source, (usedBySource.get(source) ?? 0) + 1)
    })
    const sources = [...usedBySource.entries()]
      .map(([index, used]) => ({ index, used, subEdges: subEdgeTotals.get(index) ?? used }))
      .sort((a, b) => a.index - b.index)

    const curve = composeCurveFromOutline([outline, ...islands])!
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
