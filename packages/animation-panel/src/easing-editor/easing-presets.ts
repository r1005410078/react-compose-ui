import type { ComposeAnimationInterpolation } from '../animation-panel/types'

/**
 * 缓动预设标识。
 *
 * @remarks
 * 预设是**表示层数据**：每一个都能用既有的 `hold`、`linear` 或 `cubic` 判别联合表达，
 * 不向插值协议引入新的 kind。回弹（back）系列依赖控制点 y 越界，这是 `cubic-bezier`
 * 的固有能力，不需要额外协议支持。
 *
 * @public
 */
export type ComposeEasingPresetId =
  | 'hold'
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'ease-in-back'
  | 'ease-out-back'
  | 'ease-in-out-back'

/** 预设选择项：具名预设，或与任一预设都不匹配的自定义贝塞尔。 @public */
export type ComposeEasingSelectionId = ComposeEasingPresetId | 'custom'

/** 一条缓动预设。 @public */
export interface ComposeEasingPreset {
  readonly id: ComposeEasingPresetId
  readonly interpolation: ComposeAnimationInterpolation
}

/** 控制点四元组，语义同 CSS `cubic-bezier(x1, y1, x2, y2)`。 @public */
export type ComposeEasingControl = readonly [number, number, number, number]

/**
 * 全部缓动预设，按缓入到缓出、先常规后回弹排列。
 *
 * @remarks
 * 顺序即选择器中的显示顺序。
 *
 * @public
 */
export const COMPOSE_EASING_PRESETS: readonly ComposeEasingPreset[] = [
  { id: 'hold', interpolation: { kind: 'hold' } },
  { id: 'linear', interpolation: { kind: 'linear' } },
  { id: 'ease-in', interpolation: { kind: 'cubic', control: [0.42, 0, 1, 1] } },
  { id: 'ease-out', interpolation: { kind: 'cubic', control: [0, 0, 0.58, 1] } },
  { id: 'ease-in-out', interpolation: { kind: 'cubic', control: [0.42, 0, 0.58, 1] } },
  { id: 'ease-in-back', interpolation: { kind: 'cubic', control: [0.36, 0, 0.66, -0.56] } },
  { id: 'ease-out-back', interpolation: { kind: 'cubic', control: [0.34, 1.56, 0.64, 1] } },
  { id: 'ease-in-out-back', interpolation: { kind: 'cubic', control: [0.68, -0.6, 0.32, 1.6] } },
]

/** 从别的插值切到自定义贝塞尔时的起点曲线。 @public */
export const COMPOSE_EASING_DEFAULT_CONTROL: ComposeEasingControl = [0.25, 0.1, 0.25, 1]

/** 预设匹配容差：控制点经拖拽会带浮点噪声，等值比较认不出刚选过的预设。 */
const CONTROL_EPSILON = 1e-6

/** 控制点保留三位小数：拖拽产生的长尾小数既无意义，也让数值行读不成一行。 */
const CONTROL_PRECISION = 1000

function roundControlComponent(value: number) {
  return Math.round(value * CONTROL_PRECISION) / CONTROL_PRECISION
}

/**
 * 把控制点规范到可写入文档的形状。
 *
 * @remarks
 * x 分量钳制到 `[0, 1]`：`cubic-bezier` 的时间轴必须单调，x 越界会让采样器的二分兜底
 * 收敛到无意义的 t。y 分量刻意不钳制——回弹缓动就是靠 y 越界表达过冲。
 *
 * @public
 */
export function clampComposeEasingControl(control: ComposeEasingControl): ComposeEasingControl {
  const [x1, y1, x2, y2] = control
  return [
    roundControlComponent(Math.min(1, Math.max(0, x1))),
    roundControlComponent(y1),
    roundControlComponent(Math.min(1, Math.max(0, x2))),
    roundControlComponent(y2),
  ]
}

/**
 * 判断当前插值对应哪个预设；都不匹配时返回 `custom`。
 *
 * @public
 */
