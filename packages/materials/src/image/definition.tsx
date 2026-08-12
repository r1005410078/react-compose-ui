import type {
  ComposeEntityPreset,
  ComposeRendererPropContract,
  ComposeRendererDefinition,
} from '@compose-ui/component-registry'
import * as v from 'valibot'
import { measureRasterAsset } from '../material-inspector-kit/assets'
import type { ComposeBasicMaterialOptions } from '../types'
import { ComposeImageMaterialIcon } from '../material-icons'
import { mergeAppearance, mergeJson, rendererPresetComponents } from '../material-preset'
import {
  createDefaultInspectorId,
  createImageRendererInspector,
  type InspectorIdFactory,
} from '../material-inspector-kit/renderer-inspectors'
import {
  DEFAULT_IMAGE_APPEARANCE,
  DEFAULT_IMAGE_PROPS,
  DEFAULT_IMAGE_SIZE,
} from './defaults'
import { ImageRenderer } from './renderer'
import { IMAGE_RENDERER_MEASUREMENT } from './measurement'
import { IMAGE_RENDERER_PROP_SCHEMAS } from './props'

function valueContract(
  name: keyof typeof IMAGE_RENDERER_PROP_SCHEMAS,
  label: string,
  affectsMeasurement: boolean,
): ComposeRendererPropContract {
  return {
    name,
    kind: 'value',
    label,
    category: 'image',
    affectsMeasurement,
    validate: (value) => v.safeParse(IMAGE_RENDERER_PROP_SCHEMAS[name], value).success
      ? true
      : `${label} 与 Image Prop Contract 不兼容`,
  }
}

const rasterTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/bmp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
])

/** 创建 Image Renderer 与资源型 Entity Preset。 @internal */
export function createImageMaterial(
  options: ComposeBasicMaterialOptions = {},
  idFactory: InspectorIdFactory = createDefaultInspectorId,
): { renderer: ComposeRendererDefinition; preset: ComposeEntityPreset } {
  const size = options.defaultSize ?? DEFAULT_IMAGE_SIZE
  const props = mergeJson(DEFAULT_IMAGE_PROPS, options.defaultProps)
  const appearance = mergeAppearance(DEFAULT_IMAGE_APPEARANCE, options.defaultAppearance)
  return {
    renderer: {
      type: 'image',
      label: options.label ?? 'Image',
      renderer: ImageRenderer,
      propContracts: [
        valueContract('asset', 'Asset', true),
        valueContract('alt', 'Alternative text', false),
        valueContract('fit', 'Fit', false),
      ],
      propCategories: [{ id: 'image', label: '图片' }],
      inspectorPropNames: ['alt', 'fit'],
      inspector: createImageRendererInspector(idFactory),
      measurement: IMAGE_RENDERER_MEASUREMENT,
    },
    preset: {
      id: 'image',
      label: options.label ?? 'Image',
      defaultName: options.name ?? 'Image',
      icon: <ComposeImageMaterialIcon />,
      paletteHidden: true,
      createComponents: () => rendererPresetComponents({
        type: 'image',
        props,
        size,
        appearance,
      }),
      assetDrop: {
        accepts: ({ mediaType }) => rasterTypes.has(mediaType.toLowerCase()),
        async createSeed({ reference, resolved, name }) {
          const measured = await measureRasterAsset(resolved.blob)
          return {
            name,
            components: rendererPresetComponents({
              type: 'image',
              props: { asset: reference, alt: name, fit: 'contain' },
              size: measured,
              appearance,
            }),
          }
        },
      },
    },
  }
}

const image = createImageMaterial()
/** 默认 Image Renderer。 @public */
export const DEFAULT_COMPOSE_IMAGE_RENDERER = image.renderer
/** 默认 Image Entity Preset。 @public */
export const DEFAULT_COMPOSE_IMAGE_PRESET = image.preset
