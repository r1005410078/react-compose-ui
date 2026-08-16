import type { AnimationKeyState } from './animation-key-state'

/** 菱形四态到 accessible name 的解析文案。 */
export interface AnimationKeyButtonMessages {
  readonly keyNone: (label: string) => string
  readonly keyAnimated: (label: string) => string
  readonly keyKeyed: (label: string) => string
  readonly keyUnavailable: (label: string) => string
}

/** 菱形打点按钮的受控属性。 */
export interface AnimationKeyButtonProps {
  readonly state: AnimationKeyState
  /** 字段的已本地化标签，用于组装按钮的 accessible name。 */
  readonly label: string
  readonly messages: AnimationKeyButtonMessages
  /** `keyed` 时删除关键帧，其余可用状态写入关键帧；`unavailable` 下不会被调用。 */
  readonly onToggle: () => void
}

function keyButtonName(
  state: AnimationKeyState,
  label: string,
  messages: AnimationKeyButtonMessages,
) {
  if (state === 'keyed') return messages.keyKeyed(label)
  if (state === 'animated') return messages.keyAnimated(label)
  if (state === 'unavailable') return messages.keyUnavailable(label)
  return messages.keyNone(label)
}

/**
 * 属性面板字段标签后的菱形打点按钮。
 *
 * @remarks
 * 四态视觉由 `data-key-state` 驱动（灰描边 / 蓝描边 / 蓝实心 / 置灰禁用），对齐 Rive 的
 * key 按钮语义。`aria-pressed` 表达"当前播放头上有帧"；`unavailable` 用原生 `disabled`
 * 并把原因放进 accessible name——禁用按钮不可聚焦，名字是读屏用户唯一能拿到的解释。
 */
export function AnimationKeyButton({ label, messages, onToggle, state }: AnimationKeyButtonProps) {
  return (
    <button
      aria-label={keyButtonName(state, label, messages)}
      aria-pressed={state === 'keyed'}
      className="compose-editor__animation-key"
      data-key-state={state}
      disabled={state === 'unavailable'}
      type="button"
      onClick={(event) => {
        // 标签单元可能整体是 <label>：不拦截会把点击透传成聚焦字段输入框。
        event.preventDefault()
        event.stopPropagation()
        onToggle()
      }}
    >
      <svg aria-hidden="true" viewBox="0 0 12 12">
        <path d="M6 1.2 10.8 6 6 10.8 1.2 6 6 1.2Z" />
      </svg>
    </button>
  )
}
