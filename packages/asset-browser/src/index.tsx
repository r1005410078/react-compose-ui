/* eslint-disable react-refresh/only-export-components -- 库公共入口必须同时导出 React 组件和无 React 的 Provider factory。 */
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
export { COMPOSE_ASSET_REFERENCE_DRAG_MEDIA_TYPE } from './asset-browser-types'
export { parseComposeAssetReferenceDragData } from './asset-drag-payload'
export {
  ComposeAssetPreview,
} from './asset-preview'
export type {
  ComposeAssetBrowserProps,
  ComposeAssetCanvasDragEvent,
  ComposeAssetCanvasDragItem,
  ComposeAssetReferenceDragPayload,
  ComposeAssetContextMenuContext,
  ComposeAssetEntryNaming,
  ComposeAssetContextMenuItem,
  ComposeAssetEntryRenderContext,
  ComposeAssetExternalDropConfig,
  ComposeAssetExternalDropEvent,
  ComposeAssetExternalDropPayload,
  ComposeAssetExternalDropTarget,
  ComposeAssetNamePromptRequest,
  ComposeAssetMutation,
} from './asset-browser-types'
export type {
  ComposeAssetPreviewHandle,
  ComposeAssetPreviewProps,
} from './asset-preview'
export type {
  ComposeScriptIntelligenceProfile,
  ComposeVirtualTextInsertion,
} from './script-intelligence'
export type { FileSystemAssetProviderOptions as ComposeFileSystemAssetProviderOptions } from './file-system-provider'
export {
  createFileSystemAssetProvider as createComposeFileSystemAssetProvider,
  isFileSystemAssetProviderSupported as isComposeFileSystemAssetProviderSupported,
  openFileSystemAssetProvider as openComposeFileSystemAssetProvider,
} from './file-system-provider'
