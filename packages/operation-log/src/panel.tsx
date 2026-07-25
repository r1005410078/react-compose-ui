import { useMemo, useState } from 'react'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
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

function getOperationLogMessages(
  locale: 'zh-CN' | 'en-US',
  formatMessage?: (
    id: string,
    fallback: string,
    variables?: Readonly<Record<string, string | number>>,
  ) => string,
) {
  const zh = locale === 'zh-CN'
  const format = (id: string, fallback: string, variables?: Record<string, string | number>) =>
    formatMessage?.(`operationLog.${id}`, fallback, variables) ?? fallback
  const categoryFallback: Record<OperationLogCategory, string> = zh
    ? { component: '组件', scene: '场景', property: '属性', binding: '绑定' }
    : { component: 'Component', scene: 'Scene', property: 'Property', binding: 'Binding' }
  return {
    region: format('region', zh ? '操作日志' : 'Operation log'),
    empty: format('empty', zh ? '暂无操作记录' : 'No operations yet'),
    noMatches: format('noMatches', zh ? '没有匹配的操作' : 'No matching operations'),
    loading: format('loading', zh ? '正在加载操作日志…' : 'Loading operation log…'),
    degraded: format(
      'degraded',
      zh ? '本地持久化不可用' : 'Local persistence unavailable',
    ),
    search: format('search', zh ? '搜索操作' : 'Search operations'),
    category: format('category', zh ? '操作分类' : 'Operation category'),
    component: format('component', zh ? '操作组件' : 'Operation component'),
    allCategories: format('allCategories', zh ? '全部分类' : 'All categories'),
    allComponents: format('allComponents', zh ? '全部组件' : 'All components'),
    list: format('list', zh ? '操作列表' : 'Operation list'),
    details: format('details', zh ? '操作详情' : 'Operation details'),
    closeDetails: format('closeDetails', zh ? '关闭操作详情' : 'Close operation details'),
    action: format('action', zh ? '动作' : 'Action'),
    categoryLabel: format('categoryLabel', zh ? '分类' : 'Category'),
    merged: format('merged', zh ? '合并' : 'Merged'),
    times: (count: number) => format(
      'times',
      zh ? `${count} 次` : `${count} times`,
      { count },
    ),
    source: format('source', zh ? '来源' : 'Source'),
    actor: format('actor', zh ? '操作者' : 'Actor'),
    targets: format('targets', zh ? '目标' : 'Targets'),
    unknownTarget: format('unknownTarget', zh ? '未知目标' : 'Unknown target'),
    before: format('before', zh ? '之前' : 'Before'),
    after: format('after', zh ? '之后' : 'After'),
    metadata: format('metadata', zh ? '元数据' : 'Metadata'),
    truncated: format('truncated', zh ? '已截断' : 'Truncated'),
    unavailable: format('unavailable', zh ? '不可用' : 'Unavailable'),
    categories: Object.fromEntries(
      (Object.keys(categoryFallback) as OperationLogCategory[]).map((category) => [
        category,
        format(`category.${category}`, categoryFallback[category]),
      ]),
    ) as Record<OperationLogCategory, string>,
  }
}

type OperationLogMessages = ReturnType<typeof getOperationLogMessages>

function formatTime(timestamp: number, locale: 'zh-CN' | 'en-US') {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp)
}

function Snapshot({
  label,
  messages,
  snapshot,
}: {
  label: string
  messages: OperationLogMessages
  snapshot?: OperationLogSnapshot
}) {
  if (!snapshot) return null
  const content = snapshot.value === undefined
    ? snapshot.preview
    : JSON.stringify(snapshot.value, null, 2)
  return (
    <section className="operation-log__snapshot">
      <div className="operation-log__detail-label">
        {label}
        {snapshot.status === 'truncated'
          ? <span>{messages.truncated} · {snapshot.byteLength} B</span>
          : null}
        {snapshot.status === 'unavailable' ? <span>{messages.unavailable}</span> : null}
      </div>
      <pre>{content}</pre>
    </section>
  )
}

