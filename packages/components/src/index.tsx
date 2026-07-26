/**
 * 提供可被场景树、资源浏览器和宿主工具复用的受控 React 基础组件。
 *
 * @remarks
 * 本包只负责通用 UI 交互和可访问性，不拥有 ComposeDocument、资源 Provider、历史或领域命令。
 *
 * @packageDocumentation
 */
import './styles.css'

export { Tree } from './tree'
// 公共入口同时导出组件与纯 Tree 模型工具，因此只针对工具导出豁免 Fast Refresh。
// eslint-disable-next-line react-refresh/only-export-components
export { createTreeIndex, createTreeMove, flattenTree, type IndexedTreeItem } from './tree-model'
export type {
  TreeItemAdapter,
  TreeItemRenderContext,
  TreeMoveOperation,
  TreeProps,
} from './tree-types'
