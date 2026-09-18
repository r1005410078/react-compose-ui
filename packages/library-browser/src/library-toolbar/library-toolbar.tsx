import type { ComposeLibrarySort } from '@compose-ui/library'
import type { ComposeLibraryMessages } from '../library-i18n'
import type { ComposeLibraryView } from '../library-browser/library-browser-types'

const SORTS: readonly ComposeLibrarySort[] = [
  'modified-desc',
  'created-desc',
  'used-desc',
  'title-asc',
]

function labelOfSort(sort: ComposeLibrarySort, messages: ComposeLibraryMessages) {
  if (sort === 'created-desc') return messages.sortCreated
  if (sort === 'used-desc') return messages.sortUsed
  if (sort === 'title-asc') return messages.sortTitle
  return messages.sortModified
}

/**
 * 内容区顶部那一行控件。
 *
 * @remarks
 * 它**不是面板头**：没有底色条、没有下边线，与内容同一条左边线。首页只有两块内容、都不可停靠，
 * 照搬编辑器那套面板 chrome 就是两块内容画四条边框。
 * @internal
 */
export function LibraryToolbar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  view,
  onViewChange,
  onNewPage,
  onDemo,
  messages,
}: {
  readonly search: string
  readonly onSearchChange: (next: string) => void
  readonly sort: ComposeLibrarySort
  readonly onSortChange: (next: ComposeLibrarySort) => void
  readonly view: ComposeLibraryView
  readonly onViewChange: (next: ComposeLibraryView) => void
  readonly onNewPage: (() => void) | undefined
  /** 全屏演示入口；宿主没接渲染器时缺席——按下去什么都不发生的按钮比没有更差。 */
  readonly onDemo: (() => void) | undefined
  readonly messages: ComposeLibraryMessages
}) {
  return (
    <div className="compose-library__tools">
      <label className="compose-library__search">
        <svg aria-hidden="true" className="compose-library__icon" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7.2" />
          <path d="m20.5 20.5-4-4" />
        </svg>
        <input
          aria-label={messages.search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={messages.search}
          type="search"
          value={search}
        />
      </label>

      <span className="compose-library__tools-spacer" />

      <div className="compose-library__tools-group">
        <label className="compose-library__select">
          <span className="compose-library__visually-hidden">{messages.sortModified}</span>
          <select
            onChange={(event) => onSortChange(event.target.value as ComposeLibrarySort)}
            value={sort}
          >
            {SORTS.map((candidate) => (
              <option key={candidate} value={candidate}>{labelOfSort(candidate, messages)}</option>
            ))}
          </select>
        </label>

        {/* 两种呈现是同一件事的两个取值，因此是一个单选组而不是两个独立开关。 */}
        <div aria-label={messages.viewGrid} className="compose-library__seg" role="group">
          <button
            aria-label={messages.viewGrid}
            aria-pressed={view === 'grid'}
            data-on={view === 'grid' ? '' : undefined}
            onClick={() => onViewChange('grid')}
            type="button"
          >
            <svg aria-hidden="true" className="compose-library__icon" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
              <rect height="7" rx="1.2" width="7" x="3.5" y="3.5" /><rect height="7" rx="1.2" width="7" x="13.5" y="3.5" />
              <rect height="7" rx="1.2" width="7" x="3.5" y="13.5" /><rect height="7" rx="1.2" width="7" x="13.5" y="13.5" />
            </svg>
          </button>
          <button
            aria-label={messages.viewList}
            aria-pressed={view === 'list'}
            data-on={view === 'list' ? '' : undefined}
            onClick={() => onViewChange('list')}
            type="button"
          >
            <svg aria-hidden="true" className="compose-library__icon" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" viewBox="0 0 24 24">
              <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01M8 6h12.5M8 12h12.5M8 18h12.5" />
            </svg>
          </button>
        </div>
      </div>

      <div className="compose-library__tools-group">
        {onDemo === undefined ? null : (
          <button className="compose-library__button" onClick={onDemo} type="button">
            <svg aria-hidden="true" className="compose-library__icon" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
              <path d="M4 5.5h16v11H4zM9.5 20.5h5M12 16.5v4" />
            </svg>
            {messages.demo}
          </button>
        )}
      </div>

      {onNewPage === undefined ? null : (
        <div className="compose-library__tools-group">
          <button
            className="compose-library__button compose-library__button--primary"
            onClick={onNewPage}
            type="button"
          >
            <svg aria-hidden="true" className="compose-library__icon" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M5 12h14M12 5v14" />
            </svg>
            {messages.newPage}
          </button>
        </div>
      )}
    </div>
  )
}
