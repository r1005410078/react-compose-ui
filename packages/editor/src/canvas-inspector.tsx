import { useMemo, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import type {
  CommandDispatchResult,
  ComposeDocument,
  ComposeOutputSettings,
  EditorCommand,
} from '@compose-ui/core'
import { getEditorMessages } from './editor-i18n'

type CanvasInspectorProps = {
  readonly document: ComposeDocument
  readonly dispatch: (command: EditorCommand) => CommandDispatchResult
  readonly idFactory: () => string
}

const OUTPUT_PRESETS = [
  { value: '1280x720', width: 1280, height: 720, label: '1280 × 720 (HD)' },
  { value: '1366x768', width: 1366, height: 768, label: '1366 × 768' },
  { value: '1440x900', width: 1440, height: 900, label: '1440 × 900' },
  { value: '1920x1080', width: 1920, height: 1080, label: '1920 × 1080 (Full HD)' },
  { value: '2560x1440', width: 2560, height: 1440, label: '2560 × 1440 (QHD)' },
  { value: '3840x2160', width: 3840, height: 2160, label: '3840 × 2160 (4K UHD)' },
] as const

type Draft = {
  readonly width: string
  readonly height: string
  readonly backgroundColor: string
}

function draftFromOutput(output: ComposeOutputSettings): Draft {
  return {
    width: String(output.width),
    height: String(output.height),
    backgroundColor: output.backgroundColor,
  }
}

/** Editor 内部的隐式 Canvas 输出属性编辑器。 */
export function CanvasInspector({
  document,
  dispatch,
  idFactory,
}: CanvasInspectorProps) {
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(
    i18n?.locale ?? 'zh-CN',
    i18n?.formatMessage,
  ).canvasInspector
  const [draft, setDraft] = useState(() => draftFromOutput(document.output))
  const [error, setError] = useState('')

  const selectedPreset = useMemo(
    () => OUTPUT_PRESETS.find((preset) =>
      preset.width === document.output.width
      && preset.height === document.output.height)?.value ?? 'custom',
    [document.output.height, document.output.width],
  )

  const commit = (nextDraft: Draft) => {
    const width = Number(nextDraft.width)
    const height = Number(nextDraft.height)
    if (
      !Number.isFinite(width)
      || width <= 0
      || !Number.isFinite(height)
      || height <= 0
    ) {
      setError(messages.invalidSize)
      return
    }
    const backgroundColor = nextDraft.backgroundColor.trim()
    if (backgroundColor.length === 0) {
      setError(messages.invalidBackground)
      return
    }
    const result = dispatch({
      id: idFactory(),
      type: 'output.configure',
      payload: { width, height, backgroundColor },
      meta: {
        label: messages.configureTransaction,
        source: 'inspector',
      },
    })
    if (result.status === 'rejected') {
      setError(result.issues[0]?.message ?? messages.rejected)
      return
    }
    setError('')
  }

  const update = (field: keyof Draft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  const restoreField = (field: keyof Draft) => {
    setDraft((current) => ({
      ...current,
      [field]: draftFromOutput(document.output)[field],
    }))
    setError('')
  }

  const fieldKeyDown = (
    field: keyof Draft,
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit(draft)
    }
    else if (event.key === 'Escape') {
      event.preventDefault()
      restoreField(field)
    }
  }

  return (
    <section
      aria-label={messages.label}
      className="compose-editor__canvas-inspector"
      role="region"
    >
      <h2>{messages.title}</h2>
      <label>
        {messages.preset}
        <select
          aria-label={messages.preset}
          value={selectedPreset}
          onChange={(event) => {
            const preset = OUTPUT_PRESETS.find(
              (candidate) => candidate.value === event.target.value,
            )
            if (!preset) return
            const next = {
              ...draft,
              width: String(preset.width),
              height: String(preset.height),
            }
            setDraft(next)
            commit(next)
          }}
        >
          <option value="custom">{messages.custom}</option>
          {OUTPUT_PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>{preset.label}</option>
          ))}
        </select>
      </label>
      <div className="compose-editor__canvas-inspector-grid">
        <label>
          {messages.width}
          <input
            aria-label={messages.width}
            inputMode="decimal"
            type="number"
            value={draft.width}
            onBlur={() => commit(draft)}
            onChange={(event) => update('width', event.target.value)}
            onKeyDown={(event) => fieldKeyDown('width', event)}
          />
        </label>
        <label>
          {messages.height}
          <input
            aria-label={messages.height}
            inputMode="decimal"
            type="number"
            value={draft.height}
            onBlur={() => commit(draft)}
            onChange={(event) => update('height', event.target.value)}
            onKeyDown={(event) => fieldKeyDown('height', event)}
          />
        </label>
      </div>
      <label>
        {messages.background}
        <input
          aria-label={messages.background}
          value={draft.backgroundColor}
          onBlur={() => commit(draft)}
          onChange={(event) => update('backgroundColor', event.target.value)}
          onKeyDown={(event) => fieldKeyDown('backgroundColor', event)}
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  )
}
