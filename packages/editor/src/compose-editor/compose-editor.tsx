/**
 * 提供可嵌入 React 宿主的 Compose UI 编辑器工作区。
 *
 * @packageDocumentation
 */
import {
  COMPOSE_UI_CORE_PACKAGE,
  BUILTIN_COMMAND_TYPES,
  composePageDisplayName,
  getComposeAnimations,
  getComposeHierarchy,
  composePageFileName,
  isComposeFrameEntity,
  isComposeComponentMediaType,
  isComposePageMediaType,
  type ComposeComponentInstanceOverrides,
} from '@compose-ui/core'
import { ComposeAssetBrowser } from '@compose-ui/asset-browser'
import { ComposeAnimationPanelProvider } from '@compose-ui/animation-panel'
import type { ComposeAnimationPanelAction, ComposeAnimationPanelValue } from '@compose-ui/animation-panel'
import {
  COMPOSE_ANIMATION_COMMAND_TYPES,
  createComposeAnimationCommandHandlers,
  getComposeAnimationFileFrame,
} from '@compose-ui/animation'
import { AnimationInspector } from '../animation-mode/animation-inspector'
import { createPageAnimationFile } from '../animation-mode/animation-asset-store'
import { createDwgContextMenuItems, isDwgAssetName } from '../dwg'
import { createDxfContextMenuItems, createDxfImportAction, isDxfAssetName } from '../dxf'
import { createSvgContextMenuItems } from '../svg'
import { PageAnimationScopePanel } from '../animation-mode/page-animation-scope-panel'
import type { PageAnimationSceneBinding } from '../animation-mode/page-animation-scope-panel'
import { rewriteAutoRecordCommand } from '../animation-mode/auto-record'
import { useAnimationLayout } from '../animation-mode/use-animation-layout'
import { useAnimationMode } from '../animation-mode/use-animation-mode'
import { useMotionPath } from '../animation-mode/use-motion-path'
import { createAnimationFieldAdornment } from '../animation-mode/animation-field-adornment'
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
import { resolveTargetFrameId } from '@compose-ui/stage-engine'

/** 解析动画作用域时不看选区：内联 `[]` 每次渲染都是新引用，会破坏 memo。 */
const NO_SELECTION: readonly string[] = []

/** 新建动画的默认时长；与 `createComposeAnimationFile` 的缺省保持一致。 */
const DEFAULT_ANIMATION_DURATION_MS = 300
import type { ComposePageAnimationReference, ComposePageSetupReference } from '@compose-ui/core'
import type { ComposeEntity, ComposeResolvedComponentSnapshot, EditorCommand, JsonObject } from '@compose-ui/core'
import { ComposeAssetError, createComposeAssetResolver } from '@compose-ui/assets'
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
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { DockviewReadyEvent } from 'dockview-react'
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
  ComposeAssetOpenContext,
} from '@compose-ui/asset-browser'
import type { ComposeAssetResolver } from '@compose-ui/assets'
import {
  COMPOSE_DEFAULT_COMPONENT_SHELF,
  ComposeComponentLibraryPanel,
  ComposeComponentAssetIcon,
  ComposeComponentInstanceOverridesPanel,
  ComposeVariantOverridesPanel,
  applyComposeInstanceOverrides,
  planComposeInstanceAutoSync,
  createComposeVariantAsset,
  createComposeVariantAssetFromInstance,
  readComposeComponentInstance,
  resolveComposeComponentShelfView,
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
  ComposeWorkspaceSeeds,
} from '../workspace-layout'
import {
  COMPOSE_TOOLBAR_SEPARATOR,
  ComposeToolbarShelfContext,
} from '../stage-toolbar/toolbar-shelf'
import type { ComposeToolbarItem } from '../stage-toolbar/toolbar-shelf'
import { COMPOSE_TOOLBAR_ANIMATION_ID } from '../stage-toolbar/toolbar-shelf'
import { StageToolbarIcon } from '../stage-toolbar/stage-toolbar-icons'
import {
  applyWorkspaceInitialSizes,
  COMPOSE_DEFAULT_WORKSPACES,
  DEFAULT_TOOLS_WEIGHT,
  DEFAULT_WORKSPACE_SEEDS,
  createAssetDocumentPanelId,
  createComponentDocumentPanelId,
  createPageDocumentPanelId,
  createWorkspaceHostElements,
  initializeWorkspace,
  localizeWorkspace,
  setWorkspacePaletteTitle,
  setWorkspacePanelTitle,
  syncWorkspaceHistoryPanel,
  useWorkspaceSession,
  useWorkspaceSideCollapse,
  workspaceComponents,
  WorkspaceDialogs,
  EditorTopBar,
  WorkspacePortals,
  WORKSPACE_CARD_GAP,
  WORKSPACE_HEADER_HEIGHT,
  WORKSPACE_PANEL_IDS,
} from '../workspace-layout'
import type {
  ComposeEditorWorkspaceDefinition,
  ComposeWorkspaceSessionPort,
} from '../workspace-layout'
import type { ComposeEditorWorkspaceActions } from '../editor-controller/action-catalog'
import { ComposeLibraryBrowser } from '@compose-ui/library-browser'
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
import { WorkspaceTab } from '../workspace-layout'
import { createComposeEditorCommands } from '../editor-controller/action-catalog'
import type { ComposeEditorController } from '../editor-controller'
import { useComponentCatalog, useComponentEntry, useComponentWorkspace } from '../component-workspace'
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
  /**
   * 工作区列表；省略时是内建的 `COMPOSE_DEFAULT_WORKSPACES`。
   *
   * @remarks
   * 宿主按业务注入自己的工作区（`[...COMPOSE_DEFAULT_WORKSPACES, mine]`）；`id` 重名会在挂载时
   * 抛错而不是静默丢弃。用户「另存为」的工作区不在这里——它们住在偏好里。
   */
  workspaces?: readonly ComposeEditorWorkspaceDefinition[]
  /**
   * 宿主往工具栏目录里补的项；每一项**指向**一个已有动作或命令，自己不携带行为。
   *
   * @remarks
   * 与 `commands` 是同一条注入边界：先把 `MIRROR` 注册成命令，再用这里的一项给它一个按钮。
   * 补进目录不等于上架——还要把它的 id 写进某个工作区的 `toolbar`，否则它只是「可以被排上去」。
   */
  toolbarItems?: readonly ComposeToolbarItem[]
  /**
   * 请求以某个场景为目标打开预览。
   *
   * @remarks
   * 预览对话框由宿主拥有（editor 不依赖 preview），因此激活场景标签上的播放按钮只发出请求。
   * 省略时该按钮不出现。
   */
  onScenePreview?: (frameId: string) => void
}

const workspaceTabComponents = { workspaceTab: WorkspaceTab }
/**
 * Dockview 主题：沿用 abyss 的类名与变量映射，折叠后的底部边缘组高度取面板头高度——底部收起
 * 之后剩下的就是它的标签条，两者不一致会露出一条没有内容的空带。
 */
const workspaceTheme = {
  ...themeAbyss,
  edgeGroupCollapsedSize: WORKSPACE_HEADER_HEIGHT,
  gap: WORKSPACE_CARD_GAP,
}
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

