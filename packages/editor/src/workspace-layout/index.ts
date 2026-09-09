/** 工作区布局：单一 Dockview 的面板拓扑、文档标签条与跨面板内容 Context。 */
export {
  WorkspaceContentContext,
  useWorkspaceContent,
  type ComposeAssetDocumentSession,
  type ComposePageDocumentSession,
  type ComposeComponentDocumentSession,
  type ComposeWorkspaceDocumentSession,
  type WorkspaceContent,
} from './workspace-context'
export {
  DEFAULT_TOOLS_WEIGHT,
  WORKSPACE_CARD_GAP,
  WORKSPACE_COMPONENT_IDS,
  WORKSPACE_GROUP_IDS,
  WORKSPACE_HEADER_HEIGHT,
  WORKSPACE_PANEL_IDS,
  WORKSPACE_SIDE_GROUP_PREFIX,
  WORKSPACE_SIZES,
  type InitializeWorkspaceOptions,
  applyWorkspaceInitialSizes,
  buildWorkspaceLayout,
  computeToolsHeight,
  createAssetDocumentPanelId,
  createPageDocumentPanelId,
  createComponentDocumentPanelId,
  initializeWorkspace,
  isAssetDocumentPanelId,
  isPageDocumentPanelId,
  isComponentDocumentPanelId,
  isWorkspaceDocumentPanelId,
  localizeWorkspace,
  resolveToolsWeight,
  setWorkspacePaletteTitle,
  setWorkspacePanelTitle,
  syncWorkspaceHistoryPanel,
} from './workspace-layout'
export {
  AnimationPanel,
  AssetBrowserPanel,
  AssetDocumentSurface,
  CanvasPanel,
  ComponentDocumentSurface,
  ComponentLibraryPanel,
  ComposeCommandPanel,
  HistoryPanel,
  InspectorPanel,
  PageDocumentSurface,
  SceneGraphPanel,
  TransactionLogPanel,
  WorkspacePortals,
} from './workspace-panels'
export { workspaceComponents } from './workspace-components'
export {
  createWorkspaceHostElements,
  type WorkspaceHostElements,
  type WorkspaceHostKey,
} from './workspace-hosts'
export {
  COMPOSE_DEFAULT_WORKSPACES,
  COMPOSE_DRAWING_WORKSPACE_ID,
  COMPOSE_PAGE_WORKSPACE_ID,
  DEFAULT_WORKSPACE_SEEDS,
  resolveWorkspaceDescription,
  resolveWorkspaceList,
  resolveWorkspacePaletteTitle,
  resolveWorkspaceTitle,
  type ComposeEditorCustomWorkspace,
  type ComposeEditorWorkspaceDefinition,
  type ComposeWorkspaceLayout,
  type ComposeWorkspaceLayoutPreset,
  type ComposeWorkspaceLayoutSnapshot,
  type ComposeWorkspacePanelName,
  type ComposeWorkspaceSeeds,
  type ComposeWorkspaceSession,
} from './workspace-definition'
export {
  useWorkspaceSession,
  type ComposeWorkspaceDialog,
  type ComposeWorkspaceSessionHandle,
  type ComposeWorkspaceSessionItem,
  type ComposeWorkspaceSessionPort,
} from './use-workspace-session'
export { WorkspaceDialogs } from './workspace-dialogs'
export { WorkspaceTab } from './workspace-tab'
export { EditorTopBar, WorkspaceDocumentTabs, WorkspaceLayoutToggles, WorkspaceSwitcher } from './workspace-chrome'
export {
  useWorkspaceSideCollapse,
  type ComposeWorkspaceSide,
  type ComposeWorkspaceSideCollapse,
  type ComposeWorkspaceSideCollapsed,
} from './use-side-collapse'
export { EditorModeSwitcher } from './editor-mode-switcher'
export type { ComposeEditorMode, EditorModeSwitcherProps } from './editor-mode-switcher'
