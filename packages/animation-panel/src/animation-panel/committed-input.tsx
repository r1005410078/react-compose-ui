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
 *
 * 提交被模型接受但钳制回一个和提交前相同的值时（例如时间超出时长被钳回原时间），
 * `value` 的字符串表示不会变化，宿主的 `key` 也因此不会触发重挂载，草稿会永久停留在
 * 被钳制前的错误输入上。内部 epoch 计数器在每次提交被接受时自增；渲染期比较
 * `epoch`/`syncedEpoch` 并按 React 官方"渲染期调整 state"模式同步草稿，而不是在
 * effect 里 setState——后者会多触发一轮可避免的 commit，且被本仓库的
 * react-hooks/set-state-in-effect 规则判定为错误。
 */
export function CommittedInput({ onCommit, value, ...htmlProps }: CommittedInputProps) {
  const [draft, setDraft] = useState(value)
  const [epoch, setEpoch] = useState(0)
  const [syncedEpoch, setSyncedEpoch] = useState(0)
  if (epoch !== syncedEpoch) {
    setSyncedEpoch(epoch)
    setDraft(value)
  }
  const commit = () => {
    if (draft === value) return
    if (onCommit(draft)) setEpoch((current) => current + 1)
    else setDraft(value)
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
