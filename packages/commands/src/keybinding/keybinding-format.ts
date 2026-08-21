import type { ComposeKeybinding } from './keybinding-types'

/**
 * 按给定平台格式化一个键位。
 *
 * @remarks
 * `platform` 是**必填**参数：本包无 DOM，不读取 `navigator`。需要自动识别平台的 chrome
 * 在自己那一层补上默认值。
 *
 * @param binding - 需要展示的单次键位。
 * @param platform - 形如 `navigator.platform` 的平台字符串。
 * @returns macOS 使用符号修饰键，其他平台使用可读的 `Ctrl+Shift+…` 格式。
 * @public
 */
export function formatComposeKeybinding(binding: ComposeKeybinding, platform: string) {
  const key = displayKey(binding.code)
  if (isMacPlatform(platform)) {
    return [
      binding.primary ? '⌘' : '',
      binding.control ? '⌃' : '',
      binding.alt ? '⌥' : '',
      binding.shift ? '⇧' : '',
      key,
    ].join('')
  }

  return [
    binding.primary || binding.control ? 'Ctrl' : '',
    binding.alt ? 'Alt' : '',
    binding.shift ? 'Shift' : '',
    key,
  ].filter(Boolean).join('+')
}

/**
 * 格式化一个动作的全部生效键位。
 *
 * @returns 各替代键位以 ` / ` 分隔；没有键位时返回空字符串。
 * @public
 */
export function formatComposeKeybindings(
  bindings: readonly ComposeKeybinding[] | undefined,
  platform: string,
) {
  return bindings?.map((binding) => formatComposeKeybinding(binding, platform)).join(' / ') ?? ''
}

/** 判定平台字符串是否属于使用 Command 键的 Apple 平台。 @public */
export function isMacPlatform(platform: string) {
  return /Mac|iPhone|iPad|iPod/i.test(platform)
}

function displayKey(code: string) {
  const names: Record<string, string> = {
    Backspace: 'Backspace',
    BracketLeft: '[',
    BracketRight: ']',
    Comma: ',',
    Delete: 'Delete',
    Digit0: '0',
    Equal: '=',
    Escape: 'Esc',
    Minus: '-',
    Space: 'Space',
  }
  if (names[code]) return names[code]
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  return code
}
