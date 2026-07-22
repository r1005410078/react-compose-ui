import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react'
import type { ReactNode } from 'react'
import { createOperationLogRuntime } from './controller'
import { createIndexedDbOperationLogStore } from './stores'
import type {
  OperationLogActor,
  OperationLogController,
  OperationLogStore,
} from './types'

/** 操作日志 Provider 的配置。 */
export interface OperationLogProviderProps {
  /** 当前页面、文档或工作区的稳定隔离 ID。 */
  scopeId: string
  /** 由宿主提供的可选操作者。 */
  actor?: OperationLogActor
  /** 每个 scope 最多保留的记录数。 @defaultValue 1000 */
  maxEntries?: number
  /** 单个快照允许持久化的最大字节数。 @defaultValue 65536 */
  maxSnapshotBytes?: number
  /** 自定义持久化仓库；浏览器默认使用 IndexedDB。 */
  store?: OperationLogStore
  /** IndexedDB 不可用或写入失败时的非阻塞通知。 */
  onStorageError?: (error: unknown) => void
  /** 可以访问日志控制器的 React 子树。 */
  children: ReactNode
}

const OperationLogContext = createContext<OperationLogController | null>(null)

/**
 * 在 React 子树中提供 scope 隔离的操作日志控制器。
 *
 * @param props - scope、容量、可选 store 与 React 子树。
 * @returns 操作日志 Context Provider。
 */
export function OperationLogProvider({
  scopeId,
  actor,
  maxEntries,
  maxSnapshotBytes,
  store,
  onStorageError,
  children,
}: OperationLogProviderProps) {
  const indexedDbStore = useMemo(() => createIndexedDbOperationLogStore(), [])
  const runtime = useMemo(() => createOperationLogRuntime({
    scopeId,
    actor,
    maxEntries,
    maxSnapshotBytes,
    store: store ?? indexedDbStore,
    onStorageError,
  }), [actor, indexedDbStore, maxEntries, maxSnapshotBytes, onStorageError, scopeId, store])
  const state = useSyncExternalStore(runtime.subscribe, runtime.getState, runtime.getState)

  useEffect(() => {
    void runtime.initialize()
  }, [runtime])

  const controller = useMemo<OperationLogController>(() => ({
    status: state.status,
    entries: state.entries,
    record: runtime.record,
    refresh: runtime.refresh,
    clear: runtime.clear,
  }), [runtime, state])

  return (
    <OperationLogContext.Provider value={controller}>
      {children}
    </OperationLogContext.Provider>
  )
}

/**
 * 读取最近的 OperationLogProvider 控制器。
 *
 * @returns 当前 scope 的响应式日志状态和命令。
 * @throws 当调用位置不在 OperationLogProvider 子树中时抛出。
 */
// eslint-disable-next-line react-refresh/only-export-components -- Provider 与配套 Hook 必须从同一 React 模块共享私有 Context。
export function useOperationLog(): OperationLogController {
  const controller = useContext(OperationLogContext)
  if (!controller) {
    throw new Error('useOperationLog must be used inside OperationLogProvider')
  }
  return controller
}
