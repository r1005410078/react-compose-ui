import type { DockviewApi } from 'dockview-react'
import { getEditorMessages } from './editor-i18n'
import type { ComposeI18nContextValue, ComposeLocale } from '@compose-ui/ui-context'

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
  assetBrowser: 'compose-assets',
} as const

export const WORKSPACE_COMPONENT_IDS = {
  scene: 'sceneGraph',
  componentLibrary: 'componentLibrary',
  canvas: 'canvas',
  inspector: 'inspector',
  transactionLog: 'transactionLog',
  command: 'command',
  assetBrowser: 'assetBrowser',
  assetDocument: 'assetDocument',
} as const

const ASSET_DOCUMENT_PANEL_PREFIX = 'compose-asset-document:'

/** 从 Provider 与稳定资源 key 派生当前 Editor 实例中的资源标签 ID。 @internal */
export function createAssetDocumentPanelId(providerId: string, assetIdentity: string) {
  return `${ASSET_DOCUMENT_PANEL_PREFIX}${encodeURIComponent(providerId)}:${encodeURIComponent(assetIdentity)}`
}

/** 判断 Dockview panel 是否为 Editor 临时资源文档。 @internal */
export function isAssetDocumentPanelId(panelId: string) {
  return panelId.startsWith(ASSET_DOCUMENT_PANEL_PREFIX)
}

export const WORKSPACE_SIZES = {
  scene: { initialSize: 280, minimumSize: 180 },
  inspector: { initialSize: 400, minimumSize: 300 },
  bottom: { initialSize: 220, minimumSize: 120 },
} as const

const TAB_COMPONENT = 'workspaceTab'

export function localizeWorkspace(
  api: DockviewApi,
  locale: ComposeLocale,
  formatMessage?: ComposeI18nContextValue['formatMessage'],
) {
  const messages = getEditorMessages(locale, formatMessage).workspace
  const titles = {
    [WORKSPACE_PANEL_IDS.scene]: messages.sceneGraph,
    [WORKSPACE_PANEL_IDS.componentLibrary]: messages.componentLibrary,
    [WORKSPACE_PANEL_IDS.canvas]: messages.canvas,
    [WORKSPACE_PANEL_IDS.inspector]: messages.inspector,
    [WORKSPACE_PANEL_IDS.transactionLog]: messages.transactionLog,
    [WORKSPACE_PANEL_IDS.command]: messages.command,
    [WORKSPACE_PANEL_IDS.assetBrowser]: messages.assets,
  }
  for (const [panelId, title] of Object.entries(titles)) {
    const getPanel = (api as Partial<DockviewApi>).getPanel
    const panel = typeof getPanel === 'function' ? getPanel.call(api, panelId) : undefined
    if (typeof panel?.api.setTitle === 'function') panel.api.setTitle(title)
  }
}

export function initializeWorkspace(
  api: DockviewApi,
  locale: ComposeLocale = 'zh-CN',
  formatMessage?: ComposeI18nContextValue['formatMessage'],
) {
  const messages = getEditorMessages(locale, formatMessage).workspace
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
      title: messages.canvas,
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
      title: messages.sceneGraph,
      position: { referenceGroup: sceneGroup.id },
    })
  }

  if (!api.getPanel(WORKSPACE_PANEL_IDS.componentLibrary)) {
    api.addPanel({
      id: WORKSPACE_PANEL_IDS.componentLibrary,
      component: WORKSPACE_COMPONENT_IDS.componentLibrary,
      tabComponent: TAB_COMPONENT,
      title: messages.componentLibrary,
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
      title: messages.inspector,
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
      title: messages.transactionLog,
      position: { referenceGroup: bottomGroup.id },
    })
  }

  if (!api.getPanel(WORKSPACE_PANEL_IDS.command)) {
    api.addPanel({
      id: WORKSPACE_PANEL_IDS.command,
      component: WORKSPACE_COMPONENT_IDS.command,
      tabComponent: TAB_COMPONENT,
      title: messages.command,
      inactive: true,
      position: { referenceGroup: bottomGroup.id },
    })
  }

  if (!api.getPanel(WORKSPACE_PANEL_IDS.assetBrowser)) {
    api.addPanel({
      id: WORKSPACE_PANEL_IDS.assetBrowser,
      component: WORKSPACE_COMPONENT_IDS.assetBrowser,
      tabComponent: TAB_COMPONENT,
      title: messages.assets,
      inactive: true,
      position: { referenceGroup: bottomGroup.id },
    })
  }

  transactionLog.api.setActive()
  localizeWorkspace(api, locale, formatMessage)
}
