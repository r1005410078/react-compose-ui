/**
 * 提供可嵌入 React 宿主的 Compose UI 编辑器工作区。
 *
 * @packageDocumentation
 */
import {
  COMPOSE_UI_CORE_PACKAGE,
  BUILTIN_COMMAND_TYPES,
  composePageDisplayName,
  composePageFileName,
  isComposeComponentMediaType,
  isComposePageMediaType,
  type ComposeComponentInstanceOverrides,
} from '@compose-ui/core'
import { ComposeAssetBrowser } from '@compose-ui/asset-browser'
import { ComposeAnimationPanelProvider } from '@compose-ui/animation-panel'
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
  ComposeInput,
  ComposePaintImageLibraryProvider,
} from '@compose-ui/components'
import type { ComposePaintImageLibrary } from '@compose-ui/components'
import type { ComposePageSetupReference } from '@compose-ui/core'
import type { ComposeEntity, ComposeResolvedComponentSnapshot, JsonObject } from '@compose-ui/core'
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
  ComposeAssetEntryNaming,
  ComposeAssetEntryRenderContext,
  ComposeAssetExternalDropConfig,
  ComposeAssetExternalDropEvent,
  ComposeAssetMutation,
} from '@compose-ui/asset-browser'
import type { ComposeAssetResolver } from '@compose-ui/assets'
import {
  ComposeComponentLibraryPanel,
  ComposeComponentAssetIcon,
  ComposeComponentInstanceOverridesPanel,
  ComposeVariantOverridesPanel,
  applyComposeInstanceOverrides,
  planComposeInstanceAutoSync,
  createComposeVariantAsset,
  createComposeVariantAssetFromInstance,
  readComposeComponentInstance,
  updateComposeComponentInstanceFromSource,
  type ComposeComponentDescriptor,
  type ComposeComponentLibraryItem,
  type ComposeVariantOverridesChange,
} from '@compose-ui/component-library'
import {
  WorkspaceContentContext,
} from '../workspace-layout'
import type {
  ComposeComponentDocumentSession,
  ComposePageDocumentSession,
  ComposeWorkspaceDocumentSession,
} from '../workspace-layout'
import {
  AssetBrowserPanel,
  AnimationPanel,
  AssetDocumentPanel,
  CanvasPanel,
  ComponentDocumentPanel,
  PageDocumentPanel,
  ComposeCommandPanel,
  InspectorPanel,
  SceneGraphPanel,
  TransactionLogPanel,
} from '../workspace-layout'
import {
  createAssetDocumentPanelId,
  createComponentDocumentPanelId,
  createPageDocumentPanelId,
  isWorkspaceDocumentPanelId,
  initializeWorkspace,
  localizeWorkspace,
  WORKSPACE_GROUP_IDS,
  WORKSPACE_COMPONENT_IDS,
  WORKSPACE_PANEL_IDS,
} from '../workspace-layout'
import type { ComposePageDescriptor } from '@compose-ui/pages'
import { getEditorMessages } from '../editor-i18n'
import {
  createPageContextMenuItems,
  HomePageBadge,
  PageEntryIcon,
  PageScriptScopePanel,
} from '../pages'
import { usePageWorkspace } from '../pages'
import type { ComposeEditorPagesConfig } from '../pages'
import {
  COMPOSE_PAGE_SETUP_SCRIPT_INTELLIGENCE,
  isComposePageSetupScriptName,
} from '../pages/page-script-intelligence'
import { WorkspaceHeaderActions, WorkspaceTab } from '../workspace-layout'
import type { ComposeEditorController } from '../editor-controller'
import { useComponentCatalog, useComponentWorkspace } from '../component-workspace'
import type { ComposeEditorComponentsConfig } from '../component-workspace'
import { SettingsDialog } from '../editor-preferences'
import {
  createDefaultComposeEditorPreferences,
  isComposeEditorKeybindingMatch,
  isEditableKeyboardTarget,
  normalizeComposeEditorPreferences,
} from '../editor-preferences'
import type { ComposeEditorPreferences } from '../editor-preferences'
import { useProviderPaintImageLibrary } from './paint-image-library'
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
  /** 注入默认 Canvas/Appearance Inspector 图片页的资源、上传与选择端口。 */
  readonly paintImageLibrary?: ComposePaintImageLibrary
  /** 自动图片上传使用的父目录；省略时写入 Provider 根目录。 */
  readonly paintImageUploadParentId?: string
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
  /** 项目 Component/Variant 独立工作区；省略时仍可使用 Controller 上的 Store 创建实例。 */
  components?: ComposeEditorComponentsConfig
}

