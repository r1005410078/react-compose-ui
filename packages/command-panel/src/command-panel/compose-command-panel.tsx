import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent, MouseEvent as ReactMouseEvent } from 'react'
import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import {
  ComposeConfirmDialog,
  ComposeContextMenu,
  ComposeContextMenuContent,
  ComposeContextMenuItem,
  ComposeContextMenuSeparator,
  useComposeContextMenu,
} from '@compose-ui/components'
import type { ComposeLocale } from '@compose-ui/ui-context'
import type {
  EditorCommand,
  EditorTransaction,
  JsonValue,
  TransactionRuntimeEvent,
} from '@compose-ui/core'
import type {
  ComposeCommandPanelProps,
  ComposeCommandPreset,
  ComposeCommandPresetField,
} from '../types'

const commandMessages = {
  'zh-CN': {
    region: '命令调试台',
    succeeded: '成功',
    noop: '无变化',
    rejected: '已拒绝',
    unknownSource: '未知来源',
    unknown: '未知',
    merged: '已合并',
    viewDetails: (label: string) => `查看 ${label} 详情`,
    collapse: '收起',
    details: '详情',
    source: '来源',
    targets: '目标',
    none: '无',
    committedAt: '提交时间',
    unselected: '未选择',
    preset: '命令预设',
    run: (label: string) => `执行${label}`,
    command: '命令',
    empty: '暂无命令事件',
    factoryFailed: '命令工厂执行失败',
    required: (label: string) => `${label}为必填项`,
    finite: (label: string) => `${label}必须是有限数字`,
    candidate: (label: string) => `${label}不属于有效候选`,
    json: (label: string) => `${label}必须是有效 JSON`,
  },
  'en-US': {
    region: 'Command debugger',
    succeeded: 'Succeeded',
    noop: 'No change',
    rejected: 'Rejected',
    unknownSource: 'Unknown source',
    unknown: 'Unknown',
    merged: 'Coalesced',
    viewDetails: (label: string) => `View ${label} details`,
    collapse: 'Collapse',
    details: 'Details',
    source: 'Source',
    targets: 'Targets',
    none: 'None',
    committedAt: 'Committed at',
    unselected: 'Not selected',
    preset: 'Command preset',
    run: (label: string) => `Run ${label}`,
    command: 'command',
    empty: 'No command events',
    factoryFailed: 'Command factory failed',
    required: (label: string) => `${label} is required`,
    finite: (label: string) => `${label} must be a finite number`,
    candidate: (label: string) => `${label} is not a valid option`,
    json: (label: string) => `${label} must be valid JSON`,
  },
} as const

type CommandMessages = (typeof commandMessages)[ComposeLocale]

function getCommandMessages(
  locale: ComposeLocale,
  formatMessage?: (
    id: string,
    fallback: string,
    variables?: Readonly<Record<string, string | number>>,
  ) => string,
): CommandMessages {
  const messages = commandMessages[locale]
  const format = formatMessage ?? ((_id: string, fallback: string) => fallback)
  const withLabel = (id: string, fallback: string, label: string) =>
    format(id, fallback, { label })
  return {
    region: format('commandPanel.region', messages.region),
    succeeded: format('commandPanel.succeeded', messages.succeeded),
    noop: format('commandPanel.noop', messages.noop),
    rejected: format('commandPanel.rejected', messages.rejected),
    unknownSource: format('commandPanel.unknownSource', messages.unknownSource),
    unknown: format('commandPanel.unknown', messages.unknown),
    merged: format('commandPanel.merged', messages.merged),
    viewDetails: (label: string) => withLabel(
      'commandPanel.viewDetails',
      messages.viewDetails(label),
      label,
    ),
    collapse: format('commandPanel.collapse', messages.collapse),
    details: format('commandPanel.details', messages.details),
    source: format('commandPanel.source', messages.source),
    targets: format('commandPanel.targets', messages.targets),
    none: format('commandPanel.none', messages.none),
    committedAt: format('commandPanel.committedAt', messages.committedAt),
    unselected: format('commandPanel.unselected', messages.unselected),
    preset: format('commandPanel.preset', messages.preset),
    run: (label: string) => withLabel('commandPanel.run', messages.run(label), label),
    command: format('commandPanel.command', messages.command),
    empty: format('commandPanel.empty', messages.empty),
    factoryFailed: format('commandPanel.factoryFailed', messages.factoryFailed),
    required: (label: string) => withLabel(
      'commandPanel.required',
      messages.required(label),
      label,
    ),
    finite: (label: string) => withLabel(
      'commandPanel.finite',
      messages.finite(label),
      label,
    ),
    candidate: (label: string) => withLabel(
      'commandPanel.candidate',
      messages.candidate(label),
      label,
    ),
    json: (label: string) => withLabel('commandPanel.json', messages.json(label), label),
  } as CommandMessages
}

