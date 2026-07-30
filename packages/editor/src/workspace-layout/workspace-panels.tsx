import { ComposeHistoryPanel } from '@compose-ui/history'
import { ComposeAssetPreview } from '@compose-ui/asset-browser'
import type { ComposeAssetEntry } from '@compose-ui/assets'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import type { ComposeI18nContextValue, ComposeLocale } from '@compose-ui/ui-context'
import { DockviewReact, themeAbyss } from 'dockview-react'
import { useCallback, useEffect, useRef } from 'react'
import type { ComposeAssetPreviewHandle } from '@compose-ui/asset-browser'
import type {
  DockviewApi,
  DockviewReadyEvent,
  IDockviewPanelProps,
} from 'dockview-react'
import { useWorkspaceContent } from './workspace-context'
import { WorkspaceTab } from './workspace-tab'
import { getEditorMessages } from '../editor-i18n'

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
  const { history, historyPanel, historyShortcuts } = useWorkspaceContent()
  const historyContent = historyPanel !== undefined
    ? historyPanel
    : history ? (
        <ComposeHistoryPanel
          className="compose-editor__history-panel"
          controller={history}
          shortcuts={historyShortcuts}
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

function localizeSceneHistoryWorkspace(
  api: DockviewApi,
  locale: ComposeLocale,
  formatMessage?: ComposeI18nContextValue['formatMessage'],
) {
  const messages = getEditorMessages(locale, formatMessage).workspace
  const scenePanel = api.getPanel(SCENE_HISTORY_PANEL_IDS.scene)
  const historyPanel = api.getPanel(SCENE_HISTORY_PANEL_IDS.history)
  if (typeof scenePanel?.api.setTitle === 'function') {
    scenePanel.api.setTitle(messages.sceneGraph)
  }
  if (typeof historyPanel?.api.setTitle === 'function') {
    historyPanel.api.setTitle(messages.history)
  }
}

function initializeSceneHistoryWorkspace(
  api: DockviewApi,
  locale: ComposeLocale,
  formatMessage?: ComposeI18nContextValue['formatMessage'],
) {
  const messages = getEditorMessages(locale, formatMessage).workspace
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
      title: messages.sceneGraph,
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
      title: messages.history,
    })
  }

  scenePanel.api.setActive()
  localizeSceneHistoryWorkspace(api, locale, formatMessage)
}

function SceneHistoryDockview() {
  const i18n = useComposeI18nContext()
  const locale = i18n?.locale ?? 'zh-CN'
  const initializedApi = useRef<DockviewApi | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const messages = getEditorMessages(locale, i18n?.formatMessage).workspace
  const sceneContentLabel = locale === 'zh-CN' ? '场景图内容' : 'Scene Graph content'
  const handleReady = useCallback((event: DockviewReadyEvent) => {
    if (initializedApi.current === event.api) return
    initializeSceneHistoryWorkspace(event.api, locale, i18n?.formatMessage)
    initializedApi.current = event.api
  }, [i18n?.formatMessage, locale])

  useEffect(() => {
    if (initializedApi.current) {
      localizeSceneHistoryWorkspace(
        initializedApi.current,
        locale,
        i18n?.formatMessage,
      )
    }
  }, [i18n?.formatMessage, locale])

  useEffect(() => {
    // 外层 Edge Group 与内层 split Dockview 都有 Scene Graph 标签。视觉上保留两处原始标题，
    // 但内层 landmark 必须有不同可访问名称，避免辅助技术把两个 region 当作同一个区域。
    rootRef.current
      ?.querySelectorAll<HTMLElement>('.dv-groupview:not(.dv-edge-group)')
      .forEach((group) => {
        if (group.getAttribute('aria-label') === messages.sceneGraph) {
          group.setAttribute('aria-label', sceneContentLabel)
        }
      })
  }, [messages.sceneGraph, sceneContentLabel])

  return (
    <div className="compose-editor__scene-history-dockview-host" ref={rootRef}>
      <DockviewReact
        className="compose-editor__scene-history-dockview"
        components={sceneHistoryComponents}
        disableDnd
        disableFloatingGroups
        onReady={handleReady}
        tabComponents={sceneHistoryTabComponents}
        theme={themeAbyss}
      />
    </div>
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

export function ComponentLibraryPanel() {
  const { componentLibraryPanel } = useWorkspaceContent()
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage)

  return (
    <div className="compose-editor__panel" data-workspace-panel="component-library">
      {componentLibraryPanel
        ?? <Placeholder>{messages.workspace.componentLibraryEmpty}</Placeholder>}
    </div>
  )
}

export function CanvasPanel() {
  const { stageToolbar, children } = useWorkspaceContent()
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage)

  return (
    <div
      className="compose-editor__canvas-panel"
      data-workspace-panel="canvas"
    >
      <div className="compose-editor__canvas-toolbar">
        {stageToolbar ?? <Placeholder>{messages.workspace.stageToolbarEmpty}</Placeholder>}
      </div>
      <div className="compose-editor__canvas-content">{children}</div>
    </div>
  )
}

