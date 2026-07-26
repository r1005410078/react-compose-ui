/**
 * 提供带 IndexedDB 持久化的本地操作审计日志和紧凑 React 查看面板。
 *
 * @packageDocumentation
 */
// eslint-disable-next-line react-refresh/only-export-components -- 包公共入口需要同时导出纯快照函数。
export { createComposeOperationLogSnapshot } from './snapshot'
// eslint-disable-next-line react-refresh/only-export-components -- 包公共入口需要同时导出 store 工厂。
export {
  createComposeIndexedDbOperationLogStore,
  createComposeMemoryOperationLogStore,
} from './stores'
// eslint-disable-next-line react-refresh/only-export-components -- Provider 与配套 Hook 共同构成公共 React API。
export {
  ComposeOperationLogProvider,
  useComposeOperationLog,
} from './react'
export { ComposeOperationLogPanel } from './operation-log-panel'
export type { IndexedDbOperationLogStoreOptions as ComposeIndexedDbOperationLogStoreOptions } from './stores'
export type { ComposeOperationLogProviderProps } from './react'
export type { ComposeOperationLogPanelProps } from './operation-log-panel'
export type {
  ComposeOperationLogActor,
  ComposeOperationLogCategory,
  ComposeOperationLogController,
  ComposeOperationLogEncodedValue,
  ComposeOperationLogEntry,
  ComposeOperationLogRecordInput,
  ComposeOperationLogRecordOptions,
  ComposeOperationLogSnapshot,
  ComposeOperationLogState,
  ComposeOperationLogStore,
  ComposeOperationLogTarget,
} from './types'
