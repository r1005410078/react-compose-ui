import type { HTMLAttributes } from 'react'
import type { ComposeKeybinding } from '@compose-ui/components'
import type {
  EditorCommand,
  JsonValue,
  TransactionRuntime,
} from '@compose-ui/core'

/**
 * 可从命令面板检索并执行的宿主动作。
 *
 * @remarks
 * 动作是 UI 层概念，与 `EditorCommand` 这一文档变更载荷不同：`run` 既可以派发命令进入事务
 * 历史，也可以只修改宿主会话状态。面板不解释这一差异，也不本地化 `title`。
 *
 * @public
 */
export interface ComposeCommandAction {
  /** 宿主内稳定且唯一的动作 ID，同时参与检索匹配。 */
  readonly id: string
  /** 已由宿主本地化的显示名。 */
  readonly title: string
  /** 结果分组标题；省略时归入未分组区。 */
  readonly category?: string
  /** 除名称外的额外检索词，例如英文别名。 */
  readonly keywords?: readonly string[]
  /** 仅用于展示的键位；面板不注册对应监听。 */
  readonly shortcut?: readonly ComposeKeybinding[]
  /** 非空表示动作当前不可执行，同时作为原因展示给用户。 */
  readonly disabledReason?: string
  /** 执行动作；面板不关心其副作用是否进入事务历史。 */
  run(): void
}

/**
 * 按 category 归并后的一组检索结果。
 *
 * @public
 */
export interface ComposeCommandActionGroup {
  /** 分组标题；`null` 表示未提供 category 的动作。 */
  readonly category: string | null
  /** 该组内保持宿主原始顺序的动作。 */
  readonly actions: readonly ComposeCommandAction[]
}

/**
 * select 字段中的一个稳定候选。
 *
 * @public
 */
export interface ComposeCommandPresetOption {
  /** 提交给命令工厂的字符串值。 */
  readonly value: string
  /** 表单中显示的用户可读名称。 */
  readonly label: string
}

/**
 * 结构化命令表单支持的有限字段描述器。
 *
 * @public
 */
export interface ComposeCommandPresetField {
  /** values 对象中的稳定字段名。 */
  readonly name: string
  /** 表单控件的可访问名称。 */
  readonly label: string
  /** 首版内置编辑器类型。 */
  readonly type: 'string' | 'number' | 'boolean' | 'select' | 'json'
  /** 是否必须提供非空有效值。 @defaultValue false */
  readonly required?: boolean
  /** select 字段的候选；其他字段忽略。 */
  readonly options?: readonly ComposeCommandPresetOption[]
  /** 表单首次显示时使用的 JSON 默认值。 */
  readonly defaultValue?: JsonValue
}

/**
 * ComposeCommandPanel 中一个可执行的结构化命令预设。
 *
 * @public
 */
export interface ComposeCommandPreset {
  /** 当前面板内稳定且唯一的预设 ID。 */
  readonly id: string
  /** 预设选择器与提交按钮中的名称。 */
  readonly label: string
  /** 按显示顺序排列的字段。 */
  readonly fields: readonly ComposeCommandPresetField[]
  /**
   * 把已经校验的 JSON 字段值转换为一个命令。
   *
   * @param values - 以 field name 为 key 的有效值。
   * @returns 要交给外部 TransactionRuntime 的结构化命令。
   */
  createCommand(values: Readonly<Record<string, JsonValue>>): EditorCommand
}

/**
 * 独立 ComposeCommandPanel 的属性。
 *
 * @public
 */
export interface ComposeCommandPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** 提供命令事件并接收预设 dispatch 的外部运行时。 */
  readonly runtime: TransactionRuntime
  /** 可检索执行的宿主动作；为空时不渲染检索区。 */
  readonly actions?: readonly ComposeCommandAction[]
  /** 可选结构化命令表单。 */
  readonly presets?: readonly ComposeCommandPreset[]
  /** 面板最多保留的会话事件数。 @defaultValue 100 */
  readonly eventLimit?: number
  /** 右键重放命令时生成新的稳定命令 ID。 */
  readonly idFactory?: () => string
}
