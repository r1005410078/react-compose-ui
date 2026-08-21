/**
 * 无 React、无 DOM、零运行时依赖的命令与键位包。
 *
 * @remarks
 * 承载键位的类型、归一化、序列化、事件匹配与平台格式化五项能力，以及动作 id 到键位列表的
 * 泛型映射。这五项属于同一件事：分散在不同包时，任何一方都无法独立判定「一次按键命中了
 * 哪个动作」或「两个动作是否撞键」。
 *
 * 另有由**键盘启动**的多步提示命令会话协议：命令自己跑状态机，宿主只转发输入并渲染提示与
 * 预览。效果类型对消费者泛型，因此本包仍不认识任何文档协议。
 *
 * @packageDocumentation
 */

export {
  createComposeCommandRegistry,
  resolveComposeCommand,
  type ComposeCommandDefinition,
  type ComposeCommandInput,
  type ComposeCommandInputKind,
  type ComposeCommandKeyword,
  type ComposeCommandPoint,
  type ComposeCommandPrompt,
  type ComposeCommandRegistry,
  type ComposeCommandSession,
  type ComposeCommandStep,
} from './command'
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
