import type {
  ComposeEntityPreset,
  ComposeRendererDefinition,
} from '@compose-ui/component-registry'
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
      inspector: createSvgRendererInspector(idFactory),
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
