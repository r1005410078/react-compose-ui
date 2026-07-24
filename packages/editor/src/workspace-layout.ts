import type { DockviewApi } from 'dockview-react'

export const WORKSPACE_GROUP_IDS = {
  scene: 'compose-scene-edge',
  canvas: 'compose-canvas-group',
  inspector: 'compose-inspector-edge',
  bottom: 'compose-bottom-edge',
} as const

export const WORKSPACE_PANEL_IDS = {
  scene: 'compose-scene-graph',
  componentLibrary: 'compose-component-library',
  canvas: 'compose-canvas',
  inspector: 'compose-inspector',
  transactionLog: 'compose-transaction-log',
  command: 'compose-command',
} as const

export const WORKSPACE_COMPONENT_IDS = {
  scene: 'sceneGraph',
  componentLibrary: 'componentLibrary',
  canvas: 'canvas',
  inspector: 'inspector',
  transactionLog: 'transactionLog',
  command: 'command',
} as const

export const WORKSPACE_SIZES = {
  scene: { initialSize: 280, minimumSize: 180 },
  inspector: { initialSize: 400, minimumSize: 300 },
  bottom: { initialSize: 220, minimumSize: 120 },
} as const

const TAB_COMPONENT = 'workspaceTab'

export function initializeWorkspace(api: DockviewApi) {
  if (!api.getGroup(WORKSPACE_GROUP_IDS.canvas)) {
    api.addGroup({
      direction: 'right',
      id: WORKSPACE_GROUP_IDS.canvas,
      locked: 'no-drop-target',
    })
  }

  if (!api.getPanel(WORKSPACE_PANEL_IDS.canvas)) {
    api.addPanel({
      id: WORKSPACE_PANEL_IDS.canvas,
      component: WORKSPACE_COMPONENT_IDS.canvas,
      tabComponent: TAB_COMPONENT,
      title: 'Canvas',
      position: { referenceGroup: WORKSPACE_GROUP_IDS.canvas },
    })
  }

  const sceneGroup =
    api.getEdgeGroup('left') ??
    api.addEdgeGroup('left', {
      id: WORKSPACE_GROUP_IDS.scene,
      ...WORKSPACE_SIZES.scene,
    })
  sceneGroup.locked = 'no-drop-target'

  let scenePanel = api.getPanel(WORKSPACE_PANEL_IDS.scene)
  if (!scenePanel) {
    scenePanel = api.addPanel({
      id: WORKSPACE_PANEL_IDS.scene,
      component: WORKSPACE_COMPONENT_IDS.scene,
      tabComponent: TAB_COMPONENT,
      title: 'Scene Graph',
      position: { referenceGroup: sceneGroup.id },
    })
  }

  if (!api.getPanel(WORKSPACE_PANEL_IDS.componentLibrary)) {
    api.addPanel({
      id: WORKSPACE_PANEL_IDS.componentLibrary,
      component: WORKSPACE_COMPONENT_IDS.componentLibrary,
      tabComponent: TAB_COMPONENT,
      title: 'Component Library',
      inactive: true,
      position: { referenceGroup: sceneGroup.id },
    })
  }
  scenePanel.api.setActive()

  const inspectorGroup =
    api.getEdgeGroup('right') ??
    api.addEdgeGroup('right', {
      id: WORKSPACE_GROUP_IDS.inspector,
      ...WORKSPACE_SIZES.inspector,
    })
  inspectorGroup.locked = 'no-drop-target'

  if (!api.getPanel(WORKSPACE_PANEL_IDS.inspector)) {
    api.addPanel({
      id: WORKSPACE_PANEL_IDS.inspector,
      component: WORKSPACE_COMPONENT_IDS.inspector,
      tabComponent: TAB_COMPONENT,
      title: 'Component',
      position: { referenceGroup: inspectorGroup.id },
    })
  }

  const bottomGroup =
    api.getEdgeGroup('bottom') ??
    api.addEdgeGroup('bottom', {
      id: WORKSPACE_GROUP_IDS.bottom,
      ...WORKSPACE_SIZES.bottom,
    })
  bottomGroup.locked = 'no-drop-target'

  let transactionLog = api.getPanel(WORKSPACE_PANEL_IDS.transactionLog)
  if (!transactionLog) {
    transactionLog = api.addPanel({
      id: WORKSPACE_PANEL_IDS.transactionLog,
      component: WORKSPACE_COMPONENT_IDS.transactionLog,
      tabComponent: TAB_COMPONENT,
      title: '日志',
      position: { referenceGroup: bottomGroup.id },
    })
  }

  if (!api.getPanel(WORKSPACE_PANEL_IDS.command)) {
    api.addPanel({
      id: WORKSPACE_PANEL_IDS.command,
      component: WORKSPACE_COMPONENT_IDS.command,
      tabComponent: TAB_COMPONENT,
      title: '命令',
      inactive: true,
      position: { referenceGroup: bottomGroup.id },
    })
  }

  transactionLog.api.setActive()
}