/** 动画命令、关键帧与改写命令共用的 ID factory；无 randomUUID 的环境退化为时间戳。 */
function animationCommandId() {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `animation-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
  workspaces,
  toolbarItems,
  onScenePreview,
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
  /** 唯一的 Dockview 实例；底部工具组的重组与两侧收起都作用在它上面。 */
  const dockviewApiRef = useRef<DockviewReadyEvent['api'] | null>(null)
  /** Dockview 已摆好四区；页面目录先返回时必须等到这里才能打开首页。 */
  const [workspaceReady, setWorkspaceReady] = useState(false)
  /** 各面板内容的稳定宿主元素；每个编辑器实例一套，Dockview 面板只把它们搬进自己的盒子。 */
  const [hosts] = useState(() => createWorkspaceHostElements())
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
  // 动画命令 handler 注册进宿主提供的运行时；卸载或换 runtime 时注销。
  // 宿主若已自行注册同名 handler，跳过重复注册而不是让编辑器挂载崩溃。
  const animationRuntime = controller?.runtime
  useEffect(() => {
    if (!animationRuntime) return
    const disposers: (() => void)[] = []
    for (const handler of createComposeAnimationCommandHandlers()) {
      try {
        disposers.push(animationRuntime.registerHandler(handler))
      }
      catch {
        // 已注册：宿主拥有该命令的实现，编辑器不抢。
      }
    }
    return () => disposers.forEach((dispose) => dispose())
  }, [animationRuntime])

  /** 当前活动的 Dockview 面板 ID；页面工作区据此判定活动页面。 */
  const [activeDocumentPanelId, setActiveDocumentPanelId] = useState<string | null>(null)
  const [documents, setDocuments] = useState<ReadonlyMap<string, ComposeWorkspaceDocumentSession>>(
    () => new Map(),
  )

  /**
   * 动画作用域 Frame。
   *
   * @remarks
   * 每块场景有自己的动画，因此作用域跟随**选中对象所属的那块场景**，没有选择时回退页面的
   * 激活场景——与 `多画板下的 Frame 动作目标` 同一条规则。这也意味着「哪一块会被发布」
   * （`activeFrameId`）与「正在编辑哪一块的动画」可以不同：后者跟手，前者是显式声明。
   *
   * 时间线会话、文件选择器、镜像水合、绑定写入与关键帧 Inspector 必须解析到**同一个**
   * Frame，否则清单落在一块场景、文件引用落在另一块，页面配置面板与时间线各说各话。
   * 这两个 state 与本解析因此被刻意提到 {@link useAnimationMode} 之前：动画会话在缺省
   * `frameId` 时会回退到 `rootIds[0]`。
   */
  const activePageSessionForScope = activeDocumentPanelId
    ? documents.get(activeDocumentPanelId)
    : undefined
  const activePageForScope = activePageSessionForScope?.kind === 'page'
    ? activePageSessionForScope
    : undefined
  const pageActiveFrameId = activePageForScope?.page.activeFrameId ?? null
  const animationScopeDocument = controller?.document
  const animationScopeSelection = controller?.selectedIds ?? NO_SELECTION
  const animationScopeFrameId = useMemo(() => (animationScopeDocument
    ? resolveTargetFrameId(animationScopeDocument, animationScopeSelection, pageActiveFrameId)
    : null),
  [animationScopeDocument, animationScopeSelection, pageActiveFrameId])

  // ref 必须先于 useAnimationMode 初始化：propertyLabel 在同一渲染趟内就会被面板模型 memo 调用。
  const editorMessagesRef = useRef(editorMessages)
  useEffect(() => {
    editorMessagesRef.current = editorMessages
  }, [editorMessages])
  const animationPropertyLabel = useCallback((path: readonly (string | number)[]) => {
    const key = path.map(String).join('.')
    const labels = editorMessagesRef.current.animationMode
    if (key === 'LayoutItem.offset') {
      return { label: labels.propertyPosition, groupLabel: labels.propertyPosition }
    }
    if (key === 'Transform.rotation') return { label: labels.propertyRotation }
    if (key === 'LayoutItem.width.value') return { label: labels.propertyWidth }
    if (key === 'LayoutItem.height.value') return { label: labels.propertyHeight }
    if (key === 'Appearance.opacity') return { label: labels.propertyOpacity }
    if (key === 'Appearance.backgroundPaint.color') {
      return { label: labels.propertyBackgroundColor }
    }
    if (key === 'Renderer.props.strokeDashoffset') {
      return { label: labels.propertyDashOffset }
    }
    return null
  }, [])
  const animationMode = useAnimationMode({
    document: controller?.document,
    dispatch: animationRuntime
      ? (command) => animationRuntime.dispatch(command)
      : undefined,
    frameId: animationScopeFrameId,
    idFactory: animationCommandId,
    propertyLabel: animationPropertyLabel,
  })
  const animationLayout = useAnimationLayout(
    animationMode.displayDocument,
    animationMode.active && animationMode.animationId !== null,
  )
  // 画布必须拿到"同一次求解"的文档 + 快照一致对：Runtime 在 effect 里喂采样文档，
  // 结构变化（新建/删除实体）后的第一次渲染里 displayDocument 已含新实体而快照还没有
  // 它的 box，直接配对会让 stage 的几何索引抛错并卸载整个画布。ready 状态自带它求解
  // 时的 document，用它配对最多滞后一次 commit，且值级采样（拖播放头）同样受益。
  const animationStageDocument = animationLayout.state?.status === 'ready'
    ? animationLayout.state.document
    : animationMode.displayDocument
  const animationStageSnapshot = animationLayout.state?.status === 'ready'
    ? animationLayout.state.snapshot
    : undefined
  // 选中实体的运动路径：单选普通 Entity 才有意义（与菱形注入同一判据）。
  // 宿主可传部分实现的 controller（测试替身），字段逐个防御。
  const motionPathEntityId = controller
    && controller.selectedIds?.length === 1
    && !controller.instanceInnerSelection
    && controller.document?.entities[controller.selectedIds[0]!]
    ? controller.selectedIds[0]!
    : null
  const motionPath = useMotionPath({
    enabled: animationMode.active && animationMode.animationId !== null,
    document: controller?.document,
    // 与画布同源的一致对：路径原点 = 快照 box − 采样 offset，两者必须来自同一次求解。
    displayDocument: animationStageDocument,
    animationId: animationMode.animationId,
    entityId: motionPathEntityId,
    layoutSnapshot: animationStageSnapshot ?? null,
    ...(animationRuntime
      ? { dispatch: (command: EditorCommand) => animationRuntime.dispatch(command) }
      : {}),
    idFactory: animationCommandId,
  })
  // 自动记录：动画模式 + 开关开启时安装 dispatch 改写层，把画布与 Inspector 的属性编辑
  // 改写为播放头处的关键帧命令；关闭或退出模式即卸载，编辑恢复直写基础文档。
  const setCommandRewrite = controller?.setCommandRewrite
  /*
   * 进入动画模式自动打开变换指示器。
   *
   * 只在**跨过那一刻**写一次，不是把它派生成 `animationMode.active`：派生的话用户在动画模式
   * 里就永远关不掉它，而它是视图状态、关掉是正当选择。代价不对称是自动打开的理由——设计模式
   * 下拖错了就是挪了一下、撤销即可；动画模式下一次误拖往时间线里塞一条没打算要的轨道，而
   * 用户得先发现它。
   */
  const animationWasActive = useRef(false)
  useEffect(() => {
    if (animationMode.active && !animationWasActive.current) controller?.setTransformGizmo(true)
    animationWasActive.current = animationMode.active
  }, [animationMode.active, controller])

  /*
   * 十字光标样式是用户偏好，而 Stage 的 props 由宿主创建的 controller 组装，因此同步方向
   * 与变换指示器一致：编辑器往 controller 里写。缺 setter 的测试替身照常跳过。
   */
  const crosshairStyle = resolvedPreferences.crosshairStyle
  useEffect(() => {
    if (typeof controller?.setCrosshairStyle !== 'function') return
    controller.setCrosshairStyle(crosshairStyle)
  }, [controller, crosshairStyle])

  // 坐标轴同族：同样是偏好，同样由编辑器往 controller 里写。
  const showWorldAxes = resolvedPreferences.showWorldAxes
  useEffect(() => {
    if (typeof controller?.setWorldAxes !== 'function') return
    controller.setWorldAxes(showWorldAxes)
  }, [controller, showWorldAxes])

  /*
   * 长度同样是偏好。它曾经住在工作区会话开关里，而三个内建工作区统一之后那一处就成了够不着
   * 的事实来源——界面上没有任何控件能改它。搬到这里之后，切换工作区不再碰它。
   */
  const crosshairSize = resolvedPreferences.crosshairSize
  useEffect(() => {
    if (typeof controller?.setCrosshairSize !== 'function') return
    controller.setCrosshairSize(crosshairSize)
  }, [controller, crosshairSize])

  const autoRecordAnimationId = animationMode.active && animationMode.autoRecord
    ? animationMode.animationId
    : null
  const autoRecordPlayheadMs = animationMode.playheadMs
  useEffect(() => {
    if (!setCommandRewrite) return
    if (autoRecordAnimationId === null) {
      setCommandRewrite(null)
      return
    }
    setCommandRewrite((document, command) => rewriteAutoRecordCommand(document, {
      // 自动记录刻意按**被拖动实体所属**的 Frame 解析，而不是激活场景：这样在非激活场景里
      // 拖动时，rewriteAutoRecordCommand 会因为该 Frame 的清单里没有这条动画而自然 no-op，
      // 不会写出跨 Frame 的悬空分组。
      frameId: resolveTargetFrameId(document, controller?.selectedIds ?? []) ?? '',
      animationId: autoRecordAnimationId,
      playheadMs: autoRecordPlayheadMs,
      idFactory: animationCommandId,
    }, command))
    return () => setCommandRewrite(null)
  }, [autoRecordAnimationId, autoRecordPlayheadMs, controller?.selectedIds, setCommandRewrite])
  // onReady 只执行一次，闭包里不能捕获会随渲染更新的 animationMode。
  const animationModeRef = useRef(animationMode)
  useEffect(() => {
    animationModeRef.current = animationMode
  }, [animationMode])

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
  /**
   * 关掉一个文档：从会话表里删掉，活动的那个被关掉时把活动位交给右边的邻居（没有就左边）。
   *
   * @remarks
   * 文档不再是 Dockview 面板，「关掉活动标签之后谁活动」这件事 Dockview 不再替我们做。
   * 先右后左是浏览器与 VS Code 的共同约定。单文档模式下没有邻居时回到固定画布。
   */
  const closeDocumentImmediately = useCallback((panelId: string) => {
    if (!documentsRef.current.has(panelId)) return
    const order = [...documentsRef.current.keys()]
    const next = new Map(documentsRef.current)
    next.delete(panelId)
    replaceDocuments(next)
    setActiveDocumentPanelId((active) => {
      if (active !== panelId) return active
      const index = order.indexOf(panelId)
      return order[index + 1] ?? order[index - 1] ?? null
    })
  }, [replaceDocuments])
  /** 某个文档会话是否还开着；来路栈据此截断，因此必须读最新的一份而不是渲染期快照。 */
  const hasDocumentPanel = useCallback(
    (panelId: string) => documentsRef.current.has(panelId),
    [],
  )
  /** 某个文档有没有未保存的修改；返回时层的去留读它，同样必须读最新的一份。 */
  const isDocumentDirty = useCallback(
    (panelId: string) => documentsRef.current.get(panelId)?.dirty === true,
    [],
  )
  /** 激活一个已打开的文档；未启用页面系统时固定画布也算一个可激活的「文档」。 */
  const activateDocument = useCallback((panelId: string) => {
    if (documentsRef.current.has(panelId) || panelId === WORKSPACE_PANEL_IDS.canvas) {
      setActiveDocumentPanelId(panelId)
    }
  }, [])
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
    if (documentsRef.current.has(panelId)) {
      if (scriptIntelligence) {
        updateDocument(panelId, (current) => current.kind === 'asset'
          ? { ...current, scriptIntelligence }
          : current)
      }
      setActiveDocumentPanelId(panelId)
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
    setActiveDocumentPanelId(panelId)
  }, [
    assets?.browser?.provider,
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
  const resolvedHistory = history ?? controller?.history
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
  /*
   * 两条文档级动作（保存、切换动画模式）的共同前提：当前是页面或组件文档。资源文档由 Monaco
   * 自己的保存入口负责，动画模式对它也无从谈起——这与标签条右端那两个控件的显示条件同源。
   */
  const activeDocumentChrome = activeWorkspaceSession?.kind === 'asset'
    ? undefined
    : activeWorkspaceSession
  const canSaveActiveDocument = activeDocumentChrome !== undefined
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
  /**
   * 页面库那一屏此刻盖在 body 上。
   *
   * @remarks
   * 接了端口默认就**从库开始**：页面库是应用的入口，而编辑器不再是——打开产品先看到一块空
   * 画布，而用户此刻的问题是「这东西该怎么画」。没接端口时这一档恒为关，编辑器照旧是入口。
   *
   * 宿主可以用 `openOnStart: false` 让出入口而仍然接着库——「这个宿主有没有页面库」是能力，
   * 「打开先看到哪一屏」是形态，两句话回答的不是同一个问题。它**只喂初值**：此后这份状态仍
   * 然只有一个持有者，宿主中途把它改成 `false` 不会把用户从已经打开的库里拽走。
   */
  const [libraryIsEntry] = useState(
    pages?.library !== undefined && pages.library.openOnStart !== false,
  )
  const [libraryOpen, setLibraryOpen] = useState(libraryIsEntry)
  const libraryPort = pages?.library?.port
  const libraryRenderPage = pages?.library?.renderPage
  const openLibrary = useCallback(() => setLibraryOpen(true), [])
  const openPageDocument = useCallback(async (entry: ComposeAssetEntry) => {
    const provider = assets?.browser?.provider
    if (!provider || !entry.assetKey) return
    const panelId = createPageDocumentPanelId(provider.id, entry.assetKey)
    if (documentsRef.current.has(panelId)) {
      setActiveDocumentPanelId(panelId)
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
    setActiveDocumentPanelId(panelId)
  }, [assets?.browser?.provider, pageWorkspace, replaceDocuments])

  /**
   * 从页面库打开一份页面。
   *
   * @remarks
   * 目录**现列一次**而不是读手上那份：刚在库里落地的新页面比目录快一拍，读缓存的症状是
   * 「新建之后什么都没发生」。Store 的目录缓存随 Provider 通知失效，因此这一趟多半不产生
   * 额外的 IO。
   */
  const openPageFromLibrary = useCallback(async (pageKey: string) => {
    const store = pageWorkspace.store
    if (!store) return
    let descriptor: ComposePageDescriptor | undefined
    try {
      descriptor = (await store.listPages()).pages.find((page) => page.pageKey === pageKey)
    }
    catch (error) {
      setPageNotice(error instanceof Error ? error.message : String(error))
      return
    }
    if (!descriptor) {
      setPageNotice(editorMessages.pages.homePageMissing)
      return
    }
    // 先离开库再打开：打开是异步的，留在库里会让用户以为点空了。
    setLibraryOpen(false)
    await openPageDocument({
      id: descriptor.entryId,
      parentId: descriptor.parentId,
      name: descriptor.fileName,
      kind: 'file',
      assetKey: descriptor.pageKey,
      revision: descriptor.revision,
    })
  }, [editorMessages.pages.homePageMissing, openPageDocument, pageWorkspace.store])

  // 新页面 Store 代表一个新的工作区实例；此前 Provider 的一次性打开记录不能沿用。
  useEffect(() => {
    startupHomePageKeysRef.current.clear()
  }, [pageStore])

  useEffect(() => {
    const catalog = pageWorkspace.catalog
    if (
      pages === undefined
      /*
       * 从页面库起手就不自动打开首页：自动打开会让用户越过那一屏，而它才是入口。
       *
       * 判据是**这次起手在不在库里**（`libraryIsEntry`）而不是「接没接库」：`openOnStart: false`
       * 的宿主接着库却从画布起手，按后者判会让它落在一块什么都没打开的空画布上。也不读
       * `libraryOpen`——那是会变的，用户回一趟库再出来，首页就会在他背后被打开。
       */
      || libraryIsEntry
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
  }, [libraryIsEntry, openPageDocument, pageWorkspace.catalog, pages, workspaceReady])

  const savePageDocument = useCallback(async (panelId: string, force?: boolean) => {
    const outcome = await pageWorkspace.savePage(panelId, force)
    if (outcome.status === 'conflict') {
      setPendingPageConflict(panelId)
      return false
    }
    if (outcome.status === 'failed') {
      setPageNotice(editorMessages.pages.saveFailed)
      return false
    }
    if (outcome.status === 'animation-failed') {
      // 页面本体已落盘：提示指明失败的动画文件，不当作整页保存失败——下次保存会重试。
      setPageNotice(editorMessages.pages.animationSaveFailed(outcome.failedFiles.join('、')))
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
  }, [assets?.browser, editorMessages.pages, pageWorkspace])

  const openComponentDocument = useCallback(async (descriptor: ComposeComponentDescriptor) => {
    const store = componentWorkspace.store
    if (!store) return
    const panelId = createComponentDocumentPanelId(store.providerId, descriptor.assetKey)
    if (documentsRef.current.has(panelId)) {
      setActiveDocumentPanelId(panelId)
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
    setActiveDocumentPanelId(panelId)
  }, [componentWorkspace, replaceDocuments])

  const componentEntry = useComponentEntry({
    activeDocumentPanelId,
    controller,
    documents,
    fixedCanvasPanelId: WORKSPACE_PANEL_IDS.canvas,
    components: componentCatalog?.components,
    store: componentWorkspace.store,
    createPanelId: createComponentDocumentPanelId,
    openComponentDocument,
    hasDocument: hasDocumentPanel,
    isDocumentDirty,
    closeDocument: closeDocumentImmediately,
    setActiveDocumentPanelId,
    onError: setComponentNotice,
  })


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
      .filter((session) => {
        // 组件住在自己 Store 的 assetKey 命名空间里，没有 provider/entry 字段。
        if (session.kind === 'component') {
          return componentWorkspace.store?.providerId === providerId
            && affectedKeys.has(session.assetKey)
        }
        return session.provider.id === providerId
          && (affectedIds.has(session.entry.id)
            || (session.entry.assetKey !== undefined && affectedKeys.has(session.entry.assetKey)))
      })
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
  }, [
    assets?.browser,
    componentWorkspace.store,
    handleHomePageChange,
    homePageKey,
    pageStore,
    requestDocumentClose,
  ])
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
        // 这份描述符只用来打开文档（按 assetKey 与引用寻址）。分组用的路径一律从目录读，
        // 因此这里不去反查文件夹链。
        folderPath: [],
      })
    }
    catch (error) {
      setComponentNotice(error instanceof Error ? error.message : String(error))
    }
  }, [componentCatalog, componentWorkspace.store, openComponentDocument])

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
  /**
   * 绑定/更换/解除页面动画文件，并同步文档镜像：旧动画从镜像移除、新清单水合进镜像。
   * 页面包装与文件写入不可撤销；镜像事务可撤销（撤销后时间线提供重新载入入口）。
   */
  const { hydrateAnimation, removeAnimation } = animationMode
  const handlePageAnimationChanged = useCallback(async (
    pageKey: string,
    reference: ComposePageAnimationReference | null,
    frameId: string | null,
  ) => {
    if (!frameId) throw new ComposeAssetError('unsupported', '页面没有可绑定动画的场景')
    // 先读文件：内容不合法时不该把一个打不开的引用写进文档。
    const manifest = await pageWorkspace.loadFrameAnimation(pageKey, reference, frameId)
    // 引用是文档状态，走可撤销的文档命令写入——不经页面文件，因此刚画出来、尚未保存的
    // 场景也能绑定。
    animationRuntime?.dispatch({
      id: animationCommandId(),
      type: COMPOSE_ANIMATION_COMMAND_TYPES.setSource,
      payload: { frameId, source: reference },
      meta: {
        label: reference ? 'Bind animation' : 'Unbind animation',
        source: 'animation',
        targetIds: [frameId],
      },
    } as EditorCommand)
    // 同步该场景的镜像：旧清单移除、新清单水合。以文档里该 Frame 的清单为准而不是
    // 时间线会话——绑定行可能属于非作用域场景，时间线的当前动画与它无关。
    const existing = controller?.document
      ? getComposeAnimations(controller.document, frameId)
      : []
    existing.forEach((item) => {
      if (item.id !== manifest?.id) removeAnimation(item.id, frameId)
    })
    if (manifest && !existing.some((item) => item.id === manifest.id)) {
      hydrateAnimation(manifest, frameId)
    }
    return manifest
  }, [
    animationRuntime,
    controller,
    hydrateAnimation,
    pageWorkspace,
    removeAnimation,
  ])
  /**
   * 切换激活场景。
   *
   * @remarks
   * 激活写在页面文件里而不是 ComposeDocument 里，因此**不进撤销历史**——用户撤销一次误删，
   * 不该顺带把"这个页面发布哪一块"也撤回去。写入失败必须显式报出来，不能乐观翻转 UI。
   */
  const handleActiveFrameChange = useCallback((frameId: string) => {
    const pageKey = activePageSession?.pageKey
    if (!pageKey) return
    void pageWorkspace.setPageActiveFrame(pageKey, frameId).catch((error: unknown) => {
      setPageNotice(error instanceof Error ? error.message : String(error))
    })
  }, [activePageSession?.pageKey, pageWorkspace])
  /**
   * 当前工作区的新建种子。
   *
   * @remarks
   * 走 ref 而不是直接读会话：会话在这一行之下才建立（它要先知道文档标签），而菜单项此刻就要
   * 构造好。读它的只有用户点下「创建页面」之后跑的那个回调，那时 ref 早已是最新的。
   */
  const workspaceSeedsRef = useRef<ComposeWorkspaceSeeds>(DEFAULT_WORKSPACE_SEEDS)
  /** 当前工作区工具组的高度权重；容器量到真实尺寸之后要按它补落一次，见 `handleReady`。 */
  const workspaceToolsWeightRef = useRef(DEFAULT_TOOLS_WEIGHT)

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
    resolveSeeds: () => workspaceSeedsRef.current,
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

  /**
   * DXF 导入的依赖。
   *
   * @remarks
   * 右键菜单与双击共用这一份——两个入口、一条实现。
   */
  const dxfImportDeps = useMemo(() => ({
    componentStore: componentWorkspace.store,
    idFactory: animationCommandId,
    messages: editorMessages,
    onError: setPageNotice,
    // 诊断与失败都走同一条提示：用户要看的是「有没有东西没导进来」，而不是它属于哪一类。
    onNotice: setPageNotice,
    // eslint-disable-next-line react-hooks/refs -- 装进对象的是回调本身，只在用户真的导入时被调用；编译器无法区分「渲染期读 ref」与「把读 ref 的回调装进对象」。
    onPageCreated: handlePageCreated,
    pageStore,
    provider: assets?.browser?.provider,
    registry: controller?.registry,
  }), [
    assets?.browser?.provider,
    componentWorkspace.store,
    controller?.registry,
    editorMessages,
    handlePageCreated,
    pageStore,
  ])


  const handleAssetOpen = useCallback((
    entry: ComposeAssetEntry,
    context: ComposeAssetOpenContext,
  ) => {
    assets?.browser?.onAssetOpen?.(entry, context)
    // DWG 还解不了。双击一份图纸，用户要的是那块场景；给他一个空白预览等于什么都没说。
    if (entry.kind === 'file' && isDwgAssetName(entry.name)) {
      setPageNotice(editorMessages.dwg.convertFirst)
      return
    }
    /*
     * DXF 双击即导入为页面——与右键那一项是同一条实现。双击一份图纸时用户要的就是那块
     * 场景，而这个格式没有「预览」可言：它既不是浏览器画得出来的图片，也不是脚本。
     */
    if (entry.kind === 'file' && isDxfAssetName(entry.name)) {
      const action = createDxfImportAction(dxfImportDeps)
      if (action?.canCreate) {
        void action.run(entry, entry.parentId ?? null, () => { context.refresh() })
        return
      }
    }
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
    dxfImportDeps,
    editorMessages.dwg.convertFirst,
    openAssetDocument,
    openComponentFromAssetEntry,
    openPageDocument,
    pages,
  ])

  const dxfContextMenuItems = useMemo(() => {
    // eslint-disable-next-line react-hooks/refs -- 同上：传下去的是那些回调，不是 ref 的值。
    return createDxfContextMenuItems(dxfImportDeps)
  }, [dxfImportDeps])

  // DWG 导不进来，而一片空白让用户读到的是「这个工具不支持我的图」。这一项不依赖任何
  // Store 或 Provider——它在解码路径缺席时始终是正确行为。
  const dwgContextMenuItems = useMemo(() => {
    return createDwgContextMenuItems({
      messages: editorMessages,
      onNotice: setPageNotice,
    })
  }, [editorMessages])

  // eslint-disable-next-line react-hooks/refs -- 与 DXF 那一项同理：菜单项的 `onSelect` 只在用户选中后触发，编译器无法区分「渲染期读 ref」与「把读 ref 的回调装进数组」。
  const svgContextMenuItems = useMemo(() => {
    const store = componentWorkspace.store
    return createSvgContextMenuItems({
      componentStore: store,
      idFactory: animationCommandId,
      messages: editorMessages,
      onComponentCreated: (component) => {
        // 导入之后用户要做的是改这个符号，因此直接打开它的组件文档。
        void openComponentDocument({
          entryId: component.entryId,
          assetKey: component.assetKey,
          displayName: component.asset.name,
          componentId: component.asset.componentId,
          kind: component.asset.kind,
          revision: component.revision,
          reference: store!.createReference(component.assetKey),
          folderPath: [],
        })
      },
      onError: setComponentNotice,
      // 诊断与失败都走同一条提示：用户要看的是「有没有东西没导进来」，而不是它属于哪一类。
      onNotice: setComponentNotice,
      provider: assets?.browser?.provider,
      registry: controller?.registry,
    })
  }, [
    assets?.browser?.provider,
    componentWorkspace.store,
    controller?.registry,
    editorMessages,
    openComponentDocument,
  ])

  const hostContextMenuItems = useMemo(() => {
    const hostItems = assets?.browser?.contextMenuItems ?? []
    return [
      ...hostItems,
      ...pageContextMenuItems,
      ...componentContextMenuItems,
      ...dxfContextMenuItems,
      ...dwgContextMenuItems,
      ...svgContextMenuItems,
    ]
  }, [
    assets?.browser?.contextMenuItems,
    componentContextMenuItems,
    dxfContextMenuItems,
    dwgContextMenuItems,
    pageContextMenuItems,
    svgContextMenuItems,
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

  /**
   * 活动页面当前 Frame 的动画文件引用。
   *
   * @remarks
   * v7 的绑定挂在 Frame 的 `Animations.source` 上；这里读会话文档而不是页面文件，
   * 保证水合与解绑之后立即反映。
   */
  const activePageFrameAnimationSource = useMemo(() => {
    // 读运行时文档而不是上次保存的那份：绑定是文档命令，会话中途绑上的引用只在运行时文档里。
    const document = controller?.document
    if (!document || !animationScopeFrameId) return null
    const animations = document.entities[animationScopeFrameId]?.components.Animations as
      { source?: ComposePageAnimationReference } | undefined
    return animations?.source ?? null
  }, [animationScopeFrameId, controller])

  /**
   * 页面配置面板动画分组的逐场景绑定行：按 `rootIds` 顺序列出每块根场景的绑定与镜像。
   *
   * @remarks
   * 激活场景与当前动画作用域场景可能不同（发布目标 vs 时间线目标），行上分别标注。
   */
  const animationScenes = useMemo((): readonly PageAnimationSceneBinding[] => {
    const document = controller?.document
    if (!document) return []
    const frames = document.rootIds.filter((id) => isComposeFrameEntity(document.entities[id]))
    // 激活徽标沿用 resolveTargetFrameId 的回退：activeFrameId 缺省或失效时首块根场景就是
    // 事实上的激活场景，不标出来会让「编辑中」徽标在单场景页面上凭空出现。
    const effectiveActiveId = pageActiveFrameId && frames.includes(pageActiveFrameId)
      ? pageActiveFrameId
      : frames[0] ?? null
    return frames.map((frameId) => {
      const entity = document.entities[frameId]
      const source = (entity?.components.Animations as
        { source?: ComposePageAnimationReference } | undefined)?.source ?? null
      return {
        frameId,
        name: entity?.name ?? frameId,
        reference: source,
        animation: getComposeAnimations(document, frameId)[0] ?? null,
        isActive: frameId === effectiveActiveId,
        isScope: frameId === animationScopeFrameId,
      }
    })
  }, [animationScopeFrameId, controller, pageActiveFrameId])

  const { selectedKeyframeEasing, setKeyframeInterpolation } = animationMode
  const animationInspector = useMemo(() => {
    if (!activePageSession || !pageProvider) return undefined
    return (
      <PageAnimationScopePanel
        dispatch={(command) => animationRuntime?.dispatch(command as EditorCommand)}
        idFactory={animationCommandId}
        key={`${pageProvider.id}:${activePageSession.pageKey}:animation`}
        // 缓动区只属于动画模式：设计模式下选中态仍在会话里，但那时没有时间线可编辑。
        keyframeEasing={animationMode.active ? selectedKeyframeEasing : null}
        onAnimationChange={async (reference, frameId) => {
          await handlePageAnimationChanged(
            activePageSession.pageKey,
            reference,
            frameId,
          )
        }}
        onError={setPageNotice}
        onInterpolationChange={setKeyframeInterpolation}
        pageName={activePageSession.displayName}
        pageParentId={activePageSession.entry.parentId ?? pageProvider.root.id}
        provider={pageProvider}
        scenes={animationScenes}
        scope={activePageSession.scriptScope}
      />
    )
  }, [
    activePageSession,
    animationMode.active,
    animationRuntime,
    animationScenes,
    handlePageAnimationChanged,
    pageProvider,
    selectedKeyframeEasing,
    setKeyframeInterpolation,
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

  // 动画模式下注入属性面板的菱形装饰：单选普通 Entity 才有意义，实例内部选择的
  // 复合地址不对应文档 Entity，命令会被拒绝，不如不显示。
  const animationFieldAdornment = useMemo(() => {
    if (!animationMode.active || !animationMode.animationId || !controller) return undefined
    if (controller.selectedIds.length !== 1 || controller.instanceInnerSelection) return undefined
    const entityId = controller.selectedIds[0]!
    if (!controller.document.entities[entityId]) return undefined
    return createAnimationFieldAdornment({
      session: animationMode,
      document: controller.document,
      entityId,
      messages: editorMessages.animationMode,
    })
  }, [animationMode, controller, editorMessages.animationMode])

  const resolvedInspectorPanel = useMemo(() => {
    // 动画模式下时间线选中了动画本身（片段）：属性区切换为动画检查器。
    // 选回对象/属性轨道（selectedClipId 归 null）即恢复下面的原有 Inspector。
    if (
      animationMode.active
      && animationMode.animationId
      && animationMode.panelValue?.selectedClipId
      && controller
    ) {
      const animation = (animationScopeFrameId
        ? getComposeAnimations(controller.document, animationScopeFrameId)
        : []).find((item) => item.id === animationMode.animationId)
      if (animation && animationRuntime) {
        return (
          <AnimationInspector
            animation={animation}
            frameId={animationScopeFrameId ?? ''}
            dispatch={(command) => animationRuntime.dispatch(command)}
            idFactory={animationCommandId}
            messages={editorMessages.animationMode}
            scope={activePageSession?.scriptScope ?? controller.scriptScope}
          />
        )
      }
    }
    const authoredInspector = slots?.inspector !== undefined
      ? slots.inspector
      : addDefaultElementProps(controller?.inspectorPanel, {
          animationInspector,
          pageScriptInspector,
          fieldAdornment: animationFieldAdornment,
          // 页面配置面板拿不到页面会话（它由 controller 返回），沿用既有 cloneElement 注入。
          ...(activePageSession
            ? {
                activeFrameId: activePageSession.page.activeFrameId ?? null,
                onActiveFrameChange: handleActiveFrameChange,
              }
            : {}),
        })
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
        : addDefaultElementProps(controller?.inspectorPanel, { animationInspector, pageScriptInspector })
      return (
        <ComposeComponentInstanceOverridesPanel
          entity={selectedComponentInstance}
          layout="inspector"
          onApply={applySelectedInstanceOverrides}
          onChange={updateInstanceOverrides}
          onCreateVariant={createVariantFromSelectedInstance}
          onOpen={() => { void componentEntry.enter(selectedComponentInstance.id) }}
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
    controller,
    activeComponentSession,
    activePageSession,
    animationInspector,
    animationMode.active,
    animationMode.animationId,
    animationMode.panelValue?.selectedClipId,
    animationRuntime,
    applySelectedInstanceOverrides,
    componentWorkspace.store,
    createVariantFromSelectedInstance,
    componentEntry,
    editorMessages.animationMode,
    handleActiveFrameChange,
    handleVariantOverridesChange,
    pageScriptInspector,
    resolvedPaintImageLibrary,
    slots,
    selectedComponentInstance,
    updateComponentInstance,
    updateInstanceOverrides,
    animationFieldAdornment,
    animationScopeFrameId,
  ])

  const handlePanelDocumentClose = useCallback((panelId: string) => {
    void requestDocumentClose(panelId)
  }, [requestDocumentClose])
  const handlePanelDocumentSave = useCallback((panelId: string) => {
    void documentsRef.current.get(panelId)?.save?.()
  }, [])
  const setSettingsButton = useCallback((element: HTMLButtonElement | null) => {
    settingsButtonRef.current = element
  }, [])

  /**
   * 时间线面板此刻在不在布局里：动画编辑只有在它在的时候才谈得上。
   *
   * @remarks
   * 它是 React 状态而不是每次去问 Dockview：命令面板那一条要在渲染期读它。由布局事件同步
   * （见 `syncAnimationPanel`）。
   */
  const [timelinePanelPresent, setTimelinePanelPresent] = useState(false)
  /**
   * 让时间线可见：设为组内活动标签；住在底部边缘组时把那个组展开。
   *
   * @returns 布局里没有时间线时 `false`——那时进不了动画编辑，它唯一的可见依据不在。
   */
  const revealAnimationPanel = useCallback(() => {
    // 宿主测试替身可能只实现部分 api：Dockview 操作逐个防御。
    const api = dockviewApiRef.current as Partial<DockviewReadyEvent['api']> | null
    const panel = api?.getPanel?.(WORKSPACE_PANEL_IDS.animation)
    if (!panel) return false
    panel.api.setActive()
    const bottomGroup = typeof api?.getEdgeGroup === 'function' ? api.getEdgeGroup('bottom') : undefined
    const group = (panel as { readonly group?: { readonly id: string } }).group
    // 时间线被拖去别处时没有折叠可言；只有它住在底部边缘组时才展开那个组。
    if (bottomGroup && (group === undefined || group.id === bottomGroup.id)) bottomGroup.expand()
    return true
  }, [])
  /**
   * 动画编辑开关的唯一写入口。
   *
   * @remarks
   * 开只在时间线在布局里时成立，关随时可以。开关本身是 `useAnimationMode` 的会话状态；这里
   * 只负责把它与时间线的可见性绑在一起：开之前先把时间线亮出来，用户按下去就看得见它在说什么。
   * 切换工作区**永不**走这里开它——按文档记忆的工作区会让「打开页面」等于「进了录制态」。
   */
  const setAnimationEditing = useCallback((on: boolean) => {
    if (on && !revealAnimationPanel()) return
    animationModeRef.current.setActive(on)
  }, [revealAnimationPanel])
  /**
   * 时间线面板不再可见即退出动画编辑，并更新「布局里有没有时间线」。
   *
   * @remarks
   * 判据是**可见依据**：屏幕上唯一说明「拖动会变成关键帧」的东西就是时间线，它被别的标签
   * 盖住、被关掉、被换掉的布局去掉时都不允许那个状态存在。用微任务合并：工作区切换是
   * `clear` + 重建，中途面板会消失一瞬，同步判断会把「切到另一个也有时间线的布局」误判成退出。
   */
  const syncAnimationPanel = useCallback(() => {
    queueMicrotask(() => {
      const api = dockviewApiRef.current as Partial<DockviewReadyEvent['api']> | null
      if (!api) return
      const panel = api.getPanel?.(WORKSPACE_PANEL_IDS.animation)
      setTimelinePanelPresent(panel !== undefined)
      // 测试替身的面板 api 未必实现 `isVisible`：缺席按可见算，只有明确的 false 才算被盖住。
      const visible = panel !== undefined && panel.api.isVisible !== false
      if (!visible && animationModeRef.current.active) animationModeRef.current.setActive(false)
    })
  }, [])

  /** 空态创建引导：在页面同目录创建动画文件、绑定并水合镜像。 */
  const animationModeMessages = editorMessages.animationMode
  const handleCreateAnimationFromEmptyState = useCallback(async () => {
    // 先确认有可绑定的作用域场景再落文件：顺序反过来的话，任何前置校验失败都会在用户的
    // 资源目录里留下一个没有任何引用的孤儿动画文件。
    if (!animationScopeFrameId) {
      if (activePageSession || activeComponentSession) {
        setPageNotice(animationModeMessages.animationOperationFailed)
      }
      return
    }
    const manifest = {
      id: animationCommandId(),
      name: animationModeMessages.defaultAnimationName,
      durationMs: DEFAULT_ANIMATION_DURATION_MS,
      playbackMode: 'play-once' as const,
    }
    /*
     * 组件文档不落动画文件，直接把清单写进文档。
     *
     * 组件的动画**内嵌在资产里**：实例渲染的是 `resolvedSnapshot.document`，它把整份组件
     * 文档原样嵌进宿主 Entity，清单就在其中。再配一份 `.animation.json` 会出现两份清单——
     * 快照里那份是实例真正播的，文件那份谁也读不到，而两份在刚创建时一模一样，不会被察觉。
     *
     * 顺带两件事白拿：组件保持是一份可移植的文件，保存路径也不需要「把镜像聚合回文件」
     * 那段回写逻辑——清单在文档里，组件保存本来就写整份文档。
     */
    if (activeComponentSession) {
      hydrateAnimation(manifest, animationScopeFrameId)
      setAnimationEditing(true)
      return
    }
    if (!activePageSession || !pageProvider) return
    try {
      // 每块场景一份自己的动画文件：按「页面名-场景名」命名创建，不复用其他场景已绑定的
      // 引用；同名冲突由 createPageAnimationFile 追加序号解决。新文件带着这条清单落盘，
      // 绑定时会把它水合回镜像。
      const sceneName = controller?.document?.entities[animationScopeFrameId]?.name
      const { entry } = await createPageAnimationFile(
        pageProvider,
        activePageSession.entry.parentId ?? pageProvider.root.id,
        sceneName
          ? `${activePageSession.displayName}-${sceneName}`
          : activePageSession.displayName,
        animationScopeFrameId,
        manifest,
      )
      const assetKey = entry.assetKey
      if (!assetKey) throw new Error('动画文件缺少稳定 assetKey')
      await handlePageAnimationChanged(
        activePageSession.pageKey,
        {
          providerId: pageProvider.id,
          assetKey,
          scope: pageProvider.referenceScope ?? 'persistent',
        },
        animationScopeFrameId,
      )
      // 创建是用户对动画本身的动作：紧接着就要打点，直接进入动画编辑。
      setAnimationEditing(true)
    }
    catch {
      setPageNotice(animationModeMessages.animationOperationFailed)
    }
  }, [
    activeComponentSession,
    activePageSession,
    animationModeMessages,
    animationScopeFrameId,
    controller,
    handlePageAnimationChanged,
    hydrateAnimation,
    pageProvider,
    setAnimationEditing,
  ])

  /** 撤销越过水合事务后的恢复入口：重新派发水合，不再创建文件。 */
  const handleLoadBoundAnimation = useCallback(() => {
    const reference = activePageFrameAnimationSource
    const baseline = reference
      ? activePageSession?.animationFiles.get(reference.assetKey)?.baseline
      : undefined
    const manifest = baseline && animationScopeFrameId
      ? getComposeAnimationFileFrame(baseline, animationScopeFrameId)[0]
      : undefined
    if (manifest) {
      hydrateAnimation(manifest)
      setAnimationEditing(true)
      return
    }
    // 打开页面时文件加载失败会让会话没有基线清单：按当前引用重新加载一次。
    if (activePageSession && reference) {
      void handlePageAnimationChanged(
        activePageSession.pageKey,
        reference,
        animationScopeFrameId,
      ).then(() => { setAnimationEditing(true) }).catch(() => {
        setPageNotice(animationModeMessages.animationOperationFailed)
      })
    }
  }, [
    activePageFrameAnimationSource,
    activePageSession,
    animationModeMessages,
    animationScopeFrameId,
    handlePageAnimationChanged,
    hydrateAnimation,
    setAnimationEditing,
  ])

  const historyEnabled = resolvedHistory !== undefined || slots?.history !== undefined
  /**
   * Dockview 就绪：摆出四区并订阅布局事件。
   *
   * @remarks
   * 文档不是 Dockview 面板，因此这里不再从活动面板事件推导活动文档——那由标签条与打开路径
   * 直接写 state。留下的订阅只做一件事：跟着布局判断时间线在不在、可不可见，据此维护动画编辑
   * 开关。`onReady` 在 Strict Mode 下会重放，按 api 身份去重。
   */
  const handleReady = useCallback((event: DockviewReadyEvent) => {
    if (dockviewApiRef.current === event.api) {
      return
    }
    initializeWorkspace(
      event.api,
      resolvedPreferences.locale,
      hostI18n?.formatMessage,
      { historyEnabled },
    )
    dockviewApiRef.current = event.api
    setWorkspaceReady(true)
    // 容器在 onReady 时可能还没有真实尺寸（Strict Mode 重放、宿主先挂后量都会这样），
    // 那时落下去的初始尺寸会在第一次真实布局后被摊成等份：等 api 报出非零尺寸再落一次。
    if (!(event.api.width > 0 && event.api.height > 0)) {
      const subscription = event.api.onDidLayoutChange?.(() => {
        if (!(event.api.width > 0 && event.api.height > 0)) return
        subscription?.dispose()
        applyWorkspaceInitialSizes(event.api, workspaceToolsWeightRef.current)
      })
    }
    // 时间线在不在、可不可见随布局走：这几个事件覆盖活动标签切换、面板增删与整份布局换掉。
    const api = event.api as Partial<DockviewReadyEvent['api']>
    for (const subscribe of [
      api.onDidActivePanelChange,
      api.onDidAddPanel,
      api.onDidRemovePanel,
      api.onDidLayoutChange,
      api.onDidLayoutFromJSON,
    ]) {
      if (typeof subscribe === 'function') subscribe.call(event.api, () => { syncAnimationPanel() })
    }
    syncAnimationPanel()
  }, [historyEnabled, hostI18n?.formatMessage, resolvedPreferences.locale, syncAnimationPanel])

  // 两侧的收起状态从组的可见性派生：隐藏是布局的一部分，随工作区的快照走。
  const sideCollapse = useWorkspaceSideCollapse(dockviewApiRef, workspaceReady)

  /*
   * 应用菜单里的「命令面板」：先展开底栏再把命令面板设为活动。底栏收起时 `setActive` 到不了
   * 那个面板，只做后一步的症状是「点了菜单什么都没发生」。
   */
  const openCommandPanel = useCallback(() => {
    sideCollapse.setCollapsed('bottom', false)
    dockviewApiRef.current?.getPanel?.(WORKSPACE_PANEL_IDS.command)?.api.setActive()
  }, [sideCollapse])

  /**
   * 画布会话开关的读写端口：由 controller 持有，工作区切换时整组换入换出。
   *
   * @remarks
   * 宿主可以传只实现部分接口的 controller（测试替身与插槽宿主就是这么做的），缺 setter 时
   * 工作区照常切布局、只是不换开关。
   */
  const sessionPort = useMemo<ComposeWorkspaceSessionPort | null>(() => {
    if (!controller || typeof controller.setGridVisible !== 'function') return null
    return {
      get: () => ({
        angleConstraint: controller.angleConstraint,
        polarIncrement: controller.polarIncrement,
        gridVisible: controller.gridVisible,
        transformGizmo: controller.transformGizmo,
      }),
      set: (next) => {
        controller.setAngleConstraint(next.angleConstraint)
        controller.setPolarIncrement(next.polarIncrement)
        controller.setGridVisible(next.gridVisible)
        controller.setTransformGizmo(next.transformGizmo)
      },
    }
  }, [controller])
  const workspaceSession = useWorkspaceSession({
    apiRef: dockviewApiRef,
    ready: workspaceReady,
    injected: workspaces ?? COMPOSE_DEFAULT_WORKSPACES,
    preferences: resolvedPreferences,
    updatePreferences,
    locale: resolvedPreferences.locale,
    formatMessage: hostI18n?.formatMessage,
    historyEnabled,
    activeDocumentKey: activeDocumentPanelId,
    sessionPort,
    notify: setPageNotice,
  })
  useLayoutEffect(() => {
    workspaceSeedsRef.current = workspaceSession.seeds
    workspaceToolsWeightRef.current = workspaceSession.toolsWeight
  })
  // 切换工作区之后再同步一次时间线的在场与可见：布局应用在会话 Hook 自己的 effect 里完成，
  // 这个 effect 排在它后面；宿主替身不发 Dockview 事件时也靠它。
  const workspaceCurrentId = workspaceSession.currentId
  useEffect(() => {
    syncAnimationPanel()
  }, [syncAnimationPanel, workspaceCurrentId])
  /*
   * 货架与宿主目录项经 Context 下发：中间那一层属于宿主（`slots.stageToolbar` 可以把工具栏包进
   * 自己的节点里），`cloneElement` 补 prop 那条路在那里就断了。
   */
  const { openDialog, setToolbarShelf, toolbar: workspaceToolbar } = workspaceSession
  const openToolbarDialog = useCallback(() => { openDialog('toolbar') }, [openDialog])
  /**
   * 「动画编辑」在工具栏目录里的那一格：指向 `document.toggleAnimationMode`，按下态读开关本身。
   *
   * @remarks
   * 与宿主注入的项合成一份目录，Context 与直接给 `DefaultStageToolbar` 的 prop 都拿这一份——
   * 两处不同的症状是宿主自己渲染工具栏时这一格不见了。
   */
  const animationToolbarItem = useMemo<ComposeToolbarItem>(() => ({
    id: COMPOSE_TOOLBAR_ANIMATION_ID,
    label: editorMessages.stageToolbar.animationEditing,
    icon: <StageToolbarIcon name="animation" />,
    target: { kind: 'action', id: 'document.toggleAnimationMode' },
    pressed: animationMode.active,
  }), [animationMode.active, editorMessages.stageToolbar.animationEditing])
  const resolvedToolbarItems = useMemo(
    () => [...(toolbarItems ?? []), animationToolbarItem],
    [animationToolbarItem, toolbarItems],
  )
  /*
   * 工具栏量出来的溢出切口：第一个被收进「更多」的格 id。自定义对话框拿它画切口，量不到
   * 就不画——对话框自己量不到，它打开时工具栏可能已经被遮住了。
   */
  const [toolbarOverflowFrom, setToolbarOverflowFrom] = useState<string | null>(null)
  const toolbarShelfContext = useMemo(
    () => ({
      shelf: workspaceToolbar,
      items: resolvedToolbarItems,
      onCustomize: openToolbarDialog,
      onShelfChange: setToolbarShelf,
      shortcuts: resolvedPreferences.shortcuts,
      overflowFrom: toolbarOverflowFrom,
      onOverflowChange: setToolbarOverflowFrom,
    }),
    [
      openToolbarDialog, resolvedPreferences.shortcuts, resolvedToolbarItems, setToolbarShelf,
      toolbarOverflowFrom, workspaceToolbar,
    ],
  )
  /**
   * 当前工作区的工具栏上有哪几个 Preset 的入口。
   *
   * @remarks
   * 物料面板用它求值 `paletteHidden: 'toolbar'`：工具栏给了入口的物料不必再占一块瓦片，而
   * 货架按工作区不同，因此这份名单也按工作区不同。id 直接取货架里的那些——绘图命令的 id 与
   * 它产出的 Preset id 是同一个词的两种大小写（`CIRCLE` / `circle`），工具 id 则本来就同名
   * （`draw-text` 对 `text`）。
   *
   * 货架缺席时给 `undefined`（而不是空数组）：那表示「宿主没接工作区」，此时 `'toolbar'`
   * 一档照旧全藏，与货架落地之前逐字相同；空数组会让每一个 `'toolbar'` 物料都冒出来。
   */
  const toolbarPresetIds = useMemo(() => {
    const shelf = workspaceSession.toolbar
    if (!shelf) return undefined
    return shelf.flatMap((id) => (
      id === COMPOSE_TOOLBAR_SEPARATOR ? [] : [id.toLowerCase(), id.replace(/^draw-/, '')]
    ))
  }, [workspaceSession.toolbar])
  /*
   * 自定义物料面板那两列的目录。Preset 名单按当前工作区的货架求值过 `paletteHidden`——被判据
   * 藏起来的 Preset **不出现在勾选列表里**：它们藏不藏不是这份货架的决定（工具栏已提供入口），
   * 列出来会让用户以为自己能把它勾回来。
   */
  const paletteCatalog = useMemo(() => ({
    presets: (controller?.registry?.listPresets() ?? [])
      .filter((preset) => preset.paletteHidden !== 'always'
        && !(preset.paletteHidden === 'toolbar'
          && (toolbarPresetIds === undefined || toolbarPresetIds.includes(preset.id))))
      .map((preset) => ({ id: preset.id, label: preset.label })),
    folders: componentCatalog?.folders ?? [],
  }), [componentCatalog, controller, toolbarPresetIds])
  /*
   * 画布右键「添加组件」的那棵树。
   *
   * 与物料面板读**同一个**解析器（`resolveComposeComponentShelfView`）：各建一份的症状是
   * 「面板里有、菜单里没有」，而用户读不出为什么。Stage 不认识组件目录协议，因此这里把它压成
   * 一份「能列出什么」的扁平结构，连同 id → 创建意图的映射一起交出去。
   */
  const addComponentMenu = useMemo(() => {
    const registry = controller?.registry
    if (!registry) return null
    const zh = resolvedPreferences.locale === 'zh-CN'
    const sections = resolveComposeComponentShelfView({
      registry,
      shelf: workspaceSession.palette ?? COMPOSE_DEFAULT_COMPONENT_SHELF,
      catalog: componentCatalog ?? null,
      hasStore: componentWorkspace.store !== undefined,
      ...(toolbarPresetIds === undefined ? {} : { toolbarPresetIds }),
      labels: {
        basics: zh ? '基础组件' : 'Basics',
        components: zh ? '项目组件' : 'Project components',
      },
      locale: resolvedPreferences.locale,
    })
    const items = new Map<string, ComposeComponentLibraryItem>()
    const groups = sections.flatMap((section) => section.groups.map((group) => ({
      id: `${section.id}:${group.id}`,
      // 子文件夹有自己的小标题；没有小标题的一组就用段标题——菜单里**没有第三级**。
      title: group.title ?? section.title,
      items: group.tiles.map((tile) => {
        if (tile.kind === 'preset') {
          const id = `preset:${tile.presetId}`
          items.set(id, { kind: 'preset', presetId: tile.presetId })
          return { id, label: tile.label, icon: registry.getPreset(tile.presetId)?.icon }
        }
        const id = `component:${tile.descriptor.assetKey}`
        items.set(id, { kind: 'component', descriptor: tile.descriptor })
        return {
          id,
          label: tile.descriptor.displayName,
          icon: <ComposeComponentAssetIcon kind={tile.descriptor.kind} />,
        }
      }),
    }))).filter((group) => group.items.length > 0)
    return groups.length > 0 ? { groups, items } : null
  }, [
    componentCatalog,
    componentWorkspace.store,
    controller?.registry,
    resolvedPreferences.locale,
    toolbarPresetIds,
    workspaceSession.palette,
  ])

  /**
   * 场景树受控属性：在既有属性上接进入与返回。
   *
   * @remarks
   * 两条意图都在这里被截住而不是交给 controller：打开与切换文档标签是工作区的事，
   * controller 不认识标签。其余意图原样转交。
   */
  const resolvedSceneTreeProps = useMemo<ComposeSceneTreeProps>(() => {
    const base = sceneTree ?? controller?.sceneTreeProps ?? emptySceneTreeProps
    /*
     * 有来路才在根行画返回控件：退无可退时它就是一行普通的根，不该挂一个按下去什么都不做的箭头。
     * 只打第一个根——组件文档只有一个根 Frame，而页面文档根本走不到这里（没有来路）。
     */
    const nodes = componentEntry.canExit && base.nodes.length > 0
      ? [{ ...base.nodes[0]!, canExit: true }, ...base.nodes.slice(1)]
      : base.nodes
    return {
      ...base,
      nodes,
      ...(addComponentMenu ? { addMenu: addComponentMenu.groups } : {}),
      onOperation: (operation) => {
        if (operation.type === 'enter') {
          void componentEntry.enter(operation.nodeId)
          return
        }
        if (operation.type === 'exit') {
          componentEntry.exit()
          return
        }
        if (operation.type === 'add') {
          const item = addComponentMenu?.items.get(operation.itemId)
          if (!item || !controller) return
          /*
           * 走与**点击物料面板瓦片**同一条路：`external.add` 不带 clientPoint，落点因此是
           * 当前选区所在的公共容器——也就是用户在树里正指着的那一行所在的容器。
           * 树自己不表达落点：这颗按钮坐在检索栏上，不指向任何一行。
           */
          controller.interactionController.send({
            type: 'external.add',
            item: createComponentLibraryStageItem(item),
          })
          /*
           * 把落进去的那个容器展开。新对象会被选中，但选中一行看不见的行，与什么都没发生在
           * 屏幕上没有区别——而用户此刻正看着树。
           *
           * 展开**选中的容器**就够：选区是容器时它就是落点；选区是叶子时落点是它的父级，
           * 而那个父级此刻一定是展开的（否则这个叶子看不见）。只挑文档意义上的容器——
           * 组件实例的展开是「投影内部层级」，不是这里想要的那件事。
           */
          const expandable = controller.selectedIds.filter((id) => {
            const entity = controller.document.entities[id]
            return entity !== undefined && getComposeHierarchy(entity) !== undefined
          })
          if (expandable.length > 0) {
            controller.setExpandedIds([...controller.expandedIds, ...expandable])
          }
          return
        }
        base.onOperation?.(operation)
      },
    }
  }, [addComponentMenu, componentEntry, controller, sceneTree])

  const workspacePaletteTitle = workspaceSession.palette?.title
    ?? editorMessages.workspace.componentLibrary
  const workspaceActions = useMemo<ComposeEditorWorkspaceActions>(() => ({
    items: workspaceSession.items.map(({ id, title }) => ({ id, title })),
    currentId: workspaceSession.currentId,
    switchTo: workspaceSession.switchTo,
    next: workspaceSession.next,
    previous: workspaceSession.previous,
    focusCanvas: workspaceSession.toggleCanvasOnly,
    saveAs: () => workspaceSession.openDialog('saveAs'),
    reset: workspaceSession.reset,
  }), [workspaceSession])

  /**
   * 注入 Stage 命令行的宿主动作。
   *
   * @remarks
   * 与命令面板的动作**同源**：两者都由 `createComposeEditorCatalog` 派生，因此同一条动作
   * 在「敲名字」与「点面板」两个入口拿到的是同一份名称、分组与可用性。
   *
   * 界面语言在这里补齐而不是在控制器里：控制器由宿主在 `ComposeUIProvider` 之外创建，读不到
   * 语言，这与命令面板的装配位置是同一条既有理由。
   */
  const actionContext = controller?.actionContext
  /*
   * 两条文档级动作的稳定入口：命令面板与命令行各拿一次，因此不在渲染期现搓闭包——那会读到
   * 一个 ref，而 ref 的值只有在事件发生时才作数。
   */
  const saveActiveDocument = useCallback(() => {
    void activeDocumentChrome?.save?.()
  }, [activeDocumentChrome])
  // 读会话状态而不是那个 ref：ref 只在事件里才作数，而这个回调是当作 prop 交出去的。
  const animationActive = animationMode.active
  const toggleAnimationMode = useCallback(() => {
    setAnimationEditing(!animationActive)
  }, [animationActive, setAnimationEditing])
  /*
   * 对时间线的任何一次交互即进入动画编辑：用户在拖播放头，屏幕上就有播放头在动、画布跟着采样，
   * 进入这一刻有完整的视觉解释。曾考虑关闭态把时间线渲染成只读——那要给 `animation-panel` 加
   * 一个 `readOnly` 契约，且「鼠标动了没反应」正是本仓库明写要避免的状态。
   */
  const handleAnimationPanelValueChange = useCallback((next: ComposeAnimationPanelValue) => {
    if (!animationModeRef.current.active) setAnimationEditing(true)
    animationModeRef.current.onPanelValueChange(next)
  }, [setAnimationEditing])
  const handleAnimationPanelAction = useCallback((action: ComposeAnimationPanelAction) => {
    if (!animationModeRef.current.active) setAnimationEditing(true)
    animationModeRef.current.onPanelAction(action)
  }, [setAnimationEditing])

  const stageCommands = useMemo(() => {
    // 与 `controller?.renderStage` 一样按可选消费：`ComposeEditorController` 是宿主可以自己
    // 实现的接口，只实现关心的那几项是正当用法（既有测试与插槽宿主就是这么做的）。缺席时
    // 命令行退回只认内建命令，而不是让整个编辑器挂掉。
    if (!actionContext) return undefined
    return createComposeEditorCommands({
      ...actionContext,
      formatMessage: hostI18n?.formatMessage,
      locale: resolvedPreferences.locale,
      openSettings: toggleSettings,
      shortcuts: resolvedPreferences.shortcuts,
      workspace: workspaceActions,
      /*
       * 文档级动作在这里补而不是在控制器里：控制器不认识文档会话（页面 / 组件 / 资源三种
       * 标签住在编辑器上），这与 `workspace` 补在这里是同一条理由。
       */
      saveDocument: () => { void activeDocumentChrome?.save?.() },
      canSaveDocument: canSaveActiveDocument,
      // 没有页面 / 组件文档时整条省略，而不是列一个按下去没反应的条目；判据与时间线 chrome 上
      // 那颗开关的显示条件是同一个。布局里没有时间线时列出但不可用，并说明原因。
      toggleAnimationMode: activeDocumentChrome === undefined
        ? undefined
        : () => { setAnimationEditing(!animationModeRef.current.active) },
      animationTimelineMissing: !timelinePanelPresent,
    })
  }, [
    actionContext,
    activeDocumentChrome,
    canSaveActiveDocument,
    hostI18n?.formatMessage,
    resolvedPreferences.locale,
    resolvedPreferences.shortcuts,
    setAnimationEditing,
    timelinePanelPresent,
    toggleSettings,
    workspaceActions,
  ])

  const resolvedComponentLibraryPanel = slots?.componentLibrary !== undefined
    ? slots.componentLibrary
    : !controller
      ? undefined
      : !componentWorkspace.store
        ? controller.componentLibraryPanel
        : (
      /*
       * 刻意不接 `onRevealFolder`：内建的资源浏览器由宿主的 `assets.browser` 传选中态，编辑器
       * 没有把选中收成受控，因此它此刻做得到的只有「把资源标签挪到前面来」——而菜单上写的是
       * 「打开此文件夹」。不接则那一项整个不出现，比出现一个只挪面板的入口好。宿主自己控制
       * 选中时把它传进来即可，面板那一侧已经就绪。
       */
      <ComposeComponentLibraryPanel
        registry={controller.registry}
        store={componentWorkspace.store}
        shelf={workspaceSession.palette}
        toolbarPresetIds={toolbarPresetIds}
        // 排法住偏好：它回答「我想怎么看」，不产生事务、不进撤销历史。
        mode={resolvedPreferences.palette.mode}
        onModeChange={(mode) => {
          updatePreferences({ ...resolvedPreferences, palette: { ...resolvedPreferences.palette, mode } })
        }}
        onCustomize={() => workspaceSession.openDialog('palette')}
        onShelfChange={workspaceSession.setPaletteShelf}
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

  const content = {
      sceneGraphPanel: slots?.sceneGraph !== undefined
        ? slots.sceneGraph
        : (
            <ComposeSceneTree {...resolvedSceneTreeProps} />
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
            toolbarItems: resolvedToolbarItems,
          }),
      children: slots?.stage !== undefined
        ? slots.stage
        : controller?.renderStage({
          commands: stageCommands,
          ...(addComponentMenu
            ? {
                addComponentMenu: addComponentMenu.groups,
                onAddComponent: (itemId: string, clientPoint: { readonly x: number, readonly y: number }) => {
                  const item = addComponentMenu.items.get(itemId)
                  if (!item) return
                  /*
                   * 走与「从物料面板拖进来」**同一个** `externalDrop`：落点是右键那一下，
                   * 容器类升格为新场景、其余落进激活场景并保留世界落点，这条规则一个字不改。
                   */
                  controller.interactionController.send({
                    type: 'external.add',
                    item: createComponentLibraryStageItem(item),
                    clientPoint,
                  })
                },
              }
            : {}),
          services: {
            assetResolver: resolvedAssetResolver,
            scriptModuleLoader: pages?.scriptModuleLoader,
          },
          // 动画模式拖拽锁定原父级：拖动表达姿态编辑（关键帧/offset），不得跨场景挂载——
          // 否则对象被静默挂进激活场景，后续打点全部落进别块场景的动画。
          policy: {
            lockGestureParent: animationMode.active || undefined,
            transformGizmo: controller.transformGizmo,
          },
          onToolChange: controller.setTool,
          scriptScope: activePageSession?.scriptScope,
          // 无选择时 Frame 动作与辅助线的回退目标是页面的激活场景，不是第一个根 Frame。
          ...(pageActiveFrameId ? { activeFrameId: pageActiveFrameId } : {}),
          // 激活写在页面文件里，只有存在页面会话时才谈得上"切换激活场景"。
          ...(activePageSession ? { onSceneActivate: handleActiveFrameChange } : {}),
          onScenePreview,
          // 动画模式：画布显示播放头时刻的采样文档与配套布局；dispatch 不变，仍打在基础文档上。
          // 运动路径只在此分支注入：退出动画模式即随 spread 一起消失。
          ...(animationMode.active && animationMode.animationId && animationStageDocument
            ? {
                document: animationStageDocument,
                layoutSnapshot: animationStageSnapshot,
                editablePath: motionPath.editablePath,
                editablePathActiveVertexId: motionPath.activeVertexId,
                onEditablePathChange: motionPath.onEditablePathChange,
                onEditablePathVertexToggle: motionPath.onEditablePathVertexToggle,
              }
            : {}),
          shortcuts: resolvedPreferences.shortcuts,
        }) ?? 'Compose Editor',
      inspectorPanel: resolvedInspectorPanel,
      // 空动画的创建引导：空态 = 会话镜像没有动画。已绑定但镜像缺失（撤销越过水合事务
      // 或文件加载失败）给「载入」入口；未绑定且有活动页面给「创建」入口（创建动画文件
      // 并绑定当前页面）；其余宿主（纯插槽、组件文档）看到中性提示。
      animationEmptyState: (() => {
        if (!controller) return undefined
        if (activePageFrameAnimationSource && animationMode.animationId === null) {
          return (
            <div className="compose-editor__animation-empty">
              <p>{editorMessages.animationMode.mirrorMissing}</p>
              <ComposeButton size="sm" variant="secondary" onClick={handleLoadBoundAnimation}>
                {editorMessages.animationMode.loadAnimation}
              </ComposeButton>
            </div>
          )
        }
        return (
          <div className="compose-editor__animation-empty">
            <p>{editorMessages.animationMode.emptyTimeline}</p>
            {(activePageSession && pageProvider) || activeComponentSession ? (
              <ComposeButton
                size="sm"
                variant="secondary"
                onClick={() => { void handleCreateAnimationFromEmptyState() }}
              >
                {editorMessages.animationMode.createAnimation}
              </ComposeButton>
            ) : null}
          </div>
        )
      })(),
      // 空态触发条件是「镜像无动画」而不是「无轨道」：已绑定且零轨道显示正常时间线。
      animationEmpty: animationMode.animationId === null,
      animationEditing: animationMode.active,
      toggleAnimationEditing: activeDocumentChrome === undefined ? undefined : toggleAnimationMode,
      transactionLogPanel: slots?.transactionLog,
      commandPanel: slots?.command !== undefined
        ? slots.command
        // eslint-disable-next-line react-hooks/refs -- 切模式要在事件里操作 Dockview（加/删时间线面板），读 ref 是它的本分；这里只是把回调交出去，渲染期不会调用它。
        : addDefaultElementProps(controller?.commandPanel, {
            onOpenSettings: toggleSettings,
            shortcuts: resolvedPreferences.shortcuts,
            // 文档级动作住在编辑器这一层；控制器不认识文档会话。
            onSaveDocument: saveActiveDocument,
            canSaveDocument: canSaveActiveDocument,
            onToggleAnimationMode: canSaveActiveDocument ? toggleAnimationMode : undefined,
            animationTimelineMissing: !timelinePanelPresent,
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
      documents,
      // 未启用页面系统时固定画布就是那个「文档」；标签条据此画出一个不可关闭的画布标签。
      activeDocumentPanelId: activeDocumentPanelId
        ?? (pages === undefined && components === undefined ? WORKSPACE_PANEL_IDS.canvas : null),
      activateDocument,
      entryLayerPanelIds: componentEntry.layerPanelIds,
      entryOriginPanelId: componentEntry.originPanelId,
      exitEntryLayerTo: componentEntry.exitTo,
      libraryOpen: libraryOpen && libraryPort !== undefined,
      ...(libraryPort === undefined ? {} : { openLibrary }),
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
      openCommandPanel,
      paletteCatalog,
      sideCollapsed: sideCollapse.collapsed,
      toggleSide: sideCollapse.toggle,
      hosts,
      workspace: workspaceSession,
    }
  const handleHistoryShortcut = useComposeHistoryShortcuts(
    resolvedHistory ?? disabledHistory,
    {
      undo: resolvedPreferences.shortcuts['history.undo'],
      redo: resolvedPreferences.shortcuts['history.redo'],
    },
  )
  /** 外层 Dockview 就绪：只需要建立中央面板（内层 Dockview 的宿主）和 bottom Edge Group。 */
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
        // 新建的变体落在资源根（`parentId: null`），因此这里的空路径是真的。
        folderPath: [],
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
    if (dockviewApiRef.current) {
      localizeWorkspace(
        dockviewApiRef.current,
        resolvedPreferences.locale,
        hostI18n?.formatMessage,
      )
      // 物料面板的标签名是**工作区**的东西（页面「基础组件」/ 绘图「符号库」），而
      // localizeWorkspace 只知道语言：换完语言要把货架的标题再写回去。
      setWorkspacePaletteTitle(
        dockviewApiRef.current,
        workspacePaletteTitle,
      )
    }
  }, [hostI18n?.formatMessage, resolvedPreferences.locale, workspacePaletteTitle])

  /*
   * 属性面板的对象语义住在**标签**上（`属性 · 矩形`），面板里因此不再有那条 52px 的标题行。
   * 变的只有文字——标签的位置与它左侧的图标不动，否则跟着选区变的标签会让用户以为面板被换掉。
   */
  // 下钻进实例内部时被检查的是内部实体，它不在宿主文档里——标签要跟着**面板正在显示的那个**。
  const inspectorSubject = controller?.instanceInnerSelection?.entity.name
    ?? selectedControllerEntity?.name
    /*
     * 没有选择时面板显示的是**页面配置**，它的语义同样住在标签上。此前它在面板里另起了一条
     * 52px 的标题行——那正是这条规则要删掉的东西，实体那一侧删了、页面这一侧漏了：一条只在
     * 「点空白」时冒出来的标题行，把三块面板的头从「标签 + 一条 chrome」变成了三层。
     * 判据与页面配置面板自己的 `hasPageContext` 是同一个：有没有活动页面会话。
     */
    ?? (activePageSession && (controller?.selectedIds?.length ?? 0) === 0
      ? editorMessages.pageInspector.title
      : undefined)
  const inspectorPanelTitle = inspectorSubject
    ? `${editorMessages.workspace.inspector} · ${inspectorSubject}`
    : editorMessages.workspace.inspector
  useEffect(() => {
    if (!dockviewApiRef.current) return
    setWorkspacePanelTitle(
      dockviewApiRef.current,
      WORKSPACE_PANEL_IDS.inspector,
      inspectorPanelTitle,
    )
  }, [inspectorPanelTitle, workspaceReady])

  // 宿主在挂载后提供或撤掉历史控制器：历史标签跟着加入或关掉，工具组的其余部分不重建。
  useEffect(() => {
    if (!workspaceReady || !dockviewApiRef.current) return
    syncWorkspaceHistoryPanel(
      dockviewApiRef.current,
      historyEnabled,
      resolvedPreferences.locale,
      hostI18n?.formatMessage,
    )
  }, [historyEnabled, hostI18n?.formatMessage, resolvedPreferences.locale, workspaceReady])

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
          /*
           * 保存走**键位表**而不是硬接 `Cmd/Ctrl+S`：硬接的键既不在命令面板里、用户也没法
           * 在设置的键位页改。默认值仍是 `Cmd/Ctrl+S`，改绑之后这里自动跟着走。
           */
          if (
            !event.defaultPrevented
            && canSaveActiveDocument
            && !event.nativeEvent.isComposing
            && !isEditableKeyboardTarget(event.target)
            && resolvedPreferences.shortcuts['document.save'].some((binding) =>
              isComposeEditorKeybindingMatch(
                event.nativeEvent,
                binding,
                typeof navigator === 'undefined' ? '' : navigator.platform,
              ))
          ) {
            event.preventDefault()
            void activeDocumentChrome?.save?.()
            return
          }
          if (resolvedHistory && !event.defaultPrevented) handleHistoryShortcut(event)
        }}
      >
        <ComposeAnimationPanelProvider
          {...(animationMode.panelValue
            ? {
                value: animationMode.panelValue,
                onValueChange: handleAnimationPanelValueChange,
                onAction: handleAnimationPanelAction,
              }
            : {})}
        >
        <ComposeToolbarShelfContext.Provider value={toolbarShelfContext}>
        <WorkspaceContentContext.Provider value={content}>
          {/* 面板内容住在 Dockview 之外的稳定宿主元素里；Dockview 面板只把它们搬进盒子。 */}
          <WorkspacePortals />
          <WorkspaceDialogs />
          <div
            className="compose-editor__workspace"
            ref={setWorkspaceElement}
          >
            <EditorTopBar />
            <div className="compose-editor__body">
              {/*
                * 组头上没有折叠按钮、边缘也没有把手：折叠的唯一入口是应用顶栏右端那三颗开关。
                *
                * 页面库压在 Dockview **之上**而不是取代它：卸载 Dockview 会连布局、面板宿主与
                * 正在取点的命令一起销毁，而「回库看一眼再回来」是一次导航，不是一次重启。
                * 它盖着的那一层用 `inert` 收走焦点与读屏——留在 Tab 序里的话，`Tab` 会走进
                * 一块用户此刻看不见的画布。
                */}
              <div className="compose-editor__dockview-layer" inert={libraryOpen || undefined}>
                <DockviewReact
                  className="compose-editor__dockview"
                  components={workspaceComponents}
                  disableFloatingGroups
                  onReady={handleReady}
                  tabComponents={workspaceTabComponents}
                  theme={workspaceTheme}
                />
              </div>
              {libraryOpen && libraryPort !== undefined ? (
                <ComposeLibraryBrowser
                  className="compose-editor__library"
                  onOpenPage={(pageKey) => { void openPageFromLibrary(pageKey) }}
                  port={libraryPort}
                  {...(libraryRenderPage === undefined ? {} : { renderPage: libraryRenderPage })}
                />
              ) : null}
            </div>
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
                          // 页面与组件都有 displayName；只有临时资源文档退回文件名。
                          'displayName' in pendingAssetDocument
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
          {pageNotice === null && componentNotice === null
            && homePageMissingNotice === null ? null : (
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
        </ComposeToolbarShelfContext.Provider>
        </ComposeAnimationPanelProvider>
      </EditorRoot>
      </ComposeColorHistoryProvider>
    </ComposeUIProvider>
  )
}
