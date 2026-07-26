import type {
  HTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  RefObject,
} from 'react'

/**
 * 通用 Tree 读取业务 item 所需的最小适配器。
 *
 * @typeParam T - 宿主业务节点类型。
 * @public
 */
export interface TreeItemAdapter<T> {
  /** 返回当前树实例内稳定且唯一的 item ID。 */
  getId(item: T): string
  /** 返回默认可访问标签和拖拽预览文本。 */
  getLabel(item: T): string
  /** 返回已经加载的直接子项；省略表示尚未加载或没有子项。 */
  getChildren(item: T): readonly T[] | undefined
  /** 指示 item 是否可能包含子项，包括尚未懒加载的容器。 */
  hasChildren?(item: T): boolean
  /** 指示 item 是否允许成为移动目标父级。 */
  canHaveChildren?(item: T): boolean
  /** 指示 item 是否允许参与拖动。 */
  canMove?(item: T): boolean
  /** 指示 item 是否禁用选择和激活。 */
  isDisabled?(item: T): boolean
}

/**
 * Tree 发出的受控结构移动意图。
 *
 * @public
 */
export interface TreeMoveOperation {
  /** 已去除重复后代并保持树顺序的顶层 item ID。 */
  readonly itemIds: readonly string[]
  /** 目标父级；`null` 表示根级。 */
  readonly parentId: string | null
  /** 移除移动项之前的原始目标兄弟索引。 */
  readonly index: number
}

/**
 * Tree 插槽收到的稳定行上下文。
 *
 * @typeParam T - 宿主业务节点类型。
 * @public
 */
export interface TreeItemRenderContext<T> {
  /** 业务 item。 */
  readonly item: T
  /** item ID。 */
  readonly id: string
  /** 父级 ID。 */
  readonly parentId: string | null
  /** 从 1 开始的 ARIA 层级。 */
  readonly depth: number
  /** 当前是否选中。 */
  readonly selected: boolean
  /** 当前是否展开。 */
  readonly expanded: boolean
  /** 当前是否持有 roving tabindex。 */
  readonly focused: boolean
  /** 是否存在或可能存在子项。 */
  readonly hasChildren: boolean
}

/**
 * 通用受控 Tree 属性。
 *
 * @typeParam T - 宿主业务节点类型。
 * @public
 */
export interface TreeProps<T>
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** 根级业务 items。 */
  readonly items: readonly T[]
  /** 读取 item 结构与能力的适配器。 */
  readonly adapter: TreeItemAdapter<T>
  /** 当前受控选中 ID。 */
  readonly selectedIds: readonly string[]
  /** 当前受控展开 ID。 */
  readonly expandedIds: readonly string[]
  /** 请求宿主替换选择。 */
  readonly onSelectionChange?: (itemIds: readonly string[]) => void
  /** 请求宿主替换展开项。 */
  readonly onExpandedChange?: (itemIds: readonly string[]) => void
  /** 合法 Pointer 拖排完成时发出的单次移动意图。 */
  readonly onMove?: (operation: TreeMoveOperation) => void
  /** Enter 或双击触发的语义激活。 */
  readonly onActivate?: (item: T) => void
  /** 额外限制目标移动；返回 false 时不显示合法落点。 */
  readonly canDrop?: (operation: TreeMoveOperation) => boolean
  /** 匹配过滤项；Tree 自动保留全部祖先并临时展开路径。 */
  readonly filter?: (item: T) => boolean
  /** 选择模式。 @defaultValue `"multiple"` */
  readonly selectionMode?: 'single' | 'multiple'
  /** 自定义行图标。 */
  readonly renderIcon?: (context: TreeItemRenderContext<T>) => ReactNode
  /** 自定义行标签；省略时使用 adapter label。 */
  readonly renderLabel?: (context: TreeItemRenderContext<T>) => ReactNode
  /** 自定义尾部操作。 */
  readonly renderActions?: (context: TreeItemRenderContext<T>) => ReactNode
  /** 自定义拖拽预览；省略时显示标签或多选数量。 */
  readonly renderDragPreview?: (
    items: readonly T[],
    defaultContent: ReactNode,
  ) => ReactNode
  /** item 右键菜单回调。 */
  readonly onItemContextMenu?: (event: MouseEvent<HTMLDivElement>, item: T) => void
  /** 树空白区右键菜单回调。 */
  readonly onBackgroundContextMenu?: (event: MouseEvent<HTMLDivElement>) => void
  /** Tree 未消费的键盘事件，例如领域命令、重命名或删除。 */
  readonly onItemKeyDown?: (
    event: KeyboardEvent<HTMLDivElement>,
    item: T,
    rowIndex: number,
  ) => void
  /** 双击回调；调用后仍会执行 onActivate。 */
  readonly onItemDoubleClick?: (event: MouseEvent<HTMLDivElement>, item: T) => void
  /** 返回展开按钮的可访问标签；省略时使用共享 Tree 文案。 */
  readonly getExpandLabel?: (item: T) => string
  /** 返回折叠按钮的可访问标签；省略时使用共享 Tree 文案。 */
  readonly getCollapseLabel?: (item: T) => string
  /** 为业务测试标识或数据属性补充行属性。 */
  readonly getItemAttributes?: (
    context: TreeItemRenderContext<T>,
  ) => HTMLAttributes<HTMLDivElement>
  /** 暴露内部滚动容器给高级组合层。 */
  readonly scrollRef?: RefObject<HTMLDivElement | null>
  /** 固定虚拟行高度。 @defaultValue `24` */
  readonly rowHeight?: number
  /** 为组合层测试提供稳定的落点指示器标识。 */
  readonly dropIndicatorTestId?: string
  /** 为组合层测试提供稳定的拖拽预览标识。 */
  readonly dragPreviewTestId?: string
  /** 当行成为 inside 目标时写入值 `"inside"` 的 data 属性名。 */
  readonly dropTargetDataAttribute?: `data-${string}`
}
