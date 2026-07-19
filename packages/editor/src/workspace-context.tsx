import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

export interface WorkspaceContent {
  sceneGraphPanel?: ReactNode
  canvasToolbar?: ReactNode
  children?: ReactNode
  inspectorPanel?: ReactNode
  transactionLogPanel?: ReactNode
  commandPanel?: ReactNode
}

export const WorkspaceContentContext = createContext<WorkspaceContent | null>(null)

export function useWorkspaceContent() {
  const content = useContext(WorkspaceContentContext)

  if (content === null) {
    throw new Error('Workspace panels must be rendered inside ComposeEditor')
  }

  return content
}
