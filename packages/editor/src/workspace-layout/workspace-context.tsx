import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { ComposeAssetEntry, ComposeAssetProvider } from '@compose-ui/assets'
import type { ComposeAnimationFile } from '@compose-ui/animation'
import type { ComposeScriptIntelligenceProfile } from '@compose-ui/asset-browser'
import type {
  ComposeComponentAssetV1,
  ComposePageFile,
  ComposeResolvedComponentSnapshot,
  TransactionRuntime,
} from '@compose-ui/core'
import type { ComposePageScriptScope } from '@compose-ui/script-runtime'
import type {
  ComposeHistoryNavigationController,
  ComposeHistoryShortcuts,
} from '@compose-ui/history'
import type { ComposeWorkspaceSide, ComposeWorkspaceSideCollapsed } from './use-side-collapse'
import type { ComposeWorkspaceSessionHandle } from './use-workspace-session'
import type { WorkspaceHostElements } from './workspace-hosts'

export interface WorkspaceContent {
  sceneGraphPanel?: ReactNode
  componentLibraryPanel?: ReactNode
  history?: ComposeHistoryNavigationController
  historyPanel?: ReactNode
  historyShortcuts?: ComposeHistoryShortcuts
  stageToolbar?: ReactNode
  children?: ReactNode
  inspectorPanel?: ReactNode
  /** 时间线空态（无绑定动画/镜像缺失）的引导内容；缺省时面板显示中性空提示。 */
  animationEmptyState?: ReactNode
  /** 受控的时间线空态：会话镜像没有动画即为 true；缺省回退面板自身的轨道判定。 */
  animationEmpty?: boolean
  /**
   * 动画编辑开关此刻是否开着。
   *
   * @remarks
   * 它承载动画模式的语义那一半（采样显示、自动记录、父级锁定），是编辑器会话状态；时间线面板
   * 只是它的可见依据。面板 chrome 上的开关读它，`toggleAnimationEditing` 翻转它。
   */
  animationEditing?: boolean
  /** 翻转动画编辑开关；没有页面 / 组件文档时缺席，chrome 上就没有那颗按钮。 */
  toggleAnimationEditing?: () => void
  transactionLogPanel?: ReactNode
  commandPanel?: ReactNode
  assetBrowserPanel?: ReactNode
  /**
   * 唯一允许渲染 Stage 的文档 key。
   *
   * @remarks
   * Stage 持有 interaction controller 的独占 surface，同时渲染两份会抛
   * 「already has a connected surface」。画布面板按它决定给哪个文档表面渲染 Stage；未启用
   * 页面系统时它是固定画布自己的 id。
   */
  stageHostPanelId: string
  /** 当前打开的文档会话，按文档 key 索引；Map 的插入顺序就是标签条的顺序。 */
  documents: ReadonlyMap<string, ComposeWorkspaceDocumentSession>
  /** 活动文档的 key；没有打开文档时为 null。 */
  activeDocumentPanelId: string | null
  /** 激活一个已打开的文档；标签条与重复打开都走它。 */
  activateDocument: (panelId: string) => void
  /**
   * 此刻压在别的文档之上的层。
   *
   * @remarks
   * 层是会话但**不是标签**：从场景树进入一个组件是当前文档上的一次导航，不是打开了另一份
   * 文件。标签条把这些 panelId 从条目里剔除，因此层也没有关闭控件——离开一层的唯一出口是返回。
   */
  entryLayerPanelIds?: readonly string[]
  /**
   * 层存续期间标签条应当高亮的那一条——来路的栈底。
   *
   * @remarks
   * 用户仍站在那份文档上，只是进了它内部的一层。缺席或为 `null` 时标签条照旧高亮当前文档。
   */
  entryOriginPanelId?: string | null
  /**
   * 回到来路里的某一段。
   *
   * @remarks
   * 画布列头的面包屑点一个祖先走它。它与场景树根行的返回是**同一条实现**的两个入口——
   * 一个面包屑，它的前几段点下去什么都不发生的话，画它就是在撒谎。
   */
  exitEntryLayerTo?: (panelId: string) => void
  /**
   * 此刻 body 上是页面库那一屏。
   *
   * @remarks
   * 页面库是 body 的一种状态而不是第二个应用：顶栏不变、body 换成它——「回库」与「切到另一份
   * 图」是同类动作（去哪儿），做成两个应用会让它们住在两个地方，而它们在屏幕上紧挨着。
   * 这一档不渲染工作区切换器：那一屏没有画布，因而没有工作区。
   */
  libraryOpen?: boolean
  /**
   * 回页面库；顶栏最左那颗标志走它。
   *
   * @remarks
   * 缺席即宿主没有接页面库端口，标志照旧只是应用菜单的把手。
   */
  openLibrary?: () => void
  /**
   * 自定义物料面板对话框要用的两份目录：当前可见的基础 Preset，与资源里存在的文件夹路径。
   *
   * @remarks
   * 走 content 而不是给对话框传 prop，是因为 `WorkspaceDialogs` 由 `dialog` 状态自己驱动、
   * 中间隔着整棵工作区 chrome；而这两份都是**已经求值好的可呈现数据**，不是 Store 或 Registry
   * 句柄——对话框因此仍然不认识资源协议。缺席即两列为空，宿主不接组件资源时正是如此。
   */
  paletteCatalog?: {
    readonly presets: readonly { readonly id: string; readonly label: string }[]
    readonly folders: readonly (readonly string[])[]
  }
  /** 左右两侧此刻收没收起；把手与面板头上的折叠按钮都读它。 */
  sideCollapsed: ComposeWorkspaceSideCollapsed
  /** 收起或展开一侧。 */
  toggleSide: (side: ComposeWorkspaceSide) => void
  /**
   * 各面板内容的稳定宿主元素。
   *
   * @remarks
   * 面板内容不直接挂在 Dockview 面板里，而是各自渲染进一个在编辑器实例生命周期内一直存在的
   * 元素（经 portal）；Dockview 面板挂载时只把这个元素搬进自己的盒子。`fromJSON` 重建面板之后
   * 同一个元素被搬进新盒子，一个 React 组件都不重挂载——正在取点的命令继续等它的点。
   */
  hosts: WorkspaceHostElements
  /** 工作区会话；纯插槽宿主没有画布会话开关时也有（只是不换开关）。 */
  workspace: ComposeWorkspaceSessionHandle
  registerDocumentSave: (
    panelId: string,
    save: (() => Promise<boolean>) | null,
  ) => void
  setDocumentDirty: (panelId: string, dirty: boolean) => void
  setAssetDocumentSaved: (panelId: string, entry: ComposeAssetEntry) => void
  requestDocumentClose: (panelId: string) => void
  /** 保存指定文档；页面标签据此提供显式保存入口。 */
  saveDocument: (panelId: string) => void
  /**
   * 打开底部的命令面板：展开底栏并把它设为活动面板。
   *
   * @remarks
   * 应用菜单里那一项走它。命令面板是 Dockview 的一个面板，底栏收起时 `setActive` 到不了它，
   * 因此这两步必须一起做——只做后一步的症状是「点了菜单什么都没发生」。
   */
  openCommandPanel: () => void
  settingsOpen: boolean
  settingsPanelId: string
  setSettingsButton: (element: HTMLButtonElement | null) => void
  toggleSettings: () => void
}

