import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { ComposeAssetEntry, ComposeAssetProvider } from '@compose-ui/assets'
import type { TransactionRuntime } from '@compose-ui/core'
import type {
  ComposeHistoryNavigationController,
  ComposeHistoryShortcuts,
} from '@compose-ui/history'

export interface WorkspaceContent {
  sceneGraphPanel?: ReactNode
  componentLibraryPanel?: ReactNode
  history?: ComposeHistoryNavigationController
  historyPanel?: ReactNode
  historyShortcuts?: ComposeHistoryShortcuts
  stageToolbar?: ReactNode
  children?: ReactNode
  inspectorPanel?: ReactNode
  transactionLogPanel?: ReactNode
  commandPanel?: ReactNode
  assetBrowserPanel?: ReactNode
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
  readonly provider: ComposeAssetProvider
  readonly entry: ComposeAssetEntry
  readonly dirty: boolean
  readonly save: (() => Promise<boolean>) | null
}

/** Editor 实例内的临时资源文档会话；不写入 Dockview 布局或 ComposeDocument。 @internal */
export interface ComposeAssetDocumentSession extends ComposeDocumentSessionBase {
  readonly kind: 'asset'
  /** 只读标签：不注册保存、不显示未保存指示、关闭时不需要确认。 */
  readonly readOnly: boolean
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
  /** 页面的稳定资源 key。 */
  readonly pageKey: string
  /** 去掉页面后缀的用户可见名称。 */
  readonly displayName: string
  readonly runtime: TransactionRuntime
  /** 最近一次成功读写得到的 Provider revision，用于乐观并发。 */
  readonly baseRevision: string | undefined
  /** 与运行时 revision 比较以判定脏状态的基线。 */
  readonly savedRevisionId: number
}

/** 中央 Canvas Group 中可关闭的文档会话。 @internal */
export type ComposeWorkspaceDocumentSession =
  | ComposeAssetDocumentSession
  | ComposePageDocumentSession

export const WorkspaceContentContext = createContext<WorkspaceContent | null>(null)

export function useWorkspaceContent() {
  const content = useContext(WorkspaceContentContext)

  if (content === null) {
    throw new Error('Workspace panels must be rendered inside ComposeEditor')
  }

  return content
}
