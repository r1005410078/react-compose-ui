import { ComposeHistoryPanel } from '@compose-ui/history'
import { ComposeAssetPreview } from '@compose-ui/asset-browser'
import { ComposeAnimationTimeline } from '@compose-ui/animation-panel'
import type { ComposeAssetEntry } from '@compose-ui/assets'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ComposeAssetPreviewHandle } from '@compose-ui/asset-browser'
import { useWorkspaceContent } from './workspace-context'
import type {
  ComposeAssetDocumentSession,
  ComposeComponentDocumentSession,
  ComposePageDocumentSession,
} from './workspace-context'
import { WorkspaceDocumentTabs } from './workspace-chrome'
import { WORKSPACE_COMPONENT_IDS, WORKSPACE_PANEL_IDS } from './workspace-layout'
import { WORKSPACE_HOST_KEYS } from './workspace-hosts'
import type { WorkspaceHostKey } from './workspace-hosts'
import { getEditorMessages } from '../editor-i18n'

function useEditorMessages() {
  const i18n = useComposeI18nContext()
  return getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage)
}

function Placeholder({ children }: { children: string }) {
  return (
    <div className="compose-editor__placeholder" role="status">
      {children}
    </div>
  )
}

export function SceneGraphPanel() {
  const { sceneGraphPanel } = useWorkspaceContent()
  return (
    <div className="compose-editor__panel" data-workspace-panel="scene-graph">
      <div className="compose-editor__scene-content">
        {sceneGraphPanel}
      </div>
    </div>
  )
}

export function ComponentLibraryPanel() {
  const { componentLibraryPanel } = useWorkspaceContent()
  const messages = useEditorMessages()

  return (
    <div className="compose-editor__panel" data-workspace-panel="component-library">
      {componentLibraryPanel
        ?? <Placeholder>{messages.workspace.componentLibraryEmpty}</Placeholder>}
    </div>
  )
}

/** 工具组里的历史标签：显式 `historyPanel` 覆盖默认面板，`null` 也算覆盖。 */
export function HistoryPanel() {
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
    <div className="compose-editor__panel" data-workspace-panel="history">
      <div className="compose-editor__history-content">
        {historyContent}
      </div>
    </div>
  )
}

/**
 * 中央画布面板：只有它一个面板住在画布组里，文档的表面按活动文档在它内部切换。
 *
 * @remarks
 * 文档不是 Dockview 面板（标签条在 Dockview 之外），因此「哪个文档在画布上」由这里决定：
 * 页面与组件文档共用同一份 Stage，只渲染活动的那一个；资源文件文档（Monaco）全部保持挂载、
 * 非活动的藏起来——未保存的草稿就住在编辑器实例里，切走再切回不能丢。未启用页面系统时这里
 * 就是固定画布本身。
 */
export function CanvasPanel() {
  const {
    activeDocumentPanelId,
    children,
    documents,
    entryLayerPanelIds,
    stageHostPanelId,
    stageToolbar,
  } = useWorkspaceContent()
  const messages = useEditorMessages()
  const singleDocument = stageHostPanelId === WORKSPACE_PANEL_IDS.canvas
  const active = activeDocumentPanelId ? documents.get(activeDocumentPanelId) : undefined
  /*
   * 画布上此刻是一层而不是一份自己打开的文档。它不表达路径也不表达名字——「这份文档是什么」
   * 由工具栏那行「主组件 · 名称」回答，「我在哪一层、怎么回去」由场景树的来路出口行回答。
   * 它只回答一个是非问题：这是借来的一层，唯一的出口是返回。层不占标签条的一格，
   * 因此少了它，场景树面板一折叠，屏幕上就没有任何东西说明这件事。
   */
  const entryLayer = activeDocumentPanelId !== null
    && (entryLayerPanelIds ?? []).includes(activeDocumentPanelId)
  const assetSessions = [...documents.values()]
    .filter((session): session is ComposeAssetDocumentSession => session.kind === 'asset')

  return (
    <div
      className="compose-editor__canvas-panel"
      data-active-document={active?.kind ?? (singleDocument ? 'canvas' : 'none')}
      data-entry-layer={entryLayer ? 'true' : undefined}
      data-workspace-panel="canvas"
    >
      {/*
        * 画布列的头：它与左右两栏的组头落在同一条线上，因为三列是 Dockview 网格里同一行的
        * 兄弟，而画布组隐藏组头——这一行天然从组头那条线开始，不需要任何对齐代码。
        */}
      <WorkspaceDocumentTabs />
      {singleDocument ? (
        // 固定画布常驻挂载：切到一个资源文档再切回来，Stage 与它的 surface 不该重连一次。
        <div
          className="compose-editor__document-surface"
          data-workspace-panel="canvas-document"
          hidden={activeDocumentPanelId !== WORKSPACE_PANEL_IDS.canvas}
        >
          <div className="compose-editor__canvas-toolbar">
            {stageToolbar ?? <Placeholder>{messages.workspace.stageToolbarEmpty}</Placeholder>}
          </div>
          <div className="compose-editor__canvas-content">{children}</div>
        </div>
      ) : null}
      {active?.kind === 'page' ? <PageDocumentSurface session={active} /> : null}
      {active?.kind === 'component' ? <ComponentDocumentSurface session={active} /> : null}
      {assetSessions.map((session) => (
        <AssetDocumentSurface
          key={session.panelId}
          hidden={session.panelId !== activeDocumentPanelId}
          session={session}
        />
      ))}
      {!singleDocument && !active ? (
        <Placeholder>{messages.workspace.noDocumentOpen}</Placeholder>
      ) : null}
    </div>
  )
}

