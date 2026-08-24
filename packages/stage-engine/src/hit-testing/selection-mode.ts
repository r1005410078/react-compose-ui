import type { StageMarqueeCombine } from './marquee-selection'

/**
 * 点选与框选的组合语义。
 *
 * @remarks
 * - `'replace'`——页面语义（Figma）：点一下换一个，Shift 切换。
 * - `'accumulate'`——AutoCAD 语义：点中即加入（不需要修饰键），Shift 移出。第一方不使用，
 *   留给宿主受控设置。
 *
 * @public
 */
export type StageSelectionMode = 'replace' | 'accumulate'

const DEFAULT_MODE: StageSelectionMode = 'replace'

/**
 * 求解一次**点选**之后的选区。
 *
 * @remarks
 * 与 {@link resolveStageMarqueeCombine} 住在一起是有意的：整张语义表只有一份，点选与框选
 * 各写一半必然漂移出「点着累加、框着替换」这种没人设计过的组合。
 *
 * `'accumulate'` 下的 Shift 只有「移出」一个含义——点未选中的对象是 no-op，而不是加进来。
 * AutoCAD 就是这样：加入不需要修饰键，Shift 因此可以专职做减法。
 *
 * 顺序按首次加入的先后保持稳定：选择集会喂给命令，而命令把它当作一个序列。
 *
 * @param options.current - 当前选区，调用方负责先滤掉已从文档中消失的 ID。
 * @returns 新的选区。
 * @public
 */
export function resolveStageClickSelection(options: {
  readonly mode?: StageSelectionMode
  readonly current: readonly string[]
  readonly entityId: string
  readonly shift: boolean
}): readonly string[] {
  const { current, entityId, shift } = options
  const selected = current.includes(entityId)

  if ((options.mode ?? DEFAULT_MODE) === 'accumulate') {
    if (shift) return selected ? current.filter((id) => id !== entityId) : current
    return selected ? current : [...current, entityId]
  }

  if (shift) return selected ? current.filter((id) => id !== entityId) : [...current, entityId]
  return selected ? current : [entityId]
}

/**
 * 求解一次**框选**与既有选区的组合方式。
 *
 * @remarks
 * 组合与判定模式正交：判定模式决定「框住什么算命中」，组合决定「命中之后怎么并入选区」。
 *
 * `'accumulate'` 下无修饰键即并入，Shift 移出——与点选同一张表。
 *
 * @public
 */
export function resolveStageMarqueeCombine(
  modifiers: { readonly shift: boolean; readonly alt: boolean },
  mode: StageSelectionMode = DEFAULT_MODE,
): StageMarqueeCombine {
  if (mode === 'accumulate') return modifiers.shift || modifiers.alt ? 'subtract' : 'add'
  if (modifiers.shift) return 'add'
  if (modifiers.alt) return 'subtract'
  return 'replace'
}
