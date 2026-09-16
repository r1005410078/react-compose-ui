import type { ComposeLibraryRecord } from '@compose-ui/library'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useId } from 'react'
import type { ComposeLibraryMessages } from '../library-i18n'

/**
 * 全屏演示。
 *
 * @remarks
 * 屏幕此刻**正对着客户**，这一条决定了下面每个细节：
 *
 * - **整屏只有图与一条控制条**，没有任何编辑器 chrome。
 * - **不出现分类、文件名与修改时间**——它们是我们自己的记账。翻页位置只写序号与总数。
 * - 呈现的是**真实渲染**而不是缩略图：客户要凑近看数值与线宽。渲染器由宿主注入
 *   （`renderPage`），因为它就是既有的只读 Preview——另写一份会让「演示时好好的、上了大屏
 *   不一样」这类问题永远查不清是谁的。
 *
 * `←` / `→` 翻页、`Enter` 就用这个、`Escape` 退回页面库。
 * @internal
 */
export function LibraryDemoScreen({
  records,
  index,
  onIndexChange,
  renderPage,
  onUse,
  onExit,
  messages,
}: {
  readonly records: readonly ComposeLibraryRecord[]
  readonly index: number
  readonly onIndexChange: (next: number) => void
  readonly renderPage: (record: ComposeLibraryRecord) => ReactNode
  readonly onUse: ((record: ComposeLibraryRecord) => void) | undefined
  readonly onExit: () => void
  readonly messages: ComposeLibraryMessages
}) {
  const labelId = useId()
  const current = records[index]

  const step = useCallback((delta: number) => {
    if (records.length === 0) return
    // 翻到头就绕回去：一条 64 张的链上，让最后一张的「下一张」变成死键没有任何好处，
    // 而用户此刻正在客户面前连续按。
    onIndexChange((index + delta + records.length) % records.length)
  }, [index, onIndexChange, records.length])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') step(1)
      else if (event.key === 'ArrowLeft') step(-1)
      else if (event.key === 'Escape') onExit()
      else if (event.key === 'Enter' && current !== undefined) onUse?.(current)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [current, onExit, onUse, step])

  if (current === undefined) return null

  return (
    <div
      aria-labelledby={labelId}
      aria-modal="true"
      className="compose-library__demo"
      role="dialog"
    >
      <span className="compose-library__visually-hidden" id={labelId}>{current.title}</span>
      <div className="compose-library__demo-stage">{renderPage(current)}</div>

      <div className="compose-library__demo-bar">
        <button
          aria-label={messages.demoPrev}
          className="compose-library__demo-nav"
          onClick={() => step(-1)}
          type="button"
        >
          <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M14 6l-6 6 6 6" />
          </svg>
        </button>
        <div className="compose-library__demo-who">
          <b>{current.title}</b>
          {/* 只写序号与总数：文件名与修改时间是我们自己的记账，而屏幕正对着客户。 */}
          <span>{messages.demoPosition(index + 1, records.length)}</span>
        </div>
        <button
          aria-label={messages.demoNext}
          className="compose-library__demo-nav"
          onClick={() => step(1)}
          type="button"
        >
          <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M10 6l6 6-6 6" />
          </svg>
        </button>
        <span className="compose-library__demo-divider" />
        {onUse === undefined ? null : (
          <button
            className="compose-library__button compose-library__button--primary"
            onClick={() => onUse(current)}
            type="button"
          >
            {messages.use}
          </button>
        )}
        <button
          aria-label={messages.demoExit}
          className="compose-library__demo-nav"
          onClick={onExit}
          type="button"
        >
          <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" viewBox="0 0 24 24">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