/** 文档会话共有的关闭与保存契约。 @internal */
interface ComposeDocumentSessionBase {
  readonly panelId: string
  readonly dirty: boolean
  readonly save: (() => Promise<boolean>) | null
}

/** Editor 实例内的临时资源文档会话；不写入 Dockview 布局或 ComposeDocument。 @internal */
export interface ComposeAssetDocumentSession extends ComposeDocumentSessionBase {
  readonly kind: 'asset'
  readonly provider: ComposeAssetProvider
  readonly entry: ComposeAssetEntry
  /** 只读标签：不注册保存、不显示未保存指示、关闭时不需要确认。 */
  readonly readOnly: boolean
  /** 由 Editor 为特定脚本会话选择的隐藏类型分析 Profile。 */
  readonly scriptIntelligence?: ComposeScriptIntelligenceProfile
}

/**
 * 一个已打开页面的编辑会话。
 *
 * @remarks
 * 每个页面拥有独立的事务运行时，因此各页面的撤销历史在切换标签后仍然保留。会话只存在于
 * Editor 实例内，不写入 Dockview 布局。
 * @internal
 */
export interface ComposePageDocumentSession extends ComposeDocumentSessionBase {
  readonly kind: 'page'
  readonly provider: ComposeAssetProvider
  readonly entry: ComposeAssetEntry
  /** 页面的稳定资源 key。 */
  readonly pageKey: string
  /** 去掉页面后缀的用户可见名称。 */
  readonly displayName: string
  /** 最近一次成功读取或写入的完整页面聚合。 */
  readonly page: ComposePageFile
  readonly runtime: TransactionRuntime
  /** 当前页面标签独占的 setup 作用域。 */
  readonly scriptScope?: ComposePageScriptScope
  /** 最近一次成功读写得到的 Provider revision，用于乐观并发。 */
  readonly baseRevision: string | undefined
  /** 与运行时 revision 比较以判定脏状态的基线。 */
  readonly savedRevisionId: number
  /**
   * 按动画文件 assetKey 分桶的会话状态。
   *
   * @remarks
   * 一个页面的多块场景各自持有 `Animations.source`，且通常都指向同一份文件——文件内部按
   * Frame 分区。因此桶必须以**文件**为单位而不是以 Frame 为单位：entryId 与 revision 属于
   * 文件，保存时每份文件只写一次；各 Frame 的清单基线放在 `baseline` 的对应分区里。
   */
  readonly animationFiles: ReadonlyMap<string, ComposePageAnimationFileState>
}

