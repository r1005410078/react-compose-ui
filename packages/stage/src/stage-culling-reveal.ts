import type { StageSceneIndex } from '@compose-ui/stage-engine'

/**
 * 换窗时一批消化多少个 Entity。
 *
 * @remarks
 * 换窗那一帧真正贵的是**把新进窗口的那条带子挂上去、把离开的那条卸下来**：挂一个 Entity 要跑
 * 一遍物料渲染器、建四五个 DOM 节点再算样式；一条八分之一屏的带子几百个，一帧几十毫秒。把它
 * 们摊到几帧里，每帧的账是「场景层按缓存走一遍 + 这一批」。
 *
 * 批小是为了让每一帧都便宜——挂 16 个的样式重算与布局约 2ms，挂 40 个 4–9ms，而平移时用户
 * 感到的「卡一下」正是这几帧与稳态之间的落差。这一帧里另外两项——Blink 的合成层划分与分配
 * 抖动引来的 major GC——不随批次走，是另一层的账。
 *
 * 队列住在场景层而不是宿主：住宿主时每一批都让整个 Stage（覆盖层、标尺、命令行……）重渲染
 * 一遍，与这一批改没改 DOM 无关。
 */
export const STAGE_CULLING_BATCH_SIZE = 16

/**
 * 一条带子最多摊几帧；队列长过 `帧数 × 批`，每帧就按队列的这一份摊。
 *
 * @remarks
 * 批小了带子就长：外扩带只有八分之一屏，快速平移十几帧就穿过它，一条五百个的带子按 16 一批
 * 要三十帧，节点会在建好之前进入可视区。两头都要，因此批按队列长度自适应：短队列按最小批，
 * 长队列保证在这几帧内摊完。
 */
export const STAGE_CULLING_BATCH_FRAMES = 8

/** 这一帧该消化多少：短队列按最小批，长队列按「几帧内摊完」摊。 */
export function stageCullingBatchSize(queued: number) {
  return Math.max(STAGE_CULLING_BATCH_SIZE, Math.ceil(queued / STAGE_CULLING_BATCH_FRAMES))
}

const NO_PENDING: readonly string[] = []
const NO_IDS: ReadonlySet<string> = new Set<string>()

/**
 * 场景层逼近目标裁剪集的进度。
 *
 * @remarks
 * 实际生效的裁剪集恒为 `(target − pendingCull) ∪ pendingReveal`：目标里还没卸的仍在 DOM 里，
 * 目标外还没挂的仍不在。
 */
export interface StageCullingReveal {
  /** 规划时按队列长度定下的每帧批量；按剩余量现算会让队列越摊越慢、永远摊不完。 */
  readonly batch: number
  readonly batchKey: string | undefined
  readonly index: StageSceneIndex | undefined
  /** 目标里**只因读不出来**被裁的那一部分；下一次目标变化时用它分辨谁是可读性带回来的。 */
  readonly detail: ReadonlySet<string>
  readonly pendingCull: readonly string[]
  readonly pendingReveal: readonly string[]
  readonly target: ReadonlySet<string>
}

/** {@link planStageCullingReveal} 的新目标。 */
export interface StageCullingTarget {
  readonly batchKey: string | undefined
  readonly index: StageSceneIndex | undefined
  readonly detail: ReadonlySet<string>
  readonly target: ReadonlySet<string>
}

/** 一个从未裁过任何东西的起点。 */
export function initialStageCullingReveal(next: StageCullingTarget): StageCullingReveal {
  return { ...next, batch: STAGE_CULLING_BATCH_SIZE, pendingCull: NO_PENDING, pendingReveal: NO_PENDING }
}

/** 这一趟实际生效的裁剪集。 */
export function appliedStageCulledIds(reveal: StageCullingReveal): ReadonlySet<string> {
  if (reveal.pendingCull.length === 0 && reveal.pendingReveal.length === 0) return reveal.target
  const applied = new Set(reveal.target)
  for (const entityId of reveal.pendingCull) applied.delete(entityId)
  for (const entityId of reveal.pendingReveal) applied.add(entityId)
  return applied
}

/**
 * 目标裁剪集变了，算出接下来要分批消化的两条队列。
 *
 * @remarks
 * 上一趟实际生效的是 `(target − pendingCull) ∪ pendingReveal`，拿它与新目标相减，两边的差就是
 * 要挂的与要卸的。差集里谁排队、谁当帧到齐，按**它是被什么带进来的**分：
 *
 * - 批次键（档位 + 豁免）没变、索引也没变，这是纯粹的平移换窗：新进与离开的都在可视区之外，
 *   晚几帧不可见，**全部排队**。
 * - 键变了但索引没变（缩放跨档、豁免变化）：由**窗口**带进来的可能已在可视区里、正在编辑或
 *   正被拖动的那个必须当场在，**当帧到齐**；由**可读性**带进来的（上一趟因读不出来被裁、这一
 *   趟可读了，或反过来）尺寸就在可读阈值上，放大跨过阈值那一帧一次性挂上一千八百个文字是一
 *   个 50–80ms 的长任务，而让几像素高的字在几帧里按文档顺序补齐用户看不出来，**排队**。
 * - 索引换了（文档变了）：对象可能正被用户改着位置，全部当帧到齐。
 *
 * 两条队列都按**文档顺序**排（场景层按文档顺序分桶，乱序的批次会碰到每一个桶）。一批装得下
 * 就当帧到齐：排队只为把装不下的摊开，小图上换窗因此仍是同步的、可断言的。
 */
export function planStageCullingReveal(
  previous: StageCullingReveal,
  next: StageCullingTarget,
  documentPosition: ReadonlyMap<string, number>,
): StageCullingReveal {
  const sameIndex = next.index !== undefined && previous.index === next.index
  const batched = next.batchKey !== undefined && previous.batchKey === next.batchKey && sameIndex
  if (!sameIndex) {
    return { ...next, batch: STAGE_CULLING_BATCH_SIZE, pendingCull: NO_PENDING, pendingReveal: NO_PENDING }
  }
  const applied = appliedStageCulledIds(previous)
  const byDocumentOrder = (a: string, b: string) =>
    (documentPosition.get(a) ?? Number.MAX_SAFE_INTEGER)
    - (documentPosition.get(b) ?? Number.MAX_SAFE_INTEGER)
  const reveals = [...applied].filter((entityId) => !next.target.has(entityId))
  const culls = [...next.target].filter((entityId) => !applied.has(entityId))
  const reveal = batched ? reveals : reveals.filter((entityId) => previous.detail.has(entityId))
  const cull = batched ? culls : culls.filter((entityId) => next.detail.has(entityId))
  if (cull.length + reveal.length <= STAGE_CULLING_BATCH_SIZE) {
    return { ...next, batch: STAGE_CULLING_BATCH_SIZE, pendingCull: NO_PENDING, pendingReveal: NO_PENDING }
  }
  return {
    ...next,
    batch: stageCullingBatchSize(cull.length + reveal.length),
    pendingCull: cull.sort(byDocumentOrder),
    pendingReveal: reveal.sort(byDocumentOrder),
  }
}

/** 消化掉这一帧的一批。 */
export function drainStageCullingReveal(current: StageCullingReveal): StageCullingReveal {
  const { batch } = current
  return {
    ...current,
    pendingCull: current.pendingCull.length <= batch
      ? NO_PENDING
      : current.pendingCull.slice(batch),
    pendingReveal: current.pendingReveal.length <= batch
      ? NO_PENDING
      : current.pendingReveal.slice(batch),
  }
}

export { NO_IDS as NO_STAGE_CULLED_IDS }
