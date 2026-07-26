import type {
  ComposeOperationLogEntry,
  ComposeOperationLogRecordInput,
  ComposeOperationLogRecordOptions,
  ComposeOperationLogActor,
  ComposeOperationLogController,
  ComposeOperationLogState,
  ComposeOperationLogStore,
} from './types'
import { createComposeOperationLogSnapshot } from './snapshot'
import { createComposeMemoryOperationLogStore } from './stores'

export interface OperationLogRuntime extends ComposeOperationLogController {
  initialize(): Promise<void>
  getState(): ComposeOperationLogState
  subscribe(listener: () => void): () => void
}

export interface CreateOperationLogRuntimeOptions {
  scopeId: string
  sessionId?: string
  actor?: ComposeOperationLogActor
  store: ComposeOperationLogStore
  maxEntries?: number
  maxSnapshotBytes?: number
  now?: () => number
  createId?: () => string
  onStorageError?: (error: unknown) => void
}

export function createOperationLogRuntime(
  options: CreateOperationLogRuntimeOptions,
): OperationLogRuntime {
  const scopeId = options.scopeId.trim()
  if (!scopeId) throw new Error('Operation log scopeId is required')
  const sessionId = options.sessionId ?? globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}`
  const maxEntries = Math.max(1, Math.floor(options.maxEntries ?? 1000))
  const maxSnapshotBytes = Math.max(1, Math.floor(options.maxSnapshotBytes ?? 64 * 1024))
  const now = options.now ?? Date.now
  let generatedId = 0
  const createId = options.createId
    ?? (() => globalThis.crypto?.randomUUID?.() ?? `${sessionId}-${now()}-${++generatedId}`)
  const listeners = new Set<() => void>()
  const memoryStore = createComposeMemoryOperationLogStore()
  let activeStore = options.store
  let state: ComposeOperationLogState = { status: 'loading', entries: [] }
  let lastCoalesce: { id: string; key: string } | undefined
  let writeQueue = Promise.resolve()
  let initialized = false
  let initializePromise: Promise<void> | undefined

  const emit = () => listeners.forEach((listener) => listener())
  const updateState = (next: ComposeOperationLogState) => {
    state = next
    emit()
  }
  const degrade = async (error: unknown) => {
    options.onStorageError?.(error)
    activeStore = memoryStore
    await memoryStore.clear(scopeId)
    await Promise.all(state.entries.map((entry) => memoryStore.put(entry)))
    updateState({ status: 'degraded', entries: state.entries })
  }
  const enqueue = async (task: () => Promise<void>) => {
    const next = writeQueue.then(task, task)
    writeQueue = next.catch(() => undefined)
    try {
      await next
    } catch (error) {
      await degrade(error)
    }
  }
  const snapshotProperty = (
    input: ComposeOperationLogRecordInput,
    property: 'before' | 'after' | 'metadata',
  ) => Object.prototype.hasOwnProperty.call(input, property)
    ? createComposeOperationLogSnapshot(input[property], maxSnapshotBytes)
    : undefined

  const loadEntries = async () => {
    try {
      const storedEntries = await activeStore.load(scopeId)
      const entries = storedEntries.slice(0, maxEntries)
      await activeStore.remove(storedEntries.slice(maxEntries).map(({ id }) => id))
      updateState({ status: activeStore === memoryStore ? 'degraded' : 'ready', entries })
    } catch (error) {
      await degrade(error)
    }
    lastCoalesce = undefined
  }

  const initialize = () => {
    initializePromise ??= loadEntries().finally(() => {
      initialized = true
    })
    return initializePromise
  }

  const refresh = async () => {
    await writeQueue
    await loadEntries()
    initialized = true
  }

  const record = async (
    input: ComposeOperationLogRecordInput,
    recordOptions: ComposeOperationLogRecordOptions = {},
  ): Promise<ComposeOperationLogEntry> => {
    if (!initialized) await initialize()
    const timestamp = now()
    const head = state.entries[0]
    const windowMs = recordOptions.coalesceWindowMs ?? 800
    const canCoalesce = Boolean(
      recordOptions.coalesceKey
      && lastCoalesce?.key === recordOptions.coalesceKey
      && lastCoalesce.id === head?.id
      && head.sessionId === sessionId
      && timestamp - head.updatedAt <= windowMs,
    )
    const after = snapshotProperty(input, 'after')
    const metadata = snapshotProperty(input, 'metadata')
    let entry: ComposeOperationLogEntry
    let removedIds: readonly string[] = []
    if (canCoalesce && head) {
      entry = {
        ...head,
        action: input.action,
        category: input.category,
        summary: input.summary,
        targets: input.targets ? structuredClone(input.targets) : head.targets,
        source: input.source ?? head.source,
        after,
        metadata,
        updatedAt: timestamp,
        count: head.count + 1,
      }
      updateState({ ...state, entries: [entry, ...state.entries.slice(1)] })
    } else {
      entry = {
        id: createId(),
        scopeId,
        sessionId,
        action: input.action,
        category: input.category,
        summary: input.summary,
        targets: structuredClone(input.targets ?? []),
        source: input.source,
        actor: options.actor ? structuredClone(options.actor) : undefined,
        before: snapshotProperty(input, 'before'),
        after,
        metadata,
        startedAt: timestamp,
        updatedAt: timestamp,
        count: 1,
      }
      const allEntries = [entry, ...state.entries]
      removedIds = allEntries.slice(maxEntries).map(({ id }) => id)
      updateState({ ...state, entries: allEntries.slice(0, maxEntries) })
    }
    lastCoalesce = recordOptions.coalesceKey
      ? { id: entry.id, key: recordOptions.coalesceKey }
      : undefined
    await enqueue(async () => {
      await activeStore.put(entry)
      await activeStore.remove(removedIds)
    })
    return entry
  }

  const clear = async () => {
    updateState({ ...state, entries: [] })
    lastCoalesce = undefined
    await enqueue(() => activeStore.clear(scopeId))
  }

  return {
    get status() {
      return state.status
    },
    get entries() {
      return state.entries
    },
    initialize,
    refresh,
    record,
    clear,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
