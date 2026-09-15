/**
 * 曲线布尔运算：并集、差集、交集、异或与拍平。
 *
 * @remarks
 * 四条区域运算走**面分类法**：把全部操作数的轮廓片段丢进**一张**平面图，枚举出全部有界面，
 * 每块面取一个内点问「在哪几个操作数里面」，按运算的谓词决定留不留，最后把保留下来的面合并、
 * 绕出外环与洞。四条运算之间**没有任何算法差别，只差一个谓词**。
 *
 * **不走逐交点标「进 / 出」的边裁剪**（Greiner–Hormann 那一类）：共线重叠边、顶点落在对方边
 * 身上、两条弧相切各要一条特判，而网格吸附让两个矩形共享一条边正是本产品最常出现的情形。
 * 面分类把退化交给**已经处理过它们的那一层**——`buildGraph` 的叠边去重与 `castRay` 的多方向
 * 重试，那笔账仓库已经为求面付过一次。
 *
 * 拍平与那四条的差别是**根本的**：它不求交、不做任何区域判定，只把每条几何换成一条子路径。
 * 因此它没有退化情形，也没有失败——四条区域运算要的那张平面图，它一张都不用建。
 *
 * 输入 MUST 已经在同一个坐标空间里（调用方负责投影），与求面同一条约定：本模块不认识 Entity、
 * 不认识矩阵、不认识文档。
 *
 * @packageDocumentation
 */

import {
  flattenComposeOutline,
  pointToComposeSegmentDistance,
  type ComposeOutlinePiece,
  type ComposePlanarPoint,
} from './curve-geometry'
import {
  NODE_EPSILON_RATIO,
  buildGraph,
  composeCurveFromOutline,
  edgeOf,
  halfPiece,
  mergeCollinearPieces,
  opposite,
  piecePointAt,
  pieceSpan,
  piecesToSubpath,
  pruneSpurs,
  traceLoop,
  type HalfEdgeId,
  type RegionGraph,
} from './curve-arrangement'
import {
  composePolylineOutline,
  isPointInsideComposeCurve,
  type ComposeCurve,
  type ComposePathCurve,
  type ComposeSubpath,
} from './curve'
import { COMPOSE_GEOMETRY_QUANTUM } from './geometry-precision'

/**
 * 一条曲线拍平成若干子路径。
 *
 * @remarks
 * `path` 的子路径**逐字段原样搬过来**：它已经是三次贝塞尔了，再走一遍转换只会引入舍入。
 * 其余三种 kind 各只有一条子路径；多段线的圆角走 {@link composePolylineOutline}，也就是命中、
 * 框选与渲染读的**同一列**片段——拍平之后的轮廓因此与拍平之前逐像素相同。
 */
function curveToSubpaths(curve: ComposeCurve): readonly ComposeSubpath[] {
  if (curve.kind === 'path') return curve.subpaths
  if (curve.kind === 'line') {
    const segment = { start: curve.start, end: curve.end }
    return [piecesToSubpath([{ kind: 'segment', segment }], false)]
  }
  if (curve.kind === 'arc') {
    // 整圆闭合，一段弧不闭合：`closed` 表达的是「首尾是不是同一个点」，而整圆恰好是。
    return [piecesToSubpath([{ kind: 'arc', arc: curve }], Math.abs(curve.sweep) >= 360)]
  }
  const pieces = composePolylineOutline(curve)
  // 单顶点多段线（校验会拒，但拍平不该因此抛错）没有片段可搬，落成零条子路径。
  return pieces.length === 0 ? [] : [piecesToSubpath(pieces, curve.closed)]
}

/**
 * 把若干条几何拍平成**一条** `path`。
 *
 * @remarks
 * 它 MUST NOT 求交、MUST NOT 做任何区域判定——那是四条区域运算的事。轮廓一个像素都不变，
 * 变的只是「这是几个对象」和「顶点还是控制手柄」。
 *
 * 产物**恒是 `path`**，这是「写入方 MUST 取能表达该几何的最窄 kind」那条规则的**唯一例外**。
 * 例外由规则自己的理由推出：那条规则防的是「落错 kind 的症状是这条线看起来一样却拖不动顶点」，
 * 而拍平的**目的**正是把顶点换成控制手柄（把一个圆角矩形变成能拖控制手柄的路径，是用户按下
 * 这个按钮的主要理由）。任何其他写入方 MUST NOT 援引本例外。
 *
 * `fillRule` 取「任一操作数是 `evenodd` 就是 `evenodd`」，否则缺席（即 `nonzero`）。
 * 判据是**洞不能被填平**：一块带洞的填充拍平之后洞还得在，而那是看得见的。代价写在明处——
 * 此时若两个操作数还互相重叠，重叠的那一块会被挖空；真正的解法是按嵌套深度归一化各环的绕向
 * 再落 `nonzero`，那要一轮环包含判定，留给后续。
 *
 * @param curves - 已经在同一个坐标空间里的几何；空数组返回一条没有子路径的 `path`。
 * @returns 一条 `path`；调用方负责归一化进盒。
 * @public
 */
