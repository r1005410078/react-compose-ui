import { useContext, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { ComposeEdges } from '@compose-ui/core'
import type { ComposePropertyPanelRendererProps } from '@compose-ui/property-panel'
import { InspectorEdgesEditor } from '../material-inspector-kit/edge-editor'
import { useZh } from '../material-inspector-kit/use-zh'
import { FlexLayoutIcon } from './icons'
import {
  FLEX_CSS_NAMES,
  FLEX_INITIAL_VALUES,
  FLEX_OPTIONS,
  isFlexFieldEditorId,
  isFlexOptionEditorId,
} from './flex-options'
import { FlexDirectionIconContext } from './flex-direction-context'

export function FlexFieldLabel({
  label,
  metadata,
}: ComposePropertyPanelRendererProps) {
  if (!isFlexFieldEditorId(metadata.editor)) return label
  return (
    <span className="flex-layout-inspector__field-label">
      <span>
        {label}
        {metadata.editor === 'align-content' ? (
          <small title="仅在换行产生多行时生效">ⓘ</small>
        ) : null}
      </span>
      <code>{FLEX_CSS_NAMES[metadata.editor]}</code>
    </span>
  )
}

export function FlexOptionEditor({
  commit,
  label,
  metadata,
  readOnly,
  value,
}: ComposePropertyPanelRendererProps) {
  const zh = useZh()
  const flexDirection = useContext(FlexDirectionIconContext)
  const editor = metadata.editor
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  if (!isFlexOptionEditorId(editor)) return null
  const options = FLEX_OPTIONS[editor]
  const selectedIndex = options.findIndex((option) => option.value === value)
  const selectOption = (nextValue: string, resetSelected = false) => {
    if (nextValue !== value) {
      commit(nextValue)
      return
    }
    const initialValue = FLEX_INITIAL_VALUES[editor]
    if (resetSelected && nextValue !== initialValue) commit(initialValue)
  }
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | undefined
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % options.length
    }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + options.length) % options.length
    }
    else if (event.key === 'Home') {
      nextIndex = 0
    }
    else if (event.key === 'End') {
      nextIndex = options.length - 1
    }
    if (nextIndex === undefined) return
    event.preventDefault()
    buttons.current[nextIndex]?.focus()
    selectOption(options[nextIndex]!.value)
  }
  return (
    <div
      aria-label={label}
      className="flex-layout-inspector__options"
      data-flex-layout-field={editor}
      data-option-count={options.length}
      role="radiogroup"
    >
      {options.map((option, index) => (
        <button
          aria-checked={option.value === value}
          aria-label={zh ? option.zh : option.en}
          className="flex-layout-inspector__option"
          data-initial-value={option.value === FLEX_INITIAL_VALUES[editor] ? '' : undefined}
          disabled={readOnly}
          key={option.value}
          ref={(node) => {
            buttons.current[index] = node
          }}
          role="radio"
          tabIndex={(selectedIndex < 0 ? index === 0 : selectedIndex === index) ? 0 : -1}
          title={zh ? option.zh : option.en}
          type="button"
          onClick={() => selectOption(option.value, true)}
          onKeyDown={(event) => move(event, index)}
        >
          <FlexLayoutIcon
            editor={editor}
            flexDirection={flexDirection}
            value={option.value}
          />
        </button>
      ))}
    </div>
  )
}

export function FlexGapEditor({
  commit,
  label,
  readOnly,
  value,
}: ComposePropertyPanelRendererProps) {
  const zh = useZh()
  const gap = value as { readonly rowGap: number; readonly columnGap: number }
  const signature = `${gap.rowGap}:${gap.columnGap}`
  const equal = gap.rowGap === gap.columnGap
  const [state, setState] = useState({ source: signature, split: !equal })
  const current = state.source === signature ? state : { source: signature, split: !equal }
  const update = (axis: 'rowGap' | 'columnGap', raw: string) => {
    const candidate = Number(raw)
    if (!Number.isFinite(candidate) || candidate < 0) return
    commit({ ...gap, [axis]: candidate }, 'input')
  }

  return (
    <div
      className="flex-layout-inspector__gap"
      data-flex-layout-field="gap"
    >
      {current.split ? (
        <div className="flex-layout-inspector__gap-axes">
          <input
            aria-label={zh ? '行间距' : 'Row gap'}
            disabled={readOnly}
            min="0"
            step="any"
            type="number"
            value={gap.rowGap}
            onChange={(event) => update('rowGap', event.target.value)}
          />
          <input
            aria-label={zh ? '列间距' : 'Column gap'}
            disabled={readOnly}
            min="0"
            step="any"
            type="number"
            value={gap.columnGap}
            onChange={(event) => update('columnGap', event.target.value)}
          />
        </div>
      ) : (
        <input
          aria-label={label}
          disabled={readOnly}
          min="0"
          step="any"
          type="number"
          value={gap.rowGap}
          onChange={(event) => {
            const candidate = Number(event.target.value)
            if (!Number.isFinite(candidate) || candidate < 0) return
            commit({ rowGap: candidate, columnGap: candidate }, 'input')
          }}
        />
      )}
      <button
        aria-label={current.split
          ? (zh ? '重新联动项间距' : 'Relink item gap')
          : (zh ? '拆分项间距' : 'Split item gap')}
        disabled={readOnly}
        type="button"
        onClick={() => {
          if (current.split) {
            commit({ rowGap: gap.rowGap, columnGap: gap.rowGap })
            setState({ source: `${gap.rowGap}:${gap.rowGap}`, split: false })
          }
          else {
            setState({ source: signature, split: true })
          }
        }}
      >
        ↕
      </button>
    </div>
  )
}

export function FlexPaddingEditor({
  commit,
  label,
  readOnly,
  value,
}: ComposePropertyPanelRendererProps) {
  const zh = useZh()
  return (
    <div data-flex-layout-field="padding">
      <InspectorEdgesEditor
        collapseLabel={zh ? '收起并联动内边距' : 'Collapse and link padding edges'}
        expandLabel={zh ? '展开内边距' : 'Expand padding'}
        label={label}
        min={0}
        readOnly={readOnly}
        value={value as ComposeEdges}
        onCommit={(next) => commit(next, 'commit')}
      />
    </div>
  )
}
