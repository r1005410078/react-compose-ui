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
  composeEditorStageProps,
  type ComposeEditorStageOverrides,
} from './editor-controller'
export { useComposePageCatalog, useNodeEditorPort } from './pages'
export type {
  ComposeEditorActivePage,
  ComposeEditorLibraryConfig,
  ComposeEditorLibraryDiagnostic,
  ComposeEditorPagesConfig,
} from './pages'
export type {
  ComposeEditorActiveComponentSession,
  ComposeEditorComponentsConfig,
} from './component-workspace'
export {
  createDefaultComposeEditorPreferences,
  createDefaultComposeEditorWorkspacePreferences,
} from './editor-preferences'
export type {
  ComposeEditorKeybinding,
  ComposeEditorCrosshairStyle,
  ComposeEditorPreferences,
  ComposeEditorShortcutAction,
  ComposeEditorShortcutScope,
  ComposeEditorWorkspacePreferences,
} from './editor-preferences'
export { COMPOSE_DEFAULT_WORKSPACES, COMPOSE_PAGE_WORKSPACE_ID } from './workspace-layout'
export type {
  ComposeEditorCustomWorkspace,
  ComposeEditorWorkspaceDefinition,
  ComposeWorkspaceLayout,
  ComposeWorkspaceLayoutPreset,
  ComposeWorkspaceLayoutSnapshot,
  ComposeWorkspacePanelName,
  ComposeWorkspaceSession,
} from './workspace-layout'
export {
  COMPOSE_TOOLBAR_SELECT_ID,
  COMPOSE_TOOLBAR_SEPARATOR,
  DRAWING_TOOLBAR_SHELF,
  PAGE_TOOLBAR_SHELF,
} from './stage-toolbar'
export type { ComposeToolbarItem, ComposeToolbarShelf } from './stage-toolbar'