type VisibleEvent = Extract<
  TransactionRuntimeEvent,
  { type: 'committed' | 'noop' | 'rejected' }
>
type DraftValue = string | boolean
type FormState = {
  presetId: string
  draft: Record<string, DraftValue>
  errors: Record<string, string>
  formError: string | null
}

function isVisibleEvent(event: TransactionRuntimeEvent): event is VisibleEvent {
  return event.type === 'committed' || event.type === 'noop' || event.type === 'rejected'
}

function initialDraft(preset: ComposeCommandPreset | undefined) {
  const draft: Record<string, DraftValue> = {}
  for (const field of preset?.fields ?? []) {
    if (field.type === 'boolean') draft[field.name] = field.defaultValue === true
    else if (field.type === 'select') {
      draft[field.name] = typeof field.defaultValue === 'string'
        ? field.defaultValue
        : field.options?.[0]?.value ?? ''
    }
    else if (field.type === 'json') {
      draft[field.name] = field.defaultValue === undefined
        ? ''
        : JSON.stringify(field.defaultValue)
    }
    else {
      draft[field.name] = typeof field.defaultValue === 'string'
        || typeof field.defaultValue === 'number'
        ? String(field.defaultValue)
        : ''
    }
  }
  return draft
}

function initialFormState(preset: ComposeCommandPreset | undefined): FormState {
  return {
    presetId: preset?.id ?? '',
    draft: initialDraft(preset),
    errors: {},
    formError: null,
  }
}

function fieldError(
  field: ComposeCommandPresetField,
  raw: DraftValue | undefined,
  t: CommandMessages,
) {
  if (field.type === 'boolean') return null
  const text = typeof raw === 'string' ? raw : ''
  if (field.type === 'number') {
    if (text.trim().length === 0 && !field.required) return null
    const value = Number(text)
    return Number.isFinite(value) && text.trim().length > 0
      ? null
      : t.finite(field.label)
  }
  if (field.type === 'select') {
    if (text.length === 0 && field.required) return t.required(field.label)
    return field.options?.some((option) => option.value === text)
      ? null
      : t.candidate(field.label)
  }
  if (field.type === 'json') {
    if (text.trim().length === 0 && !field.required) return null
    try {
      JSON.parse(text)
      return null
    }
    catch {
      return t.json(field.label)
    }
  }
  return field.required && text.trim().length === 0
    ? t.required(field.label)
    : null
}

function parsedValue(field: ComposeCommandPresetField, raw: DraftValue | undefined): JsonValue {
  if (field.type === 'boolean') return raw === true
  const text = typeof raw === 'string' ? raw : ''
  if (field.type === 'number') return Number(text)
  if (field.type === 'json') return text.trim().length === 0 ? null : JSON.parse(text)
  return text
}

function patchSummary(transaction: EditorTransaction) {
  return transaction.forward.map((patch) => (
    `${patch.op} ${JSON.stringify(patch.path).slice(0, 512)}`
  ))
}

