/**
 * 提供 DOM Scene 与 SVG Overlay 组合的无限编辑 Stage。
 *
 * @packageDocumentation
 */

import './styles.css'

export { Stage } from './stage'
export { ComponentPalette, type ComponentPaletteProps } from './palette'
export { type StageFramePreset } from './frame-preset'
export type {
  StageDispatch,
  StageKeybinding,
  StageLocale,
  StageProps,
  StageShortcutAction,
  StageShortcuts,
  StageTool,
} from './types'
/** `@compose-ui/stage` 的稳定包标识。 @public */
export const COMPOSE_UI_STAGE_PACKAGE = '@compose-ui/stage' as const
