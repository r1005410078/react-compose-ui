import {
  composeArcEndpoints,
  composeArcMidpoint,
  composeArcQuadrants,
  composePolylineSegments,
  getComposeCurve,
  getComposeEntityPorts,
  projectComposeCurveToBox,
  getComposeVisibility,
} from '@compose-ui/core'
import type { ComposeDocument, ComposeEntity } from '@compose-ui/core'
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
 * @public
 */
export type StageFeatureSnapMode = 'port' | 'endpoint' | 'midpoint' | 'center' | 'quadrant'

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
]

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
 * @param excludedIds - 不参与捕捉的 Entity，例如正在被这条命令编辑的那个。
 * @returns 容差内优先级最高、同优先级下最近的候选；没有则返回 null。
 * @public
 */
export function findStageFeaturePoint(
  document: ComposeDocument,
  index: StageSceneIndex,
  point: StagePoint,
  tolerance: number,
  excludedIds: readonly string[] = [],
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
    const candidates = [
      // 端口与曲线特征点共用同一个世界矩阵：各算一遍必然在某个缩放下差半个像素。
      ...getComposeEntityPorts(entity).map((port) => ({
        mode: 'port' as const,
        point: toWorld(port.position),
        portId: port.id,
      })),
      ...curveFeaturePoints(entity, box, toWorld),
    ]
    for (const candidate of candidates) {
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
