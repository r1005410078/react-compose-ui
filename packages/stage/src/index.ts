/**
 * 提供 DOM Scene 与 SVG Overlay 组合的无限编辑 Stage。
 *
 * @packageDocumentation
 */

import './styles.css'

export { ComposeStage } from './stage-surface'
export { ComposeComponentPalette, type ComposeComponentPaletteProps } from './component-palette'
export type {
  ComposeStageClipboard,
  ComposeStageDispatch,
  ComposeStageKeybinding,
  ComposeStageLayoutRuntime,
  ComposeStageMarqueeMode,
  ComposeStageProps,
  ComposeStageShortcutAction,
  ComposeStageDelegatableAction,
  ComposeStageShortcuts,
  ComposeStageTool,
} from './types'
/** `@compose-ui/stage` 的稳定包标识。 @public */
export const COMPOSE_UI_STAGE_PACKAGE = '@compose-ui/stage' as const
