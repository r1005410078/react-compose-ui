/** 工作区布局：Dockview 面板拓扑、标签页与跨面板内容 Context。 */
export {
  WorkspaceContentContext,
  useWorkspaceContent,
  type ComposeAssetDocumentSession,
  type ComposeCadDocumentSession,
  type ComposePageDocumentSession,
  type ComposeComponentDocumentSession,
  type ComposeWorkspaceDocumentSession,
  type WorkspaceContent,
} from './workspace-context'
export {
  WORKSPACE_COMPONENT_IDS,
  WORKSPACE_GROUP_IDS,
  WORKSPACE_PANEL_IDS,
  WORKSPACE_SIZES,
  type InitializeWorkspaceOptions,
  createAssetDocumentPanelId,
  initializeCoreWorkspace,
  initializeOuterWorkspace,
  createPageDocumentPanelId,
  createCadDocumentPanelId,
  createComponentDocumentPanelId,
  isAssetDocumentPanelId,
  isPageDocumentPanelId,
  isCadDocumentPanelId,
  isComponentDocumentPanelId,
  isWorkspaceDocumentPanelId,
  localizeWorkspace,
} from './workspace-layout'
export {
  AnimationPanel,
  AssetBrowserPanel,
  AssetDocumentPanel,
  CanvasPanel,
  ComponentLibraryPanel,
  PageDocumentPanel,
  ComponentDocumentPanel,
  ComposeCommandPanel,
  InspectorPanel,
  SceneGraphPanel,
  TransactionLogPanel,
  WorkspaceCorePanel,
} from './workspace-panels'
export { WorkspaceHeaderActions, WorkspaceTab } from './workspace-tab'
export {
  useWorkspaceEdgeCollapse,
  type ComposeWorkspaceDocumentKind,
} from './use-edge-collapse'
export { EditorModeSwitcher } from './editor-mode-switcher'
export type { ComposeEditorMode, EditorModeSwitcherProps } from './editor-mode-switcher'