export function InspectorPanel() {
  const { inspectorPanel } = useWorkspaceContent()
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage)

  return (
    <div className="compose-editor__panel" data-workspace-panel="inspector">
      {inspectorPanel
        ?? <Placeholder>{messages.workspace.inspectorEmpty}</Placeholder>}
    </div>
  )
}

export function TransactionLogPanel() {
  const { transactionLogPanel } = useWorkspaceContent()
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage)

  return (
    <div
      className="compose-editor__panel"
      data-workspace-panel="transaction-log"
    >
      {transactionLogPanel
        ?? <Placeholder>{messages.workspace.transactionLogEmpty}</Placeholder>}
    </div>
  )
}

export function ComposeCommandPanel() {
  const { commandPanel } = useWorkspaceContent()
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage)

  return (
    <div className="compose-editor__panel" data-workspace-panel="command">
      {commandPanel
        ?? <Placeholder>{messages.workspace.commandEmpty}</Placeholder>}
    </div>
  )
}

export function AssetBrowserPanel() {
  const { assetBrowserPanel } = useWorkspaceContent()
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage)

  return (
    <div className="compose-editor__panel" data-workspace-panel="asset-browser">
      {assetBrowserPanel
        ?? <Placeholder>{messages.workspace.assetBrowserEmpty}</Placeholder>}
    </div>
  )
}

/** 渲染中央 Canvas Group 中的临时资源文档。 @internal */
export function AssetDocumentPanel(props: IDockviewPanelProps) {
  const {
    documents,
    registerDocumentSave,
    setDocumentDirty,
    setAssetDocumentSaved,
  } = useWorkspaceContent()
  const panelId = props.api?.id
  const candidate = panelId ? documents.get(panelId) : undefined
  const session = candidate?.kind === 'asset' ? candidate : undefined
  const previewRef = useRef<ComposeAssetPreviewHandle>(null)
  const handleDirtyChange = useCallback((dirty: boolean) => {
    if (panelId) setDocumentDirty(panelId, dirty)
  }, [panelId, setDocumentDirty])
  const handleSaved = useCallback((entry: ComposeAssetEntry) => {
    if (panelId) setAssetDocumentSaved(panelId, entry)
  }, [panelId, setAssetDocumentSaved])

  useEffect(() => {
    if (!panelId) return
    registerDocumentSave(panelId, () => previewRef.current?.save() ?? Promise.resolve(false))
    return () => registerDocumentSave(panelId, null)
  }, [panelId, registerDocumentSave])

  if (!panelId || !session) return null

  return (
    <div
      className="compose-editor__asset-document"
      data-asset-entry-id={session.entry.id}
      data-workspace-panel="asset-document"
    >
      <ComposeAssetPreview
        ref={previewRef}
        entry={session.entry}
        provider={session.provider}
        onDirtyChange={handleDirtyChange}
        onSaved={handleSaved}
      />
    </div>
  )
}

/**
 * 渲染中央 Canvas Group 中的页面文档。
 *
 * @remarks
 * 页面的编辑表面是共享的工作区画布 —— 活动页面由宿主换 controller 的 runtime 体现，因此本
 * 面板自身只负责注册保存入口与呈现当前页面的标识，不重复渲染一份 Stage。
 * @internal
 */
export function PageDocumentPanel(props: IDockviewPanelProps) {
  const { documents, children } = useWorkspaceContent()
  const panelId = props.api?.id
  const candidate = panelId ? documents.get(panelId) : undefined
  const session = candidate?.kind === 'page' ? candidate : undefined
  const active = props.api?.isActive ?? false

  if (!panelId || !session) return null

  return (
    <div
      className="compose-editor__page-document"
      data-page-key={session.pageKey}
      data-workspace-panel="page-document"
    >
      {active ? children : null}
    </div>
  )
}
