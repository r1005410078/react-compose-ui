/**
 * `HATCH` 的解算：光标底下围出来的是哪一块面，以及这一下该改一个已有形状还是新建一块填充。
 *
 * @remarks
 * **本模块只解算，不产出命令**：新建那一支要一个 `hatch` Preset 与一个新的 Entity id，而引擎
 * 不建 Entity、不认识 Preset id。规划住在宿主（`stage`），与绘图命令同一条边界。
 *
 * 悬停预览与落地 MUST 读**这同一份**解算——否则「看见的那块面」与「填上的那块面」不是同一块，
 * 与 `TRIM` 的 `resolveStageTrimPiece` 是同一条约束。
 */

import {
  getComposeCurve,
  getComposeHatch,
  getComposeLock,
  isComposeClosedCurve,
  resolveComposeCurveRegion,
  type ComposeCurve,
  type ComposeEntity,
  type ComposeOutlinePiece,
} from '@compose-ui/core'
import type { StagePoint } from '../geometry'
import type { StageSceneIndex } from '../hit-testing'
import { stageBoxCurve, stageCurveMatchesEntity, stageWorldOutline } from './curve-world'
import type { StageJunctionPredicate } from './junction-cleanup'

/** {@link resolveStageHatchRegion} 的入参。 @public */
export interface StageHatchOptions {
  /**
   * 这个 Entity 是不是接线节点。
   *
   * @remarks
   * 与 `TRIM` 同一条理由：节点是一个记号、坐在导线端点上，当边界会在每条支路末端围出一小块
   * 记号大小的面。由宿主注入，引擎不认识节点。
   */
  readonly isJunction?: StageJunctionPredicate
}

/**
 * 一次填充被拒绝的原因；是原因码而不是文案，本包不认识 locale。
 *
 * - `open`：边界没有闭合；`gaps` 给出自由端的位置。
 * - `outside`：落点不在任何一块围起来的面里。
 * - `locked`：要改填充的那个形状锁着——「你锁了它」和「我给你造了个新的」是两件事。
 *
 * @public
 */
export type StageHatchRejection = 'open' | 'outside' | 'locked'

/** {@link resolveStageHatchRegion} 的结果。 @public */
export type StageHatchResolution =
  /**
   * 这块面上已经压着一块填充，而且就是它：改**它的颜色**，不新建。
   *
   * @remarks
   * 没有这一支，对同一块面再点一次会在原来那块上面**叠一块**——两块几何逐像素重合、下面那块
   * 再也点不到，而屏幕上看起来只是换了个颜色。点五次就是五个。
   */
  | {
    readonly status: 'recolor'
    readonly entityId: string
    /** 世界空间的轮廓；悬停预览画它。 */
    readonly curve: ComposeCurve
  }
  /**
   * 这块面的边界恰好是某一个 Entity 的**完整**几何：改它的填充，不新建。
   *
   * @remarks
   * 没有这一支，拿桶点一个没有任何东西穿过的矩形会得到一个与它逐像素重合的新对象压在下面
   * ——屏幕上看着对了，场景树里多出一个一模一样的东西。
   */
  | {
    readonly status: 'fill'
    readonly entityId: string
    /** 世界空间的轮廓；悬停预览画它。 */
    readonly curve: ComposeCurve
  }
  /** 边界跨了对象，或只是某个对象的一部分：新建一块填充。 */
  | {
    readonly status: 'create'
    /** 世界空间的几何。 */
    readonly curve: ComposeCurve
    /** 求出这块面用的世界落点；宿主换算成 Entity 局部坐标写进 `Hatch.seed`。 */
    readonly seed: StagePoint
    /** 被挖空的岛数量。 */
    readonly islandCount: number
    /** 围出这块面的那些 Entity；宿主据此把填充插到它们之下。 */
    readonly boundaryIds: readonly string[]
  }
  | {
    readonly status: 'rejected'
    readonly reason: StageHatchRejection
    /** `open` 时的自由端位置，世界坐标。 */
    readonly gaps?: readonly StagePoint[]
  }

/** 一条候选边界：它的世界轮廓片段，与它出自哪个 Entity。 */
interface HatchCandidate {
  readonly entityId: string
  readonly pieces: readonly ComposeOutlinePiece[]
  /** 它自己是不是一条闭合曲线。 */
  readonly closed: boolean
}

/**
 * 可以当边界的那些 Entity。
 *
 * @remarks
 * 三条排除各有各的理由：**没有 `Curve`** 的没有几何可言；**不可见**的不是用户看见的墨，而
 * 用户瞄的是墨；**接线节点**见 {@link StageHatchOptions.isJunction}。还有一条——**已经是填充
 * 的那些**不当边界：它们是上一次求面的产物、与边界逐像素重合，当边界只会让每条边多出一份
 * 叠在一起的拷贝。
 */
