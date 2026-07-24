import { useMemo, useState } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { useOperationLog } from './react'
import type {
  OperationLogCategory,
  OperationLogEntry,
  OperationLogSnapshot,
} from './types'
import './styles.css'

/** 操作日志查看面板属性。 */
export interface OperationLogPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** 没有匹配记录时显示的文字。 */
  emptyMessage?: string
}

const categoryLabels: Record<OperationLogCategory, string> = {
  component: 'Component',
  scene: 'Scene',
  property: 'Property',
  binding: 'Binding',
}

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function formatTime(timestamp: number) {
  return timeFormatter.format(timestamp)
}

function Snapshot({ label, snapshot }: { label: string; snapshot?: OperationLogSnapshot }) {
  if (!snapshot) return null
  const content = snapshot.value === undefined
    ? snapshot.preview
    : JSON.stringify(snapshot.value, null, 2)
  return (
    <section className="operation-log__snapshot">
      <div className="operation-log__detail-label">
        {label}
        {snapshot.status === 'truncated' ? <span>Truncated · {snapshot.byteLength} B</span> : null}
        {snapshot.status === 'unavailable' ? <span>Unavailable</span> : null}
      </div>
      <pre>{content}</pre>
    </section>
  )
}

function Detail({ entry, onClose }: { entry: OperationLogEntry; onClose: () => void }) {
  return (
    <section className="operation-log__detail" aria-label="Operation details">
      <header>
        <strong>{entry.summary}</strong>
        <div>
          <span>{formatTime(entry.updatedAt)}</span>
          <button type="button" aria-label="Close operation details" onClick={onClose}>×</button>
        </div>
      </header>
      <dl>
        <div><dt>Action</dt><dd>{entry.action}</dd></div>
        <div><dt>Category</dt><dd>{categoryLabels[entry.category]}</dd></div>
        {entry.count > 1 ? <div><dt>Merged</dt><dd>{entry.count} times</dd></div> : null}
        {entry.source ? <div><dt>Source</dt><dd>{entry.source}</dd></div> : null}
        {entry.actor ? <div><dt>Actor</dt><dd>{entry.actor.label ?? entry.actor.id}</dd></div> : null}
      </dl>
      {entry.targets.length > 0 ? (
        <section className="operation-log__targets">
          <div className="operation-log__detail-label">Targets</div>
          {entry.targets.map((target, index) => (
            <div key={`${target.componentId ?? 'target'}-${index}`}>
              <span>{target.componentLabel ?? target.componentId ?? 'Unknown target'}</span>
              {target.path?.length ? <code>{target.path.join('.')}</code> : null}
            </div>
          ))}
        </section>
      ) : null}
      <Snapshot label="Before" snapshot={entry.before} />
      <Snapshot label="After" snapshot={entry.after} />
      <Snapshot label="Metadata" snapshot={entry.metadata} />
    </section>
  )
}

/**
 * 显示当前 scope 的本地操作审计日志。
 *
 * @param props - 标准 div 属性和可覆盖空状态文案。
 * @returns 带筛选、列表和结构化详情的紧凑日志区域。
 */
export function OperationLogPanel({
  className,
  emptyMessage = 'No operations yet',
  'aria-label': ariaLabel = 'Operation log',
  ...props
}: OperationLogPanelProps) {
  const { status, entries } = useOperationLog()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<OperationLogCategory | 'all'>('all')
  const [componentId, setComponentId] = useState('all')
  const [selectedId, setSelectedId] = useState<string>()
  const components = useMemo(() => {
    const values = new Map<string, string>()
    entries.forEach((entry) => entry.targets.forEach((target) => {
      if (target.componentId && !values.has(target.componentId)) {
        values.set(target.componentId, target.componentLabel ?? target.componentId)
      }
    }))
    return [...values].sort((left, right) => left[1].localeCompare(right[1], 'en-US'))
  }, [entries])
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredEntries = useMemo(() => entries.filter((entry) => {
    if (category !== 'all' && entry.category !== category) return false
    if (componentId !== 'all' && !entry.targets.some((target) => target.componentId === componentId)) {
      return false
    }
    if (!normalizedQuery) return true
    const searchable = [
      entry.summary,
      entry.action,
      entry.source,
      ...entry.targets.flatMap((target) => [
        target.componentId,
        target.componentLabel,
        target.path?.join('.'),
      ]),
    ].filter(Boolean).join(' ').toLocaleLowerCase()
    return searchable.includes(normalizedQuery)
  }), [category, componentId, entries, normalizedQuery])
  const selectedEntry = filteredEntries.find(({ id }) => id === selectedId)
  let content: ReactNode
  if (status === 'loading') {
    content = <div className="operation-log__empty">Loading operation log…</div>
  } else if (filteredEntries.length === 0) {
    content = (
      <div className="operation-log__empty">
        {entries.length === 0 && !normalizedQuery && category === 'all' && componentId === 'all'
          ? emptyMessage
          : 'No matching operations'}
      </div>
    )
  } else {
    content = (
      <div className="operation-log__content">
        <div className="operation-log__list" aria-label="Operation list">
          {filteredEntries.map((entry) => (
            <button
              type="button"
              className="operation-log__entry"
              aria-current={selectedEntry?.id === entry.id ? 'true' : undefined}
              key={entry.id}
              onClick={() => setSelectedId(entry.id)}
            >
              <span className={`operation-log__category operation-log__category--${entry.category}`}>
                {categoryLabels[entry.category]}
              </span>
              <span className="operation-log__entry-copy">
                <strong>{entry.summary}</strong>
                <small>{entry.targets[0]?.componentLabel ?? entry.action}</small>
              </span>
              {entry.count > 1 ? <span className="operation-log__count">×{entry.count}</span> : null}
              <time>{formatTime(entry.updatedAt)}</time>
            </button>
          ))}
        </div>
        {selectedEntry ? <Detail entry={selectedEntry} onClose={() => setSelectedId(undefined)} /> : null}
      </div>
    )
  }

  return (
    <div
      {...props}
      className={['operation-log', className].filter(Boolean).join(' ')}
      data-compose-ui="operation-log"
      role="region"
      aria-label={ariaLabel}
    >
      {status === 'degraded' ? (
        <div className="operation-log__warning" role="status">Local persistence unavailable</div>
      ) : null}
      <div className="operation-log__toolbar">
        <label className="operation-log__search">
          <span className="operation-log__sr-only">Search operations</span>
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Search operations"
            placeholder="Search operations"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
        <select
          aria-label="Operation category"
          value={category}
          onChange={(event) => setCategory(event.currentTarget.value as OperationLogCategory | 'all')}
        >
          <option value="all">All categories</option>
          {(Object.keys(categoryLabels) as OperationLogCategory[]).map((value) => (
            <option key={value} value={value}>{categoryLabels[value]}</option>
          ))}
        </select>
        <select
          aria-label="Operation component"
          value={componentId}
          onChange={(event) => setComponentId(event.currentTarget.value)}
        >
          <option value="all">All components</option>
          {components.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>
      {content}
    </div>
  )
}
