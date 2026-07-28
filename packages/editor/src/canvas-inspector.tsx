import { useEffect, useMemo, useRef, useState } from 'react'
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
  '1280x720',
  '1366x768',
  '1440x900',
  '1920x1080',
  '2560x1440',
  '3840x2160',
] as const

type OutputPresetValue = (typeof OUTPUT_PRESET_VALUES)[number]
type OutputSizeKey = 'preset' | 'custom'

const OUTPUT_PRESETS = [
  { value: '1280x720', width: 1280, height: 720, label: '1280 × 720 (HD)' },
  { value: '1366x768', width: 1366, height: 768, label: '1366 × 768' },
  { value: '1440x900', width: 1440, height: 900, label: '1440 × 900' },
  { value: '1920x1080', width: 1920, height: 1080, label: '1920 × 1080 (Full HD)' },
  { value: '2560x1440', width: 2560, height: 1440, label: '2560 × 1440 (QHD)' },
  { value: '3840x2160', width: 3840, height: 2160, label: '3840 × 2160 (4K UHD)' },
] as const

type CanvasOutputSize =
  | { readonly key: 'preset'; readonly value: OutputPresetValue | '' }
  | {
    readonly key: 'custom'
    readonly value: { readonly width: number; readonly height: number }
  }

type CanvasInspectorValue = {
  readonly outputSize: CanvasOutputSize
  readonly backgroundColor: string
}

function findOutputPreset(width: number, height: number) {
  return OUTPUT_PRESETS.find((candidate) => candidate.width === width && candidate.height === height)
}

function createCanvasOutputSchema(messages: ReturnType<typeof getEditorMessages>['canvasInspector']) {
  return v.object({
    outputSize: v.pipe(
      v.variant('key', [
        v.object({
          key: v.literal('preset'),
          value: v.pipe(
            v.picklist(['', ...OUTPUT_PRESET_VALUES]),
            v.metadata({ propertyPanel: {
              optionLabels: Object.fromEntries(OUTPUT_PRESETS.map((preset) => [preset.value, preset.label])),
            } }),
          ),
        }),
        v.object({
          key: v.literal('custom'),
          value: v.pipe(
            v.object({
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
            v.metadata({ propertyPanel: { editor: 'size' } }),
          ),
        }),
      ]),
      v.title(messages.size),
      v.metadata({ propertyPanel: {
        editor: 'map',
        mapValueDefaults: { preset: '', custom: { width: 1, height: 1 } },
        optionLabels: { preset: messages.common, custom: messages.custom },
        order: 0,
      } }),
    ),
    backgroundColor: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1, messages.invalidBackground),
      v.title(messages.background),
      v.metadata({ propertyPanel: { editor: 'color', order: 1 } }),
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
  const documentPreset = useMemo(
    () => findOutputPreset(document.output.width, document.output.height),
    [document.output.height, document.output.width],
  )
  const [outputSizeKey, setOutputSizeKey] = useState<OutputSizeKey>(
    documentPreset ? 'preset' : 'custom',
  )
  const previousDimensions = useRef({
    width: document.output.width,
    height: document.output.height,
  })

  useEffect(() => {
    const dimensionsChanged = previousDimensions.current.width !== document.output.width
      || previousDimensions.current.height !== document.output.height
    previousDimensions.current = { width: document.output.width, height: document.output.height }
    if (dimensionsChanged) setOutputSizeKey(documentPreset ? 'preset' : 'custom')
  }, [document.output.height, document.output.width, documentPreset])

  const schema = useMemo(() => createCanvasOutputSchema(messages), [messages])
  const value = useMemo(
    (): CanvasInspectorValue => ({
      outputSize: outputSizeKey === 'preset'
        ? { key: 'preset', value: documentPreset?.value ?? '' }
        : {
          key: 'custom',
          value: { width: document.output.width, height: document.output.height },
        },
      backgroundColor: document.output.backgroundColor,
    }),
    [document.output, documentPreset, outputSizeKey],
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
        const next = change.output as CanvasInspectorValue
        if (change.path[0] === 'outputSize') {
          const nextOutputSize = next.outputSize
          if (nextOutputSize.key !== value.outputSize.key) {
            setOutputSizeKey(nextOutputSize.key)
            return
          }
          if (nextOutputSize.key === 'preset') {
            const preset = OUTPUT_PRESETS.find((candidate) => candidate.value === nextOutputSize.value)
            if (!preset || (
              preset.width === document.output.width
              && preset.height === document.output.height
            )) return
            dispatch({
              id: idFactory(),
              type: 'output.configure',
              payload: {
                width: preset.width,
                height: preset.height,
                backgroundColor: document.output.backgroundColor,
              },
              meta: { label: messages.configureTransaction, source: 'inspector' },
            })
            return
          }
          const dimensions = nextOutputSize.value
          if (
            dimensions.width === document.output.width
            && dimensions.height === document.output.height
          ) return
          dispatch({
            id: idFactory(),
            type: 'output.configure',
            payload: {
              width: dimensions.width,
              height: dimensions.height,
              backgroundColor: document.output.backgroundColor,
            },
            meta: { label: messages.configureTransaction, source: 'inspector' },
          })
          return
        }
        dispatch({
          id: idFactory(),
          type: 'output.configure',
          payload: {
            width: document.output.width,
            height: document.output.height,
            backgroundColor: next.backgroundColor,
          },
          meta: { label: messages.configureTransaction, source: 'inspector' },
        })
      }}
    />
  )
}
