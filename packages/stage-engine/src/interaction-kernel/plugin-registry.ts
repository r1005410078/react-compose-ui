import type { StageInteractionPlugin } from './kernel-types'

/**
 * 按优先级排序的插件集合。
 *
 * @public
 */
export interface StagePluginRegistry {
  /** 按 `priority` 降序、同优先级按注册顺序的稳定序列。 */
  ordered(): readonly StageInteractionPlugin[]
}

/**
 * 建立插件注册表。
 *
 * @remarks
 * 排序在建表时一次算完：仲裁器在每次 pointerdown 上遍历它，逐帧重排会把 O(n log n) 放进
 * 手势热路径。同优先级保持注册顺序（稳定排序），因此组合根的书写顺序是可预期的兜底规则。
 *
 * @throws 当出现重复 `id` 时抛错——重复 id 会让「哪个插件在生效」无法从组合根读出。
 *
 * @public
 */
export function createStagePluginRegistry(
  plugins: readonly StageInteractionPlugin[],
): StagePluginRegistry {
  const seen = new Set<string>()
  for (const plugin of plugins) {
    if (seen.has(plugin.id)) {
      throw new Error(`Duplicate Stage interaction plugin id: ${plugin.id}`)
    }
    seen.add(plugin.id)
  }
  const sorted = [...plugins].sort((left, right) => right.priority - left.priority)
  return { ordered: () => sorted }
}
