/**
 * 提供 DOM Scene 与 SVG Overlay 组合的无限编辑 Stage。
 *
 * @packageDocumentation
 */

import './styles.css'

export { ComposeStage } from './stage-surface'
/**
 * Stage 的默认键位表。
 *
 * @remarks
 * 导出给宿主展开自己的键位表用：Editor 的动作集合是 Stage 的超集，把这 30 项再抄一遍会
 * 让两份默认值靠人工同步维持一致，而运行时 Editor 的表会覆盖 Stage 的表——漏改一处的
 * 表现是「设置里改了键位，脱离编辑器单独使用 Stage 时还是旧键位」。
 */
export { DEFAULT_STAGE_SHORTCUTS } from './stage-surface/keyboard'
export { ComposeComponentPalette, type ComposeComponentPaletteProps } from './component-palette'
export type {
  ComposeStageClipboard,
  ComposeStageDispatch,
  ComposeStageEditablePathChange,
  ComposeStageKeybinding,
  ComposeStageLayoutRuntime,
  ComposeStageMarqueeMode,
  ComposeStagePolicy,
  ComposeStageProps,
  ComposeStageServices,
  ComposeStageShortcutAction,
  ComposeStageDelegatableAction,
  ComposeStageShortcuts,
  ComposeStageTool,
} from './types'
/** `@compose-ui/stage` 的稳定包标识。 @public */
export const COMPOSE_UI_STAGE_PACKAGE = '@compose-ui/stage' as const
