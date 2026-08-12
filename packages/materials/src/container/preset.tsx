import type { ComposeEntityPreset } from '@compose-ui/component-registry'
import type { ComposeBasicContainerOptions } from '../types'
import { ComposeContainerMaterialIcon } from '../material-icons'
import { mergeAppearance } from '../material-preset'
import { DEFAULT_CONTAINER_APPEARANCE, DEFAULT_CONTAINER_SIZE } from './defaults'

/** 创建纯组合 Container Entity Preset。 @internal */
export function createContainerPreset(
  options: ComposeBasicContainerOptions = {},
): ComposeEntityPreset {
  const size = options.defaultSize ?? DEFAULT_CONTAINER_SIZE
  const appearance = mergeAppearance(
    DEFAULT_CONTAINER_APPEARANCE,
    options.defaultAppearance,
  )
  return {
    id: 'container',
    label: options.label ?? 'Container',
    defaultName: options.name ?? 'Container',
    icon: <ComposeContainerMaterialIcon />,
    createComponents: () => ({
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: 0, y: 0 },
        width: { mode: 'fixed', value: size.width, min: 1, max: null },
        height: { mode: 'fixed', value: size.height, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      Hierarchy: { childIds: [] },
      Clip: options.defaultClip === false
        ? { enabled: false, horizontal: 'visible', vertical: 'visible' }
        : { enabled: true, horizontal: 'clip', vertical: 'clip' },
      Appearance: structuredClone(appearance),
    }),
  }
}

/** 默认 Container Entity Preset。 @public */
export const DEFAULT_COMPOSE_CONTAINER_PRESET = createContainerPreset()
