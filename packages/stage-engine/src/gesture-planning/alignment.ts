import { getComposeLock } from '@compose-ui/core'
import { multiplyMatrices, translationMatrix } from '../geometry'
import { targetTransform } from './transform-preview'
import type { StageRect, StageTransform } from '../geometry'
import type { StageSceneIndex } from '../hit-testing'

/**
 * 六项对齐与两项分布。
 *
 * @remarks
 * 分布只有两项而对齐有六项：对齐的基准是选区包围盒的**某一条边或中线**，两轴各三条；
 * 分布回答的是「把中间的摊开」，一轴只有一个答案。
 *
 * @public
 */
export type StageAlignmentMode =
  | 'left' | 'center-x' | 'right'
  | 'top' | 'center-y' | 'bottom'
  | 'distribute-x' | 'distribute-y'

/** 分布至少要三个对象：两端不动，中间才有可摊开的东西。 @public */
export const STAGE_DISTRIBUTE_MINIMUM = 3
/** 对齐至少要两个对象。 @public */
export const STAGE_ALIGN_MINIMUM = 2

/** 一项对齐/分布至少需要几个对象。 @public */
export function stageAlignmentMinimum(mode: StageAlignmentMode): number {
  return mode === 'distribute-x' || mode === 'distribute-y'
    ? STAGE_DISTRIBUTE_MINIMUM
    : STAGE_ALIGN_MINIMUM
}

/** 这一项作用在哪个轴上。 */
function isHorizontal(mode: StageAlignmentMode): boolean {
  return mode === 'left' || mode === 'center-x' || mode === 'right' || mode === 'distribute-x'
}

interface AlignmentTarget {
  readonly id: string
  readonly bounds: StageRect
  readonly locked: boolean
}

/**
 * 规划一次对齐或分布，产出每个对象的目标变换。
 *
 * @remarks
 * 基准是**选区整体包围盒**，MUST NOT 取「最先选中的那一个」：选择顺序在屏幕上看不见，用户
 * 因此无法预测结果落在哪里。
 *
 * **锁定的对象不动，但计入基准**：它在屏幕上确实占着那块位置，把它从包围盒里剔掉会让其余
 * 对象贴到一条用户看不见的边上。
 *
 * 收敛到**顶层选区**：父子同时选中时移动父级已经带走子级，再单独算一次子级会让它相对父级
 * 又挪了一遍。
 *
 * 分布按**边到边的间隙**等距而不是按中心等距：后者在尺寸不一时看起来仍然疏密不均，而用户
 * 说的「排匀」指的是空隙。两端不动——那是用户已经摆好的位置。
 *
 * @returns 可直接交给 `planTransformCommit` 的变换表；没有对象要动时为空。
 * @public
 */
export function planStageAlignment(
  index: StageSceneIndex,
  entityIds: readonly string[],
  mode: StageAlignmentMode,
): Record<string, StageTransform> {
  const targets = collectTargets(index, entityIds)
  if (targets.length < stageAlignmentMinimum(mode)) return {}
  const horizontal = isHorizontal(mode)
  const deltas = mode === 'distribute-x' || mode === 'distribute-y'
    ? distributeDeltas(targets, horizontal)
    : alignDeltas(targets, mode, horizontal)

  const transforms: Record<string, StageTransform> = {}
  for (const target of targets) {
    if (target.locked) continue
    const delta = deltas.get(target.id)
    if (delta === undefined || delta === 0) continue
    const world = index.getWorldMatrix(target.id)
    if (!world) continue
    const moved = multiplyMatrices(
      translationMatrix(horizontal ? delta : 0, horizontal ? 0 : delta),
      world,
    )
    transforms[target.id] = targetTransform(
      index,
      target.id,
      moved,
      target.bounds.width,
      target.bounds.height,
    )
  }
  return transforms
}

function collectTargets(
  index: StageSceneIndex,
  entityIds: readonly string[],
): readonly AlignmentTarget[] {
  const targets: AlignmentTarget[] = []
  for (const id of index.topLevelSelection(entityIds)) {
    const entity = index.document.entities[id]
    const bounds = index.getWorldBounds(id)
    if (!entity || !bounds || !index.isVisible(id)) continue
    targets.push({ id, bounds, locked: getComposeLock(entity).locked })
  }
  return targets
}

function alignDeltas(
  targets: readonly AlignmentTarget[],
  mode: StageAlignmentMode,
  horizontal: boolean,
): Map<string, number> {
  const start = (target: AlignmentTarget) => (horizontal ? target.bounds.x : target.bounds.y)
  const size = (target: AlignmentTarget) => (
    horizontal ? target.bounds.width : target.bounds.height
  )
  const low = Math.min(...targets.map(start))
  const high = Math.max(...targets.map((target) => start(target) + size(target)))
  const middle = (low + high) / 2

  const deltas = new Map<string, number>()
  for (const target of targets) {
    const to = mode === 'left' || mode === 'top'
      ? low
      : mode === 'right' || mode === 'bottom'
        ? high - size(target)
        : middle - size(target) / 2
    deltas.set(target.id, to - start(target))
  }
  return deltas
}

function distributeDeltas(
  targets: readonly AlignmentTarget[],
  horizontal: boolean,
): Map<string, number> {
  const start = (target: AlignmentTarget) => (horizontal ? target.bounds.x : target.bounds.y)
  const size = (target: AlignmentTarget) => (
    horizontal ? target.bounds.width : target.bounds.height
  )
  const ordered = [...targets].sort((a, b) => start(a) - start(b))
  const first = ordered[0]!
  const last = ordered[ordered.length - 1]!
  const span = (start(last) + size(last)) - start(first)
  const occupied = ordered.reduce((total, target) => total + size(target), 0)
  /*
   * 间隙可以是负数：对象本来就互相重叠时，「排匀」仍然是把重叠量摊平，而不是把它们推开——
   * 推开会让分布顺手变成一次用户没有要求的放大。
   */
  const gap = (span - occupied) / (ordered.length - 1)

  const deltas = new Map<string, number>()
  let cursor = start(first)
  for (const target of ordered) {
    deltas.set(target.id, cursor - start(target))
    cursor += size(target) + gap
  }
  // 两端不动：它们是用户已经摆好的位置，浮点累加不该把它们挪走。
  deltas.set(first.id, 0)
  deltas.set(last.id, 0)
  return deltas
}
