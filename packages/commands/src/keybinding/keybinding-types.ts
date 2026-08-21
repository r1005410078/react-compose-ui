/**
 * 与浏览器 `KeyboardEvent.code` 对齐的通用单次键位描述。
 *
 * @remarks
 * 全仓唯一的键位定义。`components`、`stage` 与 `editor` 对外暴露的键位类型都是本类型的
 * 别名——此前三者各自声明了字段与语义逐字相同的类型，归一化在一个包、匹配在另一个包，
 * 于是没有任何一方能独立完成命中判定。
 *
 * @public
 */
export interface ComposeKeybinding {
  /** 布局无关的物理键位代码。 */
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
 * 匹配所需的最小键盘事件形状。
 *
 * @remarks
 * 刻意用结构化鸭子类型而不是 `KeyboardEvent`：本包无 DOM，且这样也能直接用普通对象写测试。
 *
 * @public
 */
export interface ComposeKeyboardEventShape {
  readonly altKey: boolean
  readonly code: string
  readonly ctrlKey: boolean
  readonly key: string
  readonly metaKey: boolean
  readonly shiftKey: boolean
}

/**
 * 动作 id 到其全部生效键位的映射。
 *
 * @remarks
 * 对动作 id 集合泛型，因此 Stage 的动作、Editor 的动作与将来 CAD 的命令可以共用同一套
 * 归一化、去重、冲突检测与命中解析。空数组表示该动作被显式禁用，与「未配置」不同。
 *
 * @public
 */
export type ComposeKeybindingMap<TAction extends string> =
  Readonly<Record<TAction, readonly ComposeKeybinding[]>>