export function matchComposeEasingPreset(
  interpolation: ComposeAnimationInterpolation,
): ComposeEasingSelectionId {
  if (interpolation.kind === 'hold') return 'hold'
  if (interpolation.kind === 'linear') return 'linear'
  const matched = COMPOSE_EASING_PRESETS.find((preset) => (
    preset.interpolation.kind === 'cubic'
    && preset.interpolation.control.every((component, index) => (
      Math.abs(component - interpolation.control[index]!) <= CONTROL_EPSILON
    ))
  ))
  return matched?.id ?? 'custom'
}

/**
 * 选择某个预设后应写入的插值。
 *
 * @remarks
 * 选 `custom` 时保留当前 cubic 控制点——用户是想接着调这条曲线，而不是把它重置掉；
 * 从 `hold`/`linear` 切过来才给标准 ease 起点。
 *
 * @public
 */
export function composeEasingPresetInterpolation(
  id: ComposeEasingSelectionId,
  current: ComposeAnimationInterpolation,
): ComposeAnimationInterpolation {
  if (id === 'custom') {
    return current.kind === 'cubic'
      ? current
      : { kind: 'cubic', control: COMPOSE_EASING_DEFAULT_CONTROL }
  }
  const preset = COMPOSE_EASING_PRESETS.find((candidate) => candidate.id === id)
  return preset?.interpolation ?? current
}

/** 把控制点格式化为单行 `0.5, 0, 0.5, 1` 文本。 @public */
export function formatComposeEasingControl(control: ComposeEasingControl): string {
  return control.map((component) => String(roundControlComponent(component))).join(', ')
}

/**
 * 解析单行控制点文本；不是四个有限数时返回 `null`，由调用方回滚。
 *
 * @remarks
 * 逗号与空白都当作分隔符：从 CSS 里粘贴 `cubic-bezier(.42, 0, .58, 1)` 的括号部分、
 * 或手敲空格分隔都应当可用。
 *
 * @public
 */
export function parseComposeEasingControl(text: string): ComposeEasingControl | null {
  const parts = text.split(/[\s,]+/).filter((part) => part.length > 0)
  if (parts.length !== 4) return null
  const parsed = parts.map((part) => Number.parseFloat(part))
  if (!parsed.every((component) => Number.isFinite(component))) return null
  return clampComposeEasingControl(parsed as unknown as ComposeEasingControl)
}

/** 缓动文案支持的语言。 @public */
export type ComposeEasingLocale = 'zh-CN' | 'en-US'

const PRESET_LABELS: Record<ComposeEasingLocale, Record<ComposeEasingSelectionId, string>> = {
  'zh-CN': {
    'hold': '保持',
    'linear': '线性',
    'ease-in': '缓入',
    'ease-out': '缓出',
    'ease-in-out': '缓入缓出',
    'ease-in-back': '缓入回弹',
    'ease-out-back': '缓出回弹',
    'ease-in-out-back': '缓入缓出回弹',
    'custom': '自定义贝塞尔',
  },
  'en-US': {
    'hold': 'Hold',
    'linear': 'Linear',
    'ease-in': 'Ease in',
    'ease-out': 'Ease out',
    'ease-in-out': 'Ease in and out',
    'ease-in-back': 'Ease in back',
    'ease-out-back': 'Ease out back',
    'ease-in-out-back': 'Ease in and out back',
    'custom': 'Custom bezier',
  },
}

/**
 * 取预设的本地化名称表。
 *
 * @remarks
 * 宿主（例如编辑器把预设渲染成属性面板的原生选择行）需要与组件内部完全一致的文案，
 * 因此文案由本包统一提供，而不是让每个宿主各抄一份。
 *
 * @public
 */
export function getComposeEasingPresetLabels(
  locale: ComposeEasingLocale,
): Record<ComposeEasingSelectionId, string> {
  return PRESET_LABELS[locale]
}
