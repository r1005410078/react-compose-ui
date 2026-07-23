/**
 * 提供当前编辑器实例内的不可变快照历史、撤销重做快捷键和受控历史面板。
 *
 * @remarks
 * 本包不拥有页面文档 Schema，也不执行持久化。传给 `useHistory` 的值必须由宿主以不可变方式
 * 更新；包会保留快照引用并利用结构共享控制内存成本，不会隐式深拷贝或序列化值。
 *
 * @packageDocumentation
 */
export { HistoryPanel } from './history-panel'
// eslint-disable-next-line react-refresh/only-export-components -- 公共入口同时导出组件与 Hook。
export { useHistory } from './use-history'
// 公共入口需要同时导出组件和 Hook，因此只针对这一行豁免 Fast Refresh 的组件导出限制。
// eslint-disable-next-line react-refresh/only-export-components -- 公共入口同时导出组件与 Hook。
export { useHistoryShortcuts } from './use-history-shortcuts'
export type {
  HistoryCommitOptions,
  HistoryController,
  HistoryEntry,
  HistoryNavigationController,
  HistoryPanelProps,
  UseHistoryOptions,
} from './types'
import './styles.css'
