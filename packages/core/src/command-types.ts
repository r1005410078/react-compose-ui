import type {
  ComposeDocument,
  DocumentValidationIssue,
  JsonObject,
  JsonValue,
} from './document-types'

/**
 * Patch 和命令用于定位 JSON 文档字段的路径。
 *
 * @public
 */
export type DocumentPath = readonly (string | number)[]

/**
 * 用新 JSON 值替换指定路径。
 *
 * @public
 */
export interface SetDocumentPatch {
  readonly op: 'set'
  readonly path: DocumentPath
  readonly value: JsonValue
}

/**
 * 在指定 JSON 数组中插入一个值。
 *
 * @public
 */
export interface InsertDocumentPatch {
  readonly op: 'insert'
  /** 指向目标数组本身的路径。 */
  readonly path: DocumentPath
  readonly index: number
  readonly value: JsonValue
}

/**
 * 删除指定对象字段或数组项。
 *
 * @public
 */
export interface RemoveDocumentPatch {
  readonly op: 'remove'
  readonly path: DocumentPath
}

/**
 * 在同一个 JSON 数组中移动一项。
 *
 * @public
 */
export interface MoveDocumentPatch {
  readonly op: 'move'
  /** 指向目标数组本身的路径。 */
  readonly path: DocumentPath
  readonly from: number
  readonly to: number
}

/**
 * 命令处理器能够返回的封闭文档 Patch 联合。
 *
 * @public
 */
export type DocumentPatch =
  | SetDocumentPatch
  | InsertDocumentPatch
  | RemoveDocumentPatch
  | MoveDocumentPatch

/**
 * Patch 应用失败时的稳定问题。
 *
 * @public
 */
export interface PatchIssue {
  readonly code: 'patch.invalid-path' | 'patch.invalid-index' | 'patch.invalid-value'
  readonly path: DocumentPath
  readonly message: string
}

/**
 * 一组 Patch 的原子应用结果。
 *
 * @public
 */
export type ApplyDocumentPatchesResult =
  | {
      readonly ok: true
      readonly document: ComposeDocument
      readonly inverse: readonly DocumentPatch[]
    }
  | { readonly ok: false; readonly issue: PatchIssue }

/**
 * 命令来源与时间线展示语义。
 *
 * @public
 */
export interface EditorCommandMeta {
  /** 历史和调试台中的用户可读动作名。 */
  readonly label?: string
  /** 产生命令的工作区或宿主区域。 */
  readonly source?: string
  /** 命令涉及的稳定 Entity ID。 */
  readonly targetIds?: readonly string[]
  /** 高频连续输入允许合并时使用的稳定 key。 */
  readonly mergeKey?: string
}

/**
 * 所有编辑入口派发的严格 JSON 命令。
 *
 * @public
 */
export interface EditorCommand<TPayload extends JsonObject = JsonObject> {
  /** 宿主生成的稳定命令 ID。 */
  readonly id: string
  /** 解析 CommandHandler 的稳定类型。 */
  readonly type: string
  /** 严格 JSON 可序列化的命令参数。 */
  readonly payload: TPayload
  /** 可选展示、来源、目标与合并语义。 */
  readonly meta?: EditorCommandMeta
}

/**
 * handler 或运行时拒绝命令时返回的问题。
 *
 * @public
 */
export interface CommandIssue {
  /** 供程序判断和 ComposeCommandPanel 显示的稳定机器码。 */
  readonly code: string
  /** 面向开发者或编辑器用户的简短说明。 */
  readonly message: string
  /** 可选命令或文档定位路径。 */
  readonly path?: DocumentPath
}

/**
 * 同步 CommandHandler 的结果。
 *
 * @public
 */
export type CommandHandlerResult =
  | { readonly status: 'patches'; readonly patches: readonly DocumentPatch[] }
  | { readonly status: 'noop'; readonly reason?: string }
  | { readonly status: 'rejected'; readonly issues: readonly CommandIssue[] }

/**
 * 一个实例级同步命令处理器。
 *
 * @public
 */
export interface CommandHandler {
  /** 该 handler 独占的命令 type。 */
  readonly type: string
  /**
   * 根据当前只读文档计算 Patch、noop 或 rejection。
   *
   * @param document - dispatch 开始时的完整文档。
   * @param command - type 与当前 handler 匹配的命令。
   */
  execute(document: ComposeDocument, command: EditorCommand): CommandHandlerResult
}

