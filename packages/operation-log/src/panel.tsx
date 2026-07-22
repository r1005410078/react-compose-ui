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
  component: '组件',
  scene: '场景',
  property: '属性',
  binding: '绑定',
}

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
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
        {snapshot.status === 'truncated' ? <span>已截断 · {snapshot.byteLength} B</span> : null}
        {snapshot.status === 'unavailable' ? <span>不可保存</span> : null}
      </div>
      <pre>{content}</pre>
    </section>
  )
}

function Detail({ entry, onClose }: { entry: OperationLogEntry; onClose: () => void }) {
  return (
    <section className="operation-log__detail" aria-label="日志详情">
      <header>
        <strong>{entry.summary}</strong>
        <div>
          <span>{formatTime(entry.updatedAt)}</span>
          <button type="button" aria-label="关闭日志详情" onClick={onClose}>×</button>
        </div>
      </header>
      <dl>
        <div><dt>操作</dt><dd>{entry.action}</dd></div>
        <div><dt>分类</dt><dd>{categoryLabels[entry.category]}</dd></div>
        {entry.count > 1 ? <div><dt>合并</dt><dd>{entry.count} 次</dd></div> : null}
        {entry.source ? <div><dt>来源</dt><dd>{entry.source}</dd></div> : null}
        {entry.actor ? <div><dt>操作者</dt><dd>{entry.actor.label ?? entry.actor.id}</dd></div> : null}
      </dl>
      {entry.targets.length > 0 ? (
        <section className="operation-log__targets">
          <div className="operation-log__detail-label">目标</div>
          {entry.targets.map((target, index) => (
            <div key={`${target.componentId ?? 'target'}-${index}`}>
              <span>{target.componentLabel ?? target.componentId ?? '未知目标'}</span>
              {target.path?.length ? <code>{target.path.join('.')}</code> : null}
            </div>
          ))}
        </section>
      ) : null}
      <Snapshot label="变更前" snapshot={entry.before} />
      <Snapshot label="变更后" snapshot={entry.after} />
      <Snapshot label="元数据" snapshot={entry.metadata} />
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
  emptyMessage = '暂无操作日志',
  'aria-label': ariaLabel = '操作日志',
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
    return [...values].sort((left, right) => left[1].localeCompare(right[1], 'zh-CN'))
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
    content = <div className="operation-log__empty">正在加载操作日志…</div>
  } else if (filteredEntries.length === 0) {
    content = (
      <div className="operation-log__empty">
        {entries.length === 0 && !normalizedQuery && category === 'all' && componentId === 'all'
          ? emptyMessage
          : '没有匹配的操作日志'}
      </div>
    )
  } else {
    content = (
      <div className="operation-log__content">
        <div className="operation-log__list" aria-label="日志列表">
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
        <div className="operation-log__warning" role="status">本地持久化不可用</div>
      ) : null}
      <div className="operation-log__toolbar">
        <label className="operation-log__search">
          <span className="operation-log__sr-only">搜索操作日志</span>
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="搜索操作日志"
            placeholder="搜索操作日志"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
        <select
          aria-label="日志分类"
          value={category}
          onChange={(event) => setCategory(event.currentTarget.value as OperationLogCategory | 'all')}
        >
          <option value="all">全部分类</option>
          {(Object.keys(categoryLabels) as OperationLogCategory[]).map((value) => (
            <option key={value} value={value}>{categoryLabels[value]}</option>
          ))}
        </select>
        <select
          aria-label="日志组件"
          value={componentId}
          onChange={(event) => setComponentId(event.currentTarget.value)}
        >
          <option value="all">全部组件</option>
          {components.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>
      {content}
    </div>
  )
}