function EventItem({ event, t, expanded, onExpandedChange, onContextMenu }: { event: VisibleEvent; t: CommandMessages; expanded: boolean; onExpandedChange(expanded: boolean): void; onContextMenu?: (event: ReactMouseEvent) => void }) {
  const status = event.type === 'committed'
    ? t.succeeded
    : event.type === 'noop' ? t.noop : t.rejected
  const label = event.command.meta?.label ?? event.command.type

  return (
    <li className={`command-panel__event is-${event.type}`} onContextMenu={onContextMenu}>
      <div className="command-panel__event-summary">
        <span className="command-panel__status">{status}</span>
        <span className="command-panel__label">{label}</span>
        <span className="command-panel__source">
          {event.command.meta?.source ?? t.unknownSource}
        </span>
        <code>{event.command.id}</code>
        {event.type === 'committed' ? <code>{event.transaction.id}</code> : null}
        {event.type === 'committed' && event.coalesced
          ? <span className="command-panel__coalesced">{t.merged}</span>
          : null}
        {event.type === 'committed' ? (
          <button
            aria-expanded={expanded}
            aria-label={t.viewDetails(label)}
            type="button"
            onClick={() => onExpandedChange(!expanded)}
          >
            {expanded ? t.collapse : t.details}
          </button>
        ) : null}
      </div>
      {event.type === 'rejected' ? (
        <ul className="command-panel__issues">
          {event.issues.map((item, index) => (
            <li key={`${item.code}:${index}`}>{item.message}</li>
          ))}
        </ul>
      ) : null}
      {event.type === 'committed' && expanded ? (
        <div className="command-panel__details">
          <dl>
            <div><dt>{t.source}</dt><dd>{event.transaction.source ?? t.unknown}</dd></div>
            <div>
              <dt>{t.targets}</dt>
              <dd>{event.transaction.targetIds.length > 0
                ? event.transaction.targetIds.map((id) => <span key={id}>{id}</span>)
                : t.none}</dd>
            </div>
            <div><dt>{t.committedAt}</dt><dd>{event.transaction.committedAt}</dd></div>
          </dl>
          <ol aria-label="Forward patches">
            {patchSummary(event.transaction).map((summary, index) => (
              <li key={`${summary}:${index}`}><code>{summary}</code></li>
            ))}
          </ol>
          <ol aria-label="Inverse patches">
            {event.transaction.inverse.map((patch) => (
              `${patch.op} ${JSON.stringify(patch.path).slice(0, 512)}`
            )).map((summary, index) => (
              <li key={`${summary}:${index}`}><code>{summary}</code></li>
            ))}
          </ol>
        </div>
      ) : null}
    </li>
  )
}

function FieldEditor({
  field,
  value,
  error,
  t,
  onChange,
}: {
  field: ComposeCommandPresetField
  value: DraftValue | undefined
  error?: string
  t: CommandMessages
  onChange(value: DraftValue): void
}) {
  const id = `command-field-${field.name}`
  const describedBy = error ? `${id}-error` : undefined
  let editor
  if (field.type === 'boolean') {
    editor = (
      <input
        aria-describedby={describedBy}
        checked={value === true}
        id={id}
        type="checkbox"
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    )
  }
  else if (field.type === 'select') {
    editor = (
      <select
        aria-describedby={describedBy}
        id={id}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {!field.required ? <option value="">{t.unselected}</option> : null}
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    )
  }
  else if (field.type === 'json') {
    editor = (
      <textarea
        aria-describedby={describedBy}
        id={id}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    )
  }
  else {
    editor = (
      <input
        aria-describedby={describedBy}
        id={id}
        type={field.type === 'number' ? 'number' : 'text'}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    )
  }

  return (
    <div className="command-panel__field">
      <label htmlFor={id}>{field.label}</label>
      {editor}
      {error ? <span id={`${id}-error`} role="alert">{error}</span> : null}
    </div>
  )
}

/**
 * 显示 TransactionRuntime 命令事件并派发结构化预设。
 *
 * @param props - 外部 runtime、预设、事件容量和标准 div 属性。
 * @returns 当前会话的命令调试台。
 * @public
 */
