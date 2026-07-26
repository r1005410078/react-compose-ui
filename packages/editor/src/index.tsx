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
// eslint-disable-next-line react-refresh/only-export-components -- 公共入口同时导出 Hook 与工厂。
export {
  useComposeEditorController,
  type ComposeEditorController,
  type ComposeEditorTransactionEvent,
  type UseComposeEditorControllerOptions,
} from './controller'
// eslint-disable-next-line react-refresh/only-export-components -- 偏好工厂是纯函数。
export { createDefaultComposeEditorPreferences } from './preferences'
export type {
  ComposeEditorKeybinding,
  ComposeEditorPreferences,
  ComposeEditorShortcutAction,
  ComposeEditorShortcutScope,
} from './preferences'
