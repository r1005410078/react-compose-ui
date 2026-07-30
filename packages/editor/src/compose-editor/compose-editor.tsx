/**
 * 提供可嵌入 React 宿主的 Compose UI 编辑器工作区。
 *
 * @packageDocumentation
 */
import { COMPOSE_UI_CORE_PACKAGE, isComposePageFileName } from '@compose-ui/core'
import { ComposeAssetBrowser } from '@compose-ui/asset-browser'
import {
  ComposeDialog,
  ComposeDialogBackdrop,
  ComposeDialogContent,
  ComposeDialogDescription,
  ComposeDialogFooter,
  ComposeDialogHeader,
  ComposeDialogPortal,
  ComposeDialogTitle,
  ComposeDialogViewport,
  ComposeButton,
  ComposeColorHistoryProvider,
} from '@compose-ui/components'
import { createComposeAssetResolver } from '@compose-ui/assets'
import type { ComposeAssetEntry } from '@compose-ui/assets'
import { useComposeHistoryShortcuts } from '@compose-ui/history'
import { ComposeSceneTree } from '@compose-ui/scene-tree'
import {
  ComposeUIProvider,
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import { DockviewReact, themeAbyss } from 'dockview-react'
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  DockviewReadyEvent,
  IDockviewPanelProps,
} from 'dockview-react'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import type { ComposeHistoryNavigationController } from '@compose-ui/history'
import type { ComposeSceneTreeProps } from '@compose-ui/scene-tree'
import type {
  ComposeAssetBrowserProps,
  ComposeAssetCanvasDragEvent,
  ComposeAssetMutation,
} from '@compose-ui/asset-browser'
import type { ComposeAssetResolver } from '@compose-ui/assets'
import {
  WorkspaceContentContext,
} from '../workspace-layout'
import type {
  ComposePageDocumentSession,
  ComposeWorkspaceDocumentSession,
} from '../workspace-layout'
import {
  AssetBrowserPanel,
  AssetDocumentPanel,
  CanvasPanel,
  PageDocumentPanel,
  ComposeCommandPanel,
  ComponentLibraryPanel,
  InspectorPanel,
  SceneGraphPanel,
  TransactionLogPanel,
} from '../workspace-layout'
import {
  createAssetDocumentPanelId,
  createPageDocumentPanelId,
  initializeWorkspace,
  localizeWorkspace,
  WORKSPACE_GROUP_IDS,
  WORKSPACE_COMPONENT_IDS,
} from '../workspace-layout'
import { getEditorMessages } from '../editor-i18n'
import { createPageContextMenuItems } from '../pages'
import { usePageWorkspace } from '../pages'
import type { ComposeEditorPagesConfig } from '../pages'
import { WorkspaceHeaderActions, WorkspaceTab } from '../workspace-layout'
import type { ComposeEditorController } from '../editor-controller'
import { SettingsDialog } from '../editor-preferences'
import {
  createDefaultComposeEditorPreferences,
  isComposeEditorKeybindingMatch,
  isEditableKeyboardTarget,
  normalizeComposeEditorPreferences,
} from '../editor-preferences'
import type { ComposeEditorPreferences } from '../editor-preferences'
import '../styles.css'

/** 编辑器内各个可替换工作区区域。未提供的区域保持默认面板或可访问占位。 */
export interface ComposeEditorSlots {
  readonly sceneGraph?: ReactNode
  readonly componentLibrary?: ReactNode
  readonly stage?: ReactNode
  readonly stageToolbar?: ReactNode
  readonly inspector?: ReactNode
  readonly history?: ReactNode
  readonly transactionLog?: ReactNode
  readonly command?: ReactNode
  readonly assetBrowser?: ReactNode
}

/** 资源面板与 Stage/Preview 资源渲染使用的编辑器范围配置。 */
export interface ComposeEditorAssets {
  /** 驱动默认资源浏览器的受控 Provider 和会话状态。 */
  readonly browser?: ComposeAssetBrowserProps
  /** 显式资源 resolver 优先于由 browser Provider 派生的 resolver。 */
  readonly resolver?: ComposeAssetResolver
}

