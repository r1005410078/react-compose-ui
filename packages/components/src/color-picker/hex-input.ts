import { normalizeComposeColor, type ComposeColor } from '@compose-ui/core'

/**
 * HEX 输入框的取值：用户习惯不打 `#`，补上再交给规范化。
 *
 * @remarks
 * 不放宽 `normalizeComposeColor` 本身——那是**持久化**值的规范形式，`isComposeColor` 靠它
 * 判断「已经是规范值」，放宽会让 `0d1b3a` 也算合法颜色。容忍省略 `#` 是这个输入框的事，
 * 不是协议的事。
 *
 * @internal
 */
export function composeColorFromHexInput(raw: string): ComposeColor | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  return normalizeComposeColor(/^[\da-f]{3,8}$/i.test(trimmed) ? `#${trimmed}` : trimmed)
}

/**
 * HEX 输入框的提交：失焦与回车共用这一处。
 *
 * @remarks
 * 只认 `onBlur` 时，敲完回车看起来已经生效、实际没有——而 HEX 正是照着设计稿填色的主路径。
 * 回车不走 `blur()`：那要求输入框此刻确实有焦点，在真实浏览器里成立、在 jsdom 里不成立，
 * 于是回归用例会盖不住这条。
 *
 * 解析不出颜色时把框里的值退回 `current`，让「这个输入被拒绝了」在屏幕上看得见——
 * 静默丢弃会让用户以为已经填上了。
 *
 * 它是普通函数而不是返回 handler 的工厂：工厂要在渲染期被调用，而静态分析无法判断它返回的
 * 闭包不会当场执行，于是闭包里读到的 ref 会被报成「渲染期访问 ref」。
 *
 * @internal
 */
export function applyComposeHexInput(
  input: HTMLInputElement,
  current: string,
  commit: (color: ComposeColor) => void,
) {
  const color = composeColorFromHexInput(input.value)
  if (color) commit(color)
  else input.value = current
}