function hatchCandidates(
  index: StageSceneIndex,
  options: StageHatchOptions,
): readonly HatchCandidate[] {
  const candidates: HatchCandidate[] = []
  for (const entity of Object.values(index.document.entities) as ComposeEntity[]) {
    if (!getComposeCurve(entity) || !index.isVisible(entity.id)) continue
    if (getComposeHatch(entity)) continue
    if (options.isJunction?.(entity)) continue
    const matrix = index.getWorldMatrix(entity.id)
    const curve = stageBoxCurve(index, entity.id)
    if (!matrix || !curve) continue
    const pieces = stageWorldOutline(curve, matrix)
    if (pieces.length === 0) continue
    candidates.push({ entityId: entity.id, pieces, closed: isComposeClosedCurve(curve) })
  }
  return candidates
}


/**
 * 这块面上是不是已经压着一块填充，而且**就是它**。
 *
 * @remarks
 * 判据是**逐位相同**，而且必须在**落地写入用的那个空间**里比——存着的 `Curve` 是父级局部、
 * 归一化之后的那一份。求解是确定性的（同一份输入给出逐位相同的结果，「这块填充过期了没有」
 * 那条判断已经用过一次），因此这不是一次浮点比较，而是在问「这一次求出来的，是不是上一次
 * 求出来的那一个」。
 *
 * **刻意不按「落点落在某块填充的墨里」判**，哪怕那更简单、也更像画图软件的做法：一块填好的
 * 面被一条新线劈成两半之后，老填充的锚点落在其中一半里；按「墨里」判会让点那一半改**整块**
 * 老填充的颜色、点另一半却新建——同一个手势在左右两边给出两种行为，而屏幕上没有任何东西解释
 * 为什么。
 */
function hatchOnThisFace(index: StageSceneIndex, curve: ComposeCurve): string | null {
  for (const entity of Object.values(index.document.entities) as ComposeEntity[]) {
    if (!getComposeHatch(entity) || !index.isVisible(entity.id)) continue
    if (stageCurveMatchesEntity(index.document, index.layoutSnapshot, curve, entity.id)) {
      return entity.id
    }
  }
  return null
}

/**
 * 求出光标底下那块面，并判定这一下该改谁还是新建。
 *
 * @remarks
 * 判定「边界恰好是某一个 Entity 的**完整**几何」要**两半**，少任一半都错：出处全来自同一个
 * Entity，**且**那个 Entity 的每一条片段都整条落在环上。只看前半句的话，一条 8 字形折线的一个
 * 环会被判成「是它自己」，而改它的填充会把**两个**环一起填上，不是用户点的那一个。
 *
 * 有岛时也不走这一支：`backgroundPaint` 填的是这条曲线自己围出来的那块，表达不了洞。
 *
 * @public
 */
export function resolveStageHatchRegion(
  index: StageSceneIndex,
  worldPoint: StagePoint,
  options: StageHatchOptions = {},
): StageHatchResolution {
  const candidates = hatchCandidates(index, options)
  if (candidates.length === 0) return { status: 'rejected', reason: 'outside' }

  // 片段摊平成一列；`sources` 报的是这一列里的下标，因此这里记下每条片段出自哪个候选。
  const pieces: ComposeOutlinePiece[] = []
  const ownerOf: string[] = []
  candidates.forEach((candidate) => {
    candidate.pieces.forEach((piece) => {
      pieces.push(piece)
      ownerOf.push(candidate.entityId)
    })
  })

  const region = resolveComposeCurveRegion(pieces, worldPoint)
  if (region.status === 'open') return { status: 'rejected', reason: 'open', gaps: region.gaps }
  if (region.status !== 'resolved') return { status: 'rejected', reason: 'outside' }

  /*
   * 三支的**次序**：先看图上有没有那块墨。两者可能同时成立（一块填充盖着一个本身就闭合的
   * 矩形），此时用户看见的那块色**就是**那块填充，而先走 `fill` 会去写矩形自己的
   * `backgroundPaint`，结果是两块墨叠在一起、上面那块还是旧颜色——屏幕上看起来什么都没发生。
   */
  const existing = hatchOnThisFace(index, region.curve)
  if (existing) {
    if (getComposeLock(index.document.entities[existing]!).locked) {
      return { status: 'rejected', reason: 'locked' }
    }
    return { status: 'recolor', entityId: existing, curve: region.curve }
  }

  const boundaryIds = [...new Set(region.sources.map((source) => ownerOf[source.index]!))]
  const whole = region.islandCount === 0
    && boundaryIds.length === 1
    && region.sources.every((source) => source.used === source.subEdges)
    && region.sources.length === candidates.find(({ entityId }) => entityId === boundaryIds[0])!.pieces.length

  if (whole) {
    const entityId = boundaryIds[0]!
    // 锁定时拒绝并说明，MUST NOT 退回去新建：那会让锁形同虚设。
    if (getComposeLock(index.document.entities[entityId]).locked) {
      return { status: 'rejected', reason: 'locked' }
    }
    return { status: 'fill', entityId, curve: region.curve }
  }

  return {
    status: 'create',
    curve: region.curve,
    seed: worldPoint,
    islandCount: region.islandCount,
    boundaryIds,
  }
}
