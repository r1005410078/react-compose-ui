import type { ComposeComponentDefinition } from '@compose-ui/component-registry'
import { cloneProps, cloneStyle } from '../material-inspector-kit/default-values'
import { measureSvgAsset } from '../material-inspector-kit/assets'
import type { ComposeBasicMaterialComponentOptions } from '../types'
import {
  DEFAULT_SVG_PROPS,
  DEFAULT_SVG_SIZE,
  DEFAULT_SVG_STYLE,
} from './defaults'
import { SvgRenderer } from './renderer'
import { createSvgInspector } from './inspector'

/** 创建 SVG definition。 @internal */
export function createSvgDefinition(
  options: ComposeBasicMaterialComponentOptions = {},
  idFactory: () => string = () => crypto.randomUUID(),
): ComposeComponentDefinition {
  const defaultSize = options.defaultSize ?? DEFAULT_SVG_SIZE
  const defaultProps = cloneProps(DEFAULT_SVG_PROPS, options.defaultProps)
  const defaultStyle = cloneStyle(DEFAULT_SVG_STYLE, options.defaultStyle)
  return {
    type: 'svg',
    label: options.label ?? 'SVG',
    defaultName: options.name ?? 'SVG',
    icon: <span aria-hidden="true">◇</span>,
    paletteHidden: true,
    defaultSize: { ...defaultSize },
    createDefaultProps: () => cloneProps(defaultProps),
    createDefaultStyle: () => cloneStyle(defaultStyle),
    renderer: SvgRenderer,
    inspector: createSvgInspector(idFactory),
    assetDrop: {
      accepts: ({ mediaType, name }) => (
        mediaType.toLowerCase() === 'image/svg+xml'
        || name.toLowerCase().endsWith('.svg')
      ),
      async createSeed({ reference, resolved, name }) {
        const size = measureSvgAsset(await resolved.blob.text())
        return {
          name,
          props: {
            asset: reference,
            alt: name,
            fit: 'contain',
            overrideFill: false,
            fillColor: '#ffffff',
            overrideStroke: false,
            strokeColor: '#ffffff',
          },
          style: cloneStyle(defaultStyle),
          ...size,
        }
      },
    },
  }
}

/** 默认 SVG definition。 @public */
export const DEFAULT_COMPOSE_SVG_DEFINITION = createSvgDefinition()
