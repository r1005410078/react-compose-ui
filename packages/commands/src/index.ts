/**
 * 无 React、无 DOM、零运行时依赖的命令与键位包。
 *
 * @remarks
 * 承载键位的类型、归一化、序列化、事件匹配与平台格式化五项能力，以及动作 id 到键位列表的
 * 泛型映射。这五项属于同一件事：分散在不同包时，任何一方都无法独立判定「一次按键命中了
 * 哪个动作」或「两个动作是否撞键」。
 *
 * 本包不认识任何文档协议——动作只是 `run(ctx)`——因此页面编辑器、Stage 与将来的 CAD
 * 命令行可以共用同一套判定。
 *
 * @packageDocumentation
 */

export {
  composeKeyboardEventCode,
  findComposeKeybindingConflict,
  formatComposeKeybinding,
  formatComposeKeybindings,
  isMacPlatform,
  matchesComposeKeybinding,
  normalizeComposeKeybinding,
  normalizeComposeKeybindingMap,
  resolveComposeKeybindingAction,
  serializeComposeKeybinding,
  type ComposeKeybinding,
  type ComposeKeybindingMap,
  type ComposeKeyboardEventShape,
} from './keybinding'

/** `@compose-ui/commands` 的稳定包标识。 @public */
export const COMPOSE_UI_COMMANDS_PACKAGE = '@compose-ui/commands' as const
