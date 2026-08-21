import { ComposeHistoryPanel } from '@compose-ui/history'
import { ComposeAssetPreview } from '@compose-ui/asset-browser'
import { ComposeAnimationTimeline } from '@compose-ui/animation-panel'
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
import { EditorModeSwitcher } from './editor-mode-switcher'
import { CadDocumentPanel } from '../cad/cad-document-panel'
import { useWorkspaceContent } from './workspace-context'
import { WORKSPACE_COMPONENT_IDS, WORKSPACE_PANEL_IDS } from './workspace-layout'
import { WorkspaceHeaderActions, WorkspaceTab } from './workspace-tab'
import { getEditorMessages } from '../editor-i18n'
import { StageToolbarIcon } from '../stage-toolbar/stage-toolbar-icons'

const SCENE_MIN_HEIGHT = 160
const TOOLS_MIN_HEIGHT = 120
const DEFAULT_SCENE_TOOLS_HEIGHT = 480
const SCENE_TOOLS_TAB_COMPONENT = 'workspaceTab'
const SCENE_TOOLS_GROUP_IDS = {
  scene: 'compose-scene-content-group',
  tools: 'compose-scene-tools-group',
} as const
const SCENE_TOOLS_PANEL_IDS = {
  scene: 'compose-scene-content-panel',
  componentLibrary: 'compose-component-library-panel',
  history: 'compose-history-panel',
} as const
const SCENE_TOOLS_COMPONENT_IDS = {
  scene: 'sceneContent',
  componentLibrary: 'componentLibraryContent',
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

const sceneToolsComponents = {
  [SCENE_TOOLS_COMPONENT_IDS.scene]: SceneContentPanel,
  [SCENE_TOOLS_COMPONENT_IDS.componentLibrary]: ComponentLibraryPanel,
  [SCENE_TOOLS_COMPONENT_IDS.history]: HistoryContentPanel,
} satisfies Record<string, React.FunctionComponent<IDockviewPanelProps>>
const sceneToolsTabComponents = {
  [SCENE_TOOLS_TAB_COMPONENT]: WorkspaceTab,
}

function localizeSceneToolsWorkspace(
  api: DockviewApi,
  locale: ComposeLocale,
  formatMessage?: ComposeI18nContextValue['formatMessage'],
) {
  const messages = getEditorMessages(locale, formatMessage).workspace
  const scenePanel = api.getPanel(SCENE_TOOLS_PANEL_IDS.scene)
  const componentLibraryPanel = api.getPanel(SCENE_TOOLS_PANEL_IDS.componentLibrary)
  const historyPanel = api.getPanel(SCENE_TOOLS_PANEL_IDS.history)
  if (typeof scenePanel?.api.setTitle === 'function') {
    scenePanel.api.setTitle(messages.sceneGraph)
  }
  if (typeof componentLibraryPanel?.api.setTitle === 'function') {
    componentLibraryPanel.api.setTitle(messages.componentLibrary)
  }
  if (typeof historyPanel?.api.setTitle === 'function') {
    historyPanel.api.setTitle(messages.history)
  }
}

/** 场景内容与工具 Dock 的高度折算：工具区取可用高度的 40%，但受最小高度双向夹紧。 */
function computeToolsHeight(availableHeight: number) {
  return Math.min(
    Math.max(TOOLS_MIN_HEIGHT, Math.round(availableHeight * 0.4)),
    Math.max(TOOLS_MIN_HEIGHT, availableHeight - SCENE_MIN_HEIGHT),
  )
}

function initializeSceneToolsWorkspace(
  api: DockviewApi,
  locale: ComposeLocale,
  historyEnabled: boolean,
  formatMessage?: ComposeI18nContextValue['formatMessage'],
) {
  const messages = getEditorMessages(locale, formatMessage).workspace
  const availableHeight = api.height > 0 ? api.height : DEFAULT_SCENE_TOOLS_HEIGHT
  const toolsInitialHeight = computeToolsHeight(availableHeight)
  const sceneGroup = api.getGroup(SCENE_TOOLS_GROUP_IDS.scene) ?? api.addGroup({
    constraints: { minimumHeight: SCENE_MIN_HEIGHT },
    direction: 'right',
    id: SCENE_TOOLS_GROUP_IDS.scene,
  })
  sceneGroup.locked = 'no-drop-target'
  const toolsGroup = api.getGroup(SCENE_TOOLS_GROUP_IDS.tools) ?? api.addGroup({
    constraints: { minimumHeight: TOOLS_MIN_HEIGHT },
    direction: 'below',
    id: SCENE_TOOLS_GROUP_IDS.tools,
    initialHeight: toolsInitialHeight,
    referenceGroup: sceneGroup.id,
  })
  toolsGroup.locked = 'no-drop-target'

  const scenePanel = api.getPanel(SCENE_TOOLS_PANEL_IDS.scene)
  if (!scenePanel) {
    api.addPanel({
      component: SCENE_TOOLS_COMPONENT_IDS.scene,
      id: SCENE_TOOLS_PANEL_IDS.scene,
      minimumHeight: SCENE_MIN_HEIGHT,
      position: { referenceGroup: sceneGroup.id },
      tabComponent: SCENE_TOOLS_TAB_COMPONENT,
      title: messages.sceneGraph,
    })
  }

  let componentLibraryPanel = api.getPanel(SCENE_TOOLS_PANEL_IDS.componentLibrary)
  if (!componentLibraryPanel) {
    componentLibraryPanel = api.addPanel({
      component: SCENE_TOOLS_COMPONENT_IDS.componentLibrary,
      id: SCENE_TOOLS_PANEL_IDS.componentLibrary,
      initialHeight: toolsInitialHeight,
      minimumHeight: TOOLS_MIN_HEIGHT,
      position: { referenceGroup: toolsGroup.id },
      tabComponent: SCENE_TOOLS_TAB_COMPONENT,
      title: messages.componentLibrary,
    })
    componentLibraryPanel.api.setActive()
  }

  if (historyEnabled && !api.getPanel(SCENE_TOOLS_PANEL_IDS.history)) {
    api.addPanel({
      component: SCENE_TOOLS_COMPONENT_IDS.history,
      id: SCENE_TOOLS_PANEL_IDS.history,
      initialHeight: toolsInitialHeight,
      minimumHeight: TOOLS_MIN_HEIGHT,
      position: { referenceGroup: toolsGroup.id },
      tabComponent: SCENE_TOOLS_TAB_COMPONENT,
      title: messages.history,
      inactive: true,
    })
  }
  else if (!historyEnabled) {
    api.getPanel(SCENE_TOOLS_PANEL_IDS.history)?.api.close()
  }

  localizeSceneToolsWorkspace(api, locale, formatMessage)
}

function SceneToolsDockview() {
  const i18n = useComposeI18nContext()
  const { history, historyPanel } = useWorkspaceContent()
  const locale = i18n?.locale ?? 'zh-CN'
  const historyEnabled = history !== undefined || historyPanel !== undefined
  const initializedApi = useRef<DockviewApi | null>(null)
  const initializedHistoryEnabled = useRef<boolean | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const messages = getEditorMessages(locale, i18n?.formatMessage).workspace
  const sceneContentLabel = locale === 'zh-CN' ? '场景图内容' : 'Scene Graph content'
  const handleReady = useCallback((event: DockviewReadyEvent) => {
    if (initializedApi.current === event.api) return
    initializeSceneToolsWorkspace(event.api, locale, historyEnabled, i18n?.formatMessage)
    initializedApi.current = event.api
    initializedHistoryEnabled.current = historyEnabled
  }, [historyEnabled, i18n?.formatMessage, locale])

  useEffect(() => {
    if (initializedApi.current && initializedHistoryEnabled.current !== historyEnabled) {
      initializeSceneToolsWorkspace(
        initializedApi.current,
        locale,
        historyEnabled,
        i18n?.formatMessage,
      )
      initializedHistoryEnabled.current = historyEnabled
    }
    else if (initializedApi.current) {
      localizeSceneToolsWorkspace(
        initializedApi.current,
        locale,
        i18n?.formatMessage,
      )
    }
  }, [historyEnabled, i18n?.formatMessage, locale])

  /*
   * initializeSceneToolsWorkspace 在 onReady 时用 api.height 或者容器 DOM 高度折算工具区
   * 40% 的初始高度——两者在这一层嵌套下都不可靠：Scene Graph 现在嵌套在中层 core Dockview
   * 的 left Edge Group 里，比原来多一层挂载；React 子组件的 effect 先于父组件 effect 触发，
   * 这层最深的 SceneToolsDockview 挂载时，它上面还有两层 Dockview 各自的初始布局/
   * ResizeObserver 可能都还没跑完，此时读到的高度（不管是 api.height 还是 DOM
   * getBoundingClientRect）都可能是过渡态的偏小值，且一旦用错值创建了 group 就不会自动
   * 再纠正。这里用 ResizeObserver 盯住真正稳定下来的高度，只在挂载后第一次观测到的高度上
   * 修正一次工具区分栏，不覆盖用户后续手动拖拽调整过的高度。
   */
  const toolsHeightCorrectedRef = useRef(false)
  useEffect(() => {
    toolsHeightCorrectedRef.current = false
  }, [])
  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      if (toolsHeightCorrectedRef.current) return
      const height = entries[0]?.contentRect.height
      if (!height || height <= 0) return
      const api = initializedApi.current
      const toolsGroup = api?.getGroup(SCENE_TOOLS_GROUP_IDS.tools)
      if (!api || !toolsGroup) return
      toolsHeightCorrectedRef.current = true
      toolsGroup.api.setSize({ height: computeToolsHeight(height) })
    })
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

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
        components={sceneToolsComponents}
        disableDnd
        disableFloatingGroups
        onReady={handleReady}
        tabComponents={sceneToolsTabComponents}
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
  return (
    <div className="compose-editor__panel" data-workspace-panel="scene-graph">
      <SceneToolsDockview />
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
  const { stageToolbar, children, stageHostPanelId } = useWorkspaceContent()
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage)
  const hostsStage = stageHostPanelId === WORKSPACE_PANEL_IDS.canvas

  return (
    <div
      className="compose-editor__canvas-panel"
      data-workspace-panel="canvas"
    >
      <div className="compose-editor__canvas-toolbar">
        {stageToolbar ?? <Placeholder>{messages.workspace.stageToolbarEmpty}</Placeholder>}
      </div>
      <div className="compose-editor__canvas-content">{hostsStage ? children : null}</div>
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

/** 底部动画时间线。右侧属性区不随动画标签切换，关键帧属性由宿主自行嵌入。 @internal */
export function AnimationPanel() {
  const { animationEmpty, animationEmptyState } = useWorkspaceContent()
  return (
    <div className="compose-editor__panel" data-workspace-panel="animation">
      <ComposeAnimationTimeline
        emptyState={animationEmptyState}
        {...(animationEmpty !== undefined ? { empty: animationEmpty } : {})}
      />
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
    if (!panelId || session?.readOnly === true) return
    registerDocumentSave(panelId, () => previewRef.current?.save() ?? Promise.resolve(false))
    return () => registerDocumentSave(panelId, null)
  }, [panelId, registerDocumentSave, session?.readOnly])

  if (!panelId || !session) return null

  return (
    <div
      className="compose-editor__asset-document"
      data-asset-entry-id={session.entry.id}
      data-readonly={session.readOnly ? 'true' : undefined}
      data-workspace-panel="asset-document"
    >
      <ComposeAssetPreview
        ref={previewRef}
        entry={session.entry}
        provider={session.provider}
        readOnly={session.readOnly}
        scriptIntelligence={session.scriptIntelligence}
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
  const {
    documents,
    children,
    editorMode,
    onEditorModeChange,
    saveDocument,
    stageHostPanelId,
    stageToolbar,
  } = useWorkspaceContent()
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage)
  const panelId = props.api?.id
  const candidate = panelId ? documents.get(panelId) : undefined
  const session = candidate?.kind === 'page' ? candidate : undefined

  if (!panelId || !session) return null

  return (
    <div
      className="compose-editor__page-document"
      data-page-key={session.pageKey}
      data-workspace-panel="page-document"
    >
      <div className="compose-editor__canvas-toolbar">
        {stageToolbar ?? <Placeholder>{messages.workspace.stageToolbarEmpty}</Placeholder>}
        {/* 设计/动画模式切换器只挂在页面文档：动画绑定是页面级概念，组件文档本期不进动画模式。 */}
        {editorMode !== undefined && onEditorModeChange !== undefined ? (
          <EditorModeSwitcher mode={editorMode} onModeChange={onEditorModeChange} />
        ) : null}
        {/* 页面没有 Monaco 那样的内建保存入口，这里提供显式按钮；快捷键同为 Cmd/Ctrl+S。 */}
        <button
          aria-label={messages.pages.savePage}
          className="compose-editor__page-save"
          disabled={!session.dirty}
          title={messages.pages.savePage}
          type="button"
          onClick={() => { saveDocument(panelId) }}
        >
          <StageToolbarIcon name="save" />
        </button>
      </div>
      <div className="compose-editor__canvas-content">
        {stageHostPanelId === panelId ? children : null}
      </div>
    </div>
  )
}

