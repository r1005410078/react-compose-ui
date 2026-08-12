import type { ComposeEntityPreset } from '@compose-ui/component-registry'
import { createComposeGroupEntitySeed } from '@compose-ui/core'

/** 创建隐藏于 Palette 的 first-class Group Preset。 @internal */
export function createGroupPreset(): ComposeEntityPreset {
  return {
    id: 'group',
    label: 'Group',
    defaultName: 'Group',
    icon: (
      <svg aria-hidden="true" viewBox="0 0 20 20">
        <rect fill="none" height="9" rx="1" stroke="currentColor" width="11" x="2.5" y="3" />
        <rect fill="none" height="9" rx="1" stroke="currentColor" width="11" x="6.5" y="8" />
      </svg>
    ),
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