const workspaceComponents = {
  [WORKSPACE_COMPONENT_IDS.scene]: SceneGraphPanel,
  [WORKSPACE_COMPONENT_IDS.canvas]: CanvasPanel,
  [WORKSPACE_COMPONENT_IDS.inspector]: InspectorPanel,
  [WORKSPACE_COMPONENT_IDS.transactionLog]: TransactionLogPanel,
  [WORKSPACE_COMPONENT_IDS.command]: ComposeCommandPanel,
  [WORKSPACE_COMPONENT_IDS.assetBrowser]: AssetBrowserPanel,
  [WORKSPACE_COMPONENT_IDS.animation]: AnimationPanel,
  [WORKSPACE_COMPONENT_IDS.assetDocument]: AssetDocumentPanel,
  [WORKSPACE_COMPONENT_IDS.pageDocument]: PageDocumentPanel,
  [WORKSPACE_COMPONENT_IDS.componentDocument]: ComponentDocumentPanel,
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

function providePaintImageLibrary(
  node: ReactNode,
  imageLibrary: ComposePaintImageLibrary | undefined,
) {
  if (node == null) return node
  return (
    <ComposePaintImageLibraryProvider value={imageLibrary}>
      {node}
    </ComposePaintImageLibraryProvider>
  )
}

function createComponentLibraryStageItem(item: ComposeComponentLibraryItem) {
  return item.kind === 'preset'
    ? { kind: 'preset' as const, presetId: item.presetId }
    : {
        kind: 'assets' as const,
        items: [{
          providerId: item.descriptor.reference.providerId,
          assetKey: item.descriptor.reference.assetKey,
          scope: item.descriptor.reference.scope,
          name: item.descriptor.displayName,
          mediaType: 'application/vnd.compose-ui.component+json',
        }],
      }
}

function rendererPropsObject(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : {}
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
 * 把资源写入失败翻译成用户可行动的中文提示。
 *
 * @remarks
 * Provider 由宿主实现，其 message 语言和措辞都不受编辑器控制，因此按稳定错误码翻译，
 * 只有无法识别时才回退到原始 message。
 */
function describeCreateComponentError(error: Error): string {
  const code = (error as { code?: unknown }).code
  if (code === 'conflict') return '同名组件已存在，请换一个名称。'
  if (code === 'unsupported') return '当前资源目录不支持创建组件文件。'
  if (code === 'not-found') return '目标资源目录不存在。'
  if (code === 'permission') return '没有写入该资源目录的权限。'
  return error.message
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
  components,
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
  /** Dockview 已提供中央组；页面目录先返回时必须等到这里才能插入首页标签。 */
  const [workspaceReady, setWorkspaceReady] = useState(false)
  /** 已自动尝试过的首页 key；用户关闭标签或目录刷新都不应强制再次打开。 */
  const startupHomePageKeysRef = useRef(new Set<string>())
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
  /** 仅由底部工具组的标签切换；点击右侧面板不能让关键帧属性瞬间消失。 */
  const [animationPanelActive, setAnimationPanelActive] = useState(false)
  /** 页面读取或保存失败的非阻断提示。 */
  const [pageNotice, setPageNotice] = useState<string | null>(null)
  /** 等待用户确认强制覆盖的页面面板 ID。 */
  const [pendingPageConflict, setPendingPageConflict] = useState<string | null>(null)
  /** 组件/变体保存与打开失败的非阻断提示。 */
  const [componentNotice, setComponentNotice] = useState<string | null>(null)
  /** 等待用户确认强制覆盖的组件或变体面板 ID。 */
  const [pendingComponentConflict, setPendingComponentConflict] = useState<string | null>(null)
  const [pendingCreateComponent, setPendingCreateComponent] = useState<{
    readonly entityIds: readonly string[]
    readonly sequence: number
  } | null>(null)
  const [createComponentName, setCreateComponentName] = useState('Component')
  const [createComponentError, setCreateComponentError] = useState<string | null>(null)
  const [creatingComponent, setCreatingComponent] = useState(false)
  const [pendingVariantParent, setPendingVariantParent] = useState<ComposeComponentDescriptor | null>(null)
  const [pendingVariantInstance, setPendingVariantInstance] = useState<ComposeEntity | null>(null)
  const [variantName, setVariantName] = useState('Variant')
  const [creatingVariant, setCreatingVariant] = useState(false)
  const handledCreateRequestRef = useRef(0)
  const resolvedHistory = history ?? controller?.history
  const createComponentRequest = controller?.createComponentRequest
  useEffect(() => {
    if (
      !createComponentRequest
      || handledCreateRequestRef.current === createComponentRequest.sequence
    ) return
    handledCreateRequestRef.current = createComponentRequest.sequence
    const firstId = createComponentRequest.entityIds[0]
    const defaultName = createComponentRequest.entityIds.length === 1 && firstId
      ? controller?.document?.entities[firstId]?.name ?? 'Component'
      : 'Component'
    setCreateComponentName(defaultName)
    setPendingCreateComponent(createComponentRequest)
  }, [controller?.document?.entities, createComponentRequest])
  const resolvedAssetResolver = useMemo(() => {
    if (assets?.resolver) return assets.resolver
    const provider = assets?.browser?.provider
    if (
      !provider?.capabilities.reference
      || !provider.resolveAsset
    ) return undefined
    return createComposeAssetResolver(provider)
  }, [assets?.browser?.provider, assets?.resolver])
  const sceneExternalDropEvent = useMemo<ComposeAssetExternalDropEvent | null>(() => {
    const event = controller?.sceneExternalDragEvent
    if (!event) return null
    const payload = { type: 'scene-entities', data: { entityIds: event.nodeIds } }
    return event.type === 'cancel'
      ? { sequence: event.sequence, type: 'cancel', payload }
      : {
          sequence: event.sequence,
          type: event.type,
          payload,
          clientPoint: event.clientPoint,
        }
  }, [controller?.sceneExternalDragEvent])
  const sceneExternalDrop = useMemo<ComposeAssetExternalDropConfig | undefined>(() => {
    const provider = assets?.browser?.provider
    if (
      !controller?.componentStore
      || !sceneExternalDropEvent
      || !provider?.capabilities.createFile
      || !provider.createFile
      || provider.id !== controller.componentStore.providerId
    ) return undefined
    return {
      event: sceneExternalDropEvent,
      accepts: ({ payload, target }) => payload.type === 'scene-entities'
        && target.entry.capabilities?.createFile !== false,
      onDrop: async ({ payload, target, promptName, refresh }) => {
        if (payload.type !== 'scene-entities') return
        const data = payload.data as { readonly entityIds?: readonly string[] }
        if (!Array.isArray(data.entityIds) || data.entityIds.length === 0) return
        controller.setSelectedIds(data.entityIds)
        const defaultName = data.entityIds.length === 1
          ? controller.document.entities[data.entityIds[0]!]?.name ?? 'Component'
          : 'Component'
        const name = await promptName({
          title: '创建组件',
          initialValue: defaultName,
          confirmLabel: '创建',
        })
        if (!name) return
        const result = await controller.createComponentFromSelection({
          name,
          parentId: target.folderId,
          entityIds: data.entityIds,
        })
        if (result.status === 'committed' || result.status === 'saved-not-instantiated') refresh()
      },
    }
  }, [assets?.browser?.provider, controller, sceneExternalDropEvent])
  const providerPaintImageLibrary = useProviderPaintImageLibrary({
    enabled: assets?.paintImageLibrary === undefined,
    provider: assets?.browser?.provider,
    uploadParentId: assets?.paintImageUploadParentId,
  })
  const resolvedPaintImageLibrary = assets?.paintImageLibrary ?? providerPaintImageLibrary
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
  const updateComponentDocument = useCallback((
    panelId: string,
    update: (current: ComposeComponentDocumentSession) => ComposeComponentDocumentSession,
  ) => {
    updateDocument(panelId, (current) => current.kind === 'component' ? update(current) : current)
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
  const openAssetDocument = useCallback((
    entry: ComposeAssetEntry,
    options?: {
      readonly readOnly?: boolean
      readonly setupScript?: boolean
    },
  ) => {
    const provider = assets?.browser?.provider
    if (!provider || entry.kind !== 'file') return
    const readOnly = options?.readOnly === true
    const scriptIntelligence = options?.setupScript === true
      ? COMPOSE_PAGE_SETUP_SCRIPT_INTELLIGENCE
      : undefined
    const panelId = createAssetDocumentPanelId(provider.id, entry.assetKey ?? entry.id, { readOnly })
    const existing = initializedApi.current?.getPanel(panelId)
    if (existing) {
      if (scriptIntelligence) {
        updateDocument(panelId, (current) => current.kind === 'asset'
          ? { ...current, scriptIntelligence }
          : current)
      }
      existing.api.setActive()
      return
    }
    const next = new Map(documentsRef.current)
    next.set(panelId, {
      kind: 'asset',
      entry,
      panelId,
      provider,
      readOnly,
      scriptIntelligence,
      dirty: false,
      save: null,
    })
    replaceDocuments(next)
    initializedApi.current?.addPanel({
      id: panelId,
      component: WORKSPACE_COMPONENT_IDS.assetDocument,
      tabComponent: 'workspaceTab',
      title: readOnly ? `${entry.name}${editorMessages.pages.readOnlySuffix}` : entry.name,
      renderer: 'always',
      position: {
        direction: 'within',
        referenceGroup: WORKSPACE_GROUP_IDS.canvas,
      },
    })
  }, [
    assets?.browser?.provider,
    editorMessages.pages.readOnlySuffix,
    replaceDocuments,
    updateDocument,
  ])

  const pageSessions = useMemo(() => {
    const map = new Map<string, ComposePageDocumentSession>()
    documents.forEach((session, panelId) => {
      if (session.kind === 'page') map.set(panelId, session)
    })
    return map
  }, [documents])
  const componentSessions = useMemo(() => {
    const map = new Map<string, ComposeComponentDocumentSession>()
    documents.forEach((session, panelId) => {
      if (session.kind === 'component') map.set(panelId, session)
    })
    return map
  }, [documents])
  const componentWorkspace = useComponentWorkspace({
    activePanelId: activeDocumentPanelId,
    config: components,
    fallbackStore: controller?.componentStore,
    sessions: componentSessions,
    updateSession: updateComponentDocument,
  })
  const componentCatalog = useComponentCatalog(componentWorkspace.store)
  const componentKindByAssetKey = useMemo(() => new Map(
    componentCatalog?.components.map((descriptor) => [descriptor.assetKey, descriptor.kind]) ?? [],
  ), [componentCatalog])
  /**
   * 活动页面或组件标签是 Stage 的宿主；只有未启用文档工作区时才回落到固定画布面板。
   *
   * @remarks
   * Stage 只能有一份：interaction controller 的 surface 是独占的。
   */
  const stageHostPanelId = activeDocumentPanelId !== null
    && (pageSessions.has(activeDocumentPanelId) || componentSessions.has(activeDocumentPanelId))
    ? activeDocumentPanelId
    : pages === undefined && components === undefined ? WORKSPACE_PANEL_IDS.canvas : ''
  const pageWorkspace = usePageWorkspace({
    activePanelId: activeDocumentPanelId,
    assetResolver: resolvedAssetResolver,
    config: pages,
    provider: assets?.browser?.provider,
    sessions: pageSessions,
    updateSession: updatePageDocument,
  })
  const pageStore = pageWorkspace.store
  const activePageSession = activeDocumentPanelId
    ? pageSessions.get(activeDocumentPanelId)
    : undefined
  const activeWorkspaceSession = activeDocumentPanelId
    ? documents.get(activeDocumentPanelId)
    : undefined
  const activeComponentSession = activeWorkspaceSession?.kind === 'component'
    ? activeWorkspaceSession
    : undefined
  const selectedControllerEntity = controller?.selectedIds?.length === 1
    ? controller.document?.entities[controller.selectedIds[0]!]
    : undefined
  const selectedComponentInstance = selectedControllerEntity
    && readComposeComponentInstance(selectedControllerEntity)
    ? selectedControllerEntity
    : undefined
  const pageProvider = assets?.browser?.provider
  const homePageKey = pageWorkspace.catalog?.homePageKey ?? null
  /**
   * 首页 key 悬空的非阻断提示。
   *
   * @remarks
   * 派生而不是写入 state：这是一个持续存在的条件，只要清单仍指向不存在的页面就应当一直
   * 提示，而不是被用户关掉一次就消失。
   */
  const homePageMissingNotice = pageWorkspace.catalog?.homePageMissing === true
    ? editorMessages.pages.homePageMissing
    : null
  const onHomePageChange = pages?.onHomePageChange
  const handleHomePageChange = useCallback((nextKey: string | null) => {
    pageWorkspace.refreshCatalog()
    onHomePageChange?.(nextKey)
  }, [onHomePageChange, pageWorkspace])
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

  // 新页面 Store 代表一个新的工作区实例；此前 Provider 的一次性打开记录不能沿用。
  useEffect(() => {
    startupHomePageKeysRef.current.clear()
  }, [pageStore])

  useEffect(() => {
    const catalog = pageWorkspace.catalog
    if (
      pages === undefined
      || !workspaceReady
      || !catalog
      || catalog.homePageMissing
      || catalog.homePageKey === null
      || startupHomePageKeysRef.current.has(catalog.homePageKey)
    ) return

    const homePage = catalog.pages.find((page) => page.pageKey === catalog.homePageKey)
    if (!homePage) return

    let disposed = false
    // 目录订阅的 effect 只负责协调外部目录状态；推迟到微任务后再进入会更新会话 state 的
    // 打开流程，避免同一 effect commit 内出现级联渲染。
    queueMicrotask(() => {
      if (disposed || startupHomePageKeysRef.current.has(homePage.pageKey)) return
      startupHomePageKeysRef.current.add(homePage.pageKey)
      void openPageDocument({
        id: homePage.entryId,
        parentId: homePage.parentId,
        name: homePage.fileName,
        kind: 'file',
        assetKey: homePage.pageKey,
        revision: homePage.revision,
      })
    })
    return () => { disposed = true }
  }, [openPageDocument, pageWorkspace.catalog, pages, workspaceReady])

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
    if (session?.kind === 'page') {
      assets?.browser?.onOperation?.({
        type: 'write',
        entryIds: [session.entry.id],
        succeeded: 1,
        failed: 0,
      })
    }
    return true
  }, [assets?.browser, editorMessages.pages.saveFailed, pageWorkspace])

  const openComponentDocument = useCallback(async (descriptor: ComposeComponentDescriptor) => {
    const store = componentWorkspace.store
    if (!store) return
    const panelId = createComponentDocumentPanelId(store.providerId, descriptor.assetKey)
    const existing = initializedApi.current?.getPanel(panelId)
    if (existing) {
      existing.api.setActive()
      return
    }
    const result = await componentWorkspace.openComponent(descriptor)
    if (!result.ok) {
      setComponentNotice(result.error.message)
      return
    }
    const next = new Map(documentsRef.current)
    next.set(panelId, { ...result.session, panelId })
    replaceDocuments(next)
    initializedApi.current?.addPanel({
      id: panelId,
      component: WORKSPACE_COMPONENT_IDS.componentDocument,
      tabComponent: 'workspaceTab',
      title: result.session.displayName,
      position: {
        direction: 'within',
        referenceGroup: WORKSPACE_GROUP_IDS.canvas,
      },
    })
  }, [componentWorkspace, replaceDocuments])

  /**
   * 组件源保存成功后同步依赖实例。
   *
   * @remarks
   * 覆盖全部兼容的实例直接刷新，不打断用户；存在失效覆盖的实例保留旧快照并提示，等待显式确认。
   * 判据是覆盖能否应用而不是变更来源，因此本地保存与外部 revision 变化行为一致。
   *
   * 全部同步项合并为一次事务，使自动路径与手动更新共享同一次 Undo。
   */
  const syncInstancesAfterComponentSave = useCallback((
    assetKey: string,
    snapshot: ComposeResolvedComponentSnapshot,
    options?: { readonly excludeEntityIds?: readonly string[] },
  ) => {
    const store = componentWorkspace.store
    const document = controller?.document
    if (!store || !controller || !document) return
    const excluded = new Set(options?.excludeEntityIds ?? [])
    const plan = planComposeInstanceAutoSync({
      document,
      reference: store.createReference(assetKey),
      snapshot,
    })
    for (const entry of plan.synced) {
      // 刚完成 Apply 的实例已写好 remainingOverrides，禁止 auto-sync 用旧 ops 盖回去。
      if (excluded.has(entry.entityId)) continue
      const entity = document.entities[entry.entityId]
      const renderer = entity?.components.Renderer
      if (!renderer) continue
      controller.dispatch({
        id: typeof globalThis.crypto?.randomUUID === 'function'
          ? globalThis.crypto.randomUUID()
          : `instance-auto-sync-${Date.now()}`,
        type: BUILTIN_COMMAND_TYPES.setRendererProps,
        payload: {
          entityId: entry.entityId,
          props: {
            ...rendererPropsObject(renderer.props),
            resolvedSnapshot: entry.snapshot,
            instanceOverrides: entry.overrides,
          } as unknown as JsonObject,
        },
        meta: {
          label: `Sync ${entity?.name ?? entry.entityId} with component source`,
          source: 'component-workspace',
          targetIds: [entry.entityId],
        },
      })
    }
    const pending = plan.pending.filter((entry) => !excluded.has(entry.entityId))
    if (pending.length > 0) {
      setComponentNotice(
        `${pending.length} 个实例的本层覆盖已失效，需要在实例上确认更新`,
      )
    }
  }, [componentWorkspace.store, controller])

  const saveComponentDocument = useCallback(async (panelId: string, force?: boolean) => {
    const outcome = await componentWorkspace.saveComponent(panelId, force)
    if (outcome.status === 'conflict') {
      setPendingComponentConflict(panelId)
      return false
    }
    if (outcome.status === 'failed') {
      setComponentNotice('组件保存失败')
      return false
    }
    syncInstancesAfterComponentSave(outcome.assetKey, outcome.snapshot)
    return true
  }, [componentWorkspace, syncInstancesAfterComponentSave])

  const handleDefaultAssetMutation = useCallback(async (mutation: ComposeAssetMutation) => {
    const hostDecision = assets?.browser?.onBeforeAssetMutation
    if (hostDecision && await hostDecision(mutation) === false) return false
    const providerId = assets?.browser?.provider?.id
    const affectedIds = new Set(mutation.entries.map((entry) => entry.id))
    const affectedKeys = new Set(mutation.entries.flatMap((entry) => entry.assetKey ? [entry.assetKey] : []))
    const panelIds = [...documentsRef.current.values()]
      .filter((session) => session.kind === 'component'
        ? componentWorkspace.store?.providerId === providerId
          && affectedKeys.has(session.assetKey)
        : session.provider.id === providerId
          && (affectedIds.has(session.entry.id)
            || (session.entry.assetKey !== undefined && affectedKeys.has(session.entry.assetKey))))
      .map((session) => session.panelId)
    for (const panelId of panelIds) {
      if (!await requestDocumentClose(panelId)) return false
    }
    // 首页对账：只处理经由本编辑器发生的删除与重命名。外部变更下 key 悬空只提示不改写，
    // 因为一次列举失败或临时移动文件都不应销毁用户的首页设置。
    if (pageStore && homePageKey !== null && mutation.type === 'delete') {
      const removesHome = mutation.entries.some((entry) => entry.assetKey === homePageKey)
      if (removesHome) {
        try {
          const manifest = await pageStore.setHomePage(null)
          handleHomePageChange(manifest.homePageKey)
        }
        catch {
          // 清单不可写时保留原设置；界面会因页面消失而不再渲染标记。
        }
      }
    }
    return true
  }, [assets?.browser, componentWorkspace.store, handleHomePageChange, homePageKey, pageStore, requestDocumentClose])
  /**
   * 从资源条目打开组件画布（双击默认路径）。
   *
   * @remarks
   * 优先用目录里的 descriptor；列举未就绪时再 readComponent 补齐。
   * 查看 JSON 走 {@link openAssetDocument}，不在此入口。
   */
  const openComponentFromAssetEntry = useCallback(async (entry: ComposeAssetEntry) => {
    const store = componentWorkspace.store
    if (!store || entry.kind !== 'file' || !entry.assetKey) return
    const fromCatalog = componentCatalog?.components.find(
      (item) => item.assetKey === entry.assetKey,
    )
    if (fromCatalog) {
      await openComponentDocument(fromCatalog)
      return
    }
    try {
      const source = await store.readComponent(entry.assetKey)
      const displayName = entry.name.endsWith('.component.json')
        ? entry.name.slice(0, -'.component.json'.length)
        : entry.name
      await openComponentDocument({
        entryId: source.entryId || entry.id,
        assetKey: entry.assetKey,
        displayName: source.asset.name || displayName,
        componentId: source.asset.componentId,
        kind: source.asset.kind,
        revision: source.revision,
        reference: store.createReference(entry.assetKey),
      })
    }
    catch (error) {
      setComponentNotice(error instanceof Error ? error.message : String(error))
    }
  }, [componentCatalog, componentWorkspace.store, openComponentDocument])

  const handleAssetOpen = useCallback((entry: ComposeAssetEntry) => {
    assets?.browser?.onAssetOpen?.(entry)
    // 组件/变体：双击打开组件画布，不是 Monaco JSON。
    if (
      componentWorkspace.store
      && entry.kind === 'file'
      && isComposeComponentMediaType(entry.mediaType)
    ) {
      void openComponentFromAssetEntry(entry)
      return
    }
    // 页面文件走页面标签；其余文件仍走既有的资源文档标签。
    if (pages !== undefined && entry.kind === 'file' && isComposePageMediaType(entry.mediaType)) {
      void openPageDocument(entry)
      return
    }
    openAssetDocument(entry, {
      setupScript: pages !== undefined && isComposePageSetupScriptName(entry.name),
    })
  }, [
    assets?.browser,
    componentWorkspace.store,
    openAssetDocument,
    openComponentFromAssetEntry,
    openPageDocument,
    pages,
  ])
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
  const handleOpenPageJson = useCallback((entry: ComposeAssetEntry) => {
    openAssetDocument(entry, { readOnly: true })
  }, [openAssetDocument])
  /** 资源右键「查看 JSON」：组件/变体只读打开原始文件。 */
  const handleOpenComponentJson = useCallback((entry: ComposeAssetEntry) => {
    openAssetDocument(entry, { readOnly: true })
  }, [openAssetDocument])
  const handleOpenPageSetup = useCallback((entry: ComposeAssetEntry) => {
    openAssetDocument(entry, { setupScript: true })
  }, [openAssetDocument])
  const handlePageSetupChanged = useCallback((
    pageKey: string,
    reference: ComposePageSetupReference | null,
  ) => pageWorkspace.setPageSetupScript(pageKey, reference), [pageWorkspace])
  const handlePageSetupReload = useCallback((pageKey: string) =>
    pageWorkspace.reloadPageSetupScript(pageKey), [pageWorkspace])
  const handlePageCreated = useCallback((descriptor: ComposePageDescriptor) => {
    void openPageDocument({
      id: descriptor.entryId,
      parentId: descriptor.parentId,
      name: descriptor.fileName,
      kind: 'file',
      assetKey: descriptor.pageKey,
      revision: descriptor.revision,
    })
  }, [openPageDocument])
  // eslint-disable-next-line react-hooks/refs -- onPageCreated 只在用户选中菜单项后触发，编译器无法区分「渲染期读 ref」与「把读 ref 的回调传下去」。
  const pageContextMenuItems = useMemo(() => createPageContextMenuItems({
    homePageKey,
    messages: editorMessages,
    onHomePageChange: handleHomePageChange,
    onOpenPageJson: handleOpenPageJson,
    onOpenPageSetup: handleOpenPageSetup,
    onPageCreated: handlePageCreated,
    onPageSetupChanged: handlePageSetupChanged,
    onPageSetupError: setPageNotice,
    provider: pageProvider,
    store: pageStore,
  }), [
    editorMessages,
    handleHomePageChange,
    handleOpenPageJson,
    handleOpenPageSetup,
    handlePageCreated,
    handlePageSetupChanged,
    homePageKey,
    pageProvider,
    pageStore,
  ])

  /**
   * 页面 / 项目组件 / 变体可拖入 Canvas。
   *
   * @remarks
   * 写出稳定引用载荷后，Stage 按 mediaType 落点：页面 → Page Slot，组件 → 实例。
   */
  const canDragEntryToCanvasDefault = useCallback(
    (entry: ComposeAssetEntry) => {
      if (entry.kind !== 'file' || !entry.assetKey) return false
      if (pages !== undefined && isComposePageMediaType(entry.mediaType)) return true
      if (componentWorkspace.store && isComposeComponentMediaType(entry.mediaType)) return true
      return false
    },
    [componentWorkspace.store, pages],
  )

  /**
   * 页面条目图标；资源浏览器不认识页面，图标由这里按媒体类型提供。
   */
  const renderEntryIcon = useCallback((context: ComposeAssetEntryRenderContext) => {
    if (pages !== undefined && isComposePageMediaType(context.entry.mediaType)) {
      return <PageEntryIcon label={editorMessages.pages.pageEntry} surface={context.surface} />
    }
    if (componentWorkspace.store && isComposeComponentMediaType(context.entry.mediaType)) {
      const kind = componentKindByAssetKey.get(context.entry.assetKey ?? '') ?? 'base'
      const label = kind === 'variant' ? '组件变体' : '项目组件'
      return (
        <span
          aria-label={label}
          className={`compose-editor__component-entry-icon compose-editor__component-entry-icon--${context.surface}`}
          role="img"
          title={label}
        >
          <ComposeComponentAssetIcon kind={kind} />
        </span>
      )
    }
    return null
  }, [componentKindByAssetKey, componentWorkspace.store, editorMessages.pages.pageEntry, pages])

  /**
   * 页面条目显示名。
   *
   * @remarks
   * `.page.json` 是存储侧的命名约定，不该出现在界面上；条目的 title 与可读名仍用原始名称。
   */
  const renderEntryLabel = useCallback((context: ComposeAssetEntryRenderContext) => {
    if (pages === undefined || !isComposePageMediaType(context.entry.mediaType)) return null
    return composePageDisplayName(context.entry.name)
  }, [pages])

  /**
   * 页面重命名的名称转换。
   *
   * @remarks
   * 输入框里只出现显示名；提交时按页面命名约定还原存储名，因此用户无需（也不该）手写
   * `.page.json`。非页面条目保持原样。
   */
  const entryNaming = useMemo<ComposeAssetEntryNaming>(() => ({
    toEditableName: (entry) => pages !== undefined && isComposePageMediaType(entry.mediaType)
      ? composePageDisplayName(entry.name)
      : entry.name,
    toStoredName: (entry, editableName) =>
      pages !== undefined && isComposePageMediaType(entry.mediaType)
        ? composePageFileName(editableName)
        : editableName,
  }), [pages])

  /** 首页标记；资源浏览器不认识页面，标记内容由这里提供。 */
  const renderEntryBadge = useCallback((context: ComposeAssetEntryRenderContext) => {
    if (homePageKey === null || context.entry.assetKey !== homePageKey) return null
    return <HomePageBadge label={editorMessages.pages.homePageBadge} />
  }, [editorMessages.pages.homePageBadge, homePageKey])

  const componentContextMenuItems = useMemo(() => {
    if (!componentWorkspace.store) return []
    return [{
      id: 'compose-component-view-json',
      label: editorMessages.components.viewJson,
      isVisible: (context: { entry?: ComposeAssetEntry }) => (
        context.entry !== undefined
        && isComposeComponentMediaType(context.entry.mediaType)
      ),
      isDisabled: (context: { entry?: ComposeAssetEntry }) => (
        context.entry?.assetKey === undefined
      ),
      onSelect: (context: { entry?: ComposeAssetEntry }) => {
        if (context.entry) handleOpenComponentJson(context.entry)
      },
    }]
  }, [componentWorkspace.store, editorMessages.components.viewJson, handleOpenComponentJson])

  const hostContextMenuItems = useMemo(() => {
    const hostItems = assets?.browser?.contextMenuItems ?? []
    return [...hostItems, ...pageContextMenuItems, ...componentContextMenuItems]
  }, [
    assets?.browser?.contextMenuItems,
    componentContextMenuItems,
    pageContextMenuItems,
  ])

  // 页面面板自身没有保存入口：保存由这里按面板 ID 注册，交给页面 Store 写入。
  useEffect(() => {
    pageSessions.forEach((session) => {
      if (session.save !== null) return
      registerDocumentSave(session.panelId, () => savePageDocument(session.panelId))
    })
  }, [pageSessions, registerDocumentSave, savePageDocument])

  useEffect(() => {
    componentSessions.forEach((session) => {
      if (session.save !== null) return
      registerDocumentSave(session.panelId, () => saveComponentDocument(session.panelId))
    })
  }, [componentSessions, registerDocumentSave, saveComponentDocument])

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

  const pageScriptInspector = useMemo(() => {
    if (!activePageSession || !pageProvider) return undefined
    return (
      <PageScriptScopePanel
        key={`${pageProvider.id}:${activePageSession.pageKey}`}
        onError={setPageNotice}
        onOpen={handleOpenPageSetup}
        onReload={() => handlePageSetupReload(activePageSession.pageKey)}
        onSetupChange={(reference) => handlePageSetupChanged(
          activePageSession.pageKey,
          reference,
        )}
        pageName={activePageSession.displayName}
        pageParentId={activePageSession.entry.parentId ?? pageProvider.root.id}
        provider={pageProvider}
        reference={activePageSession.page.setupScript}
        scope={activePageSession.scriptScope}
      />
    )
  }, [
    activePageSession,
    handleOpenPageSetup,
    handlePageSetupReload,
    handlePageSetupChanged,
    pageProvider,
  ])

  const handleVariantOverridesChange = useCallback((change: ComposeVariantOverridesChange) => {
    const panelId = activeDocumentPanelId
    if (!panelId) return
    updateComponentDocument(panelId, (session) => {
      session.runtime.reset(change.resolved.snapshot.document, session.displayName)
      return {
        ...session,
        asset: change.source.asset,
        snapshot: change.resolved.snapshot,
        baseRevision: change.source.revision,
        savedRevisionId: session.runtime.revision,
        dirty: false,
      }
    })
  }, [activeDocumentPanelId, updateComponentDocument])

  const updateInstanceOverrides = useCallback((overrides: ComposeComponentInstanceOverrides) => {
    if (!controller || !selectedComponentInstance) return
    const renderer = selectedComponentInstance.components.Renderer
    if (!renderer) return
    controller.dispatch({
      id: typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `instance-override-${Date.now()}`,
      type: BUILTIN_COMMAND_TYPES.setRendererProps,
      payload: {
        entityId: selectedComponentInstance.id,
        props: {
          ...rendererPropsObject(renderer.props),
          instanceOverrides: overrides,
        } as unknown as JsonObject,
      },
      meta: {
        label: `Update ${selectedComponentInstance.name} property overrides`,
        source: 'inspector',
        targetIds: [selectedComponentInstance.id],
        mergeKey: `instance:${selectedComponentInstance.id}:property-overrides`,
      },
    })
  }, [controller, selectedComponentInstance])

  const applyInstanceOverrides = useCallback(async (operationIds?: readonly string[]) => {
    const store = componentWorkspace.store
    if (!controller || !store || !selectedComponentInstance) return
    // 必须用文档最新实体：闭包中的 selectedComponentInstance 可能落后于刚写入的覆盖。
    const entity = controller.document.entities[selectedComponentInstance.id]
      ?? selectedComponentInstance
    const facts = readComposeComponentInstance(entity)
    if (!facts) {
      setComponentNotice('当前选择不是有效的组件实例')
      return
    }
    if (facts.overrides.operations.length === 0) {
      setComponentNotice('没有可写回的本层覆盖；请先修改实例属性')
      return
    }
    try {
      const result = await applyComposeInstanceOverrides({
        store,
        entity,
        operationIds,
      })
      const renderer = entity.components.Renderer
      if (!renderer) return
      const parentKind = result.source.asset.kind === 'base' ? '主组件' : '变体'
      // 全量写回时强制清空本层；部分写回用 remaining。避免残留「已在源中」的冗余 op。
      const remainingOverrides = operationIds && operationIds.length > 0
        ? result.remainingOverrides
        : { operations: [] as const }
      const dispatched = controller.dispatch({
        id: typeof globalThis.crypto?.randomUUID === 'function'
          ? globalThis.crypto.randomUUID()
          : `instance-apply-${Date.now()}`,
        type: BUILTIN_COMMAND_TYPES.setRendererProps,
        payload: {
          entityId: entity.id,
          props: {
            ...rendererPropsObject(renderer.props),
            reference: facts.reference,
            resolvedSnapshot: result.snapshot,
            instanceOverrides: remainingOverrides,
          } as unknown as JsonObject,
        },
        meta: {
          label: `写回${parentKind}：${entity.name}`,
          source: 'inspector',
          targetIds: [entity.id],
        },
      })
      if (dispatched.status !== 'committed' && dispatched.status !== 'noop') {
        setComponentNotice(
          `${parentKind}已保存，但本页实例快照未更新；请点检查更新或重试写回`,
        )
        return
      }
      // 其它实例跟随新源；当前实例已写好 remaining，不得被 auto-sync 用旧 ops 盖回。
      syncInstancesAfterComponentSave(result.source.assetKey, result.snapshot, {
        excludeEntityIds: [entity.id],
      })
      setComponentNotice(
        operationIds && operationIds.length > 0
          ? `已写回${parentKind}（部分覆盖）`
          : `已写回${parentKind}`,
      )
    }
    catch (error) {
      setComponentNotice(error instanceof Error ? error.message : String(error))
    }
  }, [
    componentWorkspace.store,
    controller,
    selectedComponentInstance,
    syncInstancesAfterComponentSave,
  ])

  const updateComponentInstance = useCallback(async (discardConflicts?: boolean) => {
    const store = componentWorkspace.store
    if (!controller || !store || !selectedComponentInstance) {
      throw new Error('组件实例更新不可用')
    }
    const result = await updateComposeComponentInstanceFromSource({
      store,
      entity: selectedComponentInstance,
      discardConflicts,
    })
    if (result.status === 'conflict') return result
    const renderer = selectedComponentInstance.components.Renderer
    if (!renderer) throw new Error('组件实例缺少 Renderer')
    const dispatched = controller.dispatch({
      id: typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `instance-update-${Date.now()}`,
      type: BUILTIN_COMMAND_TYPES.setRendererProps,
      payload: {
        entityId: selectedComponentInstance.id,
        props: {
          ...rendererPropsObject(renderer.props),
          resolvedSnapshot: result.snapshot,
          // 更新结果已含结构分区：兼容的结构操作保留、失效的按用户确认丢弃。
          instanceOverrides: result.overrides,
        } as unknown as JsonObject,
      },
      meta: {
        label: `Update ${selectedComponentInstance.name} from component source`,
        source: 'inspector',
        targetIds: [selectedComponentInstance.id],
      },
    })
    if (dispatched.status !== 'committed') throw new Error('实例更新事务未提交')
    return result
  }, [componentWorkspace.store, controller, selectedComponentInstance])

  const createVariantFromSelectedInstance = useCallback(() => {
    if (!selectedComponentInstance) return
    setVariantName(`${selectedComponentInstance.name} Variant`)
    setPendingVariantParent(null)
    setPendingVariantInstance(selectedComponentInstance)
  }, [selectedComponentInstance])
  const applySelectedInstanceOverrides = useCallback((propertyIds?: readonly string[]) => {
    void applyInstanceOverrides(propertyIds)
  }, [applyInstanceOverrides])

  const resolvedInspectorPanel = useMemo(() => {
    const authoredInspector = slots?.inspector !== undefined
      ? slots.inspector
      : addDefaultElementProps(controller?.inspectorPanel, { pageScriptInspector })
    const entityInspector = authoredInspector === undefined
      ? undefined
      : providePaintImageLibrary(authoredInspector, resolvedPaintImageLibrary)
    if (
      activeComponentSession?.sourceKind === 'variant'
      && componentWorkspace.store
    ) {
      return (
        <div className="compose-editor__component-inspector">
          {entityInspector}
          <ComposeVariantOverridesPanel
            assetKey={activeComponentSession.assetKey}
            store={componentWorkspace.store}
            onChange={handleVariantOverridesChange}
          />
        </div>
      )
    }
    if (activeComponentSession?.sourceKind === 'base' && activeComponentSession.asset.kind === 'base') {
      return entityInspector
    }
    if (!activeComponentSession && selectedComponentInstance && componentWorkspace.store) {
      // 实例操作并入 EntityInspector 标题行；覆盖列表仅在有本层操作时出现在标题下。
      const authoredBase = slots?.inspector !== undefined
        ? slots.inspector
        : addDefaultElementProps(controller?.inspectorPanel, { pageScriptInspector })
      return (
        <ComposeComponentInstanceOverridesPanel
          entity={selectedComponentInstance}
          layout="inspector"
          onApply={applySelectedInstanceOverrides}
          onChange={updateInstanceOverrides}
          onCreateVariant={createVariantFromSelectedInstance}
          onUpdate={updateComponentInstance}
        >
          {({ leading, subtitle, trailing, statusSlot, banner }) => providePaintImageLibrary(
            addDefaultElementProps(authoredBase, {
              headerLeading: leading,
              headerSubtitle: subtitle,
              headerTrailing: trailing,
              statusSlot,
              banner,
            }),
            resolvedPaintImageLibrary,
          )}
        </ComposeComponentInstanceOverridesPanel>
      )
    }
    return entityInspector
  }, [
    controller?.inspectorPanel,
    activeComponentSession,
    applySelectedInstanceOverrides,
    componentWorkspace.store,
    createVariantFromSelectedInstance,
    handleVariantOverridesChange,
    pageScriptInspector,
    resolvedPaintImageLibrary,
    slots,
    selectedComponentInstance,
    updateComponentInstance,
    updateInstanceOverrides,
  ])

  const resolvedComponentLibraryPanel = slots?.componentLibrary !== undefined
    ? slots.componentLibrary
    : !controller
      ? undefined
      : !componentWorkspace.store
        ? controller.componentLibraryPanel
        : (
      <ComposeComponentLibraryPanel
        registry={controller.registry}
        store={componentWorkspace.store}
        onOpenIntent={openComponentDocument}
        onCreateVariantIntent={(descriptor) => {
          setVariantName(`${descriptor.displayName} Variant`)
          setPendingVariantInstance(null)
          setPendingVariantParent(descriptor)
        }}
        onCreateIntent={(item) => {
          controller.interactionController.send({
            type: 'external.add',
            item: createComponentLibraryStageItem(item),
          })
        }}
        onItemDragStart={({ item, clientPoint }) => {
          controller.interactionController.send({
            type: 'external.begin',
            item: createComponentLibraryStageItem(item),
            clientPoint,
          })
        }}
        onItemDragMove={({ clientPoint }) => {
          controller.interactionController.send({ type: 'external.move', clientPoint })
        }}
        onItemDragEnd={({ clientPoint }) => {
          controller.interactionController.send({ type: 'external.end', clientPoint })
        }}
        onItemDragCancel={() => {
          controller.interactionController.send({ type: 'external.cancel' })
        }}
      />
          )
  const handlePanelDocumentClose = useCallback((panelId: string) => {
    void requestDocumentClose(panelId)
  }, [requestDocumentClose])
  const handlePanelDocumentSave = useCallback((panelId: string) => {
    void documentsRef.current.get(panelId)?.save?.()
  }, [])
  const setSettingsButton = useCallback((element: HTMLButtonElement | null) => {
    settingsButtonRef.current = element
  }, [])

  const content = {
      sceneGraphPanel: slots?.sceneGraph !== undefined
        ? slots.sceneGraph
        : (
            <ComposeSceneTree
              {...(sceneTree ?? controller?.sceneTreeProps ?? emptySceneTreeProps)}
            />
          ),
      componentLibraryPanel: resolvedComponentLibraryPanel,
      history: resolvedHistory,
      historyPanel: slots?.history,
      historyShortcuts: {
        undo: resolvedPreferences.shortcuts['history.undo'],
        redo: resolvedPreferences.shortcuts['history.redo'],
      },
      stageToolbar: slots?.stageToolbar !== undefined
        ? slots.stageToolbar
        : addDefaultElementProps(controller?.stageToolbar, {
            shortcuts: resolvedPreferences.shortcuts,
          }),
      children: slots?.stage !== undefined
        ? slots.stage
        : addDefaultElementProps(controller?.stage ?? 'Compose Editor', {
          assetResolver: resolvedAssetResolver,
          onToolChange: controller?.setTool,
          scriptModuleLoader: pages?.scriptModuleLoader,
          scriptScope: activePageSession?.scriptScope,
          shortcuts: resolvedPreferences.shortcuts,
        }),
      inspectorPanel: resolvedInspectorPanel,
      transactionLogPanel: slots?.transactionLog,
      commandPanel: slots?.command !== undefined
        ? slots.command
        : addDefaultElementProps(controller?.commandPanel, {
            onOpenSettings: toggleSettings,
            shortcuts: resolvedPreferences.shortcuts,
          }),
      assetBrowserPanel: slots?.assetBrowser !== undefined
        ? slots.assetBrowser
        : (() => {
            const browser = assets?.browser
            if (!browser) return undefined
            return (
              <ComposeAssetBrowser
                {...browser}
                externalDrop={browser.externalDrop ?? sceneExternalDrop}
                canDragEntryToCanvas={(entry) => (
                  browser.canDragEntryToCanvas?.(entry)
                  ?? canDragEntryToCanvasDefault(entry)
                )}
                contextMenuItems={hostContextMenuItems}
                entryNaming={browser.entryNaming ?? entryNaming}
                renderEntryBadge={browser.renderEntryBadge ?? renderEntryBadge}
                renderEntryIcon={browser.renderEntryIcon ?? renderEntryIcon}
                renderEntryLabel={browser.renderEntryLabel ?? renderEntryLabel}
                onAssetOpen={handleAssetOpen}
                onBeforeAssetMutation={handleDefaultAssetMutation}
                onCanvasDrag={handleAssetCanvasDrag}
              />
            )
          })(),
      animationPanelActive,
      documents,
      stageHostPanelId,
      registerDocumentSave,
      setDocumentDirty,
      setAssetDocumentSaved,
      requestDocumentClose: handlePanelDocumentClose,
      saveDocument: handlePanelDocumentSave,
      settingsOpen,
      settingsPanelId,
      setSettingsButton,
      toggleSettings,
    }
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
      { includeCanvas: pages === undefined && components === undefined },
    )
    initializedApi.current = event.api
    setWorkspaceReady(true)
    // 活动页面由中央 Canvas Group 内的活动面板决定。Dockview 的活动面板是全局的：点击
    // 组件库、资源面板等其他组的面板同样会触发该事件，若据此推导 Stage 宿主，页面标签会
    // 立刻失去宿主身份而让画布整体消失。因此只接受画布组内的面板 ID。
    event.api.onDidActivePanelChange?.((change) => {
      const panelId = change.panel?.id
      if (panelId === undefined) return
      if (panelId === WORKSPACE_PANEL_IDS.animation) {
        setAnimationPanelActive(true)
      }
      else if (
        panelId === WORKSPACE_PANEL_IDS.assetBrowser
        || panelId === WORKSPACE_PANEL_IDS.command
        || panelId === WORKSPACE_PANEL_IDS.transactionLog
      ) {
        setAnimationPanelActive(false)
      }
      if (
        !isWorkspaceDocumentPanelId(panelId)
        && !(pages === undefined && panelId === WORKSPACE_PANEL_IDS.canvas)
      ) return
      setActiveDocumentPanelId(panelId)
    })
  }, [components, hostI18n?.formatMessage, pages, resolvedPreferences.locale])

  const confirmCreateComponent = useCallback(async () => {
    if (!controller || !pendingCreateComponent || createComponentName.trim() === '') return
    setCreatingComponent(true)
    const result = await controller.createComponentFromSelection({
      name: createComponentName.trim(),
      entityIds: pendingCreateComponent.entityIds,
    })
    setCreatingComponent(false)
    if (result.status === 'committed') {
      setPendingCreateComponent(null)
      setCreateComponentError(null)
      setComponentNotice(null)
      return
    }
    if (result.status === 'saved-not-instantiated') {
      setPendingCreateComponent(null)
      setCreateComponentError(null)
      setComponentNotice(`资源已保存但未实例化：${result.reason}`)
      return
    }
    // 失败保持对话框打开：错误几乎总是可以靠改名重试解决，关闭对话框会丢掉用户已输入的名称。
    // 通知条位于编辑器角落且被模态遮罩压暗，单靠它无法让用户察觉失败。
    const reason = result.status === 'unavailable'
      ? result.reason
      : describeCreateComponentError(result.error)
    setCreateComponentError(reason)
    setComponentNotice(reason)
  }, [controller, createComponentName, pendingCreateComponent])

  const confirmCreateVariant = useCallback(async () => {
    const store = componentWorkspace.store
    if (!store || (!pendingVariantParent && !pendingVariantInstance) || variantName.trim() === '') return
    setCreatingVariant(true)
    try {
      const componentId = typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `variant-${Date.now()}`
      let asset
      if (pendingVariantInstance) {
        asset = createComposeVariantAssetFromInstance({
          entity: pendingVariantInstance,
          componentId,
          name: variantName.trim(),
        })
      }
      else {
        const parentDescriptor = pendingVariantParent!
        const parent = await store.resolveComponent(parentDescriptor.reference)
        if (parent.status === 'invalid') {
          throw new Error(parent.issues.map(({ message }) => message).join('；'))
        }
        asset = createComposeVariantAsset({
          componentId,
          name: variantName.trim(),
          parentRef: parentDescriptor.reference,
          parentSnapshot: parent.snapshot,
        })
      }
      const created = await store.createComponent({
        parentId: null,
        fileName: variantName.trim(),
        asset,
      })
      const reference = store.createReference(created.assetKey)
      const descriptor: ComposeComponentDescriptor = {
        entryId: created.entryId,
        assetKey: created.assetKey,
        displayName: created.asset.name,
        componentId: created.asset.componentId,
        kind: created.asset.kind,
        revision: created.revision,
        reference,
      }
      // 对齐 Unity：从实例创建变体后，场景物体默认改绑为新变体的实例，覆盖已固化进变体。
      if (pendingVariantInstance && controller) {
        const host = controller.document.entities[pendingVariantInstance.id]
          ?? pendingVariantInstance
        const renderer = host.components.Renderer
        if (renderer?.type === 'component-instance') {
          const resolved = await store.resolveComponent(reference)
          if (resolved.status !== 'invalid') {
            const dispatched = controller.dispatch({
              id: typeof globalThis.crypto?.randomUUID === 'function'
                ? globalThis.crypto.randomUUID()
                : `variant-rebind-${Date.now()}`,
              type: BUILTIN_COMMAND_TYPES.setRendererProps,
              payload: {
                entityId: host.id,
                props: {
                  ...rendererPropsObject(renderer.props),
                  reference,
                  resolvedSnapshot: resolved.snapshot,
                  instanceOverrides: { operations: [] },
                } as unknown as JsonObject,
              },
              meta: {
                label: `Bind ${host.name} to variant ${variantName.trim()}`,
                source: 'inspector',
                targetIds: [host.id],
              },
            })
            if (dispatched.status !== 'committed') {
              setComponentNotice('变体已创建，但本页实例未改绑；可从组件库再次拖入')
            }
            else {
              setComponentNotice(`已创建变体并改绑本实例：${variantName.trim()}`)
            }
          }
        }
      }
      setPendingVariantParent(null)
      setPendingVariantInstance(null)
      await openComponentDocument(descriptor)
    }
    catch (error) {
      setComponentNotice(error instanceof Error ? error.message : String(error))
    }
    finally {
      setCreatingVariant(false)
    }
  }, [
    componentWorkspace.store,
    controller,
    openComponentDocument,
    pendingVariantInstance,
    pendingVariantParent,
    variantName,
  ])

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
  const pendingComponentConflictSession = pendingComponentConflict
    ? componentSessions.get(pendingComponentConflict)
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
          // 页面与组件标签没有 Monaco 那样的内建保存入口；这里提供编辑器范围的保存快捷键。
          if (
            !event.defaultPrevented
            && activeWorkspaceSession !== undefined
            && activeWorkspaceSession.kind !== 'asset'
            && !event.nativeEvent.isComposing
            && !isEditableKeyboardTarget(event.target)
            && (event.metaKey || event.ctrlKey)
            && event.key.toLowerCase() === 's'
          ) {
            event.preventDefault()
            void activeWorkspaceSession.save?.()
            return
          }
          if (resolvedHistory && !event.defaultPrevented) handleHistoryShortcut(event)
        }}
      >
        <ComposeAnimationPanelProvider>
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
          {pendingCreateComponent ? (
            <ComposeDialog
              open
              onOpenChange={(open) => {
                if (!open && !creatingComponent) setPendingCreateComponent(null)
              }}
            >
              <ComposeDialogPortal>
                <ComposeDialogBackdrop />
                <ComposeDialogViewport>
                  <ComposeDialogContent>
                    <ComposeDialogHeader>
                      <ComposeDialogTitle>创建组件</ComposeDialogTitle>
                      <ComposeDialogDescription>
                        将选择保存为项目组件，并在资源写入成功后替换为关联实例。
                      </ComposeDialogDescription>
                    </ComposeDialogHeader>
                    <ComposeInput
                      aria-label="组件名称"
                      autoFocus
                      disabled={creatingComponent}
                      value={createComponentName}
                      onChange={(event) => {
                        setCreateComponentName(event.currentTarget.value)
                        setCreateComponentError(null)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void confirmCreateComponent()
                      }}
                    />
                    {createComponentError === null ? null : (
                      <p className="compose-editor__dialog-error" role="alert">
                        {createComponentError}
                      </p>
                    )}
                    <ComposeDialogFooter>
                      <ComposeButton
                        type="button"
                        variant="outline"
                        disabled={creatingComponent}
                        onClick={() => {
                          setPendingCreateComponent(null)
                          setCreateComponentError(null)
                        }}
                      >
                        {editorMessages.canvasSettings.cancel}
                      </ComposeButton>
                      <ComposeButton
                        type="button"
                        disabled={creatingComponent || createComponentName.trim() === ''}
                        onClick={() => void confirmCreateComponent()}
                      >
                        {creatingComponent ? '正在创建…' : '创建'}
                      </ComposeButton>
                    </ComposeDialogFooter>
                  </ComposeDialogContent>
                </ComposeDialogViewport>
              </ComposeDialogPortal>
            </ComposeDialog>
          ) : null}
          {pendingVariantParent || pendingVariantInstance ? (
            <ComposeDialog
              open
              onOpenChange={(open) => {
                if (!open && !creatingVariant) {
                  setPendingVariantParent(null)
                  setPendingVariantInstance(null)
                }
              }}
            >
              <ComposeDialogPortal>
                <ComposeDialogBackdrop />
                <ComposeDialogViewport>
                  <ComposeDialogContent>
                    <ComposeDialogHeader>
                      <ComposeDialogTitle>创建变体</ComposeDialogTitle>
                      <ComposeDialogDescription>
                        {pendingVariantInstance
                          ? `将从当前实例创建变体（基于“${pendingVariantInstance.name}”的引用与本层覆盖）。创建后本实例会改绑到新变体，覆盖固化进变体。`
                          : `新变体将直接继承“${pendingVariantParent?.displayName}”，之后只保存相对父源的当前层覆盖。`}
                      </ComposeDialogDescription>
                    </ComposeDialogHeader>
                    <ComposeInput
                      aria-label="变体名称"
                      autoFocus
                      disabled={creatingVariant}
                      value={variantName}
                      onChange={(event) => setVariantName(event.currentTarget.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void confirmCreateVariant()
                      }}
                    />
                    <ComposeDialogFooter>
                      <ComposeButton
                        type="button"
                        variant="outline"
                        disabled={creatingVariant}
                        onClick={() => {
                          setPendingVariantParent(null)
                          setPendingVariantInstance(null)
                        }}
                      >
                        {editorMessages.canvasSettings.cancel}
                      </ComposeButton>
                      <ComposeButton
                        type="button"
                        disabled={creatingVariant || variantName.trim() === ''}
                        onClick={() => void confirmCreateVariant()}
                      >
                        {creatingVariant ? '正在创建…' : '创建变体'}
                      </ComposeButton>
                    </ComposeDialogFooter>
                  </ComposeDialogContent>
                </ComposeDialogViewport>
              </ComposeDialogPortal>
            </ComposeDialog>
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
                          : pendingAssetDocument.kind === 'component'
                            ? `未保存的${pendingAssetDocument.sourceKind === 'variant' ? '变体' : '组件'}`
                            : editorMessages.unsavedAssetTitle}
                      </ComposeDialogTitle>
                      <ComposeDialogDescription>
                        {editorMessages.unsavedAssetQuestion(
                          pendingAssetDocument.kind === 'page'
                            ? pendingAssetDocument.displayName
                            : pendingAssetDocument.kind === 'component'
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
          {pendingComponentConflictSession ? (
            <ComposeDialog
              open
              onOpenChange={(open) => {
                if (!open) setPendingComponentConflict(null)
              }}
            >
              <ComposeDialogPortal>
                <ComposeDialogBackdrop />
                <ComposeDialogViewport>
                  <ComposeDialogContent>
                    <ComposeDialogHeader>
                      <ComposeDialogTitle>组件源已在外部更新</ComposeDialogTitle>
                      <ComposeDialogDescription>
                        {`“${pendingComponentConflictSession.displayName}”的 revision 已变化。覆盖会丢弃外部版本。`}
                      </ComposeDialogDescription>
                    </ComposeDialogHeader>
                    <ComposeDialogFooter>
                      <ComposeButton
                        type="button"
                        variant="outline"
                        onClick={() => setPendingComponentConflict(null)}
                      >
                        {editorMessages.canvasSettings.cancel}
                      </ComposeButton>
                      <ComposeButton
                        type="button"
                        variant="destructive"
                        onClick={() => {
                          const panelId = pendingComponentConflictSession.panelId
                          setPendingComponentConflict(null)
                          void saveComponentDocument(panelId, true)
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
          {pageNotice === null && componentNotice === null && homePageMissingNotice === null ? null : (
            <div className="compose-editor__page-notice" role="status">
              <span>{pageNotice ?? componentNotice ?? homePageMissingNotice}</span>
              {pageNotice === null && componentNotice === null ? null : (
                <ComposeButton
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setPageNotice(null)
                    setComponentNotice(null)
                  }}
                >
                  {editorMessages.close}
                </ComposeButton>
              )}
            </div>
          )}
        </WorkspaceContentContext.Provider>
        </ComposeAnimationPanelProvider>
      </EditorRoot>
      </ComposeColorHistoryProvider>
    </ComposeUIProvider>
  )
}