export function flattenComposeCurves(curves: readonly ComposeCurve[]): ComposePathCurve {
  const subpaths = curves.flatMap((curve) => curveToSubpaths(curve))
  const evenodd = curves.some((curve) => curve.kind === 'path' && curve.fillRule === 'evenodd')
  return evenodd
    ? { kind: 'path', subpaths, fillRule: 'evenodd' }
    : { kind: 'path', subpaths }
}

/**
 * 四条区域运算。
 *
 * @remarks
 * 拍平不在这个联合里：它不求交、不做区域判定，与这四条不是同一件事。
 * @public
 */
export type ComposeBooleanOp = 'union' | 'subtract' | 'intersect' | 'exclude'

/** 一个参与运算的形状：它在公共坐标空间里的一列轮廓片段。 @public */
export interface ComposeBooleanOperand {
  readonly pieces: readonly ComposeOutlinePiece[]
  /**
   * 判「某一点在不在这个形状里」时用的曲线；**缺席时由 {@link pieces} 收成一条单环曲线**。
   *
   * @remarks
   * 一块带岛的填充是两条子路径加 `evenodd`，而片段摊平之后收成「一条环」会把岛也算进去——
   * 内外判定就反了，症状是挖掉的洞在布尔结果里被补平。
   *
   * 调用方 MUST 只在片段**不足以还原内外规则**时传它（也就是多于一条环、或带 `fillRule`
   * 的 `path`）：其余情形两种做法给出同一个答案，传与不传没有区别。
   */
  readonly curve?: ComposeCurve
}

/**
 * 一次区域运算的结果。
 *
 * @remarks
 * 三支互相可分是刻意的——「这两个形状没有重叠」与「这几个形状算不出来」要给用户两句不同的话。
 * 前者按一下别的运算就好，后者要把形状错开一点再试。
 * @public
 */
export type ComposeCurveBooleanResult =
  | {
    readonly status: 'resolved'
    /** 公共坐标空间的几何；调用方负责归一化进盒。 */
    readonly curve: ComposeCurve
    /** 结果里被挖空的洞数量；为 0 时 `curve` 没有 `fillRule`。 */
    readonly islandCount: number
  }
  /** 按这条运算保留下来的面积为零。 */
  | { readonly status: 'empty' }
  /** 平面图退化，绕不出边界。 */
  | { readonly status: 'degenerate' }

/**
 * 多边形的**有向**面积；顺时针（屏幕坐标，y 向下）为负。
 *
 * @remarks
 * 与 `curve-arrangement` 的 `polygonArea` 是两个问题：那边回答「多大」（取绝对值，岛的挑选
 * 只比大小），这边回答「朝哪边绕」。最右转向让面恒落在行进方向的右手边，因此**有界面恒为负、
 * 无界的那一圈恒为正**——枚举面时正是靠这个符号把外面那一圈剔掉。
 */
function signedArea(polygon: readonly ComposePlanarPoint[]): number {
  let total = 0
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    total += (polygon[j]!.x + polygon[i]!.x) * (polygon[j]!.y - polygon[i]!.y)
  }
  return total / 2
}

/**
 * 一条半边旁边那块**元胞**里的一点。
 *
 * @remarks
 * 元胞是平面被全部边切开之后的一块连通区域。**刻意不去枚举「面」**：绕半边只能绕出**连通
 * 分量**的环，而一个形状整个落在另一个形状内部时两者不连通——那时绕出来的是大的那一圈，
 * 它把小的那块也算了进去，于是「大的挖掉小的」这块元胞根本没有代表。症状是「一个矩形减掉
 * 里面一个圆」求出来是空的。
 *
 * 判据因此落在**边**上而不是面上：一条边的两侧各属于一块元胞，取边中点沿法向让开一点点就
 * 落在其中一侧。让开的量取「中点到**其余每一条**边的最近距离」的一半——中点周围这个半径内
 * 只有它自己这条边，因此让开之后一定还在相邻的那块元胞里，再窄的元胞也不会跨出去。
 *
 * 法向取 `(-dy, dx)`：它指向**这条半边绕出来的那个环所围的那一侧**，与最右转向「面恒在右手
 * 边」是同一个约定的两种写法。
 */
