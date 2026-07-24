import { useEffect, useRef } from 'react'
import type { HistoryPanelProps } from './types'

/**
 * 渲染最新记录在上的受控历史时间线。
 *
 * @param props - 历史导航控制器和标准 `div` 属性。
 * @returns 可独立嵌入的历史面板。
 * @public
 */
export function HistoryPanel({
  controller,
  className,
  ...htmlProps
}: HistoryPanelProps) {
  const activeButtonRef = useRef<HTMLButtonElement>(null)
  const rootClassName = ['history-panel', className].filter(Boolean).join(' ')
  const activeIndex = controller.entries.findIndex(
    (entry) => entry.id === controller.activeEntryId,
  )
  const visibleEntries = [...controller.entries].map((entry, index) => ({
    entry,
    index,
  })).reverse()
  const activeEntry = activeIndex >= 0 ? controller.entries[activeIndex] : undefined

  useEffect(() => {
    activeButtonRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [controller.activeEntryId])

  return (
    <div
      {...htmlProps}
      aria-label={htmlProps['aria-label'] ?? '历史记录'}
      className={rootClassName}
      data-compose-ui="history"
    >
      <div className="history-panel__header">
        <h2>历史</h2>
      </div>
      {activeEntry ? (
        <>
          <ol aria-label="历史记录列表" className="history-panel__list">
            {visibleEntries.map(({ entry, index }) => {
              const state = index === activeIndex
                ? 'current'
                : index > activeIndex ? 'future' : 'past'
              const separator = entry.label.indexOf(' · ')
              const title = separator >= 0 ? entry.label.slice(0, separator) : entry.label
              const detail = separator >= 0 ? entry.label.slice(separator + 3) : undefined
              return (
                <li key={entry.id}>
                  <button
                    ref={state === 'current' ? activeButtonRef : undefined}
                    aria-label={entry.label}
                    aria-current={state === 'current' ? 'step' : undefined}
                    data-history-state={state}
                    title={entry.label}
                    type="button"
                    onClick={() => {
                      if (state !== 'current') controller.navigate(entry.id)
                    }}
                  >
                    {state === 'current' ? (
                      <svg aria-hidden="true" viewBox="0 0 16 16">
                        <path d="m3 8.25 3 3L13 4.5" />
                      </svg>
                    ) : <span aria-hidden="true" />}
                    <span className="history-panel__entry-copy">
                      <strong>{title}</strong>
                      {detail ? <small>{detail}</small> : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
          <p aria-live="polite" className="history-panel__visually-hidden" role="status">
            当前历史：{activeEntry.label}
          </p>
        </>
      ) : (
        <p className="history-panel__empty" role="status">
          开始编辑后会显示历史记录
        </p>
      )}
    </div>
  )
}
