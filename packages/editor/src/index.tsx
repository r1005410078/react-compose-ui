/* eslint-disable react-refresh/only-export-components -- 库公共入口必须同时导出 React 组件、控制 Hook 和偏好 factory。 */
/**
 * 提供可嵌入 React 宿主的 Compose UI 编辑器工作区。
 *
 * @packageDocumentation
 */
import './styles.css'

export {
  ComposeEditor,
  type ComposeEditorAssets,
  type ComposeEditorProps,
  type ComposeEditorSlots,
} from './compose-editor'
export {
  useComposeEditorController,
  useComposeStageViewport,
  type ComposeEditorCommandRewrite,
  type ComposeEditorController,
  type ComposeEditorTransactionEvent,
  type ComposeCreateComponentFromSelectionInput,
  type ComposeCreateComponentRequest,
  type ComposeCreateComponentFromSelectionResult,
  type UseComposeEditorControllerOptions,
} from './editor-controller'
export { useComposePageCatalog, useNodeEditorPort } from './pages'
export type {
  ComposeEditorActivePage,
  ComposeEditorPagesConfig,
} from './pages'
export type {
  ComposeEditorActiveComponentSession,
  ComposeEditorComponentsConfig,
} from './component-workspace'
export { createDefaultComposeEditorPreferences } from './editor-preferences'
export type {
  ComposeEditorKeybinding,
  ComposeEditorPreferences,
  ComposeEditorShortcutAction,
  ComposeEditorShortcutScope,
} from './editor-preferences'
