import { useState } from 'react'
import type { ComposeEdges } from '@compose-ui/core'

interface InspectorNumberDraftInputProps {
  readonly label: string
  readonly min?: number
  readonly onCommit: (value: number) => void
  readonly prefix?: string
  readonly readOnly: boolean
  readonly value: number
}

/** Materials Inspector 内部复用的提交式数值输入。 @internal */
export function InspectorNumberDraftInput({
  label,
  min,
  onCommit,
  prefix,
  readOnly,
  value,
}: InspectorNumberDraftInputProps) {
  const [draft, setDraft] = useState({ external: value, text: String(value), dirty: false })
  const current = Object.is(draft.external, value)
    ? draft
    : { external: value, text: String(value), dirty: false }
  const reset = () => setDraft({ external: value, text: String(value), dirty: false })
  const submit = () => {
    if (!current.dirty) return
    const text = current.text.trim()
    const candidate = Number(text)
    if (text === '' || !Number.isFinite(candidate) || (min !== undefined && candidate < min)) {
      reset()
      return
    }
    onCommit(candidate)
    setDraft({ external: candidate, text: String(candidate), dirty: false })
  }
  return (
    <label className="layout-item-inspector__number">
      {prefix ? <span aria-hidden="true">{prefix}</span> : null}
      <input
        aria-label={label}
        disabled={readOnly}
        min={min}
        step="any"
        type="number"
        value={current.text}
        onBlur={submit}
        onChange={(event) => setDraft({ external: value, text: event.target.value, dirty: true })}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit()
          if (event.key === 'Escape') {
            event.preventDefault()
            reset()
          }
        }}
      />
    </label>
  )
}

interface InspectorEdgesEditorProps {
  readonly collapseLabel: string
  readonly expandLabel: string
  readonly label: string
  readonly min?: number
  readonly onCommit: (value: ComposeEdges) => void
  readonly readOnly: boolean
  readonly value: ComposeEdges
}

/** Materials 内部共享的单值/四边展开编辑器。 @internal */
export function InspectorEdgesEditor({
  collapseLabel,
  expandLabel,
  label,
  min,
  onCommit,
  readOnly,
  value,
}: InspectorEdgesEditorProps) {
  const linked = value.top === value.right
    && value.top === value.bottom
    && value.top === value.left
  const [expanded, setExpanded] = useState(!linked)
  const showEdges = expanded || !linked
  if (!showEdges) {
    return (
      <div className="layout-item-inspector__edges layout-item-inspector__edges--linked">
        <InspectorNumberDraftInput
          label={label}
          min={min}
          readOnly={readOnly}
          value={value.top}
          onCommit={(candidate) => onCommit({
            top: candidate,
            right: candidate,
            bottom: candidate,
            left: candidate,
          })}
        />
        <button
          aria-label={expandLabel}
          disabled={readOnly}
          type="button"
          onClick={() => setExpanded(true)}
        >
          <svg aria-hidden="true" viewBox="0 0 20 20">
            <path d="M8 4H4v4M12 4h4v4M16 12v4h-4M8 16H4v-4" />
          </svg>
        </button>
      </div>
    )
  }
  return (
    <div className="layout-item-inspector__edges layout-item-inspector__edges--expanded">
      {(['top', 'right', 'bottom', 'left'] as const).map((edge) => (
        <InspectorNumberDraftInput
          key={edge}
          label={`${label} ${edge}`}
          min={min}
          prefix={({ top: 'T', right: 'R', bottom: 'B', left: 'L' })[edge]}
          readOnly={readOnly}
          value={value[edge]}
          onCommit={(candidate) => onCommit({ ...value, [edge]: candidate })}
        />
      ))}
      <button
        aria-label={collapseLabel}
        disabled={readOnly}
        type="button"
        onClick={() => {
          onCommit({ top: value.top, right: value.top, bottom: value.top, left: value.top })
          setExpanded(false)
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 20 20">
          <path d="M8 4v4H4M12 4v4h4M16 12h-4v4M4 12h4v4" />
        </svg>
      </button>
    </div>
  )
}
