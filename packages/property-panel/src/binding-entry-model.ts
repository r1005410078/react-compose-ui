/** 绑定入口向操作轨道暴露的视觉状态。 @internal */
export type PropertyBindingEntryState = 'literal' | 'bound' | 'invalid'

/** 操作轨道规划所需的最小绑定目标。 @internal */
export interface PropertyBindingRailTarget {
  readonly id: string
  readonly state: PropertyBindingEntryState
}

/** 操作轨道规划所需的最小普通动作。 @internal */
export interface PropertyActionRailItem {
  readonly id: string
  readonly priority: number
  readonly disabled?: boolean
}

/** 属性绑定与普通动作在操作列中的确定布局。 @internal */
export interface PropertyActionRailPlan {
  readonly slots: number
  readonly bindingEntry: 'none' | 'direct' | 'targets' | 'combined'
  readonly bindingState?: PropertyBindingEntryState
  readonly directActionIds: readonly string[]
  readonly overflowActionIds: readonly string[]
}

/** 以错误、已绑定、未绑定的优先级聚合多个目标状态。 @internal */
export function resolvePropertyBindingEntryState(
  targets: readonly PropertyBindingRailTarget[],
): PropertyBindingEntryState | undefined {
  if (targets.length === 0) return undefined
  if (targets.some((target) => target.state === 'invalid')) return 'invalid'
  return targets.some((target) => target.state === 'bound') ? 'bound' : 'literal'
}

/**
 * 规划绑定入口与普通字段动作在操作列中的分配。
 *
 * @internal
 */
export function planPropertyActionRail({
  actionWidth,
  actions,
  targets,
}: {
  readonly actionWidth: number
  readonly actions: readonly PropertyActionRailItem[]
  readonly targets: readonly PropertyBindingRailTarget[]
}): PropertyActionRailPlan {
  // 22px 图标、2px 间距和两侧 2px 内边距：76px 恰好容纳三个槽位。
  const slots = Math.max(1, Math.min(3, Math.floor((actionWidth + 2) / 24)))
  const ordered = [...actions].sort((left, right) => (
    left.priority - right.priority
    || Number(Boolean(left.disabled)) - Number(Boolean(right.disabled))
  ))
  if (targets.length === 0) {
    const direct = ordered.length > slots ? ordered.slice(0, Math.max(0, slots - 1)) : ordered
    const overflow = ordered.length > slots ? ordered.slice(Math.max(0, slots - 1)) : []
    return {
      slots,
      bindingEntry: 'none',
      directActionIds: direct.map((action) => action.id),
      overflowActionIds: overflow.map((action) => action.id),
    }
  }

  const bindingState = resolvePropertyBindingEntryState(targets) ?? 'literal'
  const standaloneEntry = targets.length === 1 ? 'direct' : 'targets'
  if (ordered.length === 0) {
    return {
      slots,
      bindingEntry: standaloneEntry,
      bindingState,
      directActionIds: [],
      overflowActionIds: [],
    }
  }

  // 单槽必须由一个聚合入口同时承载绑定和普通动作，不能让任一按钮溢出操作列。
  if (slots === 1) {
    return {
      slots,
      bindingEntry: 'combined',
      bindingState,
      directActionIds: [],
      overflowActionIds: ordered.map((action) => action.id),
    }
  }

  const actionSlots = slots - 1
  const directCount = ordered.length > actionSlots ? Math.max(0, actionSlots - 1) : ordered.length
  return {
    slots,
    bindingEntry: standaloneEntry,
    bindingState,
    directActionIds: ordered.slice(0, directCount).map((action) => action.id),
    overflowActionIds: ordered.slice(directCount).map((action) => action.id),
  }
}
