import type { HTMLAttributes, ReactNode } from 'react'
import type {
  ComposeAssetEntry,
  ComposeAssetReference,
  ComposeAssetOperationEvent,
  ComposeAssetProvider,
} from '@compose-ui/assets'

/**
 * 稳定资源引用拖拽载荷的媒体类型。
 *
 * @remarks
 * 与内部移动使用的条目 ID 载荷不同：只要产出可拖拽条目就一定写入，且内容是跨重命名与移动
 * 稳定的引用，因此可被属性面板等宿主直接消费。
 * @public
 */
export const COMPOSE_ASSET_REFERENCE_DRAG_MEDIA_TYPE
  = 'application/x-compose-asset-reference+json'

/** 一项可写入 Canvas 的资源拖拽描述。 @public */
export interface ComposeAssetCanvasDragItem {
  readonly reference: ComposeAssetReference
  readonly name: string
  readonly mediaType: string
}

/** 稳定引用拖拽载荷的结构。 @public */
export interface ComposeAssetReferenceDragPayload {
  readonly version: 1
  readonly items: readonly ComposeAssetCanvasDragItem[]
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

/** 在 Provider 写入前由宿主确认的资源批次。 @public */
export interface ComposeAssetMutation {
  /** 即将调用的 Provider 变更方法。 */
  readonly type: 'rename' | 'move' | 'delete'
  /** 此次操作影响的规范化资源条目。 */
  readonly entries: readonly ComposeAssetEntry[]
}

/** 宿主取名请求；标题与确认文案由宿主提供，校验复用浏览器内建规则。 @public */
export interface ComposeAssetNamePromptRequest {
  readonly title: string
  readonly initialValue: string
  /** @defaultValue 内建的「创建」文案 */
  readonly confirmLabel?: string
}

/**
 * 宿主上下文菜单项的规范化条目上下文。
 *
 * @remarks
 * 不暴露 React 事件对象、DOM 元素或任何文档语义类型，因此 Asset Browser 不需要理解宿主
 * 追加的菜单项在做什么。
 * @public
 */
export interface ComposeAssetContextMenuContext {
  /** 右键命中的条目；在空白区域触发时为 undefined。 */
  readonly entry?: ComposeAssetEntry
  /** 归一化后的选择集合，命中条目一定包含在内。 */
  readonly entries: readonly ComposeAssetEntry[]
  /** 新建操作应使用的父目录 ID；资源根为 null。 */
  readonly parentId: string | null
  /**
   * 复用浏览器内建命名对话框与名称校验。
   *
   * @returns 用户确认的名称；取消时为 null。
   */
  promptName: (request: ComposeAssetNamePromptRequest) => Promise<string | null>
  /**
   * 请求重新列举目录，使宿主写入后的条目立即可见。
   *
   * @param parentId - 省略时刷新 {@link ComposeAssetContextMenuContext.parentId}。
   */
  refresh: (parentId?: string | null) => void
}

/**
 * 宿主追加的上下文菜单项。
 *
 * @remarks
 * 始终排在内建的新建、重命名与删除项之后。
 * @public
 */
export interface ComposeAssetContextMenuItem {
  readonly id: string
  readonly label: string
  readonly shortcut?: string
  readonly variant?: 'default' | 'destructive'
  /** 是否在该项之前插入分隔线。 @defaultValue false */
  readonly separatorBefore?: boolean
  /** 返回 false 时该项不渲染；省略时始终渲染。 */
  readonly isVisible?: (context: ComposeAssetContextMenuContext) => boolean
  /** 返回 true 时该项渲染为禁用；宿主应据此表达能力缺失。 */
  readonly isDisabled?: (context: ComposeAssetContextMenuContext) => boolean
  /**
   * 用户选中该项。
   *
   * @remarks
   * 异步失败必须由宿主自行处理并呈现，Asset Browser 不做回滚也不显示宿主操作的错误。
   */
  readonly onSelect: (context: ComposeAssetContextMenuContext) => void | Promise<void>
}

/**
 * 条目名称在编辑与存储之间的双向转换。
 *
 * @remarks
 * 某些条目的存储名称带有宿主的命名约定（例如页面的 `.page.json`），这类约定不应出现在
 * 重命名输入框里。资源浏览器不理解这些约定，因此由宿主提供转换。
 * @public
 */
export interface ComposeAssetEntryNaming {
  /** 重命名对话框的初始值；省略时使用条目原始名称。 */
  readonly toEditableName?: (entry: ComposeAssetEntry) => string
  /** 把用户输入还原为存储名称；省略时直接使用输入。 */
  readonly toStoredName?: (entry: ComposeAssetEntry, editableName: string) => string
}

/** 条目在文件树或目录网格中渲染时的规范化上下文。 @public */
export interface ComposeAssetEntryRenderContext {
  readonly entry: ComposeAssetEntry
  readonly surface: 'tree' | 'grid'
  readonly selected: boolean
  /** 仅目录有意义；文件恒为 false。 */
  readonly expanded: boolean
}

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
  /** 文件双击或键盘激活时发出；选择文件本身不会读取其内容。 */
  readonly onAssetOpen?: (entry: ComposeAssetEntry) => void
  /** rename、move 或 delete 前由宿主接受或拒绝整个资源批次。 */
  readonly onBeforeAssetMutation?: (
    mutation: ComposeAssetMutation,
  ) => boolean | Promise<boolean>
  /** 兼容图片向 Canvas 拖入时发出的普通数据事件。 */
  readonly onCanvasDrag?: (event: ComposeAssetCanvasDragEvent) => void
  /**
   * 放宽「可拖入 Canvas」的内建图片白名单。
   *
   * @remarks
   * 只做放宽，不替换：内建白名单已接受的受支持图片始终可拖，该回调只用于额外接受别的条目。
   * 仅对已满足 `provider.capabilities.reference`、`provider.resolveAsset`、`kind === 'file'`
   * 且存在 `assetKey`、且不在内建白名单内的条目调用。返回 true 时媒体类型取
   * `entry.mediaType`，缺失时按 `application/octet-stream` 处理。
   */
  readonly canDragEntryToCanvas?: (entry: ComposeAssetEntry) => boolean
  /**
   * 覆盖条目主图标。
   *
   * @remarks
   * 文件树行与目录网格块都会调用。返回 undefined 或 null 时回退到内建目录与文件图标；
   * 宿主据此按数据结构（例如媒体类型）区分条目种类，而不是按文件名。
   */
  readonly renderEntryIcon?: (context: ComposeAssetEntryRenderContext) => ReactNode
  /**
   * 覆盖条目显示名称。
   *
   * @remarks
   * 文件树行与目录网格块都会调用。返回 undefined 或 null 时使用条目原始名称。宿主据此按
   * 数据结构决定展示名（例如页面隐藏其存储后缀），而资源浏览器仍以原始名称作为 title
   * 与可读名的基础。
   */
  readonly renderEntryLabel?: (context: ComposeAssetEntryRenderContext) => ReactNode
  /** 条目名称在重命名输入与存储之间的转换。 */
  readonly entryNaming?: ComposeAssetEntryNaming
  /** 追加到内建菜单项之后的宿主上下文菜单项。 */
  readonly contextMenuItems?: readonly ComposeAssetContextMenuItem[]
  /**
   * 在条目名称之后渲染附加标记。
   *
   * @remarks
   * 文件树行与目录网格块都会调用。标记不参与命中测试，点击其区域仍按条目本身处理。
   * 返回 undefined 或 null 时条目保持内建呈现。
   */
  readonly renderEntryBadge?: (context: ComposeAssetEntryRenderContext) => ReactNode
  /** 是否显示浏览器本地目录入口。 */
  readonly allowLocalDirectory?: boolean
  /** Provider 未连接时的自定义空状态。 */
  readonly emptyState?: ReactNode
}
