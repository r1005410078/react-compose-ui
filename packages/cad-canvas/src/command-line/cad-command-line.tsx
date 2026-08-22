import { useCallback, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react'
import type { ComposeCommandPrompt } from '@compose-ui/commands'
import type { CadCanvasMessages } from '../cad-canvas-i18n'

/** CAD 命令行的属性。 @internal */
export interface CadCommandLineProps {
  /** 命令进行中的当前提示；空闲时为 null。 */
  readonly prompt: ComposeCommandPrompt | null
  /** 上一次操作的反馈，例如「未知命令」。 */
  readonly notice: string | null
  readonly messages: CadCanvasMessages
  /** 正交模式是否开启；显示在命令行右侧。 */
  readonly ortho: boolean
  /** 对象捕捉是否开启。 */
  readonly snap: boolean
  /** 当前选择集大小；为 0 时不显示。 */
  readonly selectionCount: number
  /** 用户提交了一行文本：空闲时是命令名，命令进行中是关键字。 */
  readonly onSubmit: (text: string) => void
  /** 用户按下 Esc。 */
  readonly onCancel: () => void
  /** 指向输入框的 ref；宿主用它把键盘落点收回命令行。 */
  readonly inputRef?: RefObject<HTMLInputElement | null>
}

/**
 * 把提示与关键字渲染成 AutoCAD 风格的一行文本。
 *
 * @remarks
 * 关键字写成 `[放弃(U)/结束(F)]`——括号里的字母就是用户要键入的内容，这个格式本身在告诉用户
 * 怎么操作，所以不做成下拉或按钮。
 */
function promptText(prompt: ComposeCommandPrompt | null, messages: CadCanvasMessages) {
  if (!prompt) return messages.ready
  const keywords = prompt.keywords ?? []
  if (keywords.length === 0) return `${prompt.message}:`
  const options = keywords.map(({ key, label }) => `${label}(${key})`).join('/')
  return `${prompt.message}或 [${options}]:`
}

/**
 * CAD 命令行。
 *
 * @remarks
 * 命令由这里启动：空闲时键入命令名回车，命令进行中键入关键字回车。Esc 有两级语义——有活动
 * 命令时中止整条命令（AutoCAD 的 Esc 是中止而不是退一步，退一步由命令自己的「放弃」关键字
 * 表达），没有活动命令时清空选择集。两级都由宿主判定，本组件只负责把按键报上去。
 *
 * @internal
 */
export function CadCommandLine({
  prompt,
  notice,
  messages,
  ortho,
  snap,
  selectionCount,
  onSubmit,
  onCancel,
  inputRef,
}: CadCommandLineProps) {
  const [text, setText] = useState('')

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setText('')
      onCancel()
      return
    }
    if (event.key !== 'Enter') return
    event.preventDefault()
    const value = text
    setText('')
    onSubmit(value)
  }, [onCancel, onSubmit, text])

  return (
    <div className="compose-cad-canvas__command-line">
      <span className="compose-cad-canvas__prompt" data-testid="cad-command-prompt">
        {notice ?? promptText(prompt, messages)}
      </span>
      <input
        ref={inputRef}
        aria-label={messages.commandLineLabel}
        className="compose-cad-canvas__command-input"
        data-testid="cad-command-input"
        placeholder={messages.commandPlaceholder}
        spellCheck={false}
        type="text"
        value={text}
        onChange={(event) => { setText(event.target.value) }}
        onKeyDown={handleKeyDown}
      />
      {selectionCount > 0 ? (
        <span
          className="compose-cad-canvas__mode"
          data-active=""
          data-testid="cad-selection-count"
        >
          {selectionCount}
        </span>
      ) : null}
      <span
        className="compose-cad-canvas__mode"
        data-active={snap ? '' : undefined}
        data-testid="cad-snap-state"
      >
        {snap ? messages.snapOn : messages.snapOff}
      </span>
      <span
        className="compose-cad-canvas__mode"
        data-active={ortho ? '' : undefined}
        data-testid="cad-ortho-state"
      >
        {ortho ? messages.orthoOn : messages.orthoOff}
      </span>
    </div>
  )
}