export function InspectorPanel() {
  const { inspectorPanel } = useWorkspaceContent()
  const messages = useEditorMessages()

  return (
    <div className="compose-editor__panel" data-workspace-panel="inspector">
      {inspectorPanel
        ?? <Placeholder>{messages.workspace.inspectorEmpty}</Placeholder>}
    </div>
  )
}

/**
 * 时间线面板：一条 chrome 上的「动画编辑」开关加时间线本身。右侧属性区不随它切换，关键帧属性
 * 由宿主自行嵌入。
 *
 * @remarks
 * 开关住在编辑器这一层而不进 `animation-panel`：那个包只认识会话与动作，不认识「模式」。
 * 它是 `aria-pressed` 的开关而不是单选——它回答「拖动会不会变成关键帧」这一个是非问题。
 * 时间线在开关关着时照常渲染：屏幕上看得见要编辑的东西，第一次交互即进入。
 * @internal
 */
export function AnimationPanel() {
  const {
    animationEditing,
    animationEmpty,
    animationEmptyState,
    toggleAnimationEditing,
  } = useWorkspaceContent()
  const messages = useEditorMessages()
  return (
    <div className="compose-editor__panel" data-workspace-panel="animation">
      {toggleAnimationEditing ? (
        <div className="compose-editor__animation-chrome">
          <button
            aria-pressed={animationEditing === true}
            className="compose-editor__animation-toggle"
            data-animation-editing={animationEditing === true || undefined}
            type="button"
            onClick={toggleAnimationEditing}
          >
            <span aria-hidden="true" className="compose-editor__animation-toggle-dot" />
            {messages.workspace.animationEditing}
          </button>
          <span className="compose-editor__animation-chrome-hint">
            {animationEditing ? messages.workspace.animationEditingOn : messages.workspace.animationEditingOff}
          </span>
        </div>
      ) : null}
      <ComposeAnimationTimeline
        emptyState={animationEmptyState}
        {...(animationEmpty !== undefined ? { empty: animationEmpty } : {})}
      />
    </div>
  )
}

export function TransactionLogPanel() {
  const { transactionLogPanel } = useWorkspaceContent()
  const messages = useEditorMessages()

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
  const messages = useEditorMessages()

  return (
    <div className="compose-editor__panel" data-workspace-panel="command">
      {commandPanel
        ?? <Placeholder>{messages.workspace.commandEmpty}</Placeholder>}
    </div>
  )
}

export function AssetBrowserPanel() {
  const { assetBrowserPanel } = useWorkspaceContent()
  const messages = useEditorMessages()

  return (
    <div className="compose-editor__panel" data-workspace-panel="asset-browser">
      {assetBrowserPanel
        ?? <Placeholder>{messages.workspace.assetBrowserEmpty}</Placeholder>}
    </div>
  )
}

/**
 * 画布面板里的临时资源文档表面。
 *
 * @remarks
 * 非活动时用 `hidden` 藏起来而不是卸载：Monaco 里未保存的草稿住在组件实例里。保存入口在挂载时
 * 注册、卸载时注销，与文档会话的 dirty 状态一起交给编辑器。
 * @internal
 */
