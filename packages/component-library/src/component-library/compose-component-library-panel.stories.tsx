import type { Meta, StoryObj } from '@storybook/react-vite'
import { createComposeEntityRegistry } from '@compose-ui/component-registry'
import { ComposeComponentLibraryPanel } from './compose-component-library-panel'

const registry = createComposeEntityRegistry({
  presets: [{
    id: 'container',
    label: 'Container',
    createComponents: () => ({
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: 0, y: 0 },
        width: { mode: 'fixed', value: 100, min: 1, max: null },
        height: { mode: 'fixed', value: 100, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      Hierarchy: { childIds: [] },
    }),
  }],
})

const meta = {
  title: 'Component Library/Panel',
  component: ComposeComponentLibraryPanel,
  args: { registry },
} satisfies Meta<typeof ComposeComponentLibraryPanel>

export default meta
type Story = StoryObj<typeof meta>

export const BasicsOnly: Story = {}
