import {
  formatComposeKeybinding as formatKeybinding,
  formatComposeKeybindings as formatKeybindings,
} from '@compose-ui/commands'
import type { ComposeKeybinding } from '@compose-ui/commands'

export type { ComposeKeybinding }

/**
 * 按当前浏览器平台格式化一个键位，供菜单、设置等 Compose chrome 复用。
 *
 * @remarks
 * 纯格式化逻辑住在无 DOM 的 `@compose-ui/commands`；本层只补上「当前平台」这一个浏览器
 * 事实，因此格式化本身可以在 node 环境中确定性地测试。
 *
 * @param binding - 需要展示的单次键位。
 * @param platform - 可选的 `navigator.platform`；省略时在浏览器中自动读取。
 * @returns macOS 使用符号修饰键，其他平台使用可读的 `Ctrl+Shift+…` 格式。
 * @public
 */
export function formatComposeKeybinding(
  binding: ComposeKeybinding,
  platform: string = currentPlatform(),
) {
  return formatKeybinding(binding, platform)
}

/**
 * 格式化一个动作的全部生效键位。
 *
 * @returns 各替代键位以 ` / ` 分隔；没有键位时返回空字符串。
 * @public
 */
export function formatComposeKeybindings(
  bindings: readonly ComposeKeybinding[] | undefined,
  platform: string = currentPlatform(),
) {
  return formatKeybindings(bindings, platform)
}

function currentPlatform() {
  return typeof navigator === 'undefined' ? '' : navigator.platform
}
