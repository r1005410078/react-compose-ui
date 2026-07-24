import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type {
  EditorCommand,
  EditorTransaction,
  JsonValue,
  TransactionRuntimeEvent,
} from '@compose-ui/core'
import type {
  CommandPanelProps,
  CommandPreset,
  CommandPresetField,
} from './types'

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

function initialDraft(preset: CommandPreset | undefined) {
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

function initialFormState(preset: CommandPreset | undefined): FormState {
  return {
    presetId: preset?.id ?? '',
    draft: initialDraft(preset),
    errors: {},
    formError: null,
  }
}

function fieldError(field: CommandPresetField, raw: DraftValue | undefined) {
  if (field.type === 'boolean') return null
  const text = typeof raw === 'string' ? raw : ''
  if (field.type === 'number') {
    if (text.trim().length === 0 && !field.required) return null
    const value = Number(text)
    return Number.isFinite(value) && text.trim().length > 0
      ? null
      : `${field.label}必须是有限数字`
  }
  if (field.type === 'select') {
    if (text.length === 0 && field.required) return `${field.label}为必填项`
    return field.options?.some((option) => option.value === text)
      ? null
      : `${field.label}不属于有效候选`
  }
  if (field.type === 'json') {
    if (text.trim().length === 0 && !field.required) return null
    try {
      JSON.parse(text)
      return null
    }
    catch {
      return `${field.label}必须是有效 JSON`
    }
  }
  return field.required && text.trim().length === 0
    ? `${field.label}为必填项`
    : null
}

function parsedValue(field: CommandPresetField, raw: DraftValue | undefined): JsonValue {
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

function EventItem({ event }: { event: VisibleEvent }) {
  const [expanded, setExpanded] = useState(false)
  const status = event.type === 'committed'
    ? '成功'
    : event.type === 'noop' ? '无变化' : '已拒绝'
  const label = event.command.meta?.label ?? event.command.type

  return (
    <li className={`command-panel__event is-${event.type}`}>
      <div className="command-panel__event-summary">
        <span className="command-panel__status">{status}</span>
        <span className="command-panel__label">{label}</span>
        <span className="command-panel__source">
          {event.command.meta?.source ?? '未知来源'}
        </span>
        <code>{event.command.id}</code>
        {event.type === 'committed' ? <code>{event.transaction.id}</code> : null}
        {event.type === 'committed' && event.coalesced
          ? <span className="command-panel__coalesced">已合并</span>
          : null}
        {event.type === 'committed' ? (
          <button
            aria-expanded={expanded}
            aria-label={`查看 ${label} 详情`}
            type="button"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? '收起' : '详情'}
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
            <div><dt>来源</dt><dd>{event.transaction.source ?? '未知'}</dd></div>
            <div>
              <dt>目标</dt>
              <dd>{event.transaction.targetIds.length > 0
                ? event.transaction.targetIds.map((id) => <span key={id}>{id}</span>)
                : '无'}</dd>
            </div>
            <div><dt>提交时间</dt><dd>{event.transaction.committedAt}</dd></div>
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
  onChange,
}: {
  field: CommandPresetField
  value: DraftValue | undefined
  error?: string
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
        {!field.required ? <option value="">未选择</option> : null}
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
export function CommandPanel({
  runtime,
  presets = [],
  eventLimit = 100,
  className,
  ...props
}: CommandPanelProps) {
  const normalizedLimit = Number.isInteger(eventLimit) && eventLimit > 0 ? eventLimit : 100
  const [eventState, setEventState] = useState<{
    runtime: CommandPanelProps['runtime']
    events: readonly VisibleEvent[]
  }>(() => ({ runtime, events: [] }))
  const events = eventState.runtime === runtime ? eventState.events : []
  const [presetId, setPresetId] = useState(presets[0]?.id ?? '')
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
      const error = fieldError(field, formState.draft[field.name])
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
        formError: error instanceof Error ? error.message : '命令工厂执行失败',
      })
      return
    }
    setStoredFormState({ ...formState, errors: {}, formError: null })
    runtime.dispatch(command)
  }

  const rootClassName = ['command-panel', className].filter(Boolean).join(' ')
  return (
    <div
      {...props}
      aria-label={props['aria-label'] ?? '命令调试台'}
      className={rootClassName}
      role="region"
    >
      {presets.length > 0 ? (
        <form className="command-panel__form" onSubmit={submit}>
          {presets.length > 1 ? (
            <label>
              命令预设
              <select
                aria-label="命令预设"
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
          <button type="submit">执行{activePreset?.label ?? '命令'}</button>
        </form>
      ) : null}
      {events.length === 0 ? (
        <p className="command-panel__empty">暂无命令事件</p>
      ) : (
        <ol className="command-panel__events">
          {events.map((event, index) => (
            <EventItem
              event={event}
              key={`${event.command.id}:${event.type}:${index}`}
            />
          ))}
        </ol>
      )}
    </div>
  )
}
