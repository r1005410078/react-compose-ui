import type { ComposeCommandAction, ComposeCommandActionGroup } from '../types'

/** 判断单个动作是否命中检索词；调用方保证 `term` 已转为小写。 */
function matchesTerm(action: ComposeCommandAction, term: string) {
  if (action.title.toLowerCase().includes(term)) return true
  if (action.id.toLowerCase().includes(term)) return true
  if (action.category?.toLowerCase().includes(term) === true) return true
  return action.keywords?.some((keyword) => keyword.toLowerCase().includes(term)) === true
}

/** 按 category 首次出现的顺序归并，未分组动作固定排在末尾。 */
function groupByCategory(
  actions: readonly ComposeCommandAction[],
): readonly ComposeCommandActionGroup[] {
  const groups: ComposeCommandActionGroup[] = []
  // bucket 与 groups 中的 actions 是同一个数组引用，后续 push 会直接反映到已入列的分组上，
  // 这样只需遍历一次即可同时确定分组顺序与组内顺序。
  const buckets = new Map<string, ComposeCommandAction[]>()
  const ungrouped: ComposeCommandAction[] = []

  for (const action of actions) {
    if (action.category === undefined) {
      ungrouped.push(action)
      continue
    }
    const existing = buckets.get(action.category)
    if (existing) {
      existing.push(action)
      continue
    }
    const bucket = [action]
    buckets.set(action.category, bucket)
    groups.push({ category: action.category, actions: bucket })
  }

  if (ungrouped.length > 0) groups.push({ category: null, actions: ungrouped })
  return groups
}

/**
 * 按查询过滤宿主动作并归组。
 *
 * @remarks
 * 空查询返回空数组而不是全部动作：面板据此不渲染结果区，保持命令调试台原本的形态。
 * 前导 `/` 只是习惯性前缀，剥离后为空即表示「列出全部」，因此 `/编组` 与 `编组` 等价。
 *
 * @param actions - 宿主提供的动作，保持其原始顺序。
 * @param query - 用户在检索框中的原始输入。
 * @returns 命中动作按 category 归并后的分组；无命中时为空数组。
 * @public
 */
export function filterComposeCommandActions(
  actions: readonly ComposeCommandAction[],
  query: string,
): readonly ComposeCommandActionGroup[] {
  const trimmed = query.trim()
  if (trimmed === '') return []

  const term = (trimmed.startsWith('/') ? trimmed.slice(1) : trimmed).trim().toLowerCase()
  if (term === '') return groupByCategory(actions)

  return groupByCategory(actions.filter((action) => matchesTerm(action, term)))
}
