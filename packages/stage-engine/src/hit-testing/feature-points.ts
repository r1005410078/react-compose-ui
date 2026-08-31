import {
  closestPointOnComposeSegment,
  composeArcEndpoints,
  composeArcMidpoint,
  composeArcQuadrants,
  composeCurveSegments,
  composePolylineSegments,
  getComposeCurve,
  getComposeEntityPorts,
  getComposeWire,
  getComposeWireEndState,
  projectComposeCurveToBox,
  getComposeVisibility,
} from '@compose-ui/core'
import type {
  ComposeDocument,
  ComposeEntity,
  ComposeWireEndState,
} from '@compose-ui/core'
import { applyMatrix } from '../geometry'
import type { StagePoint } from '../geometry'
import type { StageSceneIndex } from './scene-index'

/**
 * 特征点的种类。
 *
 * @remarks
 * 同时定义**优先级顺序**：端点压过中点。这是 AutoCAD 的惯例，也是可预期性的一部分——
 * 同等距离下总是命中端点，用户才敢直接点过去而不用先放大确认。
 *
 * 圆心与象限点插在中点之后，圆心先于象限点：圆心不是任何线段的端点，却是画同心圆、把符号钉在
 * 轴上时用户真正要对齐的点，因此它排在只在弧上才有意义的象限点之前。
 *
 * **端口排在最前**：端口几乎总是画在符号线段的端点上，端点若在同等距离下胜出，用户会画出一条
 * 像素级正确但**没有绑定**的导线——而这个错误在屏幕上完全不可见。
 *
 * **`nearest` 排在最后**：它是导线上离查询点最近的那个点，因此只要指针在容差内就**永远**有
 * 答案。排在任何点状候选之前，端点、中点与圆心会被整个吞掉，而「把这个角对到那个端子上」正是
 * 画图时最常做的事。
 *
 * @public
 */
export type StageFeatureSnapMode =
  | 'port'
  | 'endpoint'
  | 'midpoint'
  | 'center'
  | 'quadrant'
  | 'nearest'

/** 一个特征点候选。 @public */
export interface StageFeaturePoint {
  readonly mode: StageFeatureSnapMode
  readonly entityId: string
  /** 世界坐标。 */
  readonly point: StagePoint
  /**
   * 端口 id；只有 `port` 候选带它。
   *
   * @remarks
   * 导线的绑定来自**取点时记下的来源**，因此这个 id 必须随捕捉结果一起交出去。事后按坐标
   * 反查已有端口会让一条恰好路过端口的普通线莫名其妙地绑上，而那个绑定在屏幕上不可见。
   */
  readonly portId?: string
}

const MODE_ORDER: readonly StageFeatureSnapMode[] = [
  'port',
  'endpoint',
  'midpoint',
  'center',
  'quadrant',
  'nearest',
]

/** 点级排除的判等阈值；见 {@link findStageFeaturePoint} 为什么不用容差。 */
const SAME_POINT_EPSILON = 1e-6

function isSameWorldPoint(a: StagePoint, b: StagePoint) {
  return Math.abs(a.x - b.x) <= SAME_POINT_EPSILON && Math.abs(a.y - b.y) <= SAME_POINT_EPSILON
}

function midpoint(a: StagePoint, b: StagePoint): StagePoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

interface LocalFeaturePoint {
  readonly mode: StageFeatureSnapMode
  readonly point: StagePoint
  readonly portId?: string
}

/**
 * 按 `kind` 产出候选。
 *
 * @remarks
 * **不能拿 `composeCurvePoints` 当端点集合用**：它返回的是「决定紧包围盒的那组点」，对弧来说
 * 包含象限点。当成端点会让象限点以端点优先级参与，还会凭空造出一批相邻点的中点。
 *
 * 多段线**不引入新语义**：顶点就是各段端点、各段中点就是中点。这与「展开是恒等变换」是同一
 * 件事。闭合时多出的那一段同样产出中点。
 */
