/**
 * 与浏览器 `KeyboardEvent.code` 对齐的通用单次键位描述。
 *
 * @public
 */
export interface ComposeKeybinding {
  /** 布局无关的物理键位代码。 */
  readonly code: string
  /** macOS 使用 Command，其他平台使用 Control。 */
  readonly primary?: boolean
  /** 所有平台都明确使用 Control。 */
  readonly control?: boolean
  /** 是否要求 Shift。 */
  readonly shift?: boolean
  /** 是否要求 Alt/Option。 */
  readonly alt?: boolean
}

/**
 * 按当前浏览器平台格式化一个键位，供菜单、设置等 Compose chrome 复用。
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
  const mac = isMacPlatform(platform)
  const key = displayKey(binding.code)
  if (mac) {
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
  platform: string = currentPlatform(),
) {
  return bindings?.map((binding) => formatComposeKeybinding(binding, platform)).join(' / ') ?? ''
}

function currentPlatform() {
  return typeof navigator === 'undefined' ? '' : navigator.platform
}

function isMacPlatform(platform: string) {
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
