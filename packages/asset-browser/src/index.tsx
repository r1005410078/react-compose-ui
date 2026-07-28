/**
 * 提供受控资源浏览、文件预览、脚本编辑和浏览器本地目录 Provider。
 *
 * @remarks
 * 资源状态独立于 ComposeDocument、History 和 Operation Log；宿主通过 Provider 和事件决定
 * 数据来源与审计策略。
 *
 * @packageDocumentation
 */
import './styles.css'

export { ComposeAssetBrowser } from './asset-browser'
export {
  ComposeAssetPreview,
} from './asset-preview'
export type {
  ComposeAssetBrowserProps,
  ComposeAssetCanvasDragEvent,
  ComposeAssetCanvasDragItem,
  ComposeAssetMutation,
} from './asset-browser-types'
export type {
  ComposeAssetPreviewHandle,
  ComposeAssetPreviewProps,
} from './asset-preview'
// 公共入口同时导出组件与 Provider factory，因此只针对该 factory 导出豁免 Fast Refresh。
// eslint-disable-next-line react-refresh/only-export-components
export {
  createFileSystemAssetProvider as createComposeFileSystemAssetProvider,
  isFileSystemAssetProviderSupported as isComposeFileSystemAssetProviderSupported,
  openFileSystemAssetProvider as openComposeFileSystemAssetProvider,
} from './file-system-provider'
