import type { DockviewApi } from 'dockview-react'
import { getEditorMessages } from '../editor-i18n'
import type { ComposeI18nContextValue, ComposeLocale } from '@compose-ui/ui-context'

export const WORKSPACE_GROUP_IDS = {
  scene: 'compose-scene-edge',
  canvas: 'compose-canvas-group',
  inspector: 'compose-inspector-edge',
  bottom: 'compose-bottom-edge',
  /** 外层 Dockview 中唯一的中央组，承载内层 scene/canvas/inspector Dockview。 */
  core: 'compose-workspace-core-group',
} as const

export const WORKSPACE_PANEL_IDS = {
  scene: 'compose-scene-graph',
  canvas: 'compose-canvas',
  inspector: 'compose-inspector',
  transactionLog: 'compose-transaction-log',
  command: 'compose-command',
  assetBrowser: 'compose-assets',
  animation: 'compose-animation',
  /** 外层唯一中央面板：内层 scene/canvas/inspector Dockview 的宿主。 */
  core: 'compose-workspace-core',
} as const

export const WORKSPACE_COMPONENT_IDS = {
  scene: 'sceneGraph',
  canvas: 'canvas',
  inspector: 'inspector',
  transactionLog: 'transactionLog',
  command: 'command',
  assetBrowser: 'assetBrowser',
  animation: 'animation',
  assetDocument: 'assetDocument',
  pageDocument: 'pageDocument',
  componentDocument: 'componentDocument',
  core: 'workspaceCore',
} as const

const ASSET_DOCUMENT_PANEL_PREFIX = 'compose-asset-document:'
const PAGE_DOCUMENT_PANEL_PREFIX = 'compose-page-document:'
const COMPONENT_DOCUMENT_PANEL_PREFIX = 'compose-component-document:'

/**
 * 从 Provider 与稳定资源 key 派生当前 Editor 实例中的资源标签 ID。
 *
 * @remarks
 * 只读标签追加 `:readonly` 后缀，使同一文件可以同时以可编辑标签与只读标签打开而不互相覆盖。
 * @internal
 */
export function createAssetDocumentPanelId(
  providerId: string,
  assetIdentity: string,
  options?: { readonly readOnly?: boolean },
) {
  const base = `${ASSET_DOCUMENT_PANEL_PREFIX}${encodeURIComponent(providerId)}:${encodeURIComponent(assetIdentity)}`
  return options?.readOnly === true ? `${base}:readonly` : base
}

/** 判断 Dockview panel 是否为 Editor 临时资源文档。 @internal */
export function isAssetDocumentPanelId(panelId: string) {
  return panelId.startsWith(ASSET_DOCUMENT_PANEL_PREFIX)
}

/**
 * 从 Provider 与页面稳定 key 派生页面标签 ID。
 *
 * @remarks
 * 与资源文档使用不同前缀，因此同一页面文件可同时以页面标签与资源标签打开而不互相覆盖。
 * @internal
 */
export function createPageDocumentPanelId(providerId: string, pageKey: string) {
  return `${PAGE_DOCUMENT_PANEL_PREFIX}${encodeURIComponent(providerId)}:${encodeURIComponent(pageKey)}`
}

/** 判断 Dockview panel 是否为页面文档。 @internal */
export function isPageDocumentPanelId(panelId: string) {
  return panelId.startsWith(PAGE_DOCUMENT_PANEL_PREFIX)
}

/** 从 Provider 与组件稳定 key 派生独立 Base/Variant 标签 ID。 @internal */
export function createComponentDocumentPanelId(providerId: string, assetKey: string) {
  return `${COMPONENT_DOCUMENT_PANEL_PREFIX}${encodeURIComponent(providerId)}:${encodeURIComponent(assetKey)}`
}

/** 判断 Dockview panel 是否为组件或变体文档。 @internal */
export function isComponentDocumentPanelId(panelId: string) {
  return panelId.startsWith(COMPONENT_DOCUMENT_PANEL_PREFIX)
}

/** 判断 Dockview panel 是否为可关闭的文档标签（资源或页面）。 @internal */
export function isWorkspaceDocumentPanelId(panelId: string) {
  return isAssetDocumentPanelId(panelId)
    || isPageDocumentPanelId(panelId)
    || isComponentDocumentPanelId(panelId)
}

export const WORKSPACE_SIZES = {
  scene: { initialSize: 280, minimumSize: 180 },
  inspector: { initialSize: 400, minimumSize: 300 },
  bottom: { initialSize: 280, minimumSize: 160 },
} as const

const TAB_COMPONENT = 'workspaceTab'

/**
 * 固定工作区的初始化选项。
 *
 * @internal 页面模式会自行把页面文档加入中央组，因此不应再插入一个无资源归属的 Canvas 标签。
 */
export interface InitializeWorkspaceOptions {
  /** 是否创建单文档模式的固定 Canvas。 @defaultValue true */
  readonly includeCanvas?: boolean
}

export function localizeWorkspace(
  api: DockviewApi,
  locale: ComposeLocale,
  formatMessage?: ComposeI18nContextValue['formatMessage'],
) {
  const messages = getEditorMessages(locale, formatMessage).workspace
  const titles = {
    [WORKSPACE_PANEL_IDS.scene]: messages.sceneGraph,
    [WORKSPACE_PANEL_IDS.canvas]: messages.canvas,
    [WORKSPACE_PANEL_IDS.inspector]: messages.inspector,
    [WORKSPACE_PANEL_IDS.transactionLog]: messages.transactionLog,
    [WORKSPACE_PANEL_IDS.command]: messages.command,
    [WORKSPACE_PANEL_IDS.assetBrowser]: messages.assets,
    [WORKSPACE_PANEL_IDS.animation]: messages.animation,
    [WORKSPACE_PANEL_IDS.core]: messages.workspaceCore,
  }
  for (const [panelId, title] of Object.entries(titles)) {
    const getPanel = (api as Partial<DockviewApi>).getPanel
    const panel = typeof getPanel === 'function' ? getPanel.call(api, panelId) : undefined
    if (typeof panel?.api.setTitle === 'function') panel.api.setTitle(title)
  }
}