function curveFeaturePoints(
  entity: ComposeEntity,
  box: { readonly width: number; readonly height: number } | undefined,
  toWorld: (point: StagePoint) => StagePoint,
): readonly LocalFeaturePoint[] {
  const geometry = getComposeCurve(entity)
  if (!geometry || !box) return []
  // 与命中同一个投影：特征点必须落在**画出来的**那条线上，否则拉宽之后端点会停在旧位置。
  const curve = projectComposeCurveToBox(geometry, box)

  if (curve.kind === 'arc') {
    const [start, end] = composeArcEndpoints(curve)
    return [
      { mode: 'endpoint' as const, point: toWorld(start) },
      { mode: 'endpoint' as const, point: toWorld(end) },
      { mode: 'midpoint' as const, point: toWorld(composeArcMidpoint(curve)) },
      // 圆心不是任何线段的端点，却是画同心圆、把符号钉在轴上时用户真正要对齐的点。
      { mode: 'center' as const, point: toWorld(curve.center) },
      ...composeArcQuadrants(curve).map((point) => ({
        mode: 'quadrant' as const,
        point: toWorld(point),
      })),
    ]
  }

  const segments = curve.kind === 'line'
    ? [{ start: curve.start, end: curve.end }]
    : composePolylineSegments(curve.vertices, curve.closed)
  const vertices = curve.kind === 'line' ? [curve.start, curve.end] : curve.vertices
  return [
    ...vertices.map((point) => ({ mode: 'endpoint' as const, point: toWorld(point) })),
    ...segments.map((segment) => ({
      mode: 'midpoint' as const,
      point: midpoint(toWorld(segment.start), toWorld(segment.end)),
    })),
  ]
}

/**
 * 判断一个 Entity 是不是导线。
 *
 * @remarks
 * **默认是文档级契约**（带 `Wire`），而宿主通常要放宽它：一条刚画完、两端都还没接上的导线
 * **没有 `Wire`**——那个 Component 只记录「这一端绑到了哪个端口」，没有绑定就不写。它在文档
 * 里唯一的身份是 `Composition.presetId`，而引擎不认识 Preset id，因此这条谓词由宿主注入，
 * 与「一个 Entity 能不能几何编辑由宿主注入谓词」是同一条既有边界。
 *
 * 不注入的症状是「新画的导线接不上，接过一次之后就能接了」——用户完全无从解释。
 *
 * @public
 */
export type StageWirePredicate = (entity: ComposeEntity) => boolean

/**
 * 导线上离查询点最近的那个点。
 *
 * @remarks
 * **只对导线产出**：接到线身中间是接线特有的手势，而给每一条曲线都配一个「永远命中」的候选
 * 会让端点在密集图上难以对准。
 *
 * 与命中、框选走**同一条**投影链（`projectComposeCurveToBox` → 世界矩阵），弧按既有规则拍扁
 * ——各算一遍必然在某个缩放下差半个像素，而这里差半个像素就是「看起来接上了却没接上」。
 *
 * 判定留在**世界空间**（把几何变换过去），不把查询点逆变换进几何空间：非等比缩放会把圆形容差
 * 变成椭圆，距离比较不再是标量。
 */
function wireNearestPoint(
  entity: ComposeEntity,
  box: { readonly width: number; readonly height: number } | undefined,
  toWorld: (point: StagePoint) => StagePoint,
  point: StagePoint,
  isWire: StageWirePredicate,
): LocalFeaturePoint | null {
  const geometry = getComposeCurve(entity)
  if (!geometry || !box || !isWire(entity)) return null
  const segments = composeCurveSegments(projectComposeCurveToBox(geometry, box))
  let best: { readonly point: StagePoint; readonly distance: number } | null = null
  for (const segment of segments) {
    const world = { start: toWorld(segment.start), end: toWorld(segment.end) }
    const candidate = closestPointOnComposeSegment(world, point)
    const dx = candidate.x - point.x
    const dy = candidate.y - point.y
    const distance = dx * dx + dy * dy
    if (best === null || distance < best.distance) best = { point: candidate, distance }
  }
  return best ? { mode: 'nearest', point: best.point } : null
}