/**
 * 一次成功文档修改的可逆事务。
 *
 * @public
 */
export interface EditorTransaction {
  readonly id: string
  readonly commandId: string
  readonly commandType: string
  readonly label: string
  readonly source?: string
  readonly targetIds: readonly string[]
  readonly mergeKey?: string
  readonly forward: readonly DocumentPatch[]
  readonly inverse: readonly DocumentPatch[]
  readonly committedAt: number
  readonly beforeRevision: number
  readonly afterRevision: number
}

/**
 * dispatch 的同步判别结果。
 *
 * @public
 */
export type CommandDispatchResult =
  | {
      readonly status: 'committed'
      readonly transaction: EditorTransaction
      readonly coalesced: boolean
    }
  | { readonly status: 'noop'; readonly command: EditorCommand; readonly reason?: string }
  | {
      readonly status: 'rejected'
      readonly command: EditorCommand
      readonly issues: readonly CommandIssue[]
    }

/**
 * 事务历史面板展示的一条记录。
 *
 * @public
 */
export interface TransactionHistoryEntry {
  readonly id: string
  readonly label: string
}

/**
 * 运行时对订阅者公开的不可变快照。
 *
 * @public
 */
export interface TransactionRuntimeState {
  readonly document: ComposeDocument
  readonly revision: number
  readonly entries: readonly TransactionHistoryEntry[]
  readonly activeEntryId: string | null
  readonly canUndo: boolean
  readonly canRedo: boolean
}

/**
 * 事务运行时发布的调试与集成事件。
 *
 * @public
 */
export type TransactionRuntimeEvent =
  | {
      readonly type: 'committed'
      readonly command: EditorCommand
      readonly transaction: EditorTransaction
      readonly coalesced: boolean
    }
  | {
      readonly type: 'noop'
      readonly command: EditorCommand
      readonly reason?: string
    }
  | {
      readonly type: 'rejected'
      readonly command: EditorCommand
      readonly issues: readonly CommandIssue[]
    }
  | {
      readonly type: 'history-navigation'
      readonly direction: 'undo' | 'redo' | 'navigate'
      readonly transactionIds: readonly string[]
      readonly document: ComposeDocument
    }
  | { readonly type: 'reset'; readonly document: ComposeDocument }

/**
 * 创建 TransactionRuntime 时可注入的依赖与限制。
 *
 * @public
 */
export interface TransactionRuntimeOptions {
  readonly document: ComposeDocument
  readonly handlers?: readonly CommandHandler[]
  /** 事务 ID factory；不负责命令或基线 ID。 */
  readonly idFactory?: () => string
  /** 返回毫秒时间戳的可控时钟。 */
  readonly clock?: () => number
  /** 最多保留的可撤销事务数。 @defaultValue 100 */
  readonly historyLimit?: number
  /** 相同 mergeKey 的合并窗口。 @defaultValue 750 */
  readonly mergeWindowMs?: number
  /** 初始历史基线名称。 @defaultValue "开始" */
  readonly initialLabel?: string
}

/**
 * reset 的同步结果。
 *
 * @public
 */
export type TransactionResetResult =
  | { readonly status: 'reset' }
  | { readonly status: 'rejected'; readonly issues: readonly DocumentValidationIssue[] }

/**
 * React/DOM 无关的文档命令、事务和历史控制器。
 *
 * @remarks
 * 该接口在 entries、activeEntryId、canUndo、canRedo、undo、redo、navigate 上结构兼容
 * `@compose-ui/history` 的 ComposeHistoryNavigationController。
 *
 * @public
 */
export interface TransactionRuntime {
  readonly document: ComposeDocument
  readonly revision: number
  readonly entries: readonly TransactionHistoryEntry[]
  readonly activeEntryId: string | null
  readonly canUndo: boolean
  readonly canRedo: boolean
  getState(): TransactionRuntimeState
  subscribe(listener: () => void): () => void
  subscribeEvents(listener: (event: TransactionRuntimeEvent) => void): () => void
  dispatch(command: EditorCommand): CommandDispatchResult
  undo(): void
  redo(): void
  navigate(entryId: string): void
  reset(document: ComposeDocument, label?: string): TransactionResetResult
  registerHandler(handler: CommandHandler): () => void
}
