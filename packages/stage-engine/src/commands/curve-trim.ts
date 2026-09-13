import {
  createComposeBatchCommand,
  composeCurvePointAtParameter,
  composeCurveParameterSpan,
  composeCurveSegments,
  getComposeCurve,
  getComposeLock,
  intersectComposeArcs,
  intersectComposeSegmentArc,
  intersectComposeSegments,
  isComposeClosedCurve,
  nearestComposeCurveParameter,
  resolveComposeGeometryConstraints,
  sliceComposeCurve,
  translateComposeCurve,
  type ComposeEntity,
  type ComposeSegmentShape,
  type EditorCommand,
} from '@compose-ui/core'
import { applyMatrix, invertMatrix, rectsIntersect, type StagePoint } from '../geometry'
import { stageBoxCurve, stageWorldShapes, type StageWorldShape } from './curve-world'
import type { StageSceneIndex } from '../hit-testing'
import { planStageCurveReplacement } from './curve-split'
import type { StageJunctionPredicate } from './junction-cleanup'

/** {@link resolveStageTrimPiece} 与 {@link planStageTrim} 的入参。 @public */
export interface StageTrimOptions {
  readonly idFactory: () => string
  /**
   * 这个 Entity 是不是导线；只决定绑定怎么继承。
   *
   * @remarks
   * 由宿主注入：引擎不认识导线。缺席即都不是。
   */
  readonly isWire?: (entity: ComposeEntity) => boolean
  /**
   * 这个 Entity 是不是接线节点。
   *
   * @remarks
   * 两处用到它：节点**不是切割边**（它是一个记号不是几何，坐在导线端点上，当切割边会让每条
   * 支路末端多出一截记号大小的碎片），以及剪掉含端口那一截之后收拾少了支路的节点。
   */
  readonly isJunction?: StageJunctionPredicate
  /** 事务标签；缺席时按 Entity 名。 */
  readonly label?: (name: string) => string
}

/**
 * 一次修剪被拒绝的原因；是原因码而不是文案，本包不认识 locale。
 *
 * - `not-curve`：不带 `Curve` 的 Entity 没有「一截」可言。
 * - `locked`：锁保护的是几何，修剪改的正是几何。
 * - `fixed-size`：`resize: 'none'` 的曲线（接线点），形状不是作者的意图。
 * - `path`：贝塞尔路径的截要解贝塞尔求交，v1 不做。
 * - `single-boundary`：整圆上只有一个交点，一个点剪不开一个圈。
 * - `unsupported`：几何在当前盒下不能参数化（非等比拉伸过的弧）。
 *
 * @public
 */
export type StageTrimRejection =
  | 'not-curve'
  | 'locked'
  | 'fixed-size'
  | 'path'
  | 'single-boundary'
  | 'unsupported'

/** 剪口：被去掉那一截的一端，带线在那里的走向，呈现层据此画一道与线垂直的短划。 @public */
export interface StageTrimCut {
  readonly point: StagePoint
  /** 单位方向，世界坐标。 */
  readonly direction: StagePoint
}

/** 光标底下的那一截。 @public */
export interface StageTrimPiece {
  readonly entityId: string
  /** 两头在曲线自身参数轴上的位置；闭合几何按正向走，`from > to` 表示越过收尾点。 */
  readonly from: number
  readonly to: number
  /** 被去掉那一截的世界折线（弧已拍扁），供预览画幽灵。 */
  readonly outline: readonly StagePoint[]
  /** 两头的剪口；落在曲线自己的端头上的那一头没有剪口。 */
  readonly cuts: readonly StageTrimCut[]
  /** 整条都要去掉。 */
  readonly whole: boolean
}

/** {@link resolveStageTrimPiece} 的结果。 @public */
export type StageTrimResolution =
  | { readonly status: 'ok'; readonly piece: StageTrimPiece }
  | { readonly status: 'rejected'; readonly reason: StageTrimRejection }

/** 参数轴上两个位置视为同一处的容差。 */
const PARAMETER_EPSILON = 1e-6

/** 求方向用的参数步长。 */
const TANGENT_STEP = 1e-3