/**
 * 初始化外层工作区：只有一个中央面板（宿主内层 scene/canvas/inspector Dockview）和一个
 * `bottom` Edge Group（资源/动画/命令/日志）。
 *
 * @remarks
 * 外层不持有 `left`/`right` Edge Group，这是让 `bottom` 能横跨整个编辑器宽度的前提——见
 * `initializeCoreWorkspace` 上的注释。
 */
export function initializeOuterWorkspace(
  api: DockviewApi,
  locale: ComposeLocale = 'zh-CN',
  formatMessage?: ComposeI18nContextValue['formatMessage'],
) {
  const messages = getEditorMessages(locale, formatMessage).workspace
  // hideHeader：这个组永远只有一个面板（内层 scene/canvas/inspector Dockview 的宿主），
  // 不需要自己的标签条——它自己内部已经有真正的 Canvas 标签，叠两层标签条只是多余的 chrome。
  const coreGroup =
    api.getGroup(WORKSPACE_GROUP_IDS.core) ??
    api.addGroup({
      direction: 'right',
      hideHeader: true,
      id: WORKSPACE_GROUP_IDS.core,
      locked: 'no-drop-target',
    })

  if (!api.getPanel(WORKSPACE_PANEL_IDS.core)) {
    api.addPanel({
      id: WORKSPACE_PANEL_IDS.core,
      component: WORKSPACE_COMPONENT_IDS.core,
      tabComponent: TAB_COMPONENT,
      // 用与内层真正的 Canvas 不同的标题，避免两层 group landmark 重名（见上面的 hideHeader 注释）。
      title: messages.workspaceCore,
      position: { referenceGroup: coreGroup.id },
    })
  }

  const bottomGroup =
    api.getEdgeGroup('bottom') ??
    api.addEdgeGroup('bottom', {
      id: WORKSPACE_GROUP_IDS.bottom,
      ...WORKSPACE_SIZES.bottom,
      collapsed: true,
    })
  bottomGroup.locked = 'no-drop-target'

  // 首次插入的资源标签即为默认活动项；后续标签保持非活动，以固定底部工具组的可见顺序。
  let assetBrowser = api.getPanel(WORKSPACE_PANEL_IDS.assetBrowser)
  if (!assetBrowser) {
    assetBrowser = api.addPanel({
      id: WORKSPACE_PANEL_IDS.assetBrowser,
      component: WORKSPACE_COMPONENT_IDS.assetBrowser,
      tabComponent: TAB_COMPONENT,
      title: messages.assets,
      position: { referenceGroup: bottomGroup.id },
    })
  }

  if (!api.getPanel(WORKSPACE_PANEL_IDS.animation)) {
    api.addPanel({
      id: WORKSPACE_PANEL_IDS.animation,
      component: WORKSPACE_COMPONENT_IDS.animation,
      tabComponent: TAB_COMPONENT,
      title: messages.animation,
      inactive: true,
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

  if (!api.getPanel(WORKSPACE_PANEL_IDS.transactionLog)) {
    api.addPanel({
      id: WORKSPACE_PANEL_IDS.transactionLog,
      component: WORKSPACE_COMPONENT_IDS.transactionLog,
      tabComponent: TAB_COMPONENT,
      title: messages.transactionLog,
      inactive: true,
      position: { referenceGroup: bottomGroup.id },
    })
  }

  assetBrowser.api.setActive()
  localizeWorkspace(api, locale, formatMessage)
}

/**
 * 初始化内层工作区：Scene Graph 与 Component Inspector 是真正的 Dockview `left`/`right`
 * Edge Group（原生支持折叠为窄轨道 + 点击展开），Canvas 是它们之间的中央固定面板。
 *
 * @remarks
 * 这个 Dockview 实例本身挂载在外层唯一中央面板内部（见 `initializeOuterWorkspace`），因此
 * 这里的 `left`/`right` 边缘组只影响内层实例自己的宽度，不会挤压外层的 `bottom` 边缘组。
 */
export function initializeCoreWorkspace(
  api: DockviewApi,
  locale: ComposeLocale = 'zh-CN',
  formatMessage?: ComposeI18nContextValue['formatMessage'],
  options?: InitializeWorkspaceOptions,
) {
  const messages = getEditorMessages(locale, formatMessage).workspace
  const includeCanvas = options?.includeCanvas ?? true
  const canvasGroup =
    api.getGroup(WORKSPACE_GROUP_IDS.canvas) ??
    api.addGroup({
      direction: 'right',
      id: WORKSPACE_GROUP_IDS.canvas,
      locked: 'no-drop-target',
    })

  if (includeCanvas && !api.getPanel(WORKSPACE_PANEL_IDS.canvas)) {
    api.addPanel({
      id: WORKSPACE_PANEL_IDS.canvas,
      component: WORKSPACE_COMPONENT_IDS.canvas,
      tabComponent: TAB_COMPONENT,
      title: messages.canvas,
      position: { referenceGroup: canvasGroup.id },
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

  localizeWorkspace(api, locale, formatMessage)
}
