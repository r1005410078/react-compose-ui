import type { ComposeEntityPreset } from '@compose-ui/component-registry'
import { createComposeGroupEntitySeed } from '@compose-ui/core'
import { ComposeGroupMaterialIcon } from '../material-icons'

/** 创建隐藏于 Palette 的 first-class Group Preset。 @internal */
export function createGroupPreset(): ComposeEntityPreset {
  return {
    id: 'group',
    label: 'Group',
    defaultName: 'Group',
    icon: <ComposeGroupMaterialIcon />,
    paletteHidden: true,
    createComponents: () => {
      const seed = createComposeGroupEntitySeed({ id: '__group_preset__' })
      return Object.fromEntries(
        Object.entries(seed.components).filter(([key]) => key !== 'Composition'),
      )
    },
  }
}

/** 默认 first-class Group Preset。 @public */
export const DEFAULT_COMPOSE_GROUP_PRESET = createGroupPreset()