const coreComponents = {
  [WORKSPACE_COMPONENT_IDS.scene]: SceneGraphPanel,
  [WORKSPACE_COMPONENT_IDS.canvas]: CanvasPanel,
  [WORKSPACE_COMPONENT_IDS.inspector]: InspectorPanel,
  [WORKSPACE_COMPONENT_IDS.assetDocument]: AssetDocumentPanel,
  [WORKSPACE_COMPONENT_IDS.pageDocument]: PageDocumentPanel,
  [WORKSPACE_COMPONENT_IDS.componentDocument]: ComponentDocumentPanel,
  [WORKSPACE_COMPONENT_IDS.cadDocument]: CadDocumentPanel,
} satisfies Record<string, React.FunctionComponent<IDockviewPanelProps>>
const coreTabComponents = { workspaceTab: WorkspaceTab }

/**
 * 内层 Dockview：Scene Graph（`left` Edge Group）、Canvas（中央固定面板）、
 * Component Inspector（`right` Edge Group）。
 *
 * @remarks
 * 挂载在外层工作区唯一中央面板（`WorkspaceCorePanel`）内部，`onReady` 通过 Context 转发给
 * `ComposeEditor`——它拥有 `pages`/`components` 配置和文档面板生命周期，需要自己调用
 * `initializeCoreWorkspace` 并持有这份内层 `api`。这里只负责渲染和转发事件，不做初始化。
 * @internal
 */
