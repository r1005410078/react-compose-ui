import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import type { HistoryPanelProps } from './types'

const historyMessages = {
  'zh-CN': {
    region: '历史记录',
    heading: '历史',
    list: '历史记录列表',
    current: '当前历史：',
    empty: '开始编辑后会显示历史记录',
  },
  'en-US': {
    region: 'History',
    heading: 'History',
    list: 'History entries',
    current: 'Current history: ',
    empty: 'History appears after you start editing',
  },
} as const

/**
 * 渲染最新记录在上的受控历史时间线。
 *
 * @param props - 历史导航控制器和标准 `div` 属性。
 * @returns 可独立嵌入的历史面板。
 * @public
 */
export function HistoryPanel({
  controller,
  locale,
  className,
  style,
  ...htmlProps
}: HistoryPanelProps) {
  const i18n = useComposeI18nContext()
  const theme = useComposeThemeContext()
  const resolvedLocale = locale ?? i18n?.locale ?? 'zh-CN'
  const messages = historyMessages[resolvedLocale]
  const message = i18n?.formatMessage
  const t = {
    region: message?.('history.region', messages.region) ?? messages.region,
    heading: message?.('history.heading', messages.heading) ?? messages.heading,
    list: message?.('history.list', messages.list) ?? messages.list,
    current: message?.('history.current', messages.current) ?? messages.current,
    empty: message?.('history.empty', messages.empty) ?? messages.empty,
  }
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
      aria-label={htmlProps['aria-label'] ?? t.region}
      className={rootClassName}
      data-compose-ui="history"
      data-compose-theme={theme?.resolvedTheme}
      lang={resolvedLocale}
      role={htmlProps.role ?? 'region'}
      style={{
        ...(theme ? createComposeThemeStyle(theme.tokens) : {}),
        ...style,
      } as CSSProperties}
    >
      <div className="history-panel__header">
        <h2>{t.heading}</h2>
      </div>
      {activeEntry ? (
        <>
          <ol aria-label={t.list} className="history-panel__list">
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
            {t.current}{activeEntry.label}
          </p>
        </>
      ) : (
        <p className="history-panel__empty" role="status">
          {t.empty}
        </p>
      )}
    </div>
  )
}