/** 目标形状上与另一条形状的交点参数。 */
function intersectionParameters(target: StageWorldShape, other: StageWorldShape): readonly number[] {
  if (target.kind === 'segment') {
    const hits = other.kind === 'segment'
      ? intersectComposeSegments(target.segment, other.segment)
      : intersectComposeSegmentArc(target.segment, other.arc)
    return hits.map((hit) => target.base + hit.a)
  }
  if (other.kind === 'segment') {
    return intersectComposeSegmentArc(other.segment, target.arc).map((hit) => hit.b)
  }
  return intersectComposeArcs(target.arc, other.arc).map((hit) => hit.a)
}

function rejected(reason: StageTrimRejection): StageTrimResolution {
  return { status: 'rejected', reason }
}

/**
 * 光标底下的那一截。
 *
 * @remarks
 * **边界规则的全部**：从落点在该曲线上的位置向两边走，先遇到**交点**就停在交点，其次**顶点**，
 * 其次**端头**；两侧都是端头即整条。弧上按扫掠方向走，整圆首尾相接——整圆上只有一个交点时
 * 拒绝，一个点剪不开一个圈。
 *
 * 交点按**世界坐标**求：各曲线投影到盒、再乘世界矩阵，与命中、框选、特征点同一条链。切割边是
 * 任何带 `Curve` 的可见 Entity，含导线、含**自己**（折线自交时另一段也是边界）；`path` 作为
 * 切割边拍扁；接线点不是切割边。T 形相接算交点。
 *
 * 悬停预览与落地 MUST 读这**同一份**解算——否则「看见的那一截」与「掉的那一截」不是同一截。
 *
 * @public
 */
