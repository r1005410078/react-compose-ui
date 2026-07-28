import type { HTMLAttributes } from 'react'
/**
 * 撤销或重做动作使用的单次键位。
 *
 * @public
 */
export interface ComposeHistoryKeybinding {
  /** `KeyboardEvent.code` 物理键位。 */
  readonly code: string
  /** macOS 使用 Command，其他平台使用 Control。 */
  readonly primary?: boolean
  /** 所有平台都明确使用 Control。 */
  readonly control?: boolean
  /** 是否要求 Shift。 */
  readonly shift?: boolean
  /** 是否要求 Alt/Option。 */
  readonly alt?: boolean
}

/**
 * 历史导航快捷键覆盖；空数组表示禁用对应动作。
 *
 * @public
 */
export interface ComposeHistoryShortcuts {
  readonly undo?: readonly ComposeHistoryKeybinding[]
  readonly redo?: readonly ComposeHistoryKeybinding[]
}

/** 历史面板可展示的一条稳定记录。 */
export interface ComposeHistoryEntry {
  /** 当前时间线内唯一且稳定的记录标识。 */
  id: string
  /** 描述一次用户可理解编辑动作的显示名称。 */
  label: string
}
/** 提交不可变快照时附带的动作语义。 */
export interface ComposeHistoryCommitOptions {
  /** 显示在历史面板中的动作名称。 */
  label: string
  /**
   * 连续输入的合并标识。
   *
   * @remarks
   * 仅当当前记录位于时间线末尾、标识相同且未超出合并窗口时才会合并。省略时总是新建记录。
   */
  mergeKey?: string
}

/** `useComposeHistory` 的会话级行为选项。 */
export interface ComposeUseHistoryOptions<T> {
  /** 最多保留的可撤销动作数，基线不计入该数量。 @defaultValue 100 */
  limit?: number
  /** 相同 `mergeKey` 连续提交的合并窗口。 @defaultValue 750 */
  mergeWindowMs?: number
  /** 初始基线的显示名称。 @defaultValue "开始" */
  initialLabel?: string
  /** 判断候选值是否与当前值相同；相同时忽略提交。 @defaultValue Object.is */
  isEqual?: (left: T, right: T) => boolean
}

/** ComposeHistoryPanel 和编辑器集成所需的只读时间线与导航命令。 */
export interface ComposeHistoryNavigationController {
  /** 从最旧基线到最新动作排列的完整可达记录。 */
  readonly entries: readonly ComposeHistoryEntry[]
  /** 当前快照对应的记录 ID；没有可用记录时为 `null`。 */
  readonly activeEntryId: string | null
  /** 当前是否可以向前撤销一个动作。 */
  readonly canUndo: boolean
  /** 当前是否可以向后重做一个动作。 */
  readonly canRedo: boolean
  /** 撤销一个动作；不可撤销时保持不变。 */
  undo(): void
  /** 重做一个动作；不可重做时保持不变。 */
  redo(): void
  /** 跳转到指定稳定 ID；ID 不存在时保持不变。 */
  navigate(entryId: string): void
}

/** `useComposeHistory` 返回的完整不可变快照控制器。 */
export interface ComposeHistoryController<T> extends ComposeHistoryNavigationController {
  /** 当前活动记录对应的不可变值。 */
  readonly value: T
  /**
   * 提交一个值或纯更新函数。
   *
   * @param value - 新不可变值，或根据当前值计算新值的无副作用函数。
   * @param options - 动作名称和可选连续输入合并标识。
   */
  commit(value: T | ((current: T) => T), options: ComposeHistoryCommitOptions): void
  /**
   * 丢弃现有时间线并建立新基线。
   *
   * @param value - 新基线不可变值。
   * @param label - 新基线显示名称，省略时使用 Hook 的初始标签。
   */
  reset(value: T, label?: string): void
}

/** 独立受控 `ComposeHistoryPanel` 的属性。 */
export interface ComposeHistoryPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** 驱动列表、当前状态和记录跳转的受控历史协议。 */
  controller: ComposeHistoryNavigationController
  /**
   * 当前容器实际安装的撤销/重做快捷键。
   *
   * @remarks
   * HistoryPanel 不自行注册键盘监听器；省略时菜单不会显示快捷键，以免暗示并不存在的键盘行为。
   */
  shortcuts?: ComposeHistoryShortcuts
}
