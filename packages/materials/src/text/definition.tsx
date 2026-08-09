import type {
  ComposeEntityPreset,
  ComposeRendererDefinition,
} from '@compose-ui/component-registry'
import type { ComposeBasicMaterialOptions } from '../types'
import { mergeAppearance, mergeJson, rendererPresetComponents } from '../material-preset'
import {
  createDefaultInspectorId,
  createTextRendererInspector,
  type InspectorIdFactory,
} from '../material-inspector-kit/renderer-inspectors'
import {
  DEFAULT_TEXT_APPEARANCE,
  DEFAULT_TEXT_PROPS,
  DEFAULT_TEXT_SIZE,
} from './defaults'
import { TextRenderer } from './renderer'
import { TEXT_RENDERER_MEASUREMENT } from './measurement'

/** 创建 Text Renderer 与 Entity Preset。 @internal */
export function createTextMaterial(
  options: ComposeBasicMaterialOptions = {},
  idFactory: InspectorIdFactory = createDefaultInspectorId,
): { renderer: ComposeRendererDefinition; preset: ComposeEntityPreset } {
  const size = options.defaultSize ?? DEFAULT_TEXT_SIZE
  const props = mergeJson(DEFAULT_TEXT_PROPS, options.defaultProps)
  const appearance = mergeAppearance(DEFAULT_TEXT_APPEARANCE, options.defaultAppearance)
  return {
    renderer: {
      type: 'text',
      label: options.label ?? 'Text',
      renderer: TextRenderer,
      propContracts: [{
        name: 'text',
        kind: 'value',
        label: 'Text',
        validate: (value) => typeof value === 'string' || typeof value === 'number'
          ? true
          : 'Text 只接受 string 或 number',
      }],
      inspector: createTextRendererInspector(idFactory),
      measurement: TEXT_RENDERER_MEASUREMENT,
    },
    preset: {
      id: 'text',
      label: options.label ?? 'Text',
      defaultName: options.name ?? 'Text',
      icon: <span aria-hidden="true">T</span>,
      createComponents: () => rendererPresetComponents({
        type: 'text',
        props,
        size,
        appearance,
      }),
    },
  }
}

const text = createTextMaterial()
/** 默认 Text Renderer。 @public */
export const DEFAULT_COMPOSE_TEXT_RENDERER = text.renderer
/** 默认 Text Entity Preset。 @public */
export const DEFAULT_COMPOSE_TEXT_PRESET = text.preset
