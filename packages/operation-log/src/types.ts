/** 操作日志的业务分类。 */
export type OperationLogCategory = 'component' | 'scene' | 'property' | 'binding'

/** 一条日志涉及的组件或属性目标。 */
export interface OperationLogTarget {
  /** 被操作组件的稳定 ID。 */
  componentId?: string
  /** 记录时的可读组件名称。 */
  componentLabel?: string
  /** 属性或子目标在组件数据中的路径。 */
  path?: readonly (string | number)[]
}

/** 快照持久化后的标记值。 */
export type OperationLogEncodedValue =
  | null
  | boolean
  | number
  | string
  | readonly OperationLogEncodedValue[]
  | { readonly [key: string]: OperationLogEncodedValue }

/** before、after 或 metadata 的可展示持久化快照。 */
export interface OperationLogSnapshot {
  /** 快照是否完整、已截断或无法保存。 */
  status: 'complete' | 'truncated' | 'unavailable'
  /** 即使内容截断或不可用也可直接显示的短预览。 */
  preview: string
  /** 编码后完整内容的 UTF-8 字节数；不可用时为零。 */
  byteLength: number
  /** 未超出上限时保存的标记编码值。 */
  value?: OperationLogEncodedValue
  /** 无法编码时的可读原因。 */
  reason?: string
}

/** 记录一次成功操作所需的数据。 */
export interface OperationLogRecordInput {
  /** 稳定动作名，例如 `property.change`。 */
  action: string
  /** 用于筛选的一级业务分类。 */
  category: OperationLogCategory
  /** 面向用户的简短操作摘要。 */
  summary: string
  /** 本次操作涉及的组件或属性目标。 */
  targets?: readonly OperationLogTarget[]
  /** 产生操作的宿主区域，例如 `property-panel`。 */
  source?: string
  /** 成功变更前的可选业务值。 */
  before?: unknown
  /** 成功变更后的可选业务值。 */
  after?: unknown
  /** 不属于前后值的可选结构化补充信息。 */
  metadata?: Readonly<Record<string, unknown>>
}

/** 可选的连续操作合并设置。 */
export interface OperationLogRecordOptions {
  /** 允许与紧邻记录合并的宿主稳定 key；省略时永不合并。 */
  coalesceKey?: string
  /** 合并时间窗口，单位毫秒。 @defaultValue 800 */
  coalesceWindowMs?: number
}

/** 可选的操作者信息。 */
export interface OperationLogActor {
  /** 宿主用户或自动化主体的稳定 ID。 */
  id: string
  /** 日志详情中显示的可选名称。 */
  label?: string
}

/** 已生成并可以持久化的操作日志。 */
export interface OperationLogEntry {
  /** 日志条目的全局唯一 ID。 */
  id: string
  /** 宿主提供的持久化隔离 ID。 */
  scopeId: string
  /** 当前 Provider 生命周期生成的会话 ID。 */
  sessionId: string
  /** 稳定动作名。 */
  action: string
  /** 一级业务分类。 */
  category: OperationLogCategory
  /** 面向用户的操作摘要。 */
  summary: string
  /** 操作涉及的全部目标。 */
  targets: readonly OperationLogTarget[]
  /** 产生操作的宿主区域。 */
  source?: string
  /** Provider 记录的可选操作者。 */
  actor?: OperationLogActor
  /** 第一次操作前的快照。 */
  before?: OperationLogSnapshot
  /** 最后一次操作后的快照。 */
  after?: OperationLogSnapshot
  /** 可选补充元数据快照。 */
  metadata?: OperationLogSnapshot
  /** 独立记录或合并序列第一次发生的客户端时间。 */
  startedAt: number
  /** 独立记录或合并序列最后一次更新的客户端时间。 */
  updatedAt: number
  /** 合并到当前条目中的成功操作次数。 */
  count: number
}

/** 日志持久化适配器。 */
export interface OperationLogStore {
  /** 按更新时间倒序读取指定 scope 的记录。 */
  load(scopeId: string): Promise<readonly OperationLogEntry[]>
  /** 新增或按 ID 覆盖一条记录。 */
  put(entry: OperationLogEntry): Promise<void>
  /** 删除指定 ID 的记录；不存在的 ID 可以忽略。 */
  remove(ids: readonly string[]): Promise<void>
  /** 删除指定 scope 的全部记录。 */
  clear(scopeId: string): Promise<void>
}

/** Provider 和面板共享的日志状态。 */
export interface OperationLogState {
  /** 初始读取、正常可用或内存降级状态。 */
  status: 'loading' | 'ready' | 'degraded'
  /** 当前 scope 按更新时间倒序排列的记录。 */
  entries: readonly OperationLogEntry[]
}

/** 日志记录、刷新和清理控制器。 */
export interface OperationLogController extends OperationLogState {
  /** 记录一条已成功应用的宿主数据变更。 */
  record(input: OperationLogRecordInput, options?: OperationLogRecordOptions): Promise<OperationLogEntry>
  /** 等待待写入任务后重新读取当前 scope。 */
  refresh(): Promise<void>
  /** 程序化清除当前 scope；默认面板不暴露此操作。 */
  clear(): Promise<void>
}
