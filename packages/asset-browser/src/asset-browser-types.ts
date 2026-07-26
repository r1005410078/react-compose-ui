import type { HTMLAttributes, ReactNode } from 'react'
import type {
  ComposeAssetReference,
  ComposeAssetOperationEvent,
  ComposeAssetProvider,
} from '@compose-ui/assets'

/** 一项可写入 Canvas 的资源拖拽描述。 @public */
export interface ComposeAssetCanvasDragItem {
  readonly reference: ComposeAssetReference
  readonly name: string
  readonly mediaType: string
}

/** 不暴露 React DragEvent 的 Canvas 拖拽生命周期。 @public */
export type ComposeAssetCanvasDragEvent =
  | {
      readonly type: 'start'
      readonly items: readonly ComposeAssetCanvasDragItem[]
      readonly clientPoint: { readonly x: number; readonly y: number }
    }
  | {
      readonly type: 'move' | 'end'
      readonly clientPoint: { readonly x: number; readonly y: number }
    }
  | { readonly type: 'cancel' }

/**
 * ComposeAssetBrowser 受控组件属性。
 *
 * @public
 */
export interface ComposeAssetBrowserProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** 当前资源 Provider；省略时可通过本地目录入口连接。 */
  readonly provider?: ComposeAssetProvider
  /** 受控选中资源 ID。 */
  readonly selectedIds?: readonly string[]
  /** 非受控模式初始选择。 */
  readonly defaultSelectedIds?: readonly string[]
  /** 选择变更回调。 */
  readonly onSelectionChange?: (ids: readonly string[]) => void
  /** 受控展开目录 ID。 */
  readonly expandedIds?: readonly string[]
  /** 非受控模式初始展开目录。 */
  readonly defaultExpandedIds?: readonly string[]
  /** 展开目录变更回调。 */
  readonly onExpandedChange?: (ids: readonly string[]) => void
  /** 通过本地入口连接新 Provider 后触发。 */
  readonly onProviderChange?: (provider: ComposeAssetProvider) => void
  /** 完成资源写操作后供宿主审计。 */
  readonly onOperation?: (event: ComposeAssetOperationEvent) => void
  /** 兼容图片向 Canvas 拖入时发出的普通数据事件。 */
  readonly onCanvasDrag?: (event: ComposeAssetCanvasDragEvent) => void
  /** 是否显示浏览器本地目录入口。 */
  readonly allowLocalDirectory?: boolean
  /** Provider 未连接时的自定义空状态。 */
  readonly emptyState?: ReactNode
}
