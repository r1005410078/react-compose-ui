import type {
  ComposeEntityPreset,
  ComposeRendererDefinition,
} from '@compose-ui/component-registry'
import type { ComposeBasicMaterialOptions } from '../types'
import { ComposeRectangleMaterialIcon } from '../material-icons'
import { mergeAppearance, mergeJson, rendererPresetComponents } from '../material-preset'
import { DEFAULT_RECTANGLE_APPEARANCE, DEFAULT_RECTANGLE_SIZE } from './defaults'
import { RectangleRenderer } from './renderer'

/** 创建 Rectangle Renderer 与 Entity Preset。 @internal */
export function createRectangleMaterial(
  options: ComposeBasicMaterialOptions = {},
): { renderer: ComposeRendererDefinition; preset: ComposeEntityPreset } {
  const size = options.defaultSize ?? DEFAULT_RECTANGLE_SIZE
  const props = mergeJson({}, options.defaultProps)
  const appearance = mergeAppearance(
    DEFAULT_RECTANGLE_APPEARANCE,
    options.defaultAppearance,
  )
  return {
    renderer: {
      type: 'rectangle',
      label: options.label ?? 'Rectangle',
      renderer: RectangleRenderer,
    },
    preset: {
      id: 'rectangle',
      label: options.label ?? 'Rectangle',
      defaultName: options.name ?? 'Rectangle',
      icon: <ComposeRectangleMaterialIcon />,
      createComponents: () => rendererPresetComponents({
        type: 'rectangle',
        props,
        size,
        appearance,
      }),
    },
  }
}

const rectangle = createRectangleMaterial()
/** 默认 Rectangle Renderer。 @public */
export const DEFAULT_COMPOSE_RECTANGLE_RENDERER = rectangle.renderer
/** 默认 Rectangle Entity Preset。 @public */
export const DEFAULT_COMPOSE_RECTANGLE_PRESET = rectangle.preset
