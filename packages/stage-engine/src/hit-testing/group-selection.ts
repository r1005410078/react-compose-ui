import {
  composeInstancePathHostId,
  getComposeLock,
  isComposeGroupEntity,
  type ComposeDocument,
} from '@compose-ui/core'

/**
 * 一次实体命中在 Group 门槛上的解算输入。
 *
 * @public
 */
export interface StageGroupHitQuery {
  readonly document: ComposeDocument
  /** 父级查询；场景索引的 `getParentId` 或按文档现算的等价物。 */
  readonly getParentId: (entityId: string) => string | null
  /** 指针真正落到的那个 Entity（DOM 命中给出的最深项）。 */
  readonly entityId: string
  /**
   * 当前选区。
   *
   * @remarks
   * 「已进入」的 Group 由它派生：选区里任何一项的**严格**祖先都算已进入。复合地址（实例内部）
   * 按宿主实例算——用户已经下钻进实例内部时，包着这个实例的 Group 当然是进入过的。
   */
  readonly selectedIds: readonly string[]
  /** 归一化连击计数；偶数即双击，缺省视为单击。 */
  readonly clickCount?: number
  /** 深选（Figma 的 ⌘ 点击）：无视所有门槛，直接选中命中的那一项。 */
  readonly deep?: boolean
}

/**
 * 解算结果。
 *
 * @public
 */
export interface StageGroupHitResolution {
  /** 这次按下应当作用的 Entity。 */
  readonly entityId: string
  /**
   * 这次按下是不是一次**下钻**——双击穿过了一层 Group 门槛。
   *
   * @remarks
   * 下钻只改选区：既不开始移动，也不进入文字或几何编辑——那一下的含义是「进到这一层」，
   * 而不是「对进到的那一个做什么」。
   */
  readonly descended: boolean
}

/**
 * 按 Figma 的分组交互，把指针命中的最深 Entity 解算成这次按下真正作用的对象。
 *
 * @remarks
 * 规则只有三条：
 *
 * - **单击选中最外层还没进入的 Group**。命中项的祖先链上，所有「是 Group 且不是当前选区任何
 *   一项的严格祖先」的那些是门槛，取最外层的一个。没有门槛就是命中项自己。
 * - **双击穿过一层**：落到那个门槛的**直接子级**（沿命中链往下一格）。它可能仍是一个 Group，
 *   于是下一次双击再进一层；也可能就是命中项本身。
 * - **深选无视门槛**：按住 `command` 时直接是命中项。
 *
 * 「已进入」**从选区派生，不另存一份状态**：选中了 Group 内的任何一项，那个 Group 就是进入过的，
 * 此后单击它的兄弟直接选中兄弟；点空白清掉选区即退出。这与 Figma 一致，也让场景树里的选中
 * 与画布上的选中天然一致——场景树选中一个子项，画布上这个 Group 就是进入过的。
 *
 * **选中 Group 自己不算进入**：它不是自己的严格祖先。于是选中 Group 之后再点它的子级仍是
 * Group（保持选中、可拖动），与 Figma 相同。
 *
 * **锁定的门槛不下钻**：锁住一个 Group 的含义是「里面的东西不要动」，双击穿过去等于把锁绕开。
 * 这一档解算成 Group 自己，交给收敛那一支按锁定处理。
 *
 * 判据只读 `isComposeGroupEntity`——容器（Frame、Auto Layout 容器）**不是**门槛：这个产品里
 * 容器的子级一直是直接可点的，场景更是画布本身。
 *
 * @public
 */
export function resolveStageGroupHit(query: StageGroupHitQuery): StageGroupHitResolution {
  const { document, getParentId, entityId } = query
  const direct = { entityId, descended: false } as const
  if (query.deep) return direct

  const entered = new Set<string>()
  for (const selected of query.selectedIds) {
    const hostId = composeInstancePathHostId(selected)
    if (!document.entities[hostId]) continue
    for (let ancestor = getParentId(hostId); ancestor; ancestor = getParentId(ancestor)) {
      entered.add(ancestor)
    }
  }

  // 命中链：命中项在前，一路上溯到根。
  const chain: string[] = [entityId]
  for (let ancestor = getParentId(entityId); ancestor; ancestor = getParentId(ancestor)) {
    chain.push(ancestor)
  }
  let gate = -1
  for (let index = 1; index < chain.length; index += 1) {
    const candidate = document.entities[chain[index]!]
    if (candidate && isComposeGroupEntity(candidate) && !entered.has(chain[index]!)) gate = index
  }
  if (gate === -1) return direct

  const gateId = chain[gate]!
  const doubleClick = (query.clickCount ?? 1) % 2 === 0
  if (!doubleClick || getComposeLock(document.entities[gateId]!).locked) {
    return { entityId: gateId, descended: false }
  }
  return { entityId: chain[gate - 1]!, descended: true }
}

/**
 * `Escape` 退出分组：求当前选区共同的最近 Group 严格祖先。
 *
 * @remarks
 * 进了组之后（选区是某个 Group 的后代），按 `Escape` 回到上一层——选中那个 Group 自己，与 Figma
 * 相同；再按一次没有更外层的 Group 时返回 `null`，调用方保持既有行为。
 *
 * 只认**共同**的那一个：选区里的项分属两个不同 Group 时没有「上一层」可言。复合地址按宿主实例算，
 * 已不在文档中的 ID 不参与。
 *
 * @returns 应当选中的 Group；选区为空或没有共同的 Group 祖先时为 `null`
 *
 * @public
 */
export function resolveStageGroupExit(query: Pick<StageGroupHitQuery, 'document' | 'getParentId' | 'selectedIds'>): string | null {
  const { document, getParentId } = query
  let common: string | null | undefined
  for (const selected of query.selectedIds) {
    const hostId = composeInstancePathHostId(selected)
    if (!document.entities[hostId]) continue
    let nearest: string | null = null
    for (let ancestor = getParentId(hostId); ancestor; ancestor = getParentId(ancestor)) {
      const candidate = document.entities[ancestor]
      if (candidate && isComposeGroupEntity(candidate)) {
        nearest = ancestor
        break
      }
    }
    if (nearest === null) return null
    if (common === undefined) common = nearest
    else if (common !== nearest) return null
  }
  return common ?? null
}
