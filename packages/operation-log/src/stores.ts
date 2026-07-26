import type { ComposeOperationLogEntry, ComposeOperationLogStore } from './types'

function sortEntries(entries: readonly ComposeOperationLogEntry[]) {
  return [...entries].sort((left, right) => (
    right.updatedAt - left.updatedAt
      || right.startedAt - left.startedAt
      || right.id.localeCompare(left.id)
  ))
}

/**
 * 创建仅在当前 JavaScript 会话内存中保存记录的仓库。
 *
 * @returns 可用于测试、SSR 或显式非持久化场景的独立 store。
 */
export function createComposeMemoryOperationLogStore(): ComposeOperationLogStore {
  const entries = new Map<string, ComposeOperationLogEntry>()
  return {
    async load(scopeId) {
      return sortEntries([...entries.values()].filter((entry) => entry.scopeId === scopeId))
        .map((entry) => structuredClone(entry))
    },
    async put(entry) {
      entries.set(entry.id, structuredClone(entry))
    },
    async remove(ids) {
      ids.forEach((id) => entries.delete(id))
    },
    async clear(scopeId) {
      for (const [id, entry] of entries) {
        if (entry.scopeId === scopeId) entries.delete(id)
      }
    },
  }
}

/** IndexedDB 日志仓库的数据库配置。 */
export interface IndexedDbOperationLogStoreOptions {
  /** 数据库名称。 */
  databaseName?: string
  /** object store 名称。 */
  storeName?: string
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
  })
}

/**
 * 创建按 scope 隔离记录的浏览器 IndexedDB 仓库。
 *
 * @param options - 可覆盖的数据库与 object store 名称。
 * @returns 延迟打开 IndexedDB 的日志 store；不可用错误由 Provider 降级处理。
 */
export function createComposeIndexedDbOperationLogStore(
  options: IndexedDbOperationLogStoreOptions = {},
): ComposeOperationLogStore {
  const databaseName = options.databaseName ?? 'compose-ui-operation-log'
  const storeName = options.storeName ?? 'entries'
  let databasePromise: Promise<IDBDatabase> | undefined
  const openDatabase = () => {
    if (databasePromise) return databasePromise
    databasePromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available'))
        return
      }
      const request = indexedDB.open(databaseName, 1)
      request.onupgradeneeded = () => {
        const database = request.result
        const store = database.objectStoreNames.contains(storeName)
          ? request.transaction!.objectStore(storeName)
          : database.createObjectStore(storeName, { keyPath: 'id' })
        if (!store.indexNames.contains('scope-updated-at')) {
          store.createIndex('scope-updated-at', ['scopeId', 'updatedAt'])
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
      request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked'))
    })
    return databasePromise
  }
  return {
    async load(scopeId) {
      const database = await openDatabase()
      const transaction = database.transaction(storeName, 'readonly')
      const done = transactionDone(transaction)
      const index = transaction.objectStore(storeName).index('scope-updated-at')
      const range = IDBKeyRange.bound([scopeId, 0], [scopeId, Number.MAX_SAFE_INTEGER])
      const entries = await requestResult(index.getAll(range) as IDBRequest<ComposeOperationLogEntry[]>)
      await done
      return sortEntries(entries)
    },
    async put(entry) {
      const database = await openDatabase()
      const transaction = database.transaction(storeName, 'readwrite')
      transaction.objectStore(storeName).put(entry)
      await transactionDone(transaction)
    },
    async remove(ids) {
      if (ids.length === 0) return
      const database = await openDatabase()
      const transaction = database.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      ids.forEach((id) => store.delete(id))
      await transactionDone(transaction)
    },
    async clear(scopeId) {
      const database = await openDatabase()
      const transaction = database.transaction(storeName, 'readwrite')
      const index = transaction.objectStore(storeName).index('scope-updated-at')
      const range = IDBKeyRange.bound([scopeId, 0], [scopeId, Number.MAX_SAFE_INTEGER])
      const request = index.openKeyCursor(range)
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) return
        transaction.objectStore(storeName).delete(cursor.primaryKey)
        cursor.continue()
      }
      await transactionDone(transaction)
    },
  }
}
