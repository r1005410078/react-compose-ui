/* eslint-disable react-refresh/only-export-components -- 库公共入口必须同时导出面板、Provider、Hook 和无 React 的 store factory。 */
/**
 * 提供带 IndexedDB 持久化的本地操作审计日志和紧凑 React 查看面板。
 *
 * @packageDocumentation
 */
export { createComposeOperationLogSnapshot } from './snapshot'
export {
  createComposeIndexedDbOperationLogStore,
  createComposeMemoryOperationLogStore,
} from './stores'
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
