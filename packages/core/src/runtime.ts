import { validateComposeDocument } from './document'
import { applyDocumentPatches, jsonEqual } from './patches'
import {
  asBatchCommands,
  BUILTIN_COMMAND_TYPES,
  createBuiltinCommandHandlers,
} from './builtin-commands'
import type { ComposeDocument, DocumentValidator } from './document-types'
import type {
  CommandDispatchResult,
  CommandHandler,
  CommandIssue,
  DocumentPatch,
  DocumentPath,
  EditorCommand,
  EditorTransaction,
  TransactionHistoryEntry,
  TransactionResetResult,
  TransactionRuntime,
  TransactionRuntimeEvent,
  TransactionRuntimeOptions,
  TransactionRuntimeState,
} from './command-types'

type TimelineEntry = {
  transaction: EditorTransaction
}

function defaultIdFactory() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `transaction-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function normalizeLimit(value: number | undefined, fallback: number) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : fallback
}

function commandIssue(code: string, message: string): CommandIssue {
  return { code, message }
}

function pathKey(path: DocumentPath): string {
  return path.map((segment) => `${typeof segment}:${String(segment)}`).join('/')
}

/**
 * 合并同一 mergeKey 下的连续事务 Patch。
 *
 * 色盘拖动等高频“同路径反复 set”场景下，中间帧的 set 对最终文档无贡献；
 * 保留最新 forward set 与最早 inverse，避免 undo 链随拖动帧数线性膨胀。
 */
function coalesceTransactionPatches(
  previousForward: readonly DocumentPatch[],
  previousInverse: readonly DocumentPatch[],
  nextForward: readonly DocumentPatch[],
  nextInverse: readonly DocumentPatch[],
): { readonly forward: readonly DocumentPatch[]; readonly inverse: readonly DocumentPatch[] } {
  const allForward = [...previousForward, ...nextForward]
  const allInverse = [...nextInverse, ...previousInverse]
  const onlySets = allForward.every((patch) => patch.op === 'set')
    && allInverse.every((patch) => patch.op === 'set')
  if (!onlySets || allForward.length === 0) {
    return { forward: allForward, inverse: allInverse }
  }

  const forwardByPath = new Map<string, DocumentPatch>()
  for (const patch of allForward) {
    if (patch.op === 'set') forwardByPath.set(pathKey(patch.path), patch)
  }
  // allInverse 为 [...nextInverse, ...previousInverse]；同路径最后一次 set 才是窗口起点旧值。
  const inverseByPath = new Map<string, DocumentPatch>()
  for (const patch of allInverse) {
    if (patch.op === 'set') inverseByPath.set(pathKey(patch.path), patch)
  }
  return {
    forward: [...forwardByPath.values()],
    inverse: [...inverseByPath.values()],
  }
}

function safeNotify<T>(listeners: ReadonlySet<(value: T) => void>, value: T) {
  for (const listener of listeners) {
    try {
      listener(value)
    }
    catch {
      // 订阅者属于运行时外部副作用；其同步异常也不能回滚已完成的状态转换。
    }
  }
}

/**
 * 创建同步、可逆且可订阅的事务运行时，文档类型由调用方决定。
 *
 * @remarks
 * 运行时对文档形状没有任何假设：克隆是 JSON 深拷贝，Patch 按路径寻址，合法性完全交给注入的
 * `validate`。`validate` 在这里是**必填**——若给它一个默认值，为其他文档类型创建运行时时
 * 漏传校验器会通过类型检查，却在运行时以无关的校验问题失败。面向 ComposeDocument 的
 * {@link createTransactionRuntime} 是本函数的特化。
 *
 * @param options - 初始文档、校验器、handler 与可控历史依赖。
 * @returns 同时满足文档控制、事件订阅和历史导航协议的运行时。
 * @throws 初始文档非法，或初始 handler type 重复时抛出配置错误。
 * @public
 */
export function createDocumentTransactionRuntime<TDocument extends object>(
  options: TransactionRuntimeOptions<TDocument> & {
    readonly validate: DocumentValidator<TDocument>
  },
): TransactionRuntime<TDocument> {
  const validate = options.validate
  const initialValidation = validate(options.document)
  if (!initialValidation.valid) {
    throw new Error(`Invalid document: ${initialValidation.issues[0]?.message ?? 'unknown'}`)
  }

  const handlers = new Map<string, CommandHandler<TDocument>>()
  const idFactory = options.idFactory ?? defaultIdFactory
  const clock = options.clock ?? Date.now
  const historyLimit = normalizeLimit(options.historyLimit, 100)
  const mergeWindowMs = normalizeLimit(options.mergeWindowMs, 750)
  const stateListeners = new Set<() => void>()
  const eventListeners = new Set<(event: TransactionRuntimeEvent<TDocument>) => void>()

  let document = initialValidation.document
  let baselineDocument = document
  let baselineLabel = options.initialLabel ?? '开始'
  let baselineVersion = 0
  let revision = 0
  let timeline: TimelineEntry[] = []
  let cursor = 0
  let snapshot: TransactionRuntimeState<TDocument>

  const entries = (): readonly TransactionHistoryEntry[] => [
    { id: `baseline-${baselineVersion}`, label: baselineLabel },
    ...timeline.map(({ transaction }) => ({
      id: transaction.id,
      label: transaction.label,
    })),
  ]

  const activeEntryId = () => cursor === 0
    ? `baseline-${baselineVersion}`
    : timeline[cursor - 1]?.transaction.id ?? null

  const buildSnapshot = (): TransactionRuntimeState<TDocument> => ({
    document,
    revision,
    entries: entries(),
    activeEntryId: activeEntryId(),
    canUndo: cursor > 0,
    canRedo: cursor < timeline.length,
  })
  snapshot = buildSnapshot()

  const notifyState = () => {
    snapshot = buildSnapshot()
    for (const listener of stateListeners) {
      try {
        listener()
      }
      catch {
        // 与事件订阅相同，宿主监听异常不能破坏已经完成的运行时状态。
      }
    }
  }
  const notifyEvent = (event: TransactionRuntimeEvent<TDocument>) => safeNotify(eventListeners, event)

  const reject = (
    command: EditorCommand,
    issues: readonly CommandIssue[],
  ): CommandDispatchResult => {
    const result = { status: 'rejected' as const, command, issues }
    notifyEvent({ type: 'rejected', command, issues })
    return result
  }

  const registerHandler = (handler: CommandHandler<TDocument>) => {
    if (handler.type.length === 0) throw new Error('Command handler type must not be empty')
    if (handler.type === BUILTIN_COMMAND_TYPES.batch) {
      throw new Error(`Command handler type is reserved: ${handler.type}`)
    }
    if (handlers.has(handler.type)) {
      throw new Error(`Command handler type already registered: ${handler.type}`)
    }
    handlers.set(handler.type, handler)
    return () => {
      if (handlers.get(handler.type) === handler) handlers.delete(handler.type)
    }
  }

  // 内建 handler 不在这里注册：`entity.*` 那套是 ComposeDocument 的命令词汇，对其他文档
  // 类型是错的。batch 例外——它是事务原语而非文档命令，因此仍由本函数内联处理。
  for (const handler of options.handlers ?? []) registerHandler(handler)

  const executeHandler = (
    currentDocument: TDocument,
    command: EditorCommand,
  ): ReturnType<CommandHandler<TDocument>['execute']> => {
    if (command.type === BUILTIN_COMMAND_TYPES.batch) {
      const batch = asBatchCommands(command)
      if ('code' in batch) return { status: 'rejected', issues: [batch] }
      let candidate = currentDocument
      const combined = []
      for (const childCommand of batch) {
        const childResult = executeHandler(candidate, childCommand)
        if (childResult.status === 'rejected') return childResult
        if (childResult.status === 'noop') continue
        const applied = applyDocumentPatches(candidate, childResult.patches)
        if (!applied.ok) {
          return {
            status: 'rejected',
            issues: [{
              code: applied.issue.code,
              message: applied.issue.message,
              path: applied.issue.path,
            }],
          }
        }
        const validation = validate(applied.document)
        if (!validation.valid) {
          return {
            status: 'rejected',
            issues: validation.issues.map((item) => ({
              code: item.code,
              message: item.message,
              path: item.path,
            })),
          }
        }
        candidate = validation.document
        combined.push(...childResult.patches)
      }
      return combined.length > 0
        ? { status: 'patches', patches: combined }
        : { status: 'noop', reason: 'batch 中没有实际修改' }
    }
    const handler = handlers.get(command.type)
    if (!handler) {
      return {
        status: 'rejected',
        issues: [commandIssue('command.unknown-type', `未注册命令类型 ${command.type}`)],
      }
    }
    return handler.execute(currentDocument, command)
  }

  const applyHistoryPatches = (patches: EditorTransaction['forward']) => {
    const result = applyDocumentPatches(document, patches)
    if (!result.ok) {
      // 已校验并记录的事务如果无法重放，说明运行时不变量被破坏，不能静默跨过历史。
      throw new Error(`Stored transaction patch is invalid: ${result.issue.message}`)
    }
    document = result.document
    revision += 1
  }

  const trimHistory = () => {
    if (timeline.length <= historyLimit) return
    const removeCount = timeline.length - historyLimit
    const removed = timeline.slice(0, removeCount)
    let promoted = baselineDocument
    for (const { transaction } of removed) {
      const result = applyDocumentPatches(promoted, transaction.forward)
      if (!result.ok) throw new Error(`Unable to promote history baseline: ${result.issue.message}`)
      promoted = result.document
    }
    baselineDocument = promoted
    baselineLabel = '较早状态'
    baselineVersion += 1
    timeline = timeline.slice(removeCount)
    cursor = Math.max(0, cursor - removeCount)
  }

  const runtime: TransactionRuntime<TDocument> = {
    get document() {
      return document
    },
    get revision() {
      return revision
    },
    get entries() {
      return snapshot.entries
    },
    get activeEntryId() {
      return snapshot.activeEntryId
    },
    get canUndo() {
      return snapshot.canUndo
    },
    get canRedo() {
      return snapshot.canRedo
    },
    getState() {
      return snapshot
    },
    subscribe(listener) {
      stateListeners.add(listener)
      return () => stateListeners.delete(listener)
    },
    subscribeEvents(listener) {
      eventListeners.add(listener)
      return () => eventListeners.delete(listener)
    },
    registerHandler,
    dispatch(command) {
      let handlerResult
      try {
        handlerResult = executeHandler(document, command)
      }
      catch (error) {
        return reject(command, [
          commandIssue(
            'handler.exception',
            error instanceof Error ? error.message : '命令处理器抛出未知异常',
          ),
        ])
      }

      if (handlerResult.status === 'rejected') return reject(command, handlerResult.issues)
      if (handlerResult.status === 'noop') {
        const result = { status: 'noop' as const, command, reason: handlerResult.reason }
        notifyEvent({ type: 'noop', command, reason: handlerResult.reason })
        return result
      }

      const applied = applyDocumentPatches(document, handlerResult.patches)
      if (!applied.ok) {
        return reject(command, [{
          code: applied.issue.code,
          message: applied.issue.message,
          path: applied.issue.path,
        }])
      }
      const validation = validate(applied.document)
      if (!validation.valid) {
        return reject(command, validation.issues.map((issue) => ({
          code: issue.code,
          message: issue.message,
          path: issue.path,
        })))
      }
      if (jsonEqual(document, validation.document)) {
        const result = { status: 'noop' as const, command, reason: '文档未发生变化' }
        notifyEvent({ type: 'noop', command, reason: result.reason })
        return result
      }

      const wasAtTimelineEnd = cursor === timeline.length
      if (!wasAtTimelineEnd) timeline = timeline.slice(0, cursor)
      const committedAt = clock()
      revision += 1
      const newTransaction: EditorTransaction = {
        id: idFactory(),
        commandId: command.id,
        commandType: command.type,
        label: command.meta?.label ?? command.type,
        source: command.meta?.source,
        targetIds: command.meta?.targetIds ?? [],
        mergeKey: command.meta?.mergeKey,
        forward: handlerResult.patches,
        inverse: applied.inverse,
        committedAt,
        beforeRevision: revision - 1,
        afterRevision: revision,
      }
      document = validation.document

      const previous = timeline[timeline.length - 1]?.transaction
      const coalesced = Boolean(
        previous
        && wasAtTimelineEnd
        && previous.mergeKey !== undefined
        && previous.mergeKey === newTransaction.mergeKey
        && committedAt - previous.committedAt <= mergeWindowMs,
      )
      let transaction = newTransaction
      if (coalesced && previous) {
        const patches = coalesceTransactionPatches(
          previous.forward,
          previous.inverse,
          newTransaction.forward,
          newTransaction.inverse,
        )
        transaction = {
          ...newTransaction,
          id: previous.id,
          beforeRevision: previous.beforeRevision,
          forward: patches.forward,
          inverse: patches.inverse,
        }
        timeline[timeline.length - 1] = { transaction }
      }
      else {
        timeline.push({ transaction })
        cursor += 1
        trimHistory()
      }
      if (coalesced) cursor = timeline.length

      notifyState()
      notifyEvent({ type: 'committed', command, transaction, coalesced })
      return { status: 'committed', transaction, coalesced }
    },
    undo() {
      if (cursor === 0) return
      const transaction = timeline[cursor - 1]?.transaction
      if (!transaction) return
      applyHistoryPatches(transaction.inverse)
      cursor -= 1
      notifyState()
      notifyEvent({
        type: 'history-navigation',
        direction: 'undo',
        transactionIds: [transaction.id],
        document,
      })
    },
    redo() {
      if (cursor >= timeline.length) return
      const transaction = timeline[cursor]?.transaction
      if (!transaction) return
      applyHistoryPatches(transaction.forward)
      cursor += 1
      notifyState()
      notifyEvent({
        type: 'history-navigation',
        direction: 'redo',
        transactionIds: [transaction.id],
        document,
      })
    },
    navigate(entryId) {
      const target = entryId === `baseline-${baselineVersion}`
        ? 0
        : timeline.findIndex(({ transaction }) => transaction.id === entryId) + 1
      if (target < 0 || target > timeline.length || target === cursor) return
      const transactionIds: string[] = []
      if (target < cursor) {
        for (let index = cursor - 1; index >= target; index -= 1) {
          const transaction = timeline[index]?.transaction
          if (!transaction) continue
          applyHistoryPatches(transaction.inverse)
          transactionIds.push(transaction.id)
        }
      }
      else {
        for (let index = cursor; index < target; index += 1) {
          const transaction = timeline[index]?.transaction
          if (!transaction) continue
          applyHistoryPatches(transaction.forward)
          transactionIds.push(transaction.id)
        }
      }
      cursor = target
      notifyState()
      notifyEvent({
        type: 'history-navigation',
        direction: 'navigate',
        transactionIds,
        document,
      })
    },
    reset(nextDocument, label = options.initialLabel ?? '开始'): TransactionResetResult {
      const validation = validate(nextDocument)
      if (!validation.valid) return { status: 'rejected', issues: validation.issues }
      document = validation.document
      baselineDocument = document
      baselineLabel = label
      baselineVersion += 1
      timeline = []
      cursor = 0
      revision += 1
      notifyState()
      notifyEvent({ type: 'reset', document })
      return { status: 'reset' }
    },
  }

  return runtime
}

/**
 * 创建同步、可逆且可订阅的 ComposeDocument 事务运行时。
 *
 * @remarks
 * {@link createDocumentTransactionRuntime} 在 ComposeDocument 上的特化：省略 `validate`
 * 时使用 `validateComposeDocument`。签名与注入化之前完全一致。
 *
 * @param options - 初始文档、handler 与可控历史依赖。
 * @returns 同时满足文档控制、事件订阅和历史导航协议的运行时。
 * @throws 初始文档非法，或初始 handler type 重复时抛出配置错误。
 * @public
 */
export function createTransactionRuntime(
  options: TransactionRuntimeOptions,
): TransactionRuntime {
  return createDocumentTransactionRuntime<ComposeDocument>({
    ...options,
    validate: options.validate ?? validateComposeDocument,
    // 内建 handler 先注册、宿主 handler 后注册，与注入化之前的顺序一致；重复 type 仍抛错。
    handlers: [...createBuiltinCommandHandlers(), ...(options.handlers ?? [])],
  })
}