export function AssetDocumentSurface({
  hidden,
  session,
}: {
  readonly hidden?: boolean
  readonly session: ComposeAssetDocumentSession
}) {
  const { registerDocumentSave, setDocumentDirty, setAssetDocumentSaved } = useWorkspaceContent()
  const panelId = session.panelId
  const previewRef = useRef<ComposeAssetPreviewHandle>(null)
  const handleDirtyChange = useCallback((dirty: boolean) => {
    setDocumentDirty(panelId, dirty)
  }, [panelId, setDocumentDirty])
  const handleSaved = useCallback((entry: ComposeAssetEntry) => {
    setAssetDocumentSaved(panelId, entry)
  }, [panelId, setAssetDocumentSaved])

  useEffect(() => {
    if (session.readOnly) return
    registerDocumentSave(panelId, () => previewRef.current?.save() ?? Promise.resolve(false))
    return () => registerDocumentSave(panelId, null)
  }, [panelId, registerDocumentSave, session.readOnly])

  return (
    <div
      className="compose-editor__asset-document"
      data-asset-entry-id={session.entry.id}
      data-readonly={session.readOnly ? 'true' : undefined}
      data-workspace-panel="asset-document"
      hidden={hidden}
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
 * 画布面板里的页面文档表面。
 *
 * @remarks
 * 页面的编辑表面是共享的工作区画布——活动页面由宿主换 controller 的 runtime 体现，因此本表面
 * 只负责工具栏行（模式切换器 + 保存）与呈现当前页面的标识，不重复渲染一份 Stage。
 * @internal
 */
export function PageDocumentSurface({ session }: { readonly session: ComposePageDocumentSession }) {
  const { children, stageHostPanelId, stageToolbar } = useWorkspaceContent()
  const messages = useEditorMessages()
  const panelId = session.panelId

  return (
    <div
      className="compose-editor__page-document"
      data-page-key={session.pageKey}
      data-workspace-panel="page-document"
    >
      <div className="compose-editor__canvas-toolbar">
        {stageToolbar ?? <Placeholder>{messages.workspace.stageToolbarEmpty}</Placeholder>}
      </div>
      <div className="compose-editor__canvas-content">
        {stageHostPanelId === panelId ? children : null}
      </div>
    </div>
  )
}

/** 画布面板里的 Base/Variant 独立编辑表面。 @internal */
export function ComponentDocumentSurface({
  session,
}: {
  readonly session: ComposeComponentDocumentSession
}) {
  const { children, stageHostPanelId, stageToolbar } = useWorkspaceContent()
  const panelId = session.panelId
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
      </div>
      <div className="compose-editor__canvas-content">
        {stageHostPanelId === panelId ? children : null}
      </div>
    </div>
  )
}

/** 每种面板的内容组件；Dockview 里对应的面板只是把宿主元素搬进盒子。 */
const CONTENT_BY_HOST: Readonly<Record<WorkspaceHostKey, () => React.JSX.Element>> = {
  [WORKSPACE_COMPONENT_IDS.scene]: SceneGraphPanel,
  [WORKSPACE_COMPONENT_IDS.componentLibrary]: ComponentLibraryPanel,
  [WORKSPACE_COMPONENT_IDS.history]: HistoryPanel,
  [WORKSPACE_COMPONENT_IDS.canvas]: CanvasPanel,
  [WORKSPACE_COMPONENT_IDS.inspector]: InspectorPanel,
  [WORKSPACE_COMPONENT_IDS.transactionLog]: TransactionLogPanel,
  [WORKSPACE_COMPONENT_IDS.command]: ComposeCommandPanel,
  [WORKSPACE_COMPONENT_IDS.assetBrowser]: AssetBrowserPanel,
  [WORKSPACE_COMPONENT_IDS.animation]: AnimationPanel,
}

/**
 * 把每种面板的内容经 portal 渲染进它的稳定宿主元素。
 *
 * @remarks
 * 挂在编辑器根下、Dockview 之外，因此面板内容的 React 生命周期与 Dockview 面板无关：
 * 工作区切换经 `fromJSON` 重建面板时，内容一个组件都不重挂载。时间线与别的面板一样常驻渲染：
 * 它在不在屏幕上由布局决定，与动画编辑开关无关。
 * @internal
 */
export function WorkspacePortals() {
  const { hosts } = useWorkspaceContent()
  return (
    <>
      {WORKSPACE_HOST_KEYS.map((key) => {
        const Content = CONTENT_BY_HOST[key]
        return createPortal(<Content />, hosts[key], key)
      })}
    </>
  )
}