/** 一份绑定动画文件的会话状态。 @internal */
export interface ComposePageAnimationFileState {
  /** Provider 条目 ID，写回时作为 `writeFile.fileId` 使用。 */
  readonly entryId: string
  /** 条目的文件名；保存失败提示按名字指认文件，assetKey 可能是不可读的机器键。 */
  readonly entryName: string
  /** 最近一次读写得到的 revision，用于保存回写的乐观并发。 */
  readonly revision: string
  /** 当前落盘的文件基线；保存时与各 Frame 的文档镜像比较，判断是否需要回写。 */
  readonly baseline: ComposeAnimationFile
}

/** 一个 Base 或 Variant 的独立编辑会话。 @internal */
export interface ComposeComponentDocumentSession extends ComposeDocumentSessionBase {
  readonly kind: 'component'
  readonly assetKey: string
  readonly displayName: string
  readonly sourceKind: ComposeComponentAssetV1['kind']
  readonly asset: ComposeComponentAssetV1
  readonly snapshot: ComposeResolvedComponentSnapshot
  readonly runtime: TransactionRuntime
  readonly baseRevision: string
  readonly savedRevisionId: number
}

/** 中央 Canvas Group 中可关闭的文档会话。 @internal */
export type ComposeWorkspaceDocumentSession =
  | ComposeAssetDocumentSession
  | ComposePageDocumentSession
  | ComposeComponentDocumentSession

export const WorkspaceContentContext = createContext<WorkspaceContent | null>(null)

export function useWorkspaceContent() {
  const content = useContext(WorkspaceContentContext)

  if (content === null) {
    throw new Error('Workspace panels must be rendered inside ComposeEditor')
  }

  return content
}