export function ComposeCommandPanel({
  runtime,
  presets = [],
  eventLimit = 100,
  className,
  idFactory = () => globalThis.crypto?.randomUUID?.() ?? `command-replay-${Date.now()}`,
  style,
  ...props
}: ComposeCommandPanelProps) {
  const i18n = useComposeI18nContext()
  const theme = useComposeThemeContext()
  const resolvedLocale = i18n?.locale ?? 'zh-CN'
  const t = getCommandMessages(resolvedLocale, i18n?.formatMessage)
  const normalizedLimit = Number.isInteger(eventLimit) && eventLimit > 0 ? eventLimit : 100
  const [eventState, setEventState] = useState<{
    runtime: ComposeCommandPanelProps['runtime']
    events: readonly VisibleEvent[]
  }>(() => ({ runtime, events: [] }))
  const events = eventState.runtime === runtime ? eventState.events : []
  const [presetId, setPresetId] = useState(presets[0]?.id ?? '')
  const [confirmAction, setConfirmAction] = useState<'clear' | VisibleEvent | null>(null)
  const [clipboardStatus, setClipboardStatus] = useState('')
  const [expandedCommandIds, setExpandedCommandIds] = useState<readonly string[]>([])
  const contextMenu = useComposeContextMenu<VisibleEvent | null>()
  const activePreset = useMemo(
    () => presets.find((preset) => preset.id === presetId) ?? presets[0],
    [presetId, presets],
  )
  const [storedFormState, setStoredFormState] = useState<FormState>(
    () => initialFormState(activePreset),
  )
  const formState = storedFormState.presetId === activePreset?.id
    ? storedFormState
    : initialFormState(activePreset)

  useEffect(() => {
    return runtime.subscribeEvents((event) => {
      if (!isVisibleEvent(event)) return
      setEventState((current) => {
        const currentEvents = current.runtime === runtime ? current.events : []
        const next = [...currentEvents]
        if (event.type === 'committed' && event.coalesced) {
          const index = next.findIndex((item) => (
            item.type === 'committed' && item.transaction.id === event.transaction.id
          ))
          if (index >= 0) next[index] = event
          else next.push(event)
        }
        else next.push(event)
        return { runtime, events: next.slice(-normalizedLimit) }
      })
    })
  }, [normalizedLimit, runtime])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!activePreset) return
    const nextErrors: Record<string, string> = {}
    const values: Record<string, JsonValue> = {}
    for (const field of activePreset.fields) {
      const error = fieldError(field, formState.draft[field.name], t)
      if (error) nextErrors[field.name] = error
      else values[field.name] = parsedValue(field, formState.draft[field.name])
    }
    if (Object.keys(nextErrors).length > 0) {
      setStoredFormState({ ...formState, errors: nextErrors, formError: null })
      return
    }

    let command: EditorCommand
    try {
      const created = activePreset.createCommand(values)
      command = {
        ...created,
        meta: {
          ...created.meta,
          source: created.meta?.source ?? 'command-panel',
        },
      }
    }
    catch (error) {
      setStoredFormState({
        ...formState,
        errors: {},
        formError: error instanceof Error ? error.message : t.factoryFailed,
      })
      return
    }
    setStoredFormState({ ...formState, errors: {}, formError: null })
    runtime.dispatch(command)
  }

  const rootClassName = ['command-panel', className].filter(Boolean).join(' ')
  const canCopy = typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.writeText)
  const copy = async (value: string, label: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(value)
      setClipboardStatus(`已复制${label}`)
    } catch { setClipboardStatus(`复制${label}失败`) }
  }
  const replay = (event: VisibleEvent) => {
    runtime.dispatch({
      ...event.command,
      id: idFactory(),
      meta: { ...event.command.meta, source: 'command-panel-replay', mergeKey: undefined },
    })
    setConfirmAction(null)
  }
  return (
    <div
      {...props}
      aria-label={props['aria-label'] ?? t.region}
      className={rootClassName}
      data-compose-theme={theme?.resolvedTheme}
      lang={resolvedLocale}
      role="region"
      style={{
        ...(theme ? createComposeThemeStyle(theme.tokens) : {}),
        ...style,
      } as CSSProperties}
      onContextMenu={(event) => {
        props.onContextMenu?.(event)
        if (event.defaultPrevented || (event.target as Element).closest('input, select, textarea, [contenteditable="true"]')) return
        contextMenu.openAt(event, null)
      }}
    >
      {presets.length > 0 ? (
        <form className="command-panel__form" onSubmit={submit}>
          {presets.length > 1 ? (
            <label>
              {t.preset}
              <select
                aria-label={t.preset}
                value={activePreset?.id ?? ''}
                onChange={(event) => {
                  const nextId = event.currentTarget.value
                  const nextPreset = presets.find((preset) => preset.id === nextId)
                  setPresetId(nextId)
                  setStoredFormState(initialFormState(nextPreset))
                }}
              >
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </select>
            </label>
          ) : null}
          {activePreset?.fields.map((field) => (
            <FieldEditor
              error={formState.errors[field.name]}
              field={field}
              key={field.name}
              t={t}
              value={formState.draft[field.name]}
              onChange={(value) => setStoredFormState({
                ...formState,
                draft: { ...formState.draft, [field.name]: value },
                errors: {
                  ...formState.errors,
                  [field.name]: '',
                },
              })}
            />
          ))}
          {formState.formError ? <p role="alert">{formState.formError}</p> : null}
          <button type="submit">{t.run(activePreset?.label ?? t.command)}</button>
        </form>
      ) : null}
      {events.length === 0 ? (
        <p className="command-panel__empty">{t.empty}</p>
      ) : (
        <ol className="command-panel__events">
          {events.map((event, index) => (
            <EventItem
              expanded={expandedCommandIds.includes(event.command.id)}
              event={event}
              key={`${event.command.id}:${event.type}:${index}`}
              t={t}
              onExpandedChange={(expanded) => setExpandedCommandIds((ids) => expanded
                ? [...new Set([...ids, event.command.id])]
                : ids.filter((id) => id !== event.command.id))}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                contextMenu.openAt(event, events[index]!)
              }}
            />
          ))}
        </ol>
      )}
      <p aria-live="polite" className="command-panel__empty">{clipboardStatus}</p>
      <ComposeContextMenu {...contextMenu.rootProps}>
        <ComposeContextMenuContent aria-label={t.region}>
          {contextMenu.payload ? <>
            {contextMenu.payload.type === 'committed' ? <ComposeContextMenuItem onClick={() => setExpandedCommandIds((ids) => ids.includes(contextMenu.payload!.command.id)
              ? ids.filter((id) => id !== contextMenu.payload!.command.id)
              : [...ids, contextMenu.payload!.command.id])}>查看详情</ComposeContextMenuItem> : null}
            <ComposeContextMenuItem disabled={!canCopy} onClick={() => void copy(contextMenu.payload!.command.id, '命令 ID')}>复制命令 ID</ComposeContextMenuItem>
            <ComposeContextMenuItem disabled={!canCopy} onClick={() => void copy(JSON.stringify(contextMenu.payload!.command, null, 2), '命令 JSON')}>复制命令 JSON</ComposeContextMenuItem>
            {contextMenu.payload.type === 'committed' ? <ComposeContextMenuItem disabled={!canCopy} onClick={() => void copy((contextMenu.payload as Extract<VisibleEvent, { type: 'committed' }>).transaction.id, '事务 ID')}>复制事务 ID</ComposeContextMenuItem> : null}
            <ComposeContextMenuSeparator />
            <ComposeContextMenuItem onClick={() => setConfirmAction(contextMenu.payload!)}>重放命令</ComposeContextMenuItem>
            <ComposeContextMenuSeparator />
          </> : null}
          <ComposeContextMenuItem disabled={events.length === 0} variant="destructive" onClick={() => setConfirmAction('clear')}>清空会话事件</ComposeContextMenuItem>
        </ComposeContextMenuContent>
      </ComposeContextMenu>
      <ComposeConfirmDialog
        cancelLabel="取消"
        confirmLabel={confirmAction === 'clear' ? '清空事件' : '重放命令'}
        description={confirmAction === 'clear' ? '仅清空当前调试台可见事件，不影响文档或事务历史。' : '将对当前文档重新派发此命令，命令可能产生修改、无变化或被拒绝。'}
        destructive={confirmAction === 'clear'}
        open={confirmAction !== null}
        title={confirmAction === 'clear' ? '确认清空会话事件' : '确认重放命令'}
        onConfirm={() => {
          if (confirmAction === 'clear') { setEventState({ runtime, events: [] }); setConfirmAction(null) }
          else if (confirmAction) replay(confirmAction)
        }}
        onOpenChange={(open) => { if (!open) setConfirmAction(null) }}
      />
    </div>
  )
}
