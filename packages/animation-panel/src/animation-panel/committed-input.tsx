import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'

type CommittedInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'defaultValue' | 'onChange' | 'value'
> & {
  /** 当前会话值的显示文本。 */
  readonly value: string
  /** 按 Enter 或失焦时提交草稿；返回 false 表示草稿非法或被拒绝，组件回滚到会话值。 */
  readonly onCommit: (draft: string) => boolean
}

/**
 * 会话值只在提交时更新的文本输入。
 *
 * 把 model 值直接绑到受控 `value` 会让所有中间态被立即回滚（`#FF6B6` 这类半成品颜色
 * 永远输入不完），逐键提交又会把不完整的数字当成真实编辑写回模型，并因受控回写把光标
 * 推到末尾而吞掉后续按键。宿主必须用当前会话值作为 `key`，会话值从外部变化时重新挂载
 * 以同步草稿。
 */
export function CommittedInput({ onCommit, value, ...htmlProps }: CommittedInputProps) {
  const [draft, setDraft] = useState(value)
  const commit = () => {
    if (draft === value) return
    if (!onCommit(draft)) setDraft(value)
  }
  return (
    <input
      {...htmlProps}
      value={draft}
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit()
        }
        else if (event.key === 'Escape') {
          event.preventDefault()
          setDraft(value)
        }
      }}
    />
  )
}