function Detail({
  entry,
  locale,
  messages,
  onClose,
}: {
  entry: OperationLogEntry
  locale: 'zh-CN' | 'en-US'
  messages: OperationLogMessages
  onClose: () => void
}) {
  return (
    <section className="operation-log__detail" aria-label={messages.details}>
      <header>
        <strong>{entry.summary}</strong>
        <div>
          <span>{formatTime(entry.updatedAt, locale)}</span>
          <button type="button" aria-label={messages.closeDetails} onClick={onClose}>×</button>
        </div>
      </header>
      <dl>
        <div><dt>{messages.action}</dt><dd>{entry.action}</dd></div>
        <div><dt>{messages.categoryLabel}</dt><dd>{messages.categories[entry.category]}</dd></div>
        {entry.count > 1
          ? <div><dt>{messages.merged}</dt><dd>{messages.times(entry.count)}</dd></div>
          : null}
        {entry.source ? <div><dt>{messages.source}</dt><dd>{entry.source}</dd></div> : null}
        {entry.actor
          ? <div><dt>{messages.actor}</dt><dd>{entry.actor.label ?? entry.actor.id}</dd></div>
          : null}
      </dl>
      {entry.targets.length > 0 ? (
        <section className="operation-log__targets">
          <div className="operation-log__detail-label">{messages.targets}</div>
          {entry.targets.map((target, index) => (
            <div key={`${target.componentId ?? 'target'}-${index}`}>
              <span>{target.componentLabel ?? target.componentId ?? messages.unknownTarget}</span>
              {target.path?.length ? <code>{target.path.join('.')}</code> : null}
            </div>
          ))}
        </section>
      ) : null}
      <Snapshot label={messages.before} messages={messages} snapshot={entry.before} />
      <Snapshot label={messages.after} messages={messages} snapshot={entry.after} />
      <Snapshot label={messages.metadata} messages={messages} snapshot={entry.metadata} />
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
  emptyMessage,
  'aria-label': ariaLabel,
  style,
  ...props
}: OperationLogPanelProps) {
  const i18n = useComposeI18nContext()
  const theme = useComposeThemeContext()
  const locale = i18n?.locale ?? 'en-US'
  const messages = getOperationLogMessages(locale, i18n?.formatMessage)
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
    content = <div className="operation-log__empty">{messages.loading}</div>
  } else if (filteredEntries.length === 0) {
    content = (
      <div className="operation-log__empty">
        {entries.length === 0 && !normalizedQuery && category === 'all' && componentId === 'all'
          ? emptyMessage ?? messages.empty
          : messages.noMatches}
      </div>
    )
  } else {
    content = (
      <div className="operation-log__content">
        <div className="operation-log__list" aria-label={messages.list}>
          {filteredEntries.map((entry) => (
            <button
              type="button"
              className="operation-log__entry"
              aria-current={selectedEntry?.id === entry.id ? 'true' : undefined}
              key={entry.id}
              onClick={() => setSelectedId(entry.id)}
            >
              <span className={`operation-log__category operation-log__category--${entry.category}`}>
                {messages.categories[entry.category]}
              </span>
              <span className="operation-log__entry-copy">
                <strong>{entry.summary}</strong>
                <small>{entry.targets[0]?.componentLabel ?? entry.action}</small>
              </span>
              {entry.count > 1 ? <span className="operation-log__count">×{entry.count}</span> : null}
              <time>{formatTime(entry.updatedAt, locale)}</time>
            </button>
          ))}
        </div>
        {selectedEntry ? (
          <Detail
            entry={selectedEntry}
            locale={locale}
            messages={messages}
            onClose={() => setSelectedId(undefined)}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div
      {...props}
      className={['operation-log', className].filter(Boolean).join(' ')}
      data-compose-ui="operation-log"
      data-compose-theme={theme?.resolvedTheme}
      lang={locale}
      role="region"
      aria-label={ariaLabel ?? messages.region}
      style={{
        ...(theme ? createComposeThemeStyle(theme.tokens) : {}),
        ...style,
      } as CSSProperties}
    >
      {status === 'degraded' ? (
        <div className="operation-log__warning" role="status">{messages.degraded}</div>
      ) : null}
      <div className="operation-log__toolbar">
        <label className="operation-log__search">
          <span className="operation-log__sr-only">{messages.search}</span>
          <span aria-hidden="true">⌕</span>
          <input
            aria-label={messages.search}
            placeholder={messages.search}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
        <select
          aria-label={messages.category}
          value={category}
          onChange={(event) => setCategory(event.currentTarget.value as OperationLogCategory | 'all')}
        >
          <option value="all">{messages.allCategories}</option>
          {(Object.keys(messages.categories) as OperationLogCategory[]).map((value) => (
            <option key={value} value={value}>{messages.categories[value]}</option>
          ))}
        </select>
        <select
          aria-label={messages.component}
          value={componentId}
          onChange={(event) => setComponentId(event.currentTarget.value)}
        >
          <option value="all">{messages.allComponents}</option>
          {components.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>
      {content}
    </div>
  )
}
