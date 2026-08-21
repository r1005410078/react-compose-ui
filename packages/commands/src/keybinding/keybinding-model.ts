import type { ComposeKeybinding, ComposeKeyboardEventShape, ComposeKeybindingMap } from './keybinding-types'

/**
 * 归一化一个键位，使其可用于相等判定。
 *
 * @remarks
 * 剔除取值为假的修饰键字段，因此 `{ code: 'KeyG', shift: false }` 与 `{ code: 'KeyG' }`
 * 序列化后相同。
 *
 * @throws code 为空，或同时要求平台主修饰键与显式 Control 时抛出配置错误——
 * 后者在任何平台上都不可能被满足，静默保留会得到一个永远触发不了的键位。
 * @public
 */
export function normalizeComposeKeybinding(binding: ComposeKeybinding): ComposeKeybinding {
  const code = binding.code.trim()
  if (!code) throw new Error('Shortcut code must not be empty')
  if (binding.primary && binding.control) {
    throw new Error('Shortcut cannot require primary and explicit Control together')
  }

  return {
    code,
    ...(binding.primary ? { primary: true } : {}),
    ...(binding.control ? { control: true } : {}),
    ...(binding.shift ? { shift: true } : {}),
    ...(binding.alt ? { alt: true } : {}),
  }
}

/**
 * 把键位序列化为稳定字符串，供相等判定与去重使用。
 *
 * @remarks
 * 修饰键按固定顺序拼接，因此书写顺序不影响结果。输入 MUST 已归一化，否则假值字段会参与拼接。
 * @public
 */
export function serializeComposeKeybinding(binding: ComposeKeybinding) {
  return [
    binding.code,
    binding.primary ? 'primary' : '',
    binding.control ? 'control' : '',
    binding.shift ? 'shift' : '',
    binding.alt ? 'alt' : '',
  ].join(':')
}

/**
 * 把键盘事件归一为物理键码。
 *
 * @remarks
 * 部分环境（含测试与少数输入法）不提供 `code`，只给出 `key`；这里按需要用到的键补一张
 * 回退表，而不是让匹配在这些环境里静默失效。
 *
 * 导出而不是内部私有：临时平移那类「按下开始、松开结束」的能力要用同一个归一化结果比对
 * 按下与松开的键，若各自实现一份，`code` 缺失的环境里会出现按下能开始、松开却结不掉。
 *
 * @public
 */
export function composeKeyboardEventCode(event: ComposeKeyboardEventShape) {
  if (event.code) return event.code
  const codes: Record<string, string> = {
    ' ': 'Space',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Escape: 'Escape',
  }
  if (/^[a-zA-Z]$/.test(event.key)) return `Key${event.key.toUpperCase()}`
  if (/^[0-9]$/.test(event.key)) return `Digit${event.key}`
  return codes[event.key] ?? event.key
}

/**
 * 判定一次按键是否命中某个键位。
 *
 * @remarks
 * `primary` 的语义是「平台主修饰键」，因此判定写成 `ctrlKey !== metaKey`——在 macOS 上是
 * Command、其他平台是 Control，且不接受两个同时按下。未要求 `primary` 时 Meta 必须为假，
 * 否则 macOS 上的 Command 组合会误命中无修饰键的键位。
 *
 * @public
 */
export function matchesComposeKeybinding(
  event: ComposeKeyboardEventShape,
  binding: ComposeKeybinding,
) {
  const modifierMatches = binding.primary
    ? event.ctrlKey !== event.metaKey
    : event.ctrlKey === Boolean(binding.control) && !event.metaKey
  return composeKeyboardEventCode(event) === binding.code
    && modifierMatches
    && event.shiftKey === Boolean(binding.shift)
    && event.altKey === Boolean(binding.alt)
}

/**
 * 归一化整张映射，并在每个动作内按序列化结果去重。
 *
 * @param map - 动作到键位列表的映射。
 * @returns 同样键集合的新映射；不修改入参。
 * @public
 */
export function normalizeComposeKeybindingMap<TAction extends string>(
  map: ComposeKeybindingMap<TAction>,
): ComposeKeybindingMap<TAction> {
  const entries = (Object.entries(map) as [TAction, readonly ComposeKeybinding[]][])
    .map(([action, bindings]): readonly [TAction, readonly ComposeKeybinding[]] => {
      const normalized = bindings.map(normalizeComposeKeybinding)
      const seen = new Set<string>()
      const unique = normalized.filter((binding) => {
        const key = serializeComposeKeybinding(binding)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      return [action, unique]
    })
  // Object.fromEntries 的返回类型丢掉了 key 的字面量联合，只能断言回去。
  return Object.fromEntries(entries) as unknown as ComposeKeybindingMap<TAction>
}

/**
 * 在候选动作中查找与给定键位撞键的另一个动作。
 *
 * @param map - 动作到键位列表的映射。
 * @param action - 正在配置的动作；自身不算冲突。
 * @param binding - 待配置的键位。
 * @param candidates - 参与判定的动作集合；调用方据此表达作用域。
 * @returns 撞键的动作 id，没有则为 `null`。
 * @public
 */
export function findComposeKeybindingConflict<TAction extends string>(
  map: ComposeKeybindingMap<TAction>,
  action: TAction,
  binding: ComposeKeybinding,
  candidates: readonly TAction[],
): TAction | null {
  const serialized = serializeComposeKeybinding(normalizeComposeKeybinding(binding))
  return candidates.find((candidate) =>
    candidate !== action
    && (map[candidate] ?? []).some((item) =>
      serializeComposeKeybinding(normalizeComposeKeybinding(item)) === serialized)) ?? null
}

/**
 * 解析一次按键命中的动作。
 *
 * @param map - 动作到键位列表的映射。
 * @param event - 归一化的键盘事件形状。
 * @param order - 判定顺序；同一次按键命中多个动作时先者胜出。
 * @returns 命中的动作 id，没有则为 `null`。
 * @public
 */
export function resolveComposeKeybindingAction<TAction extends string>(
  map: ComposeKeybindingMap<TAction>,
  event: ComposeKeyboardEventShape,
  order: readonly TAction[],
): TAction | null {
  return order.find((action) =>
    (map[action] ?? []).some((binding) => matchesComposeKeybinding(event, binding))) ?? null
}
