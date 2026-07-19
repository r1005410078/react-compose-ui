import { DockviewDefaultTab } from 'dockview-react'
import type { IDockviewPanelHeaderProps } from 'dockview-react'

export function WorkspaceTab(props: IDockviewPanelHeaderProps) {
  return (
    <DockviewDefaultTab
      {...props}
      className="compose-editor__tab"
      hideClose
    />
  )
}
