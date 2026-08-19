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
import type { DockviewReadyEvent } from 'dockview-react'

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
  /** 当前编辑模式；驱动页面文档工具栏的 设计/动画 切换器。 */
  editorMode?: 'design' | 'animation'
  /** 模式切换回调；由 compose-editor 集中完成会话与底部 Dockview 重组。 */
  onEditorModeChange?: (mode: 'design' | 'animation') => void
  transactionLogPanel?: ReactNode
  commandPanel?: ReactNode
  assetBrowserPanel?: ReactNode
  /**
   * 外层工作区唯一中央面板挂载内层 scene/canvas/inspector Dockview 时调用。
   *
   * @remarks
   * 内层 Dockview 是通过外层 `core` 面板组件渲染的，不能直接从 `ComposeEditor` 拿到它的
   * `onReady` 事件；这里把回调经 Context 往下传，内层组件就绪后再往上转发。
   */
  onCoreDockviewReady: (event: DockviewReadyEvent) => void
  /**
   * 唯一允许渲染 Stage 的面板 ID。
   *
   * @remarks
   * Stage 持有 interaction controller 的独占 surface，同时渲染两份会抛
   * 「already has a connected surface」。Dockview 会保留同组内非活动面板的挂载，因此不能
   * 依赖「只有活动面板才渲染」，必须由这里显式指定单一宿主。
   */
  stageHostPanelId: string
  /** 当前打开的文档会话，按 Dockview panel ID 索引。 */
  documents: ReadonlyMap<string, ComposeWorkspaceDocumentSession>
  registerDocumentSave: (
    panelId: string,
    save: (() => Promise<boolean>) | null,
  ) => void
  setDocumentDirty: (panelId: string, dirty: boolean) => void
  setAssetDocumentSaved: (panelId: string, entry: ComposeAssetEntry) => void
  requestDocumentClose: (panelId: string) => void
  /** 保存指定文档；页面标签据此提供显式保存入口。 */
  saveDocument: (panelId: string) => void
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
