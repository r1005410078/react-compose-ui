import type { ComponentDefinition } from '@compose-ui/component-registry'
import { cloneProps, cloneStyle } from '../shared/default-values'
import { measureRasterAsset } from '../shared/assets'
import type { BasicMaterialComponentOptions } from '../types'
import {
  DEFAULT_IMAGE_PROPS,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_IMAGE_STYLE,
} from './defaults'
import { ImageRenderer } from './renderer'
import { createImageInspector } from './inspector'

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

/** 创建 Image definition。 @internal */
export function createImageDefinition(
  options: BasicMaterialComponentOptions = {},
  idFactory: () => string = () => crypto.randomUUID(),
): ComponentDefinition {
  const defaultSize = options.defaultSize ?? DEFAULT_IMAGE_SIZE
  const defaultProps = cloneProps(DEFAULT_IMAGE_PROPS, options.defaultProps)
  const defaultStyle = cloneStyle(DEFAULT_IMAGE_STYLE, options.defaultStyle)
  return {
    type: 'image',
    label: options.label ?? 'Image',
    defaultName: options.name ?? 'Image',
    icon: <span aria-hidden="true">▧</span>,
    paletteHidden: true,
    defaultSize: { ...defaultSize },
    createDefaultProps: () => cloneProps(defaultProps),
    createDefaultStyle: () => cloneStyle(defaultStyle),
    renderer: ImageRenderer,
    inspector: createImageInspector(idFactory),
    assetDrop: {
      accepts: ({ mediaType }) => rasterTypes.has(mediaType.toLowerCase()),
      async createSeed({ reference, resolved, name }) {
        const size = await measureRasterAsset(resolved.blob)
        return {
          name,
          props: {
            asset: reference,
            alt: name,
            fit: 'contain',
          },
          style: cloneStyle(defaultStyle),
          ...size,
        }
      },
    },
  }
}

/** 默认 Image definition。 @public */
export const DEFAULT_IMAGE_DEFINITION = createImageDefinition()