function cellSample(
  graph: RegionGraph,
  half: HalfEdgeId,
  clearance: number,
): ComposePlanarPoint | null {
  const piece = halfPiece(graph, half)
  const span = pieceSpan(piece)
  if (!(span > 0) || !(clearance > 0)) return null
  const midpoint = piecePointAt(piece, span / 2)
  const before = piecePointAt(piece, span * 0.4)
  const after = piecePointAt(piece, span * 0.6)
  const dx = after.x - before.x
  const dy = after.y - before.y
  const length = Math.hypot(dx, dy)
  if (!(length > 0)) return null
  /*
   * 让开量还要被这条边**自己的曲率**钳住。`clearance` 只保证这个半径内没有**别的**边，而弧会
   * 自己绕回来：一个远离其余几何的小圆，它的 `clearance` 是到外框的距离，让开 `clearance/2`
   * 直接跨到圆的另一侧——症状是「大矩形减掉里面一个小圆」求出来**没有洞**，而且不报错。
   * 取半径（而不是刚好够用的 2r）是留一倍余量：取样点只要落在相邻元胞里，不必贴着边。
   */
  const limit = piece.kind === 'arc' ? Math.min(clearance, piece.arc.radius) : clearance
  const offset = limit / 2
  return { x: midpoint.x - (dy / length) * offset, y: midpoint.y + (dx / length) * offset }
}

/**
 * 每条子边中点到**其余**子边的最近距离。
 *
 * @remarks
 * 它决定取样点让开多远。按中点算而不是按整条边算：让开量只在中点那一处用得上，而按整条边取
 * 最小值会在两条边端点相接时退化成零——端点相接是这张图上最常见的情形。
 */
function clearances(graph: RegionGraph): readonly number[] {
  const midpoints = graph.subEdges.map((edge) => {
    const span = pieceSpan(edge.piece)
    return piecePointAt(edge.piece, span / 2)
  })
  const flattened = graph.subEdges.map((edge) => flattenComposeOutline([edge.piece]))
  return midpoints.map((midpoint, index) => {
    let nearest = Number.POSITIVE_INFINITY
    flattened.forEach((segments, other) => {
      if (other === index) return
      segments.forEach((segment) => {
        nearest = Math.min(nearest, pointToComposeSegmentDistance(segment, midpoint))
      })
    })
    return nearest
  })
}

/**
 * 按运算决定一块面留不留。
 *
 * @remarks
 * 四条运算的全部差别就在这一个函数里。多于两个操作数时这四句话**原样成立**，
 * MUST NOT 退化成两两归约——每一步归约都要重建一次平面图，中间产物的浮点误差还会逐级放大。
 */
function keepsFace(op: ComposeBooleanOp, memberships: readonly boolean[]): boolean {
  if (op === 'union') return memberships.some(Boolean)
  if (op === 'intersect') return memberships.every(Boolean)
  if (op === 'exclude') return memberships.filter(Boolean).length % 2 === 1
  // 差集：在第一个里，且不在其余任何一个里。第一个是层序最靠后那个，也就是画在最下面的。
  return memberships[0] === true && memberships.slice(1).every((value) => !value)
}

/**
 * 沿保留区域的边界绕出若干条环。
 *
 * @remarks
 * 一条半边在边界上，当且仅当**它这一侧的元胞留下了、对面那一侧没留**。两侧都留的边在结果
 * 内部、两侧都不留的边不在结果上——两种情形都删掉，于是相邻的保留元胞自动并成一块。
 *
 * 绕行 MUST 按**半边**限定而不是按子边：同一条边的两个朝向里只有一个在边界上，按子边限定会
 * 让绕行有机会顺着反向那一个走出去，而走出去的是外面那一圈。
 */
function traceBoundaryRings(
  graph: RegionGraph,
  boundary: ReadonlySet<HalfEdgeId>,
): readonly (readonly ComposeOutlinePiece[])[] {
  const rings: (readonly ComposeOutlinePiece[])[] = []
  const visited = new Set<HalfEdgeId>()
  boundary.forEach((half) => {
    if (visited.has(half)) return
    const traced = traceLoop(graph, half, (candidate) => boundary.has(candidate))
    if (!traced) {
      visited.add(half)
      return
    }
    traced.forEach((item) => visited.add(item))
    const loop = pruneSpurs(traced)
    if (loop.length === 0) return
    rings.push(mergeCollinearPieces(loop.map((item) => halfPiece(graph, item))))
  })
  return rings
}

