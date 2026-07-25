import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { HistoryNavigationController } from '@compose-ui/history'

export interface WorkspaceContent {
  sceneGraphPanel?: ReactNode
  componentLibraryPanel?: ReactNode
  history?: HistoryNavigationController
  historyPanel?: ReactNode
  stageToolbar?: ReactNode
  children?: ReactNode
  inspectorPanel?: ReactNode
  transactionLogPanel?: ReactNode
  commandPanel?: ReactNode
  settingsOpen: boolean
  settingsPanelId: string
  setSettingsButton: (element: HTMLButtonElement | null) => void
  toggleSettings: () => void
}

export const WorkspaceContentContext = createContext<WorkspaceContent | null>(null)

export function useWorkspaceContent() {
  const content = useContext(WorkspaceContentContext)

  if (content === null) {
    throw new Error('Workspace panels must be rendered inside ComposeEditor')
  }

  return content
}
