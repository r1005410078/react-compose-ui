/**
 * 提供订阅 TransactionRuntime 的独立结构化命令调试台。
 *
 * @packageDocumentation
 */

import './styles.css'

export { ComposeCommandPanel } from './command-panel'
export type {
  ComposeCommandAction,
  ComposeCommandActionGroup,
  ComposeCommandPanelProps,
  ComposeCommandPreset,
  ComposeCommandPresetField,
  ComposeCommandPresetOption,
} from './types'

/** `@compose-ui/command-panel` 的稳定包标识。 @public */
export const COMPOSE_UI_COMMAND_PANEL_PACKAGE = '@compose-ui/command-panel' as const