/**
 * 可嵌入工作区的受控内容与默认 controller。
 *
 * @public
 */
export interface ComposeEditorProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** 受控的完整编辑器用户偏好；提供后由宿主负责回传更新值。 */
  preferences?: ComposeEditorPreferences
  /** 非受控模式首次挂载时使用的偏好；后续属性更新不会重置实例状态。 */
  defaultPreferences?: ComposeEditorPreferences
  /** 每次有效偏好变更返回完整规范化值；不会自动持久化。 */
  onPreferencesChange?: (preferences: ComposeEditorPreferences) => void
  /** 提供统一 runtime、registry、会话状态与默认面板组合。 */
  controller?: ComposeEditorController
  /** 驱动默认场景树的受控节点、选择、展开和操作意图。 */
  sceneTree?: ComposeSceneTreeProps
  /** 驱动默认历史面板和编辑器范围撤销重做快捷键的受控控制器。 */
  history?: ComposeHistoryNavigationController
  /** Stage、资源浏览器和各工作区面板的可替换内容。 */
  slots?: ComposeEditorSlots
  /** 默认资源浏览器与资源渲染的编辑器范围配置。 */
  assets?: ComposeEditorAssets
  /**
   * 页面系统集成；省略时编辑器不提供页面能力。
   *
   * @remarks
   * 提供后资源面板出现页面相关的右键操作，双击页面文件以独立标签打开。宿主必须实现
   * `onActiveSessionChange` 并据此切换 controller 的 runtime，否则工作区不会跟随活动页面。
   */
  pages?: ComposeEditorPagesConfig
}

const workspaceComponents = {
  [WORKSPACE_COMPONENT_IDS.scene]: SceneGraphPanel,
  [WORKSPACE_COMPONENT_IDS.componentLibrary]: ComponentLibraryPanel,
  [WORKSPACE_COMPONENT_IDS.canvas]: CanvasPanel,
  [WORKSPACE_COMPONENT_IDS.inspector]: InspectorPanel,
  [WORKSPACE_COMPONENT_IDS.transactionLog]: TransactionLogPanel,
  [WORKSPACE_COMPONENT_IDS.command]: ComposeCommandPanel,
  [WORKSPACE_COMPONENT_IDS.assetBrowser]: AssetBrowserPanel,
  [WORKSPACE_COMPONENT_IDS.assetDocument]: AssetDocumentPanel,
  [WORKSPACE_COMPONENT_IDS.pageDocument]: PageDocumentPanel,
} satisfies Record<string, React.FunctionComponent<IDockviewPanelProps>>

const workspaceTabComponents = { workspaceTab: WorkspaceTab }
const emptySceneTreeProps: ComposeSceneTreeProps = {
  nodes: [],
  selectedIds: [],
  expandedIds: [],
}
const disabledHistory: ComposeHistoryNavigationController = {
  entries: [],
  activeEntryId: null,
  canUndo: false,
  canRedo: false,
  undo: () => undefined,
  redo: () => undefined,
  navigate: () => undefined,
}

type PendingAssetDocumentClose = {
  readonly panelId: string
  readonly resolve: (allowed: boolean) => void
}

function addDefaultElementProps(
  node: ReactNode,
  props: Record<string, unknown>,
): ReactNode {
  return isValidElement(node) && typeof node.type !== 'string'
    ? cloneElement(node, props)
    : node
}

type EditorRootProps = HTMLAttributes<HTMLElement>

function EditorRoot({
  children,
  style,
  ...props
}: EditorRootProps) {
  const theme = useComposeThemeContext()
  const i18n = useComposeI18nContext()
  return (
    <section
      {...props}
      data-compose-theme={theme?.resolvedTheme}
      lang={i18n?.locale}
      style={{
        ...(theme ? createComposeThemeStyle(theme.tokens) : {}),
        ...style,
      } as CSSProperties}
    >
      {children}
    </section>
  )
}