/**
 * 在世界点附近求解几何特征点。
 *
 * @remarks
 * 这是与对齐吸附（`snapCandidates`）**并列**的另一条查询，不是它的扩展：对齐吸附返回的是
 * `{ axis, value }` 的参考**线**，服务「与那个盒的左边对齐」；本查询返回一个二维**点**，
 * 服务「正好落在那条线的端点上」。两者输入相同、输出形状不同、消费方式也不同。
 *
 * 候选只来自带 `Curve` 或带 `Ports` 的 Entity。盒的角点与中心刻意不出：那正是对齐吸附覆盖的
 * 语义，两套同时生效会在同一次取点里给出互相拉扯的答案，而用户看不出是哪一套在起作用。端口
 * 不在此列——那条挡的是从盒**推**出来的点，而端口是作者**显式写下**的。
 *
 * @param tolerance - 世界单位的容差；调用方用屏幕像素除以 zoom 换算。
 * @param excludedIds - 不参与捕捉的整个 Entity。
 * @param excludedPoint - 不参与捕捉的**单个世界点**。
 * @param isWire - 哪些 Entity 产出 `nearest` 候选；见 {@link StageWirePredicate}。
 *
 * @remarks
 * 两级排除服务不同的事：Entity 级挡的是「这个对象整体不该出现在候选里」，点级挡的是
 * 「**这一个点**就在指针底下，会把落点吸回原处」。拖夹点属于后者——用 Entity 级去挡它，会把
 * 同一个对象的其他顶点与各段中点一起收走，而那些正是用户最常要对齐的目标。
 *
 * 点级比较用极小的 epsilon 而不是容差：排除点与候选点由**同一条**投影与世界矩阵算出，数值
 * 上本就相等，epsilon 只是为了不依赖浮点的逐位一致。
 *
 * @returns 容差内优先级最高、同优先级下最近的候选；没有则返回 null。
 * @public
 */
export function findStageFeaturePoint(
  document: ComposeDocument,
  index: StageSceneIndex,
  point: StagePoint,
  tolerance: number,
  excludedIds: readonly string[] = [],
  excludedPoint: StagePoint | null = null,
  isWire: StageWirePredicate = (entity) => getComposeWire(entity) !== undefined,
): StageFeaturePoint | null {
  if (!(tolerance > 0)) return null
  const excluded = new Set(excludedIds)
  const limit = tolerance * tolerance
  let best: { readonly candidate: StageFeaturePoint; readonly distance: number } | null = null

  for (const entityId of index.order) {
    if (excluded.has(entityId)) continue
    const entity = document.entities[entityId]
    if (!entity || !getComposeVisibility(entity).visible) continue
    const matrix = index.getWorldMatrix(entityId)
    if (!matrix) continue
    const toWorld = (local: StagePoint) => applyMatrix(matrix, local)
    const box = index.layoutSnapshot.boxes[entityId]
    const nearestOnWire = wireNearestPoint(entity, box, toWorld, point, isWire)
    const candidates = [
      // 端口与曲线特征点共用同一个世界矩阵：各算一遍必然在某个缩放下差半个像素。
      ...getComposeEntityPorts(entity).map((port) => ({
        mode: 'port' as const,
        point: toWorld(port.position),
        portId: port.id,
      })),
      ...curveFeaturePoints(entity, box, toWorld),
      ...(nearestOnWire ? [nearestOnWire] : []),
    ]
    for (const candidate of candidates) {
      if (excludedPoint && isSameWorldPoint(candidate.point, excludedPoint)) continue
      const dx = candidate.point.x - point.x
      const dy = candidate.point.y - point.y
      const distance = dx * dx + dy * dy
      if (distance > limit) continue
      const next = { candidate: { ...candidate, entityId }, distance }
      if (best === null) {
        best = next
        continue
      }
      const rank = MODE_ORDER.indexOf(candidate.mode) - MODE_ORDER.indexOf(best.candidate.mode)
      // 优先级先于距离：端点在容差内就赢，哪怕中点更近一点。
      if (rank < 0 || (rank === 0 && distance < best.distance)) best = next
    }
  }
  return best?.candidate ?? null
}

/** 一个符号上被显现出来的端口。 @public */
export interface StageRevealedPorts {
  readonly entityId: string
  /** 该 Entity 的**全部**端口，世界坐标。 */
  readonly points: readonly StagePoint[]
}

