import { COMPOSE_UI_CORE_PACKAGE } from '@compose-ui/core'
import { SceneTree } from '@compose-ui/scene-tree'
import { DockviewReact, themeAbyss } from 'dockview-react'
import { useCallback, useMemo, useRef } from 'react'
import type {
  DockviewReadyEvent,
  IDockviewPanelProps,
} from 'dockview-react'
import type { HTMLAttributes, ReactNode } from 'react'
import type { SceneTreeProps } from '@compose-ui/scene-tree'
import { WorkspaceContentContext } from './workspace-context'
import {
  CanvasPanel,
  CommandPanel,
  InspectorPanel,
  SceneGraphPanel,
  TransactionLogPanel,
} from './workspace-panels'
import { initializeWorkspace, WORKSPACE_COMPONENT_IDS } from './workspace-layout'
import { WorkspaceHeaderActions, WorkspaceTab } from './workspace-tab'
import './styles.css'

export interface ComposeEditorProps extends HTMLAttributes<HTMLElement> {
  sceneTreeProps?: SceneTreeProps
  sceneGraphPanel?: ReactNode
  canvasToolbar?: ReactNode
  inspectorPanel?: ReactNode
  transactionLogPanel?: ReactNode
  commandPanel?: ReactNode
}

const workspaceComponents = {
  [WORKSPACE_COMPONENT_IDS.scene]: SceneGraphPanel,
  [WORKSPACE_COMPONENT_IDS.canvas]: CanvasPanel,
  [WORKSPACE_COMPONENT_IDS.inspector]: InspectorPanel,
  [WORKSPACE_COMPONENT_IDS.transactionLog]: TransactionLogPanel,
  [WORKSPACE_COMPONENT_IDS.command]: CommandPanel,
} satisfies Record<string, React.FunctionComponent<IDockviewPanelProps>>

const workspaceTabComponents = { workspaceTab: WorkspaceTab }
const emptySceneTreeProps: SceneTreeProps = {
  nodes: [],
  selectedIds: [],
  expandedIds: [],
}

export function ComposeEditor({
  children = 'Compose Editor',
  sceneTreeProps,
  sceneGraphPanel,
  canvasToolbar,
  inspectorPanel,
  transactionLogPanel,
  commandPanel,
  className,
  ...props
}: ComposeEditorProps) {
  const initializedApi = useRef<DockviewReadyEvent['api'] | null>(null)
  const content = useMemo(
    () => ({
      sceneGraphPanel: sceneGraphPanel !== undefined
        ? sceneGraphPanel
        : <SceneTree {...(sceneTreeProps ?? emptySceneTreeProps)} />,
      canvasToolbar,
      children,
      inspectorPanel,
      transactionLogPanel,
      commandPanel,
    }),
    [
      sceneGraphPanel,
      sceneTreeProps,
      canvasToolbar,
      children,
      inspectorPanel,
      transactionLogPanel,
      commandPanel,
    ],
  )
  const handleReady = useCallback((event: DockviewReadyEvent) => {
    if (initializedApi.current === event.api) {
      return
    }

    initializeWorkspace(event.api)
    initializedApi.current = event.api
  }, [])

  const rootClassName = ['compose-editor', className].filter(Boolean).join(' ')

  return (
    <section
      {...props}
      aria-label={props['aria-label'] ?? 'Compose editor'}
      className={rootClassName}
      data-compose-core={COMPOSE_UI_CORE_PACKAGE}
      data-compose-ui="editor"
    >
      <WorkspaceContentContext.Provider value={content}>
        <DockviewReact
          className="compose-editor__dockview"
          components={workspaceComponents}
          disableDnd
          disableFloatingGroups
          onReady={handleReady}
          rightHeaderActionsComponent={WorkspaceHeaderActions}
          tabComponents={workspaceTabComponents}
          theme={themeAbyss}
        />
      </WorkspaceContentContext.Provider>
    </section>
  )
}
