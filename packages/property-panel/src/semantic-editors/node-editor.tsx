import { useId, useRef, useState } from 'react'
import type { DragEvent as ReactDragEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import * as v from 'valibot'
import type { ComposePropertyPanelNodeCandidate } from '../property-panel/editor-ports'
import { useComposePropertyPanelNodeEditorPort } from '../property-panel/editor-ports'
import type { PropertyPanelRendererProps } from '../property-panel/compose-property-panel'

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined
}

/**
 * 从拖拽数据中取出宿主声明的媒体类型及其载荷。
 *
 * @returns 没有交集时返回 null，调用方据此不接受该次拖拽。
 */
function readDragPayload(
  transfer: DataTransfer,
  mediaTypes: readonly string[],
): Record<string, string> | null {
  const available = new Set(Array.from(transfer.types))
  const matched = mediaTypes.filter((type) => available.has(type))
  if (matched.length === 0) return null
  const payload: Record<string, string> = {}
  matched.forEach((type) => { payload[type] = transfer.getData(type) })
  return payload
}

/**
 * 指向宿主节点的引用属性 editor。
 *
 * @remarks
 * 面板不理解候选值的领域含义，全部交由 {@link ComposePropertyPanelNodeEditorPort} 解析。
 * 这是属性面板中唯一的拖放目标：只有在拖拽数据类型与宿主声明存在交集时才 `preventDefault`，
 * 否则会吞掉页面上其他拖放交互。
 * @internal
 */
export function NodeEditor(props: PropertyPanelRendererProps) {
  const port = useComposePropertyPanelNodeEditorPort()
  const bindingTarget = props.binding?.getTarget('value')
  const bound = Boolean(bindingTarget?.binding)
  const effectiveValue = bindingTarget?.effectiveValue ?? props.value
  const disabled = props.readOnly || bound

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [dropActive, setDropActive] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listboxId = `${useId()}-node-listbox`

  const candidates = port?.candidates ?? []
  const filtered = query.trim().length === 0
    ? candidates
    : candidates.filter((candidate) => candidate.label
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()))

  const commitValue = (nextValue: unknown, reason: 'input' | 'drop') => {
    if (disabled) return false
    const result = v.safeParse(props.schema, nextValue)
    if (!result.success) {
      setError(result.issues[0]?.message)
      return false
    }
    const committed = props.commit(nextValue, reason)
    setError(committed ? undefined : '完整属性值不符合 Schema')
    return committed
  }

  const selectCandidate = (candidate: ComposePropertyPanelNodeCandidate) => {
    if (commitValue(candidate.value, 'input')) {
      setOpen(false)
      triggerRef.current?.focus()
    }
  }

  const clearValue = () => {
    if (commitValue(null, 'input')) setOpen(false)
  }

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      clearValue()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setQuery('')
      setActiveIndex(0)
      setOpen(true)
    }
  }

  const handleListKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => Math.max(current - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const candidate = filtered[activeIndex]
      if (candidate) selectCandidate(candidate)
    }
  }

  const handleDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (disabled || !port) return
    if (readDragPayload(event.dataTransfer, port.dragMediaTypes) === null) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDropActive(true)
  }

  const handleDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    setDropActive(false)
    if (disabled || !port) return
    const payload = readDragPayload(event.dataTransfer, port.dragMediaTypes)
    if (payload === null) return
    event.preventDefault()
    const candidate = port.parseDrop(payload)
    if (candidate) commitValue(candidate.value, 'drop')
  }

  const empty = isEmptyValue(effectiveValue)
  const triggerLabel = empty
    ? '未设置'
    : port?.resolveLabel(effectiveValue) ?? '未知引用'

  return (
    <div
      className="property-panel__semantic property-panel__semantic--node"
      data-drop-active={dropActive ? 'true' : undefined}
      data-testid="semantic-editor-node"
      onDragLeave={() => { setDropActive(false) }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="property-panel__binding-target">
        <div className="property-panel__binding-control">
          <button
            ref={triggerRef}
            aria-controls={open ? listboxId : undefined}
            aria-expanded={open}
            aria-haspopup="listbox"
            className="property-panel__node-trigger"
            data-empty={empty ? 'true' : undefined}
            disabled={disabled}
            role="combobox"
            type="button"
            onClick={() => {
              setOpen((current) => {
                // 每次打开都从空筛选与第一项开始，避免上次的输入残留。
                if (!current) {
                  setQuery('')
                  setActiveIndex(0)
                }
                return !current
              })
            }}
            onKeyDown={handleTriggerKeyDown}
          >
            {triggerLabel}
          </button>
          {empty || disabled ? null : (
            <button
              aria-label={`清除${props.label}`}
              className="property-panel__node-clear"
              type="button"
              onClick={clearValue}
            >
              ×
            </button>
          )}
          {open ? (
            <div className="property-panel__node-popover" onKeyDown={handleListKeyDown}>
              <input
                aria-label={`筛选${props.label}`}
                autoFocus
                className="property-panel__node-filter"
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActiveIndex(0)
                }}
              />
              <ul
                aria-label={props.label}
                className="property-panel__node-listbox"
                id={listboxId}
                role="listbox"
              >
                {filtered.length === 0 ? (
                  <li className="property-panel__node-empty" role="presentation">
                    无可用候选
                  </li>
                ) : filtered.map((candidate, index) => (
                  <li key={candidate.id}>
                    <button
                      aria-selected={index === activeIndex}
                      className="property-panel__node-option"
                      role="option"
                      type="button"
                      onClick={() => { selectCandidate(candidate) }}
                    >
                      {candidate.label}
                      {candidate.description === undefined
                        ? null
                        : <small>{candidate.description}</small>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        {props.binding?.renderTrigger('value')}
      </div>
      {error ? <span role="alert">{error}</span> : null}
    </div>
  )
}
