import { DockviewDefaultTab } from 'dockview-react'
import type {
  IDockviewHeaderActionsProps,
  IDockviewPanelHeaderProps,
} from 'dockview-react'
import type { PointerEventHandler } from 'react'
import { WORKSPACE_GROUP_IDS, WORKSPACE_PANEL_IDS } from './workspace-layout'

type WorkspaceTabProps = IDockviewPanelHeaderProps & {
  onPointerDown?: PointerEventHandler<HTMLDivElement>
  onPointerLeave?: PointerEventHandler<HTMLDivElement>
  onPointerUp?: PointerEventHandler<HTMLDivElement>
}

function SceneGraphIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m12 2.75 8 4.5v9.5l-8 4.5-8-4.5v-9.5l8-4.5Z" />
      <path d="m4.35 7.45 7.65 4.3 7.65-4.3M12 11.75v9.5" />
    </svg>
  )
}

function InspectorIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 6h6M14 6h6M10 3v6M4 12h11M19 12h1M15 9v6M4 18h3M11 18h9M7 15v6" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63h.01A1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9v.01A1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  )
}

export function WorkspaceHeaderActions(props: IDockviewHeaderActionsProps) {
  if (props.group.id !== WORKSPACE_GROUP_IDS.scene) {
    return null
  }

  return (
    <div
      aria-label="设置"
      className="compose-editor__settings-icon"
      role="img"
      title="设置"
    >
      <SettingsIcon />
    </div>
  )
}

export function WorkspaceTab(props: WorkspaceTabProps) {
  const icon =
    props.api.id === WORKSPACE_PANEL_IDS.scene ? (
      <SceneGraphIcon />
    ) : props.api.id === WORKSPACE_PANEL_IDS.inspector ? (
      <InspectorIcon />
    ) : null

  if (icon) {
    return (
      <div
        className="compose-editor__icon-tab"
        data-workspace-tab={props.api.id}
        onPointerDown={props.onPointerDown}
        onPointerLeave={props.onPointerLeave}
        onPointerUp={props.onPointerUp}
        title={props.api.title}
      >
        {icon}
        <span className="compose-editor__visually-hidden">{props.api.title}</span>
      </div>
    )
  }

  return (
    <DockviewDefaultTab {...props} hideClose />
  )
}