function WorkspaceCoreDockview() {
  const { onCoreDockviewReady } = useWorkspaceContent()

  return (
    <div className="compose-editor__core-dockview-host">
      <DockviewReact
        className="compose-editor__core-dockview"
        components={coreComponents}
        disableDnd
        disableFloatingGroups
        onReady={onCoreDockviewReady}
        rightHeaderActionsComponent={WorkspaceHeaderActions}
        tabComponents={coreTabComponents}
        theme={themeAbyss}
      />
    </div>
  )
}

/** 外层工作区唯一中央面板：宿主内层 scene/canvas/inspector Dockview。 @internal */
export function WorkspaceCorePanel() {
  return (
    <div className="compose-editor__panel" data-workspace-panel="core">
      <WorkspaceCoreDockview />
    </div>
  )
}

/** 渲染中央 Canvas Group 中的 Base/Variant 独立编辑会话。 @internal */
export function ComponentDocumentPanel(props: IDockviewPanelProps) {
  const {
    documents,
    children,
    saveDocument,
    stageHostPanelId,
    stageToolbar,
  } = useWorkspaceContent()
  const panelId = props.api?.id
  const candidate = panelId ? documents.get(panelId) : undefined
  const session = candidate?.kind === 'component' ? candidate : undefined
  if (!panelId || !session) return null

  const kindLabel = session.sourceKind === 'variant' ? '变体' : '主组件'
  const parentHint = session.asset.kind === 'variant'
    ? ` · 基于 ${session.asset.parentRef.assetKey}`
    : ''

  return (
    <div
      className="compose-editor__component-document"
      data-component-asset-key={session.assetKey}
      data-component-kind={session.sourceKind}
      data-workspace-panel="component-document"
    >
      <div className="compose-editor__canvas-toolbar">
        <span
          aria-label={`${kindLabel} ${session.displayName}${parentHint}`}
          className="compose-editor__component-kind-label"
        >
          {kindLabel}
          {' · '}
          {session.displayName}
          {parentHint}
        </span>
        {stageToolbar}
        <button
          aria-label={`保存${kindLabel} ${session.displayName}`}
          className="compose-editor__page-save"
          disabled={!session.dirty}
          type="button"
          onClick={() => { saveDocument(panelId) }}
        >
          <StageToolbarIcon name="save" />
        </button>
      </div>
      <div className="compose-editor__canvas-content">
        {stageHostPanelId === panelId ? children : null}
      </div>
    </div>
  )
}