export function resolveStageTrimPiece(
  index: StageSceneIndex,
  entityId: string,
  worldPoint: StagePoint,
  options: Pick<StageTrimOptions, 'isJunction'>,
): StageTrimResolution {
  const { document } = index
  const entity = document.entities[entityId]
  if (!entity || !getComposeCurve(entity)) return rejected('not-curve')
  if (getComposeLock(entity).locked) return rejected('locked')
  if (resolveComposeGeometryConstraints(entity).resize === 'none') return rejected('fixed-size')
  const source = getComposeCurve(entity)!
  if (source.kind === 'path') return rejected('path')
  const curve = stageBoxCurve(index, entityId)
  const matrix = index.getWorldMatrix(entityId)
  // 非等比拉伸过的弧投影成了折线：它的参数轴与文档里那条弧对不上。
  if (!curve || !matrix || curve.kind !== source.kind) return rejected('unsupported')
  const span = composeCurveParameterSpan(curve)
  if (span === null) return rejected('unsupported')

  const local = applyMatrix(invertMatrix(matrix), worldPoint)
  const parameter = nearestComposeCurveParameter(curve, local)
  if (parameter === null) return rejected('unsupported')

  const shapes = stageWorldShapes(curve, matrix)
  const closed = isComposeClosedCurve(curve)
  const boundaries = new Set<number>()
  const addBoundary = (value: number) => {
    for (const existing of boundaries) {
      if (Math.abs(existing - value) <= PARAMETER_EPSILON) return
    }
    boundaries.add(value)
  }
  // 顶点：开放折线的内部顶点，闭合折线的每一个顶点。弧没有顶点。
  if (curve.kind !== 'arc') {
    const count = closed ? span : span - 1
    for (let k = closed ? 0 : 1; k <= count; k += 1) addBoundary(k)
  }
  // 交点：视口内每一条可见曲线，含自己不相邻的段。
  const bounds = index.getWorldBounds(entityId)
  for (const other of Object.values(document.entities)) {
    if (!getComposeCurve(other) || !index.isVisible(other.id)) continue
    if (options.isJunction?.(other)) continue
    const otherBounds = index.getWorldBounds(other.id)
    if (bounds && otherBounds && !rectsIntersect(bounds, otherBounds)) continue
    const otherMatrix = index.getWorldMatrix(other.id)
    const otherCurve = stageBoxCurve(index, other.id)
    if (!otherMatrix || !otherCurve) continue
    const otherShapes = other.id === entityId ? shapes : stageWorldShapes(otherCurve, otherMatrix)
    shapes.forEach((shape, shapeIndex) => {
      otherShapes.forEach((candidate, candidateIndex) => {
        if (other.id === entityId) {
          // 相邻两段永远在公共顶点上相交，而那个顶点已经是边界；弧与自己没有交点。
          if (shape.kind === 'arc' || candidate.kind === 'arc') return
          const gap = Math.abs(shapeIndex - candidateIndex)
          const adjacent = gap <= 1 || (closed && gap === shapes.length - 1)
          if (adjacent) return
        }
        intersectionParameters(shape, candidate).forEach(addBoundary)
      })
    })
  }

  const sorted = [...boundaries].sort((left, right) => left - right)
  let from: number
  let to: number
  let whole = false
  if (closed) {
    if (sorted.length === 0) {
      whole = true
      from = parameter
      to = parameter
    } else if (sorted.length === 1) {
      return rejected('single-boundary')
    } else {
      const lower = [...sorted].reverse().find((value) => value < parameter - PARAMETER_EPSILON)
      const upper = sorted.find((value) => value > parameter + PARAMETER_EPSILON)
      from = lower ?? sorted[sorted.length - 1]!
      to = upper ?? sorted[0]!
    }
  } else {
    const lower = [...sorted].reverse().find((value) => value < parameter - PARAMETER_EPSILON)
    const upper = sorted.find((value) => value > parameter + PARAMETER_EPSILON)
    from = lower ?? 0
    to = upper ?? span
    whole = from <= PARAMETER_EPSILON && to >= span - PARAMETER_EPSILON
  }

  const slice = whole ? null : sliceComposeCurve(curve, from, to)
  const removedLocal = whole ? curve : slice?.removed
  if (!removedLocal) return rejected('unsupported')
  const segments = composeCurveSegments(removedLocal)
  const outline = segments.length === 0
    ? []
    : [segments[0]!.start, ...segments.map(({ end }) => end)].map((point) => applyMatrix(matrix, point))

  const cutAt = (at: number): StageTrimCut | null => {
    const here = composeCurvePointAtParameter(curve, at)
    const ahead = composeCurvePointAtParameter(curve, at + TANGENT_STEP)
    const behind = composeCurvePointAtParameter(curve, at - TANGENT_STEP)
    if (!here || !ahead || !behind) return null
    const point = applyMatrix(matrix, here)
    const next = applyMatrix(matrix, closed || at + TANGENT_STEP <= span ? ahead : here)
    const previous = applyMatrix(matrix, closed || at - TANGENT_STEP >= 0 ? behind : here)
    const length = Math.hypot(next.x - previous.x, next.y - previous.y) || 1
    return { point, direction: { x: (next.x - previous.x) / length, y: (next.y - previous.y) / length } }
  }
  const cuts: StageTrimCut[] = []
  if (!whole) {
    const atStart = !closed && from <= PARAMETER_EPSILON
    const atEnd = !closed && to >= span - PARAMETER_EPSILON
    const first = atStart ? null : cutAt(from)
    const second = atEnd ? null : cutAt(to)
    if (first) cuts.push(first)
    if (second) cuts.push(second)
  }
  return { status: 'ok', piece: { entityId, from, to, outline, cuts, whole } }
}

/** {@link planStageTrim} 的结果。 @public */
export interface StageTrimPlan {
  readonly commands: readonly EditorCommand[]
  /** 各目标的解算结果，按输入顺序；宿主据此说明被拒绝的那些。 */
  readonly resolutions: readonly StageTrimResolution[]
  readonly createdIds: readonly string[]
  readonly removedIds: readonly string[]
}

/**
 * 把若干次 `pick` 规划成文档命令。
 *
 * @remarks
 * 每个目标各解算一截，全部收进**一个**事务（多于一条时套 batch）——一笔拖过多条是一次输入，
 * 撤销一步全部回来。同一个 Entity 上只受理
 * 第一次 `pick`：去掉第一截之后剩下的几何还没进文档，第二截无处可解算；一笔在同一条线上划过
 * 两次是罕见操作，再划一笔就是。
 *
 * 落地走 {@link planStageCurveReplacement}：剩下的第一条留原 Entity、其余新建、一条不剩就删；
 * 导线的绑定跟着被去掉的那一截走（起点还在的那一半继承 `start`、终点还在的继承 `end`），剪到
 * 节点时既有的支路清理与合并在同一个事务里发生。
 *
 * @public
 */
