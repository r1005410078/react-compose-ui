import { Fragment, useCallback, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { ComposeCommandPrompt } from '@compose-ui/commands'
import type { ComposeCommandLineMessages, ComposeCommandLineProps } from './command-line-types'

/**
 * 把提示与关键字渲染成 AutoCAD 风格的一行。
 *
 * @remarks
 * 关键字写成 `[放弃(U)/结束(F)]`——括号里的字母就是用户要键入的内容，这个格式本身在告诉
 * 用户怎么操作，因此**不换成下拉或工具栏**。可点只是在这一行上多给一条路：每个
 * `标签(字母)` 是一个按钮，点它与键入那个字母上报同一个结果。
 *
 * 分片而不是拼一整个字符串，是因为按钮必须是独立元素；前后的方括号、斜杠与冒号仍然逐字
 * 保留，这一行看起来与从前一模一样。
 */
function promptParts(prompt: ComposeCommandPrompt | null, messages: ComposeCommandLineMessages) {
  if (!prompt) return { lead: messages.ready, keywords: [] as const }
  const keywords = prompt.keywords ?? []
  if (keywords.length === 0) return { lead: `${prompt.message}:`, keywords: [] as const }
  return { lead: `${prompt.message}${messages.keywordsPrefix} [`, keywords }
}

/**
 * 召回历史保留的行数上限。
 *
 * @remarks
 * 上限存在是为了不让一次长会话把内存吃掉；50 行远超「上箭头翻几下」的实际用法，取更大的
 * 值不改变任何可观察行为。
 */
const HISTORY_LIMIT = 50

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
  onTextChange,
  onFieldAdvance,
  inputRef,
  testIdPrefix = 'compose',
  className,
}: ComposeCommandLineProps) {
  const [text, setText] = useState('')
  /**
   * 提交过的文本行，最近的在前。
   *
   * @remarks
   * 记的是**文本行**而不是命令：行里混着坐标与关键字，它们不是命令名。宿主那边「空确认重复
   * 上一条命令」记的是另一个序列，两者刻意不共用——共用会让空确认把上一次键入的坐标拿去当
   * 命令解析。
   *
   * 用 ref 而不是 state：召回历史不参与渲染，写进 state 只会白白多一次重渲染。
   */
  const historyRef = useRef<readonly string[]>([])
  /** 当前召回到第几行；`-1` 表示正在编辑一行新的。同样不参与渲染。 */
  const historyIndexRef = useRef(-1)

  /** 召回一行：`step` 为正往更早走，为负往更近走。走回 `-1` 时回到空输入。 */
  const recall = useCallback((step: number) => {
    const history = historyRef.current
    if (history.length === 0) return
    const next = Math.min(history.length - 1, Math.max(-1, historyIndexRef.current + step))
    historyIndexRef.current = next
    setText(next === -1 ? '' : history[next]!)
  }, [])

  /** 写缓冲的唯一入口：上报与置位必须成对，分开写必然有一处漏掉。 */
  const writeText = useCallback((next: string) => {
    setText(next)
    onTextChange?.(next)
  }, [onTextChange])

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
    // 只在调用方要接管时才吃掉 `Tab`：其余时候它是焦点导航键。
    if (event.key === 'Tab' && onFieldAdvance) {
      event.preventDefault()
      onFieldAdvance(text)
      writeText('')
      return
    }
    // 方向键默认把光标移到行首/行尾；召回要覆盖它，这是终端的既有约定。
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      recall(event.key === 'ArrowUp' ? 1 : -1)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      writeText('')
      historyIndexRef.current = -1
      onCancel()
      return
    }
    if (event.key !== 'Enter') return
    event.preventDefault()
    const value = text
    if (value.trim().length > 0) {
      historyRef.current = [value, ...historyRef.current].slice(0, HISTORY_LIMIT)
    }
    writeText('')
    historyIndexRef.current = -1
    onSubmit(value)
  }, [onCancel, onFieldAdvance, onSubmit, recall, text, writeText])

  const parts = promptParts(prompt, messages)

  return (
    <div
      className={`compose-command-line${className ? ` ${className}` : ''}`}
      data-testid={`${testIdPrefix}-command-line`}
    >
      <span className="compose-command-line__prompt" data-testid={`${testIdPrefix}-command-prompt`}>
        {notice ?? (
          <>
            {parts.lead}
            {parts.keywords.map(({ key, label }, index) => (
              <Fragment key={key}>
                {index > 0 ? '/' : null}
                <button
                  className="compose-command-line__keyword"
                  data-testid={`${testIdPrefix}-command-keyword-${key}`}
                  type="button"
                  // 点击与键入同一条路：宿主收到的是同一个字符串，它不需要知道用户走的是哪条。
                  onClick={() => { onSubmit(key) }}
                >
                  {`${label}(${key})`}
                </button>
              </Fragment>
            ))}
            {parts.keywords.length > 0 ? ']:' : null}
          </>
        )}
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
        onChange={(event) => { writeText(event.target.value) }}
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
