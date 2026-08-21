/**
 * 对选择集的一次改动。
 *
 * @remarks
 * 用改动而不是「下一个选择集」表达，是为了让插件不必知道当前选择集的全貌——它只知道自己
 * 命中了什么、用户按没按 Shift。
 *
 * @public
 */
export type CadSelectionChange =
  | { readonly kind: 'add'; readonly ids: readonly string[] }
  | { readonly kind: 'remove'; readonly ids: readonly string[] }
  | { readonly kind: 'clear' }

/**
 * 把一次改动应用到选择集。
 *
 * @remarks
 * **语义按 AutoCAD 而不是页面编辑器**：点中图元是**加入**，不需要按修饰键；Shift 是**移出**。
 * 页面编辑器那套「点一下换一个、Shift 才追加」在这里是反的。这不是疏漏——用户明确说过 CAD
 * 「跟画页面是完全不同的风格」，在选择集这种每分钟要用几十次的动作上折中只会两边都不像。
 *
 * 顺序按首次加入的先后保持稳定：选择集会喂给命令，而 ERASE 之类的命令把它当成一个序列。
 *
 * @param current - 当前选择集。
 * @param change - 要应用的改动。
 * @returns 新的选择集；内容没有变化时**原样返回入参**，便于调用方按引用判断是否需要重绘。
 * @public
 */
export function applyCadSelection(
  current: readonly string[],
  change: CadSelectionChange,
): readonly string[] {
  if (change.kind === 'clear') return current.length === 0 ? current : []
  if (change.ids.length === 0) return current

  if (change.kind === 'remove') {
    const removed = new Set(change.ids)
    const next = current.filter((id) => !removed.has(id))
    return next.length === current.length ? current : next
  }

  const present = new Set(current)
  const added = change.ids.filter((id) => !present.has(id))
  return added.length === 0 ? current : [...current, ...added]
}

/**
 * 从选择集中剔除已不存在的 Entity。
 *
 * @remarks
 * 删除命令提交后必须走一遍：留在选择集里的已删 id 会指向不存在的 Entity，随后任何以选择集
 * 为输入的命令都会拿到幽灵目标。
 *
 * @public
 */
export function pruneCadSelection(
  current: readonly string[],
  exists: (id: string) => boolean,
): readonly string[] {
  const next = current.filter(exists)
  return next.length === current.length ? current : next
}
