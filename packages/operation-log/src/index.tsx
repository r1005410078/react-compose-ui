/**
 * 提供带 IndexedDB 持久化的本地操作审计日志和紧凑 React 查看面板。
 *
 * @packageDocumentation
 */
// eslint-disable-next-line react-refresh/only-export-components -- 包公共入口需要同时导出纯快照函数。
export { createOperationLogSnapshot } from './snapshot'
// eslint-disable-next-line react-refresh/only-export-components -- 包公共入口需要同时导出 store 工厂。
export { createIndexedDbOperationLogStore, createMemoryOperationLogStore } from './stores'
// eslint-disable-next-line react-refresh/only-export-components -- Provider 与配套 Hook 共同构成公共 React API。
export { OperationLogProvider, useOperationLog } from './react'
export { OperationLogPanel } from './panel'
export type { IndexedDbOperationLogStoreOptions } from './stores'
export type { OperationLogProviderProps } from './react'
export type { OperationLogPanelProps } from './panel'
export type {
  OperationLogActor,
  OperationLogCategory,
  OperationLogController,
  OperationLogEncodedValue,
  OperationLogEntry,
  OperationLogRecordInput,
  OperationLogRecordOptions,
  OperationLogSnapshot,
  OperationLogState,
  OperationLogStore,
  OperationLogTarget,
} from './types'
