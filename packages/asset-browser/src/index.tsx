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

// 公共入口同时导出组件与纯协议 factory，因此只针对该导出豁免 Fast Refresh。
// eslint-disable-next-line react-refresh/only-export-components
export { createComposeAssetResolver } from '@compose-ui/assets'
export { AssetBrowser } from './asset-browser'
export type {
  AssetBrowserProps,
  ComposeAssetCanvasDragEvent,
  ComposeAssetCanvasDragItem,
} from './asset-browser-types'
export {
  ComposeAssetError,
} from './asset-types'
export type {
  ComposeAssetBatchResult,
  ComposeAssetCapabilities,
  ComposeAssetEntry,
  ComposeAssetErrorCode,
  ComposeAssetItemResult,
  ComposeAssetOperationEvent,
  ComposeAssetProvider,
  ComposeAssetReference,
  ComposeAssetResolver,
  ComposeResolvedAsset,
  CreateFileInput,
  CreateFolderInput,
  DeleteAssetInput,
  MoveAssetInput,
  RenameAssetInput,
  ResolveAssetInput,
  WriteAssetInput,
} from './asset-types'
// 公共入口同时导出组件与纯工具，因此只针对该工具导出豁免 Fast Refresh。
// eslint-disable-next-line react-refresh/only-export-components
export { executeAssetBatch, normalizeComposeAssetError, validateAssetName } from './asset-operations'
// 公共入口同时导出组件与 Provider factory，因此只针对该 factory 导出豁免 Fast Refresh。
// eslint-disable-next-line react-refresh/only-export-components
export { createFileSystemAssetProvider, isFileSystemAssetProviderSupported, openFileSystemAssetProvider } from './file-system-provider'
// 公共入口同时导出组件与工具函数，因此只针对工具导出豁免 Fast Refresh。
// eslint-disable-next-line react-refresh/only-export-components
export { getAssetScriptLanguage } from './script-language'