/**
 * 渲染固定 Dockview 工作区及可选的场景树、历史、画布、属性和底部工具内容。
 *
 * @param props - 受控面板内容、可选历史控制器和标准 `section` 属性。
 * @returns Compose UI 编辑器工作区。
 * @public
 */
export function ComposeEditor({
  controller,
  sceneTree,
  history,
  slots,
  assets,
  pages,
  preferences,
  defaultPreferences,
  onPreferencesChange,
  className,
  style,
  onKeyDownCapture,
  ...props
}: ComposeEditorProps) {
  const hostI18n = useComposeI18nContext()
  const generatedSettingsId = useId()
  const settingsPanelId = `compose-editor-settings-${generatedSettingsId.replace(/:/g, '')}`
  const initializedApi = useRef<DockviewReadyEvent['api'] | null>(null)
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null)
  const restoreSettingsFocusRef = useRef(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [uncontrolledPreferences, setUncontrolledPreferences] = useState(() =>
    normalizeComposeEditorPreferences(
      defaultPreferences ?? createDefaultComposeEditorPreferences(),
    ))
  const resolvedPreferences = useMemo(
    () => normalizeComposeEditorPreferences(preferences ?? uncontrolledPreferences),
    [preferences, uncontrolledPreferences],
  )
  const editorMessages = useMemo(
    () => getEditorMessages(resolvedPreferences.locale, hostI18n?.formatMessage),
    [hostI18n?.formatMessage, resolvedPreferences.locale],
  )
  /** 当前活动的 Dockview 面板 ID；页面工作区据此判定活动页面。 */
  const [activeDocumentPanelId, setActiveDocumentPanelId] = useState<string | null>(null)
  /** 页面读取或保存失败的非阻断提示。 */
  const [pageNotice, setPageNotice] = useState<string | null>(null)
  /** 等待用户确认强制覆盖的页面面板 ID。 */
  const [pendingPageConflict, setPendingPageConflict] = useState<string | null>(null)
  const resolvedHistory = history ?? controller?.history
  const resolvedAssetResolver = useMemo(() => {
    if (assets?.resolver) return assets.resolver
    const provider = assets?.browser?.provider
    if (
      !provider?.capabilities.reference
      || !provider.resolveAsset
    ) return undefined
    return createComposeAssetResolver(provider)
  }, [assets?.browser?.provider, assets?.resolver])
  const [documents, setDocuments] = useState<ReadonlyMap<string, ComposeWorkspaceDocumentSession>>(
    () => new Map(),
  )
  const documentsRef = useRef(documents)
  const [pendingAssetDocumentClose, setPendingAssetDocumentClose] = useState<
    PendingAssetDocumentClose | null
  >(null)
  const pendingAssetDocumentCloseRef = useRef<PendingAssetDocumentClose | null>(null)
  const replaceDocuments = useCallback((next: ReadonlyMap<string, ComposeWorkspaceDocumentSession>) => {
    documentsRef.current = next
    setDocuments(next)
  }, [])
  const updateDocument = useCallback((
    panelId: string,
    update: (current: ComposeWorkspaceDocumentSession) => ComposeWorkspaceDocumentSession,
  ) => {
    const current = documentsRef.current.get(panelId)
    if (!current) return
    const next = new Map(documentsRef.current)
    next.set(panelId, update(current))
    replaceDocuments(next)
  }, [replaceDocuments])
  const updatePageDocument = useCallback((
    panelId: string,
    update: (current: ComposePageDocumentSession) => ComposePageDocumentSession,
  ) => {
    updateDocument(panelId, (current) => current.kind === 'page' ? update(current) : current)
  }, [updateDocument])
  const closeDocumentImmediately = useCallback((panelId: string) => {
    const panel = initializedApi.current?.getPanel(panelId)
    panel?.api.close?.()
    if (!documentsRef.current.has(panelId)) return
    const next = new Map(documentsRef.current)
    next.delete(panelId)
    replaceDocuments(next)
  }, [replaceDocuments])
  const settleAssetDocumentClose = useCallback((allowed: boolean) => {
    const pending = pendingAssetDocumentCloseRef.current
    if (!pending) return
    pendingAssetDocumentCloseRef.current = null
    setPendingAssetDocumentClose(null)
    if (allowed) closeDocumentImmediately(pending.panelId)
    pending.resolve(allowed)
  }, [closeDocumentImmediately])
  const requestDocumentClose = useCallback((panelId: string) => {
    const session = documentsRef.current.get(panelId)
    if (!session) return Promise.resolve(true)
    if (!session.dirty) {
      closeDocumentImmediately(panelId)
      return Promise.resolve(true)
    }
    if (pendingAssetDocumentCloseRef.current) return Promise.resolve(false)
    return new Promise<boolean>((resolve) => {
      const pending = { panelId, resolve }
      pendingAssetDocumentCloseRef.current = pending
      setPendingAssetDocumentClose(pending)
    })
  }, [closeDocumentImmediately])
  const saveAndClosePendingAssetDocument = useCallback(async () => {
    const pending = pendingAssetDocumentCloseRef.current
    if (!pending) return
    const saved = await documentsRef.current.get(pending.panelId)?.save?.() ?? false
    settleAssetDocumentClose(saved)
  }, [settleAssetDocumentClose])
  const registerDocumentSave = useCallback((
    panelId: string,
    save: (() => Promise<boolean>) | null,
  ) => updateDocument(panelId, (current) => ({ ...current, save })), [updateDocument])
  const setDocumentDirty = useCallback((panelId: string, dirty: boolean) => {
    updateDocument(panelId, (current) => current.dirty === dirty ? current : { ...current, dirty })
  }, [updateDocument])
  const setAssetDocumentSaved = useCallback((panelId: string, entry: ComposeAssetEntry) => {
    updateDocument(panelId, (current) => ({ ...current, dirty: false, entry }))
    assets?.browser?.onOperation?.({
      type: 'write',
      entryIds: [entry.id],
      succeeded: 1,
      failed: 0,
    })
  }, [assets?.browser, updateDocument])
  const openAssetDocument = useCallback((entry: ComposeAssetEntry) => {
    const provider = assets?.browser?.provider
    if (!provider || entry.kind !== 'file') return
    const panelId = createAssetDocumentPanelId(provider.id, entry.assetKey ?? entry.id)
    const existing = initializedApi.current?.getPanel(panelId)
    if (existing) {
      existing.api.setActive()
      return
    }
    const next = new Map(documentsRef.current)
    next.set(panelId, {
      kind: 'asset',
      entry,
      panelId,
      provider,
      dirty: false,
      save: null,
    })
    replaceDocuments(next)
    initializedApi.current?.addPanel({
      id: panelId,
      component: WORKSPACE_COMPONENT_IDS.assetDocument,
      tabComponent: 'workspaceTab',
      title: entry.name,
      renderer: 'always',
      position: {
        direction: 'within',
        referenceGroup: WORKSPACE_GROUP_IDS.canvas,
      },
    })
  }, [assets?.browser?.provider, replaceDocuments])

  const pageSessions = useMemo(() => {
    const map = new Map<string, ComposePageDocumentSession>()
    documents.forEach((session, panelId) => {
      if (session.kind === 'page') map.set(panelId, session)
    })
    return map
  }, [documents])
  const pageWorkspace = usePageWorkspace({
    activePanelId: activeDocumentPanelId,
    config: pages,
    provider: assets?.browser?.provider,
    sessions: pageSessions,
    updateSession: updatePageDocument,
  })
  const openPageDocument = useCallback(async (entry: ComposeAssetEntry) => {
    const provider = assets?.browser?.provider
    if (!provider || !entry.assetKey) return
    const panelId = createPageDocumentPanelId(provider.id, entry.assetKey)
    const existing = initializedApi.current?.getPanel(panelId)
    if (existing) {
      existing.api.setActive()
      return
    }
    const result = await pageWorkspace.openPage(entry)
    if (!result.ok) {
      setPageNotice(result.error.message)
      return
    }
    const next = new Map(documentsRef.current)
    next.set(panelId, { ...result.session, panelId })
    replaceDocuments(next)
    initializedApi.current?.addPanel({
      id: panelId,
      component: WORKSPACE_COMPONENT_IDS.pageDocument,
      tabComponent: 'workspaceTab',
      title: result.session.displayName,
      // 与资源文档不同，页面面板不使用 always renderer：页面共享工作区画布，同组内只有
      // 活动标签渲染 Stage，避免出现两个 Stage 实例。
      position: {
        direction: 'within',
        referenceGroup: WORKSPACE_GROUP_IDS.canvas,
      },
    })
  }, [assets?.browser?.provider, pageWorkspace, replaceDocuments])

  const savePageDocument = useCallback(async (panelId: string, force?: boolean) => {
    const outcome = await pageWorkspace.savePage(panelId, force)
    if (outcome === 'conflict') {
      setPendingPageConflict(panelId)
      return false
    }
    if (outcome === 'failed') {
      setPageNotice(editorMessages.pages.saveFailed)
      return false
    }
    const session = documentsRef.current.get(panelId)
    if (session) {
      assets?.browser?.onOperation?.({
        type: 'write',
        entryIds: [session.entry.id],
        succeeded: 1,
        failed: 0,
      })
    }
    return true
  }, [assets?.browser, editorMessages.pages.saveFailed, pageWorkspace])

  const handleDefaultAssetMutation = useCallback(async (mutation: ComposeAssetMutation) => {
    const hostDecision = assets?.browser?.onBeforeAssetMutation
    if (hostDecision && await hostDecision(mutation) === false) return false
    const providerId = assets?.browser?.provider?.id
    const affectedIds = new Set(mutation.entries.map((entry) => entry.id))
    const affectedKeys = new Set(mutation.entries.flatMap((entry) => entry.assetKey ? [entry.assetKey] : []))
    const panelIds = [...documentsRef.current.values()]
      .filter((session) => (
        session.provider.id === providerId
        && (affectedIds.has(session.entry.id)
          || (session.entry.assetKey !== undefined && affectedKeys.has(session.entry.assetKey)))
      ))
      .map((session) => session.panelId)
    for (const panelId of panelIds) {
      if (!await requestDocumentClose(panelId)) return false
    }
    return true
  }, [assets?.browser, requestDocumentClose])
  const handleAssetOpen = useCallback((entry: ComposeAssetEntry) => {
    assets?.browser?.onAssetOpen?.(entry)
    // 页面文件走页面标签；其余文件仍走既有的资源文档标签。
    if (pages !== undefined && entry.kind === 'file' && isComposePageFileName(entry.name)) {
      void openPageDocument(entry)
      return
    }
    openAssetDocument(entry)
  }, [assets?.browser, openAssetDocument, openPageDocument, pages])
  const handleAssetCanvasDrag = useCallback((
    event: ComposeAssetCanvasDragEvent,
  ) => {
    assets?.browser?.onCanvasDrag?.(event)
    const interactionController = controller?.interactionController
    if (!interactionController) return
    if (event.type === 'start') {
      interactionController.send({
        type: 'external.begin',
        clientPoint: event.clientPoint,
        item: {
          kind: 'assets',
          items: event.items.map((item) => ({
            providerId: item.reference.providerId,
            assetKey: item.reference.assetKey,
            scope: item.reference.scope,
            name: item.name,
            mediaType: item.mediaType,
          })),
        },
      })
    }
    else if (event.type === 'move') {
      interactionController.send({
        type: 'external.move',
        clientPoint: event.clientPoint,
      })
    }
    else if (event.type === 'end') {
      interactionController.send({
        type: 'external.end',
        clientPoint: event.clientPoint,
      })
    }
    else {
      interactionController.send({ type: 'external.cancel' })
    }
  }, [assets?.browser, controller?.interactionController])
  const handlePageCreated = useCallback((pageKey: string, entryId: string) => {
    // 创建结果只带回 key 与 entry id，这里补出打开页面所需的最小条目。
    void openPageDocument({
      id: entryId,
      parentId: null,
      name: pageKey.slice(pageKey.lastIndexOf('/') + 1),
      kind: 'file',
      assetKey: pageKey,
    })
  }, [openPageDocument])
  const pageStore = pageWorkspace.store
  const pageProvider = assets?.browser?.provider
  // eslint-disable-next-line react-hooks/refs -- onPageCreated 只在用户选中菜单项后触发，编译器无法区分「渲染期读 ref」与「把读 ref 的回调传下去」。
  const pageContextMenuItems = useMemo(() => createPageContextMenuItems({
    messages: editorMessages,
    provider: pageProvider,
    store: pageStore,
    onPageCreated: handlePageCreated,
  }), [editorMessages, handlePageCreated, pageProvider, pageStore])

  const hostContextMenuItems = useMemo(() => {
    const hostItems = assets?.browser?.contextMenuItems ?? []
    return pageContextMenuItems.length === 0
      ? hostItems
      : [...hostItems, ...pageContextMenuItems]
  }, [assets?.browser?.contextMenuItems, pageContextMenuItems])

  // 页面面板自身没有保存入口：保存由这里按面板 ID 注册，交给页面 Store 写入。
  useEffect(() => {
    pageSessions.forEach((session) => {
      if (session.save !== null) return
      registerDocumentSave(session.panelId, () => savePageDocument(session.panelId))
    })
  }, [pageSessions, registerDocumentSave, savePageDocument])

  const closeSettings = useCallback(() => {
    restoreSettingsFocusRef.current = true
    setSettingsOpen(false)
  }, [])
  const toggleSettings = useCallback(() => {
    setSettingsOpen((current) => {
      const next = !current
      if (!next) restoreSettingsFocusRef.current = true
      return next
    })
  }, [])
  const updatePreferences = useCallback((next: ComposeEditorPreferences) => {
    const normalized = normalizeComposeEditorPreferences(next)
    if (preferences === undefined) setUncontrolledPreferences(normalized)
    onPreferencesChange?.(normalized)
  }, [onPreferencesChange, preferences])

  const setWorkspaceElement = useCallback((element: HTMLDivElement | null) => {
    if (!element) return
    // React 18 不会稳定地写入新标准 inert 的布尔属性；直接同步 presence，确保真实 Dockview
    // DOM 与焦点陷阱一致地隔离，同时在关闭时移除该属性。
    element.toggleAttribute('inert', settingsOpen)
  }, [settingsOpen])

  useEffect(() => {
    if (!settingsOpen && restoreSettingsFocusRef.current) {
      restoreSettingsFocusRef.current = false
      settingsButtonRef.current?.focus()
    }
  }, [settingsOpen])

  const content = useMemo(
    () => ({
      sceneGraphPanel: slots?.sceneGraph !== undefined
        ? slots.sceneGraph
        : (
            <ComposeSceneTree
              {...(sceneTree ?? controller?.sceneTreeProps ?? emptySceneTreeProps)}
            />
          ),
      componentLibraryPanel: slots?.componentLibrary !== undefined
        ? slots.componentLibrary
        : controller?.componentLibraryPanel,
      history: resolvedHistory,
      historyPanel: slots?.history,
      historyShortcuts: {
        undo: resolvedPreferences.shortcuts['history.undo'],
        redo: resolvedPreferences.shortcuts['history.redo'],
      },
      stageToolbar: slots?.stageToolbar !== undefined
        ? slots.stageToolbar
        : controller?.stageToolbar,
      children: slots?.stage !== undefined
        ? slots.stage
        : addDefaultElementProps(controller?.stage ?? 'Compose Editor', {
            assetResolver: resolvedAssetResolver,
            onToolChange: controller?.setTool,
            shortcuts: resolvedPreferences.shortcuts,
          }),
      inspectorPanel: slots?.inspector !== undefined
        ? slots.inspector
        : controller?.inspectorPanel,
      transactionLogPanel: slots?.transactionLog,
      commandPanel: slots?.command !== undefined
        ? slots.command
        : controller?.commandPanel,
      assetBrowserPanel: slots?.assetBrowser !== undefined
        ? slots.assetBrowser
        : assets?.browser
          ? (
              <ComposeAssetBrowser
                {...assets.browser}
                contextMenuItems={hostContextMenuItems}
                onAssetOpen={handleAssetOpen}
                onBeforeAssetMutation={handleDefaultAssetMutation}
                onCanvasDrag={handleAssetCanvasDrag}
              />
            )
          : undefined,
      documents,
      registerDocumentSave,
      setDocumentDirty,
      setAssetDocumentSaved,
      requestDocumentClose: (panelId: string) => {
        void requestDocumentClose(panelId)
      },
      settingsOpen,
      settingsPanelId,
      setSettingsButton: (element: HTMLButtonElement | null) => {
        settingsButtonRef.current = element
      },
      toggleSettings,
    }),
    [
      slots,
      sceneTree,
      controller,
      resolvedHistory,
      assets,
      documents,
      handleAssetOpen,
      handleDefaultAssetMutation,
      hostContextMenuItems,
      resolvedAssetResolver,
      handleAssetCanvasDrag,
      registerDocumentSave,
      requestDocumentClose,
      setDocumentDirty,
      setAssetDocumentSaved,
      resolvedPreferences.shortcuts,
      settingsOpen,
      settingsPanelId,
      toggleSettings,
    ],
  )
  const handleHistoryShortcut = useComposeHistoryShortcuts(
    resolvedHistory ?? disabledHistory,
    {
      undo: resolvedPreferences.shortcuts['history.undo'],
      redo: resolvedPreferences.shortcuts['history.redo'],
    },
  )
  const handleReady = useCallback((event: DockviewReadyEvent) => {
    if (initializedApi.current === event.api) {
      return
    }

    initializeWorkspace(
      event.api,
      resolvedPreferences.locale,
      hostI18n?.formatMessage,
    )
    initializedApi.current = event.api
    // 活动页面由 Dockview 的活动面板决定；宿主据此换 controller 的 runtime。
    event.api.onDidActivePanelChange?.((change) => {
      setActiveDocumentPanelId(change.panel?.id ?? null)
    })
  }, [hostI18n?.formatMessage, resolvedPreferences.locale])

  useEffect(() => {
    if (initializedApi.current) {
      localizeWorkspace(
        initializedApi.current,
        resolvedPreferences.locale,
        hostI18n?.formatMessage,
      )
    }
  }, [hostI18n?.formatMessage, resolvedPreferences.locale])

  const pendingAssetDocument = pendingAssetDocumentClose
    ? documents.get(pendingAssetDocumentClose.panelId)
    : undefined
  const pendingPageConflictSession = pendingPageConflict
    ? pageSessions.get(pendingPageConflict)
    : undefined
  const rootClassName = ['compose-editor', className].filter(Boolean).join(' ')

  return (
    <ComposeUIProvider
      locale={resolvedPreferences.locale}
      theme={resolvedPreferences.theme}
    >
      <ComposeColorHistoryProvider>
      <EditorRoot
        {...props}
        aria-label={props['aria-label'] ?? 'Compose editor'}
        className={rootClassName}
        data-compose-core={COMPOSE_UI_CORE_PACKAGE}
        data-compose-ui="editor"
        style={style}
        onKeyDownCapture={(event) => {
          onKeyDownCapture?.(event)
          if (
            !event.defaultPrevented
            && !event.nativeEvent.isComposing
            && !isEditableKeyboardTarget(event.target)
            && resolvedPreferences.shortcuts['editor.settings'].some((binding) =>
              isComposeEditorKeybindingMatch(
                event.nativeEvent,
                binding,
                typeof navigator === 'undefined' ? '' : navigator.platform,
              ))
          ) {
            event.preventDefault()
            toggleSettings()
          }
          if (resolvedHistory && !event.defaultPrevented) handleHistoryShortcut(event)
        }}
      >
        <WorkspaceContentContext.Provider value={content}>
          <div
            className="compose-editor__workspace"
            ref={setWorkspaceElement}
          >
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
          </div>
          {settingsOpen ? (
            <SettingsDialog
              id={settingsPanelId}
              onChange={updatePreferences}
              onClose={closeSettings}
              preferences={resolvedPreferences}
            />
          ) : null}
          {pendingAssetDocumentClose && pendingAssetDocument ? (
            <ComposeDialog
              open
              onOpenChange={(open) => {
                if (!open) settleAssetDocumentClose(false)
              }}
            >
              <ComposeDialogPortal>
                <ComposeDialogBackdrop />
                <ComposeDialogViewport>
                  <ComposeDialogContent>
                    <ComposeDialogHeader>
                      <ComposeDialogTitle>
                        {pendingAssetDocument.kind === 'page'
                          ? editorMessages.pages.unsavedPageTitle
                          : editorMessages.unsavedAssetTitle}
                      </ComposeDialogTitle>
                      <ComposeDialogDescription>
                        {editorMessages.unsavedAssetQuestion(
                          pendingAssetDocument.kind === 'page'
                            ? pendingAssetDocument.displayName
                            : pendingAssetDocument.entry.name,
                        )}
                      </ComposeDialogDescription>
                    </ComposeDialogHeader>
                    <ComposeDialogFooter>
                      <ComposeButton
                        type="button"
                        variant="outline"
                        onClick={() => settleAssetDocumentClose(false)}
                      >
                        {editorMessages.canvasSettings.cancel}
                      </ComposeButton>
                      <ComposeButton
                        type="button"
                        variant="destructive"
                        onClick={() => settleAssetDocumentClose(true)}
                      >
                        {editorMessages.discard}
                      </ComposeButton>
                      <ComposeButton type="button" onClick={() => void saveAndClosePendingAssetDocument()}>
                        {editorMessages.save}
                      </ComposeButton>
                    </ComposeDialogFooter>
                  </ComposeDialogContent>
                </ComposeDialogViewport>
              </ComposeDialogPortal>
            </ComposeDialog>
          ) : null}
          {pendingPageConflictSession ? (
            <ComposeDialog
              open
              onOpenChange={(open) => {
                if (!open) setPendingPageConflict(null)
              }}
            >
              <ComposeDialogPortal>
                <ComposeDialogBackdrop />
                <ComposeDialogViewport>
                  <ComposeDialogContent>
                    <ComposeDialogHeader>
                      <ComposeDialogTitle>{editorMessages.pages.conflictTitle}</ComposeDialogTitle>
                      <ComposeDialogDescription>
                        {editorMessages.pages.conflictQuestion(pendingPageConflictSession.displayName)}
                      </ComposeDialogDescription>
                    </ComposeDialogHeader>
                    <ComposeDialogFooter>
                      <ComposeButton
                        type="button"
                        variant="outline"
                        onClick={() => setPendingPageConflict(null)}
                      >
                        {editorMessages.canvasSettings.cancel}
                      </ComposeButton>
                      <ComposeButton
                        type="button"
                        variant="destructive"
                        onClick={() => {
                          const panelId = pendingPageConflictSession.panelId
                          setPendingPageConflict(null)
                          void savePageDocument(panelId, true)
                        }}
                      >
                        {editorMessages.pages.overwrite}
                      </ComposeButton>
                    </ComposeDialogFooter>
                  </ComposeDialogContent>
                </ComposeDialogViewport>
              </ComposeDialogPortal>
            </ComposeDialog>
          ) : null}
          {pageNotice === null ? null : (
            <div className="compose-editor__page-notice" role="status">
              <span>{pageNotice}</span>
              <ComposeButton
                type="button"
                variant="ghost"
                onClick={() => setPageNotice(null)}
              >
                {editorMessages.close}
              </ComposeButton>
            </div>
          )}
        </WorkspaceContentContext.Provider>
      </EditorRoot>
      </ComposeColorHistoryProvider>
    </ComposeUIProvider>
  )
}
