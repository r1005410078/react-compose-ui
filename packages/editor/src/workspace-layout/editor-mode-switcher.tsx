import { useComposeI18nContext } from '@compose-ui/ui-context'
import { getEditorMessages } from '../editor-i18n'

/** 编辑器的顶层编辑模式。 @internal */
export type ComposeEditorMode = 'design' | 'drafting' | 'animation'

/** 画布工具栏行右侧的 设计/动画 模式切换器。 @internal */
export interface EditorModeSwitcherProps {
  readonly mode: ComposeEditorMode
  readonly onModeChange: (mode: ComposeEditorMode) => void
}

/**
 * 设计 / 绘图 / 动画 切换器。
 *
 * @remarks
 * 实现 WAI-ARIA radiogroup 语义：Tab 进入当前选中项，方向键在各模式之间移动并立即生效
 * （selection follows focus），与原生 radio 组的键盘行为一致。
 *
 * 方向键按**索引循环**而不是「另一个就是对面那个」：后者只在恰好两段时成立，加第三段时
 * 会静默退化成在前两段之间来回跳。
 */
export function EditorModeSwitcher({ mode, onModeChange }: EditorModeSwitcherProps) {
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage).workspace
  const options: readonly { readonly value: ComposeEditorMode; readonly label: string }[] = [
    { value: 'design', label: messages.modeDesign },
    { value: 'drafting', label: messages.modeDrafting },
    { value: 'animation', label: messages.modeAnimation },
  ]

  return (
    <div
      aria-label={messages.modeSwitcher}
      className="compose-editor__mode-switcher"
      role="radiogroup"
      onKeyDown={(event) => {
        const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : 0
        if (step === 0) return
        event.preventDefault()
        const index = options.findIndex((option) => option.value === mode)
        const next = options[(index + step + options.length) % options.length]!.value
        onModeChange(next)
        const target = event.currentTarget
          .querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)
        target?.focus()
      }}
    >
      {options.map((option) => (
        <button
          aria-checked={mode === option.value}
          className="compose-editor__mode-switcher-option"
          data-mode={option.value}
          key={option.value}
          role="radio"
          tabIndex={mode === option.value ? 0 : -1}
          type="button"
          onClick={() => {
            if (mode !== option.value) onModeChange(option.value)
          }}
        >{option.label}</button>
      ))}
    </div>
  )
}
