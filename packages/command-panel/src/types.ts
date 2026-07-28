import type { HTMLAttributes } from 'react'
import type {
  EditorCommand,
  JsonValue,
  TransactionRuntime,
} from '@compose-ui/core'

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
  /** 可选结构化命令表单。 */
  readonly presets?: readonly ComposeCommandPreset[]
  /** 面板最多保留的会话事件数。 @defaultValue 100 */
  readonly eventLimit?: number
  /** 右键重放命令时生成新的稳定命令 ID。 */
  readonly idFactory?: () => string
}
