/**
 * 提供可嵌入 React 宿主的 Compose UI 编辑器工作区。
 *
 * @packageDocumentation
 */
import { COMPOSE_UI_CORE_PACKAGE } from '@compose-ui/core'
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
import type { ComposeAssetDocumentSession } from '../workspace-layout'
import {
  AssetBrowserPanel,
  AssetDocumentPanel,
  CanvasPanel,
  ComposeCommandPanel,
  ComponentLibraryPanel,
  InspectorPanel,
  SceneGraphPanel,
  TransactionLogPanel,
} from '../workspace-layout'
import {
  createAssetDocumentPanelId,
  initializeWorkspace,
  localizeWorkspace,
  WORKSPACE_GROUP_IDS,
  WORKSPACE_COMPONENT_IDS,
} from '../workspace-layout'
import { getEditorMessages } from '../editor-i18n'
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
  const [assetDocuments, setAssetDocuments] = useState<ReadonlyMap<string, ComposeAssetDocumentSession>>(
    () => new Map(),
  )
  const assetDocumentsRef = useRef(assetDocuments)
  const [pendingAssetDocumentClose, setPendingAssetDocumentClose] = useState<
    PendingAssetDocumentClose | null
  >(null)
  const pendingAssetDocumentCloseRef = useRef<PendingAssetDocumentClose | null>(null)
  const replaceAssetDocuments = useCallback((next: ReadonlyMap<string, ComposeAssetDocumentSession>) => {
    assetDocumentsRef.current = next
    setAssetDocuments(next)
  }, [])
  const updateAssetDocument = useCallback((
    panelId: string,
    update: (current: ComposeAssetDocumentSession) => ComposeAssetDocumentSession,
  ) => {
    const current = assetDocumentsRef.current.get(panelId)
    if (!current) return
    const next = new Map(assetDocumentsRef.current)
    next.set(panelId, update(current))
    replaceAssetDocuments(next)
  }, [replaceAssetDocuments])
  const closeAssetDocumentImmediately = useCallback((panelId: string) => {
    const panel = initializedApi.current?.getPanel(panelId)
    panel?.api.close?.()
    if (!assetDocumentsRef.current.has(panelId)) return
    const next = new Map(assetDocumentsRef.current)
    next.delete(panelId)
    replaceAssetDocuments(next)
  }, [replaceAssetDocuments])
  const settleAssetDocumentClose = useCallback((allowed: boolean) => {
    const pending = pendingAssetDocumentCloseRef.current
    if (!pending) return
    pendingAssetDocumentCloseRef.current = null
    setPendingAssetDocumentClose(null)
    if (allowed) closeAssetDocumentImmediately(pending.panelId)
    pending.resolve(allowed)
  }, [closeAssetDocumentImmediately])
  const requestAssetDocumentClose = useCallback((panelId: string) => {
    const session = assetDocumentsRef.current.get(panelId)
    if (!session) return Promise.resolve(true)
    if (!session.dirty) {
      closeAssetDocumentImmediately(panelId)
      return Promise.resolve(true)
    }
    if (pendingAssetDocumentCloseRef.current) return Promise.resolve(false)
    return new Promise<boolean>((resolve) => {
      const pending = { panelId, resolve }
      pendingAssetDocumentCloseRef.current = pending
      setPendingAssetDocumentClose(pending)
    })
  }, [closeAssetDocumentImmediately])
  const saveAndClosePendingAssetDocument = useCallback(async () => {
    const pending = pendingAssetDocumentCloseRef.current
    if (!pending) return
    const saved = await assetDocumentsRef.current.get(pending.panelId)?.save?.() ?? false
    settleAssetDocumentClose(saved)
  }, [settleAssetDocumentClose])
  const registerAssetDocumentSave = useCallback((
    panelId: string,
    save: (() => Promise<boolean>) | null,
  ) => updateAssetDocument(panelId, (current) => ({ ...current, save })), [updateAssetDocument])
  const setAssetDocumentDirty = useCallback((panelId: string, dirty: boolean) => {
    updateAssetDocument(panelId, (current) => current.dirty === dirty ? current : { ...current, dirty })
  }, [updateAssetDocument])
  const setAssetDocumentSaved = useCallback((panelId: string, entry: ComposeAssetEntry) => {
    updateAssetDocument(panelId, (current) => ({ ...current, dirty: false, entry }))
    assets?.browser?.onOperation?.({
      type: 'write',
      entryIds: [entry.id],
      succeeded: 1,
      failed: 0,
    })
  }, [assets?.browser, updateAssetDocument])
  const openAssetDocument = useCallback((entry: ComposeAssetEntry) => {
    const provider = assets?.browser?.provider
    if (!provider || entry.kind !== 'file') return
    const panelId = createAssetDocumentPanelId(provider.id, entry.assetKey ?? entry.id)
    const existing = initializedApi.current?.getPanel(panelId)
    if (existing) {
      existing.api.setActive()
      return
    }
    const next = new Map(assetDocumentsRef.current)
    next.set(panelId, {
      entry,
      panelId,
      provider,
      dirty: false,
      save: null,
    })
    replaceAssetDocuments(next)
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
  }, [assets?.browser?.provider, replaceAssetDocuments])
  const handleDefaultAssetMutation = useCallback(async (mutation: ComposeAssetMutation) => {
    const hostDecision = assets?.browser?.onBeforeAssetMutation
    if (hostDecision && await hostDecision(mutation) === false) return false
    const providerId = assets?.browser?.provider?.id
    const affectedIds = new Set(mutation.entries.map((entry) => entry.id))
    const affectedKeys = new Set(mutation.entries.flatMap((entry) => entry.assetKey ? [entry.assetKey] : []))
    const panelIds = [...assetDocumentsRef.current.values()]
      .filter((session) => (
        session.provider.id === providerId
        && (affectedIds.has(session.entry.id)
          || (session.entry.assetKey !== undefined && affectedKeys.has(session.entry.assetKey)))
      ))
      .map((session) => session.panelId)
    for (const panelId of panelIds) {
      if (!await requestAssetDocumentClose(panelId)) return false
    }
    return true
  }, [assets?.browser, requestAssetDocumentClose])
  const handleAssetOpen = useCallback((entry: ComposeAssetEntry) => {
    assets?.browser?.onAssetOpen?.(entry)
    openAssetDocument(entry)
  }, [assets?.browser, openAssetDocument])
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
                onAssetOpen={handleAssetOpen}
                onBeforeAssetMutation={handleDefaultAssetMutation}
                onCanvasDrag={handleAssetCanvasDrag}
              />
            )
          : undefined,
      assetDocuments,
      registerAssetDocumentSave,
      setAssetDocumentDirty,
      setAssetDocumentSaved,
      requestAssetDocumentClose: (panelId: string) => {
        void requestAssetDocumentClose(panelId)
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
      assetDocuments,
      handleAssetOpen,
      handleDefaultAssetMutation,
      resolvedAssetResolver,
      handleAssetCanvasDrag,
      registerAssetDocumentSave,
      requestAssetDocumentClose,
      setAssetDocumentDirty,
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

  const assetDocumentMessages = getEditorMessages(
    resolvedPreferences.locale,
    hostI18n?.formatMessage,
  )
  const pendingAssetDocument = pendingAssetDocumentClose
    ? assetDocuments.get(pendingAssetDocumentClose.panelId)
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
                      <ComposeDialogTitle>{assetDocumentMessages.unsavedAssetTitle}</ComposeDialogTitle>
                      <ComposeDialogDescription>
                        {assetDocumentMessages.unsavedAssetQuestion(pendingAssetDocument.entry.name)}
                      </ComposeDialogDescription>
                    </ComposeDialogHeader>
                    <ComposeDialogFooter>
                      <ComposeButton
                        type="button"
                        variant="outline"
                        onClick={() => settleAssetDocumentClose(false)}
                      >
                        {assetDocumentMessages.canvasSettings.cancel}
                      </ComposeButton>
                      <ComposeButton
                        type="button"
                        variant="destructive"
                        onClick={() => settleAssetDocumentClose(true)}
                      >
                        {assetDocumentMessages.discard}
                      </ComposeButton>
                      <ComposeButton type="button" onClick={() => void saveAndClosePendingAssetDocument()}>
                        {assetDocumentMessages.save}
                      </ComposeButton>
                    </ComposeDialogFooter>
                  </ComposeDialogContent>
                </ComposeDialogViewport>
              </ComposeDialogPortal>
            </ComposeDialog>
          ) : null}
        </WorkspaceContentContext.Provider>
      </EditorRoot>
      </ComposeColorHistoryProvider>
    </ComposeUIProvider>
  )
}
