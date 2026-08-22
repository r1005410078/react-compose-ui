import { useCallback, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { ComposeCommandPrompt } from '@compose-ui/commands'
import type { ComposeCommandLineMessages, ComposeCommandLineProps } from './command-line-types'

/**
 * 把提示与关键字渲染成 AutoCAD 风格的一行文本。
 *
 * @remarks
 * 关键字写成 `[放弃(U)/结束(F)]`——括号里的字母就是用户要键入的内容，这个格式本身在告诉用户
 * 怎么操作，所以不做成下拉或按钮。
 */
function promptText(prompt: ComposeCommandPrompt | null, messages: ComposeCommandLineMessages) {
  if (!prompt) return messages.ready
  const keywords = prompt.keywords ?? []
  if (keywords.length === 0) return `${prompt.message}:`
  const options = keywords.map(({ key, label }) => `${label}(${key})`).join('/')
  return `${prompt.message}${messages.keywordsPrefix} [${options}]:`
}

/**
 * 命令行：一行提示 + 一个输入框 + 若干状态标记。
 *
 * @remarks
 * 本组件是**无业务语义的 Pattern**：它不认识文档、选择集或任何一条具体命令，只把用户键入的
 * 文本与 Esc 上报给宿主。命令由宿主启动——空闲时键入命令名回车，命令进行中键入关键字或坐标
 * 回车。
 *
 * Esc 有两级语义（有活动命令时中止命令、没有时清空选择），**两级都由宿主判定**：组件不知道
 * 宿主有没有选择集这个概念。
 *
 * @public
 */
export function ComposeCommandLine({
  prompt,
  notice,
  messages,
  status,
  onSubmit,
  onCancel,
  inputRef,
  testIdPrefix = 'compose',
  className,
}: ComposeCommandLineProps) {
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
    <div className={`compose-command-line${className ? ` ${className}` : ''}`}>
      <span className="compose-command-line__prompt" data-testid={`${testIdPrefix}-command-prompt`}>
        {notice ?? promptText(prompt, messages)}
      </span>
      <input
        ref={inputRef}
        aria-label={messages.inputLabel}
        className="compose-command-line__input"
        data-testid={`${testIdPrefix}-command-input`}
        placeholder={messages.placeholder}
        spellCheck={false}
        type="text"
        value={text}
        onChange={(event) => { setText(event.target.value) }}
        onKeyDown={handleKeyDown}
      />
      {(status ?? []).map((item) => (
        <span
          className="compose-command-line__status"
          data-active={item.active ? '' : undefined}
          data-testid={`${testIdPrefix}-${item.id}`}
          key={item.id}
        >
          {item.label}
        </span>
      ))}
    </div>
  )
}
