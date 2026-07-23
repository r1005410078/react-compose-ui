import { HistoryPanel } from '@compose-ui/history'
import { DockviewReact, themeAbyss } from 'dockview-react'
import { useCallback, useRef } from 'react'
import type {
  DockviewApi,
  DockviewReadyEvent,
  IDockviewPanelProps,
} from 'dockview-react'
import { useWorkspaceContent } from './workspace-context'
import { WorkspaceTab } from './workspace-tab'

const SCENE_MIN_HEIGHT = 160
const HISTORY_MIN_HEIGHT = 120
const DEFAULT_SCENE_HISTORY_HEIGHT = 480
const SCENE_HISTORY_TAB_COMPONENT = 'workspaceTab'
const SCENE_HISTORY_GROUP_IDS = {
  scene: 'compose-scene-content-group',
  history: 'compose-history-group',
} as const
const SCENE_HISTORY_PANEL_IDS = {
  scene: 'compose-scene-content-panel',
  history: 'compose-history-panel',
} as const
const SCENE_HISTORY_COMPONENT_IDS = {
  scene: 'sceneContent',
  history: 'historyContent',
} as const

function SceneContentPanel() {
  const { sceneGraphPanel } = useWorkspaceContent()
  return (
    <div className="compose-editor__scene-content">
      {sceneGraphPanel}
    </div>
  )
}

function HistoryContentPanel() {
  const { history, historyPanel } = useWorkspaceContent()
  const historyContent = historyPanel !== undefined
    ? historyPanel
    : history ? (
        <HistoryPanel
          className="compose-editor__history-panel"
          controller={history}
        />
      ) : null

  return (
    <div className="compose-editor__history-content">
      {historyContent}
    </div>
  )
}

const sceneHistoryComponents = {
  [SCENE_HISTORY_COMPONENT_IDS.scene]: SceneContentPanel,
  [SCENE_HISTORY_COMPONENT_IDS.history]: HistoryContentPanel,
} satisfies Record<string, React.FunctionComponent<IDockviewPanelProps>>
const sceneHistoryTabComponents = {
  [SCENE_HISTORY_TAB_COMPONENT]: WorkspaceTab,
}

function initializeSceneHistoryWorkspace(api: DockviewApi) {
  const availableHeight = api.height > 0 ? api.height : DEFAULT_SCENE_HISTORY_HEIGHT
  const historyInitialHeight = Math.min(
    Math.max(HISTORY_MIN_HEIGHT, Math.round(availableHeight * 0.4)),
    Math.max(HISTORY_MIN_HEIGHT, availableHeight - SCENE_MIN_HEIGHT),
  )
  const sceneGroup = api.getGroup(SCENE_HISTORY_GROUP_IDS.scene) ?? api.addGroup({
    constraints: { minimumHeight: SCENE_MIN_HEIGHT },
    direction: 'right',
    id: SCENE_HISTORY_GROUP_IDS.scene,
  })
  sceneGroup.locked = 'no-drop-target'
  const historyGroup = api.getGroup(SCENE_HISTORY_GROUP_IDS.history) ?? api.addGroup({
    constraints: { minimumHeight: HISTORY_MIN_HEIGHT },
    direction: 'below',
    id: SCENE_HISTORY_GROUP_IDS.history,
    initialHeight: historyInitialHeight,
    referenceGroup: sceneGroup.id,
  })
  historyGroup.locked = 'no-drop-target'

  let scenePanel = api.getPanel(SCENE_HISTORY_PANEL_IDS.scene)
  if (!scenePanel) {
    scenePanel = api.addPanel({
      component: SCENE_HISTORY_COMPONENT_IDS.scene,
      id: SCENE_HISTORY_PANEL_IDS.scene,
      minimumHeight: SCENE_MIN_HEIGHT,
      position: { referenceGroup: sceneGroup.id },
      tabComponent: SCENE_HISTORY_TAB_COMPONENT,
      title: 'Scene Graph',
    })
  }

  if (!api.getPanel(SCENE_HISTORY_PANEL_IDS.history)) {
    api.addPanel({
      component: SCENE_HISTORY_COMPONENT_IDS.history,
      id: SCENE_HISTORY_PANEL_IDS.history,
      initialHeight: historyInitialHeight,
      minimumHeight: HISTORY_MIN_HEIGHT,
      position: { referenceGroup: historyGroup.id },
      tabComponent: SCENE_HISTORY_TAB_COMPONENT,
      title: 'History',
    })
  }

  scenePanel.api.setActive()
}

function SceneHistoryDockview() {
  const initializedApi = useRef<DockviewApi | null>(null)
  const handleReady = useCallback((event: DockviewReadyEvent) => {
    if (initializedApi.current === event.api) return
    initializeSceneHistoryWorkspace(event.api)
    initializedApi.current = event.api
  }, [])

  return (
    <DockviewReact
      className="compose-editor__scene-history-dockview"
      components={sceneHistoryComponents}
      disableDnd
      disableFloatingGroups
      onReady={handleReady}
      tabComponents={sceneHistoryTabComponents}
      theme={themeAbyss}
    />
  )
}

function Placeholder({ children }: { children: string }) {
  return (
    <div className="compose-editor__placeholder" role="status">
      {children}
    </div>
  )
}

export function SceneGraphPanel() {
  const { sceneGraphPanel, history, historyPanel } = useWorkspaceContent()
  const historyEnabled = history !== undefined || historyPanel !== undefined

  return (
    <div className="compose-editor__panel" data-workspace-panel="scene-graph">
      {historyEnabled ? <SceneHistoryDockview /> : sceneGraphPanel}
    </div>
  )
}

export function CanvasPanel() {
  const { canvasToolbar, children } = useWorkspaceContent()

  return (
    <div
      className="compose-editor__canvas-panel"
      data-workspace-panel="canvas"
    >
      <div className="compose-editor__canvas-toolbar">
        {canvasToolbar ?? <Placeholder>Canvas toolbar</Placeholder>}
      </div>
      <div className="compose-editor__canvas-content">{children}</div>
    </div>
  )
}

export function InspectorPanel() {
  const { inspectorPanel } = useWorkspaceContent()

  return (
    <div className="compose-editor__panel" data-workspace-panel="inspector">
      {inspectorPanel ?? <Placeholder>Component inspector content</Placeholder>}
    </div>
  )
}

export function TransactionLogPanel() {
  const { transactionLogPanel } = useWorkspaceContent()

  return (
    <div
      className="compose-editor__panel"
      data-workspace-panel="transaction-log"
    >
      {transactionLogPanel ?? <Placeholder>Transaction log content</Placeholder>}
    </div>
  )
}

export function CommandPanel() {
  const { commandPanel } = useWorkspaceContent()

  return (
    <div className="compose-editor__panel" data-workspace-panel="command">
      {commandPanel ?? <Placeholder>Command content</Placeholder>}
    </div>
  )
}