/**
 * 求出光标够及范围内那个符号的**全部**端口。
 *
 * @remarks
 * 与 {@link findStageFeaturePoint} 是**两个不同的问题**，因此不合并：捕捉标记回答「落点吸上了
 * 什么」（恰好一个点），本查询回答「这个符号上有哪些接线点」（一个符号的全部）。只返回最近的
 * 那一个时，用户读到的是「这里只有一个端子」——而接线图上端子密集（继电器的端子只隔几个
 * 像素），旁边那两个就此不可见。
 *
 * 世界矩阵与容差都与捕捉共用：各算一遍必然在某个缩放下差半个像素，而「多近算靠近」在这个产品
 * 里只该有一个数。
 *
 * @returns 最近的那个在容差内的符号，连同它的全部端口；没有则 `null`。
 * @public
 */
export function collectStageRevealedPorts(
  document: ComposeDocument,
  index: StageSceneIndex,
  point: StagePoint,
  tolerance: number,
): StageRevealedPorts | null {
  if (!(tolerance > 0)) return null
  const limit = tolerance * tolerance
  let best: { readonly revealed: StageRevealedPorts; readonly distance: number } | null = null

  for (const entityId of index.order) {
    const entity = document.entities[entityId]
    if (!entity || !getComposeVisibility(entity).visible) continue
    const ports = getComposeEntityPorts(entity)
    if (ports.length === 0) continue
    const matrix = index.getWorldMatrix(entityId)
    if (!matrix) continue
    const points = ports.map((port) => applyMatrix(matrix, port.position))
    // 符号的入选资格看它**最近的那个**端口：够到任何一个端子，整组就该显现。
    let nearest = Number.POSITIVE_INFINITY
    for (const candidate of points) {
      const dx = candidate.x - point.x
      const dy = candidate.y - point.y
      nearest = Math.min(nearest, dx * dx + dy * dy)
    }
    if (nearest > limit) continue
    if (best === null || nearest < best.distance) {
      best = { revealed: { entityId, points }, distance: nearest }
    }
  }
  return best?.revealed ?? null
}

/** 一条导线端点的呈现信息。 @public */
export interface StageWireEnd {
  readonly entityId: string
  readonly key: 'start' | 'end'
  readonly point: StagePoint
  readonly state: ComposeWireEndState
}

/**
 * 求出一条导线两端的世界落点与接线状态。
 *
 * @remarks
 * 落点走 `projectComposeCurveToBox` 与 Entity 世界矩阵——与命中、捕捉同一条链，否则记号会在
 * 盒被拉宽之后停在旧位置。状态走 `getComposeWireEndState`，与 Wire Inspector 同一个入口。
 *
 * @returns 不是导线、几何不是直线或缺少布局盒时为空。
 * @public
 */
export function collectStageWireEnds(
  document: ComposeDocument,
  index: StageSceneIndex,
  entityId: string,
): readonly StageWireEnd[] {
  const entity = document.entities[entityId]
  if (!entity || !getComposeVisibility(entity).visible) return []
  const wire = getComposeWire(entity)
  const geometry = getComposeCurve(entity)
  const box = index.layoutSnapshot.boxes[entityId]
  const matrix = index.getWorldMatrix(entityId)
  if (!wire || !geometry || !box || !matrix) return []
  const curve = projectComposeCurveToBox(geometry, box)
  /*
   * **两端就是首尾两个顶点**，因此直线与多段线走同一条路——只认 `line` 的症状是「折线导线
   * 选中之后两端什么都不显示」。中间的拐点不画记号：它不接任何东西。
   */
  if (curve.kind === 'arc') return []
  const ends = curve.kind === 'line'
    ? [curve.start, curve.end]
    : [curve.vertices[0], curve.vertices[curve.vertices.length - 1]]
  const [first, last] = ends
  if (!first || !last) return []
  return [
    { key: 'start' as const, local: first, binding: wire.start },
    { key: 'end' as const, local: last, binding: wire.end },
  ].map(({ key, local, binding }) => ({
    entityId,
    key,
    point: applyMatrix(matrix, local),
    state: getComposeWireEndState(document, binding),
  }))
}
