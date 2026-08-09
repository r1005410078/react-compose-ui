import type {
  ComposeEntityPreset,
  ComposeRendererPropContract,
  ComposeRendererDefinition,
} from '@compose-ui/component-registry'
import * as v from 'valibot'
import { measureSvgAsset } from '../material-inspector-kit/assets'
import type { ComposeBasicMaterialOptions } from '../types'
import { mergeAppearance, mergeJson, rendererPresetComponents } from '../material-preset'
import {
  createDefaultInspectorId,
  createSvgRendererInspector,
  type InspectorIdFactory,
} from '../material-inspector-kit/renderer-inspectors'
import {
  DEFAULT_SVG_APPEARANCE,
  DEFAULT_SVG_PROPS,
  DEFAULT_SVG_SIZE,
} from './defaults'
import { SvgRenderer } from './renderer'
import { SVG_RENDERER_MEASUREMENT } from './measurement'
import { SVG_RENDERER_PROP_SCHEMAS } from './props'

function valueContract(
  name: keyof typeof SVG_RENDERER_PROP_SCHEMAS,
  label: string,
  affectsMeasurement: boolean,
): ComposeRendererPropContract {
  return {
    name,
    kind: 'value',
    label,
    category: 'svg',
    affectsMeasurement,
    validate: (value) => v.safeParse(SVG_RENDERER_PROP_SCHEMAS[name], value).success
      ? true
      : `${label} 与 SVG Prop Contract 不兼容`,
  }
}

/** 创建 SVG Renderer 与资源型 Entity Preset。 @internal */
export function createSvgMaterial(
  options: ComposeBasicMaterialOptions = {},
  idFactory: InspectorIdFactory = createDefaultInspectorId,
): { renderer: ComposeRendererDefinition; preset: ComposeEntityPreset } {
  const size = options.defaultSize ?? DEFAULT_SVG_SIZE
  const props = mergeJson(DEFAULT_SVG_PROPS, options.defaultProps)
  const appearance = mergeAppearance(DEFAULT_SVG_APPEARANCE, options.defaultAppearance)
  return {
    renderer: {
      type: 'svg',
      label: options.label ?? 'SVG',
      renderer: SvgRenderer,
      propContracts: [
        valueContract('asset', 'Asset', true),
        valueContract('alt', 'Alternative text', false),
        valueContract('fit', 'Fit', false),
        valueContract('overrideFill', 'Override fill', false),
        valueContract('fillColor', 'Fill color', false),
        valueContract('overrideStroke', 'Override stroke', false),
        valueContract('strokeColor', 'Stroke color', false),
      ],
      propCategories: [{ id: 'svg', label: 'SVG' }],
      inspectorPropNames: [
        'alt',
        'fit',
        'overrideFill',
        'fillColor',
        'overrideStroke',
        'strokeColor',
      ],
      inspector: createSvgRendererInspector(idFactory),
      measurement: SVG_RENDERER_MEASUREMENT,
    },
    preset: {
      id: 'svg',
      label: options.label ?? 'SVG',
      defaultName: options.name ?? 'SVG',
      icon: <span aria-hidden="true">◇</span>,
      paletteHidden: true,
      createComponents: () => rendererPresetComponents({
        type: 'svg',
        props,
        size,
        appearance,
      }),
      assetDrop: {
        accepts: ({ mediaType, name }) => (
          mediaType.toLowerCase() === 'image/svg+xml'
          || name.toLowerCase().endsWith('.svg')
        ),
        async createSeed({ reference, resolved, name }) {
          const measured = measureSvgAsset(await resolved.blob.text())
          return {
            name,
            components: rendererPresetComponents({
              type: 'svg',
              props: {
                asset: reference,
                alt: name,
                fit: 'contain',
                overrideFill: false,
                fillColor: '#ffffff',
                overrideStroke: false,
                strokeColor: '#ffffff',
              },
              size: measured,
              appearance,
            }),
          }
        },
      },
    },
  }
}

const svg = createSvgMaterial()
/** 默认 SVG Renderer。 @public */
export const DEFAULT_COMPOSE_SVG_RENDERER = svg.renderer
/** 默认 SVG Entity Preset。 @public */
export const DEFAULT_COMPOSE_SVG_PRESET = svg.preset
