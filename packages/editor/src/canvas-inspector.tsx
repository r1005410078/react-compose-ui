import { useMemo } from 'react'
import { ComposePropertyPanel } from '@compose-ui/property-panel'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import type {
  CommandDispatchResult,
  ComposeDocument,
  EditorCommand,
} from '@compose-ui/core'
import * as v from 'valibot'
import { getEditorMessages } from './editor-i18n'

type CanvasInspectorProps = {
  readonly document: ComposeDocument
  readonly dispatch: (command: EditorCommand) => CommandDispatchResult
  readonly idFactory: () => string
}

const OUTPUT_PRESET_VALUES = [
  'custom',
  '1280x720',
  '1366x768',
  '1440x900',
  '1920x1080',
  '2560x1440',
  '3840x2160',
] as const

type OutputPresetValue = (typeof OUTPUT_PRESET_VALUES)[number]

const OUTPUT_PRESETS = [
  { value: '1280x720', width: 1280, height: 720, label: '1280 × 720 (HD)' },
  { value: '1366x768', width: 1366, height: 768, label: '1366 × 768' },
  { value: '1440x900', width: 1440, height: 900, label: '1440 × 900' },
  { value: '1920x1080', width: 1920, height: 1080, label: '1920 × 1080 (Full HD)' },
  { value: '2560x1440', width: 2560, height: 1440, label: '2560 × 1440 (QHD)' },
  { value: '3840x2160', width: 3840, height: 2160, label: '3840 × 2160 (4K UHD)' },
] as const

function createCanvasOutputSchema(messages: ReturnType<typeof getEditorMessages>['canvasInspector']) {
  return v.object({
    size: v.pipe(
      v.object({
        preset: v.pipe(
          v.picklist(OUTPUT_PRESET_VALUES),
          v.metadata({ propertyPanel: {
            optionLabels: Object.fromEntries([
              ['custom', messages.custom],
              ...OUTPUT_PRESETS.map((preset) => [preset.value, preset.label]),
            ]),
          } }),
        ),
        width: v.pipe(
          v.number(),
          v.finite(messages.invalidSize),
          v.minValue(0.000001, messages.invalidSize),
        ),
        height: v.pipe(
          v.number(),
          v.finite(messages.invalidSize),
          v.minValue(0.000001, messages.invalidSize),
        ),
      }),
      v.title(messages.size),
      v.metadata({ propertyPanel: {
        editor: 'size',
        sizePresets: OUTPUT_PRESETS.map(({ value, width, height }) => ({ value, width, height })),
      } }),
    ),
    backgroundColor: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1, messages.invalidBackground),
      v.title(messages.background),
      v.metadata({ propertyPanel: { editor: 'color' } }),
    ),
  })
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
  const schema = useMemo(() => createCanvasOutputSchema(messages), [messages])
  const preset = useMemo<OutputPresetValue>(
    () => OUTPUT_PRESETS.find((candidate) => (
      candidate.width === document.output.width
      && candidate.height === document.output.height
    ))?.value ?? 'custom',
    [document.output.height, document.output.width],
  )
  const value = useMemo(
    () => ({
      size: {
        preset,
        width: document.output.width,
        height: document.output.height,
      },
      backgroundColor: document.output.backgroundColor,
    }),
    [document.output, preset],
  )

  return (
    <ComposePropertyPanel
      aria-label={messages.label}
      className="compose-editor__canvas-inspector"
      defaultValue={value}
      header={{ title: messages.title }}
      schema={schema}
      value={value}
      onValueChange={(_nextValue, change) => {
        dispatch({
          id: idFactory(),
          type: 'output.configure',
          payload: {
            width: change.output.size.width,
            height: change.output.size.height,
            backgroundColor: change.output.backgroundColor,
          },
          meta: {
            label: messages.configureTransaction,
            source: 'inspector',
          },
        })
      }}
    />
  )
}
