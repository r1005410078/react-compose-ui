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
/**
 * 接线节点的身份判据。
 *
 * @remarks
 * 导出给宿主的删除入口用：删除有好几个入口，而「删掉一条支路之后收拾支路不足的节点」只有
 * `createStageDeleteEntitiesCommand` 一份实现，它需要这条谓词才认得出节点。
 */
export { isStageJunctionEntity, STAGE_JUNCTION_PRESET_ID } from './drafting'
export type {
  ComposeStageClipboard,
  ComposeStageDispatch,
  ComposeStageEditablePathChange,
  ComposeStageHandle,
  ComposeStageKeybinding,
  ComposeStageLayoutRuntime,
  ComposeStagePolicy,
  ComposeStageProps,
  ComposeStageServices,
  ComposeStageShortcutAction,
  ComposeStageDelegatableAction,
  ComposeStageShortcuts,
  ComposeStageTool,
} from './types'
/**
 * 十字光标样式；宿主经 `ComposeStageProps.crosshairStyle` 传入，编辑器把它作为偏好持有。
 * 从本包转导是为了让不依赖 `canvas-kit` 的宿主拿得到这个联合。
 */
export type { ComposeCanvasCrosshairStyle } from '@compose-ui/canvas-kit'
/** `@compose-ui/stage` 的稳定包标识。 @public */
export const COMPOSE_UI_STAGE_PACKAGE = '@compose-ui/stage' as const
