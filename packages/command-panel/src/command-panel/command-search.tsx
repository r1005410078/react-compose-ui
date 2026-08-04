import { useId, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { formatComposeKeybinding } from '@compose-ui/components'
import { filterComposeCommandActions } from './command-filter'
import type { ComposeCommandAction } from '../types'

/** 检索区所需的文案子集；由面板的完整字典结构化满足。 */
export interface CommandSearchMessages {
  readonly searchLabel: string
  readonly searchPlaceholder: string
  readonly searchEmpty: string
  readonly searchUngrouped: string
}

interface CommandSearchProps {
  readonly actions: readonly ComposeCommandAction[]
  readonly messages: CommandSearchMessages
}

/**
 * 命令检索输入与结果列表。
 *
 * @remarks
 * 实现 WAI-ARIA Combobox with List Autocomplete：输入框自身即 combobox，结果为 listbox，
 * 活动项通过 `aria-activedescendant` 关联而非移动焦点，因此输入过程中焦点始终留在输入框。
 */
export function CommandSearch({ actions, messages }: CommandSearchProps) {
  const [query, setQuery] = useState('')
  const [storedIndex, setStoredIndex] = useState(0)
  const baseId = useId()
  const listboxId = `${baseId}-listbox`

  const groups = filterComposeCommandActions(actions, query)
  const flat = groups.flatMap((group) => group.actions)
  // 宿主可能在检索期间更新动作列表（例如选区变化），因此活动下标每次渲染都夹紧到有效范围，
  // 避免残留的旧下标指向不存在的选项。
  const activeIndex = Math.min(storedIndex, Math.max(flat.length - 1, 0))
  const activeAction = flat[activeIndex]
  // 查询为空时结果区整体不渲染，面板保持命令调试台原本的形态。
  const expanded = query.trim() !== ''
  const optionId = (index: number) => `${baseId}-option-${index}`

  const runAction = (action: ComposeCommandAction) => {
    if (action.disabledReason !== undefined) return
    action.run()
    // 执行后清空查询并收起结果，与命令面板「执行即完成」的预期一致。
    setQuery('')
    setStoredIndex(0)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      if (query === '') return
      event.preventDefault()
      setQuery('')
      setStoredIndex(0)
      return
    }
    if (!expanded || flat.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setStoredIndex(Math.min(activeIndex + 1, flat.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setStoredIndex(Math.max(activeIndex - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (activeAction) runAction(activeAction)
    }
  }

  // 分组只影响展示，键盘遍历用的是拍平后的连续下标。预先算出每组的起始位置，
  // 就不必在渲染过程中递增可变游标。分组数量是个位数，这里的累加成本可以忽略。
  const groupStart = groups.map((_, groupIndex) => groups
    .slice(0, groupIndex)
    .reduce((total, group) => total + group.actions.length, 0))

  return (
    <div className="command-panel__search">
      <input
        aria-activedescendant={expanded && activeAction ? optionId(activeIndex) : undefined}
        aria-autocomplete="list"
        aria-controls={expanded ? listboxId : undefined}
        aria-expanded={expanded}
        aria-label={messages.searchLabel}
        className="command-panel__search-input"
        placeholder={messages.searchPlaceholder}
        role="combobox"
        type="text"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setStoredIndex(0)
        }}
        onKeyDown={handleKeyDown}
      />
      {!expanded ? null : flat.length === 0 ? (
        <p className="command-panel__search-empty">{messages.searchEmpty}</p>
      ) : (
        <ul
          aria-label={messages.searchLabel}
          className="command-panel__results"
          id={listboxId}
          role="listbox"
        >
          {groups.map((group, groupIndex) => (
            <li key={group.category ?? '__ungrouped__'} role="presentation">
              <div
                aria-label={group.category ?? messages.searchUngrouped}
                className="command-panel__result-group"
                role="group"
              >
                <span aria-hidden="true" className="command-panel__result-category">
                  {group.category ?? messages.searchUngrouped}
                </span>
                {group.actions.map((action, actionIndex) => {
                  const index = (groupStart[groupIndex] ?? 0) + actionIndex
                  const disabled = action.disabledReason !== undefined
                  return (
                    <div
                      aria-disabled={disabled || undefined}
                      aria-selected={index === activeIndex}
                      className="command-panel__result"
                      data-action-id={action.id}
                      id={optionId(index)}
                      key={action.id}
                      role="option"
                      onClick={() => { runAction(action) }}
                      // 保持焦点留在输入框，否则点击会让 combobox 失焦并收起结果。
                      onMouseDown={(event) => { event.preventDefault() }}
                    >
                      <span className="command-panel__result-title">{action.title}</span>
                      {action.disabledReason === undefined ? null : (
                        <span className="command-panel__result-reason">
                          {action.disabledReason}
                        </span>
                      )}
                      {action.shortcut === undefined || action.shortcut.length === 0 ? null : (
                        <span className="command-panel__result-shortcut">
                          {action.shortcut
                            .map((binding) => formatComposeKeybinding(binding))
                            .join(' / ')}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
