/** 工作区布局：Dockview 面板拓扑、标签页与跨面板内容 Context。 */
export {
  WorkspaceContentContext,
  useWorkspaceContent,
  type ComposeAssetDocumentSession,
  type ComposePageDocumentSession,
  type ComposeWorkspaceDocumentSession,
  type WorkspaceContent,
} from './workspace-context'
export {
  WORKSPACE_COMPONENT_IDS,
  WORKSPACE_GROUP_IDS,
  WORKSPACE_PANEL_IDS,
  WORKSPACE_SIZES,
  createAssetDocumentPanelId,
  initializeWorkspace,
  createPageDocumentPanelId,
  isAssetDocumentPanelId,
  isPageDocumentPanelId,
  isWorkspaceDocumentPanelId,
  localizeWorkspace,
} from './workspace-layout'
export {
  AssetBrowserPanel,
  AssetDocumentPanel,
  CanvasPanel,
  ComponentLibraryPanel,
  PageDocumentPanel,
  ComposeCommandPanel,
  InspectorPanel,
  SceneGraphPanel,
  TransactionLogPanel,
} from './workspace-panels'
export { WorkspaceHeaderActions, WorkspaceTab } from './workspace-tab'