export function planStageTrim(
  index: StageSceneIndex,
  targets: readonly { readonly id: string; readonly point: StagePoint }[],
  options: StageTrimOptions,
): StageTrimPlan {
  const { document } = index
  const commands: EditorCommand[] = []
  const resolutions: StageTrimResolution[] = []
  const createdIds: string[] = []
  const removedIds: string[] = []
  const seen = new Set<string>()
  for (const target of targets) {
    const resolution = resolveStageTrimPiece(index, target.id, target.point, options)
    resolutions.push(resolution)
    if (resolution.status !== 'ok' || seen.has(target.id)) continue
    seen.add(target.id)
    const entity = document.entities[target.id]!
    const curve = stageBoxCurve(index, target.id)!
    const { piece } = resolution
    const remaining = piece.whole ? [] : (sliceComposeCurve(curve, piece.from, piece.to)?.remaining ?? [])
    const item = entity.components.LayoutItem as { offset: { x: number; y: number } }
    const parentLocal = remaining.map((part) => translateComposeCurve(part, item.offset.x, item.offset.y))
    const closed = isComposeClosedCurve(curve)
    const span = composeCurveParameterSpan(curve) ?? 0
    const wire = options.isWire?.(entity) === true
    const plan = planStageCurveReplacement(document, target.id, parentLocal, {
      idFactory: options.idFactory,
      keepStart: wire && !closed && piece.from > PARAMETER_EPSILON,
      keepEnd: wire && !closed && piece.to < span - PARAMETER_EPSILON,
      ...(options.isJunction ? { isJunction: options.isJunction } : {}),
      label: options.label ? options.label(entity.name) : entity.name,
    })
    if (!plan) continue
    commands.push(...plan.commands)
    createdIds.push(...plan.createdIds)
    if (plan.removed) removedIds.push(target.id)
  }
  const batched = commands.length > 1
    ? [createComposeBatchCommand({
        id: options.idFactory(),
        commands,
        meta: {
          label: options.label ? options.label(targets.map(({ id }) => document.entities[id]?.name ?? id).join(', ')) : undefined,
          source: 'stage',
          targetIds: [...new Set(targets.map(({ id }) => id))],
        },
      })]
    : commands
  return { commands: batched, resolutions, createdIds, removedIds }
}

/**
 * 一笔轨迹碰到的目标：轨迹的每一段与视口内每条可见曲线求交，每个交点是一次 `pick` 的目标。
 *
 * @remarks
 * 轨迹只是一串屏幕采样点，因此这里按线段求交而不是按距离——「碰到」的含义是划过，不是靠近。
 * 同一条曲线被划过两次会给出两个目标，去重由 {@link planStageTrim} 按 Entity 做（同一个 Entity
 * 只受理第一次）。接线点与不可见的 Entity 不是目标，与切割边同一条判据。
 *
 * @public
 */
export function resolveStageTrailTargets(
  index: StageSceneIndex,
  trail: readonly StagePoint[],
  options: Pick<StageTrimOptions, 'isJunction'>,
): readonly { readonly id: string; readonly point: StagePoint }[] {
  if (trail.length < 2) return []
  const strokes: ComposeSegmentShape[] = []
  for (let i = 1; i < trail.length; i += 1) strokes.push({ start: trail[i - 1]!, end: trail[i]! })
  const targets: { id: string; point: StagePoint }[] = []
  for (const entity of Object.values(index.document.entities)) {
    if (!getComposeCurve(entity) || !index.isVisible(entity.id)) continue
    if (options.isJunction?.(entity)) continue
    const matrix = index.getWorldMatrix(entity.id)
    const curve = stageBoxCurve(index, entity.id)
    if (!matrix || !curve) continue
    const shapes = stageWorldShapes(curve, matrix)
    for (const stroke of strokes) {
      for (const shape of shapes) {
        const hits = shape.kind === 'segment'
          ? intersectComposeSegments(stroke, shape.segment)
          : intersectComposeSegmentArc(stroke, shape.arc)
        hits.forEach((hit) => targets.push({ id: entity.id, point: hit.point }))
      }
    }
  }
  return targets
}
