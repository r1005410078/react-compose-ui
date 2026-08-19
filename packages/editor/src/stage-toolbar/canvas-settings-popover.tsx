import { useState } from 'react'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import type {
  ComposeDocument,
  EditorCommand,
} from '@compose-ui/core'
import type { ComposeStageDispatch } from '@compose-ui/stage'
import { getEditorMessages } from '../editor-i18n'

type CanvasSettingsPopoverProps = {
  readonly document: ComposeDocument
  readonly dispatch: ComposeStageDispatch
  readonly idFactory: () => string
  readonly onClose: () => void
}

type Draft = {
  stepX: string
  stepY: string
  offsetX: string
  offsetY: string
  primaryLineEvery: string
  nodes: boolean
  guides: boolean
}

function initialDraft(document: ComposeDocument): Draft {
  const { grid, smartSnap } = document.canvas
  return {
    stepX: String(grid.stepX),
    stepY: String(grid.stepY),
    offsetX: String(grid.offsetX),
    offsetY: String(grid.offsetY),
    primaryLineEvery: String(grid.primaryLineEvery),
    nodes: smartSnap.nodes,
    guides: smartSnap.guides,
  }
}

/**
 * Stage 工具栏内部使用的画布设置草稿。
 */
export function CanvasSettingsPopover({
  document,
  dispatch,
  idFactory,
  onClose,
}: CanvasSettingsPopoverProps) {
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(
    i18n?.locale ?? 'zh-CN',
    i18n?.formatMessage,
  ).canvasSettings
  const [draft, setDraft] = useState(() => initialDraft(document))
  const [error, setError] = useState('')
  const updateNumber = (field: keyof Pick<
    Draft,
    | 'stepX'
    | 'stepY'
    | 'offsetX'
    | 'offsetY'
    | 'primaryLineEvery'
  >) => (value: string) => setDraft((current) => ({ ...current, [field]: value }))

  const apply = () => {
    const stepX = Number(draft.stepX)
    const stepY = Number(draft.stepY)
    const offsetX = Number(draft.offsetX)
    const offsetY = Number(draft.offsetY)
    const primaryLineEvery = Number(draft.primaryLineEvery)
    if (
      !Number.isFinite(stepX)
      || stepX <= 0
      || !Number.isFinite(stepY)
      || stepY <= 0
      || !Number.isFinite(offsetX)
      || !Number.isFinite(offsetY)
      || !Number.isInteger(primaryLineEvery)
      || primaryLineEvery <= 0
    ) {
      setError(messages.invalid)
      return
    }

    const configure: EditorCommand = {
      id: idFactory(),
      type: 'canvas.configure',
      payload: {
        grid: {
          ...document.canvas.grid,
          stepX,
          stepY,
          offsetX,
          offsetY,
          primaryLineEvery,
        },
        smartSnap: {
          nodes: draft.nodes,
          guides: draft.guides,
        },
      },
      meta: { label: messages.configureTransaction, source: 'stage-toolbar' },
    }
    const result = dispatch(configure)
    if (result.status === 'rejected') {
      setError(result.issues[0]?.message ?? messages.rejected)
      return
    }
    onClose()
  }

  return (
    <div
      aria-label={messages.label}
      aria-modal="false"
      className="compose-editor__canvas-settings"
      role="dialog"
    >
      <div className="compose-editor__canvas-settings-grid">
        <label>
          {messages.stepX}
          <input
            aria-label={messages.stepX}
            inputMode="decimal"
            value={draft.stepX}
            onChange={(event) => updateNumber('stepX')(event.target.value)}
          />
        </label>
        <label>
          {messages.stepY}
          <input
            aria-label={messages.stepY}
            inputMode="decimal"
            value={draft.stepY}
            onChange={(event) => updateNumber('stepY')(event.target.value)}
          />
        </label>
        <label>
          {messages.offsetX}
          <input
            aria-label={messages.offsetX}
            inputMode="decimal"
            value={draft.offsetX}
            onChange={(event) => updateNumber('offsetX')(event.target.value)}
          />
        </label>
        <label>
          {messages.offsetY}
          <input
            aria-label={messages.offsetY}
            inputMode="decimal"
            value={draft.offsetY}
            onChange={(event) => updateNumber('offsetY')(event.target.value)}
          />
        </label>
        <label className="is-wide">
          {messages.primaryLineEvery}
          <input
            aria-label={messages.primaryLineEvery}
            inputMode="numeric"
            value={draft.primaryLineEvery}
            onChange={(event) => updateNumber('primaryLineEvery')(event.target.value)}
          />
        </label>
      </div>
      <label className="compose-editor__canvas-setting-check">
        <input
          checked={draft.nodes}
          type="checkbox"
          onChange={(event) => setDraft((current) => ({
            ...current,
            nodes: event.target.checked,
          }))}
        />
        {messages.nodeSnap}
      </label>
      <label className="compose-editor__canvas-setting-check">
        <input
          checked={draft.guides}
          type="checkbox"
          onChange={(event) => setDraft((current) => ({
            ...current,
            guides: event.target.checked,
          }))}
        />
        {messages.guideSnap}
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <div className="compose-editor__canvas-settings-actions">
        <button type="button" onClick={onClose}>{messages.cancel}</button>
        <button type="button" onClick={apply}>{messages.apply}</button>
      </div>
    </div>
  )
}