/**
 * 对一组操作数求并集、差集、交集或异或。
 *
 * @remarks
 * 操作数 MUST 按**层序从下到上**给出：`operands[0]` 是画在最下面的那一个，差集减的就是它。
 *
 * 产物取能表达该几何的**最窄 kind**（见 {@link composeCurveFromOutline}）。环多于一条时写
 * `evenodd`，因此洞与互不相交的几块面用同一条规则表达——奇偶数一遍就同时答对了两者。
 *
 * @param operands - 已经在同一个坐标空间里的形状；少于两个时直接返回 `empty`。
 * @param quantum - 这批片段所在空间里的坐标量化步长；调用方要把文档精度的步长乘上
 *   「几何 → 盒」与「盒 → 世界」两段缩放，只有它知道这两段。默认取文档精度的步长本身，
 *   也就是盒与取景框 1:1 时的那个值；取小了只会让归一够不着、退回「求解退化」这个**看得见**
 *   的失败，取大了才会把两条真的不同的边收成一条。
 * @returns 求出了几何、结果没有面积、或求解退化。
 * @public
 */
export function resolveComposeCurveBoolean(
  operands: readonly ComposeBooleanOperand[],
  op: ComposeBooleanOp,
  quantum: number = COMPOSE_GEOMETRY_QUANTUM,
): ComposeCurveBooleanResult {
  const usable = operands.filter((operand) => operand.pieces.length > 0)
  if (usable.length < 2) return { status: 'empty' }

  const pieces = usable.flatMap((operand) => operand.pieces)
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
  /*
   * 节点合并容差取两者的较大者：包围盒尺度的相对量（浮点卫生，与求面同源）与**一个坐标量化
   * 步长**。后者的理由是同一个角点被两个对象各自写进文档、各自舍到两位，两份就能差这么多，
   * 而相对量在一张 400 单位的图上只有 4e-5。
   *
   * 这条下限**单独不成立**，它与 `buildGraph` 里的支撑归一是一对：量过——只抬容差而不归一，
   * 两块共用弧边界的填充求并集仍然报「求解退化」；另一个夹具上它会跨过报错那一关而**静默产出
   * 一个几像素大的形状**，把一个看得见的失败换成一个看不见的错误。因此**不要**在归一被去掉或
   * 绕开的情况下单独留着它。
   */
  const epsilon = Math.max(NODE_EPSILON_RATIO * Math.max(1, maxX - minX, maxY - minY), quantum)

  const graph = buildGraph(pieces, epsilon, quantum)
  if (graph.subEdges.length === 0) return { status: 'degenerate' }

  /*
   * 操作数的内外判定读 `isPointInsideComposeCurve`——渲染与命中读的是同一个入口。
   *
   * 自带曲线优先：带岛的操作数是两条子路径加 `evenodd`，而片段摊平之后收成「一条环」会把岛
   * 算成实心，内外判定就反了。缺席时退回由片段收环，那两种做法对单环形状给出同一个答案。
   */
  const operandCurves = usable.map(
    (operand) => operand.curve ?? composeCurveFromOutline([operand.pieces]),
  )
  const clearance = clearances(graph)
  const kept = new Map<HalfEdgeId, boolean>()
  const keepsCell = (half: HalfEdgeId): boolean => {
    const cached = kept.get(half)
    if (cached !== undefined) return cached
    const sample = cellSample(graph, half, clearance[edgeOf(half)] ?? 0)
    const value = sample === null
      ? false
      : keepsFace(op, operandCurves.map((curve) => (
        curve ? isPointInsideComposeCurve(curve, sample) : false
      )))
    kept.set(half, value)
    return value
  }

  const boundary = new Set<HalfEdgeId>()
  for (let half = 0; half < graph.subEdges.length * 2; half += 1) {
    if (keepsCell(half) && !keepsCell(opposite(half))) boundary.add(half)
  }
  if (boundary.size === 0) return { status: 'empty' }

  const rings = traceBoundaryRings(graph, boundary)
  if (rings.length === 0) return { status: 'degenerate' }

  /*
   * 外环与洞按有向面积分：边界环仍然把保留区域留在右手边，因此包住区域的那些为负、被挖空的
   * 那些为正。`composeCurveFromOutline` 只用第一环决定要不要走多段线那一支，其余靠 `evenodd`
   * 的奇偶数，因此这里只需要把一条外环排到最前面。
   */
  const oriented = rings.map((ring) => ({
    ring,
    // 弧边拍成线段再算：有向面积只用来读朝向，采样误差影响不到正负号。
    area: signedArea(flattenComposeOutline(ring).map((segment) => segment.start)),
  }))
  const outerFirst = [...oriented].sort((a, b) => a.area - b.area).map((item) => item.ring)
  const curve = composeCurveFromOutline(outerFirst)
  if (!curve) return { status: 'degenerate' }
  return { status: 'resolved', curve, islandCount: oriented.filter((item) => item.area > 0).length }
}
