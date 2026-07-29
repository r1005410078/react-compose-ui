import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { ComposeAssetEntry, ComposeAssetProvider } from '@compose-ui/assets'
import type {
  ComposeHistoryNavigationController,
  ComposeHistoryShortcuts,
} from '@compose-ui/history'

export interface WorkspaceContent {
  sceneGraphPanel?: ReactNode
  componentLibraryPanel?: ReactNode
  history?: ComposeHistoryNavigationController
  historyPanel?: ReactNode
  historyShortcuts?: ComposeHistoryShortcuts
  stageToolbar?: ReactNode
  children?: ReactNode
  inspectorPanel?: ReactNode
  transactionLogPanel?: ReactNode
  commandPanel?: ReactNode
  assetBrowserPanel?: ReactNode
  assetDocuments: ReadonlyMap<string, ComposeAssetDocumentSession>
  registerAssetDocumentSave: (
    panelId: string,
    save: (() => Promise<boolean>) | null,
  ) => void
  setAssetDocumentDirty: (panelId: string, dirty: boolean) => void
  setAssetDocumentSaved: (panelId: string, entry: ComposeAssetEntry) => void
  requestAssetDocumentClose: (panelId: string) => void
  settingsOpen: boolean
  settingsPanelId: string
  setSettingsButton: (element: HTMLButtonElement | null) => void
  toggleSettings: () => void
}

/** Editor 实例内的临时资源文档会话；不写入 Dockview 布局或 ComposeDocument。 @internal */
export interface ComposeAssetDocumentSession {
  readonly entry: ComposeAssetEntry
  readonly panelId: string
  readonly provider: ComposeAssetProvider
  readonly dirty: boolean
  readonly save: (() => Promise<boolean>) | null
}

export const WorkspaceContentContext = createContext<WorkspaceContent | null>(null)

export function useWorkspaceContent() {
  const content = useContext(WorkspaceContentContext)

  if (content === null) {
    throw new Error('Workspace panels must be rendered inside ComposeEditor')
  }

  return content
}
