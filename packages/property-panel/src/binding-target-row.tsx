import { useMemo, useState } from 'react'
import type { PropertyPanelVariable } from './property-panel/compose-property-panel'
import { usePropertyPanelMessages } from './property-panel-i18n'

/** 无字面 editor 的独立受控绑定目标。 @public */
export interface ComposePropertyPanelBindingTargetRowProps {
  readonly label: string
  readonly kind: 'value' | 'method'
  readonly variables: readonly PropertyPanelVariable[]
  /** 当前绑定的变量 ID；null 表示未绑定。 */
  readonly value: string | null
  readonly onChange: (variableId: string | null) => void
  readonly readOnly?: boolean
  /** 已绑定成员缺失或不兼容时的可访问错误。 */
  readonly error?: string
}

/**
 * 渲染没有 JSON 字面输入的 binding-only target row。
 *
 * @remarks
 * 组件只发出绑定 ID 变化，不读取或写入属性 Schema value，适合 event-handler method Prop。
 * @public
 */
export function ComposePropertyPanelBindingTargetRow({
  label,
  kind,
  variables,
  value,
  onChange,
  readOnly = false,
  error,
}: ComposePropertyPanelBindingTargetRowProps) {
  const messages = usePropertyPanelMessages()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const current = variables.find((variable) => variable.id === value)
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const candidates = useMemo(() => variables.filter((variable) => (
    (variable.kind ?? 'value') === kind
    && (!normalizedQuery || [variable.label, variable.id, variable.description]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery))
  )), [kind, normalizedQuery, variables])

  return (
    <div
      aria-label={label}
      className="property-panel__binding-only-row"
      data-binding-state={error ? 'invalid' : value ? 'bound' : 'literal'}
      role="group"
    >
      <span>{label}</span>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-invalid={error ? 'true' : undefined}
        disabled={readOnly}
        type="button"
        onClick={() => { setOpen((currentOpen) => !currentOpen) }}
      >
        {current?.label ?? value ?? messages.bind(label)}
      </button>
      {error ? <span role="alert">{error}</span> : null}
      {open ? (
        <div aria-label={messages.bind(label)} className="property-panel__binding-picker" role="dialog">
          <header>
            <strong>{messages.bind(label)}</strong>
            <button
              aria-label={messages.closeVariablePicker}
              type="button"
              onClick={() => { setOpen(false) }}
            >×</button>
          </header>
          <input
            aria-label={messages.searchVariables}
            autoFocus
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value) }}
          />
          <div className="property-panel__binding-options">
            {candidates.map((variable) => (
              <button
                key={variable.id}
                type="button"
                onClick={() => {
                  onChange(variable.id)
                  setOpen(false)
                }}
              >
                <span>{variable.label}</span>
              </button>
            ))}
            {candidates.length === 0 ? <p>{messages.noVariables}</p> : null}
          </div>
          {value ? (
            <footer>
              <button
                disabled={readOnly}
                type="button"
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                }}
              >
                {messages.unbind}
              </button>
            </footer>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
