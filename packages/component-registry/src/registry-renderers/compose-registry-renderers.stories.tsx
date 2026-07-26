import type { Meta, StoryObj } from '@storybook/react-vite'
import { storyRegistry } from '@compose-ui/storybook-fixtures'
import { ComposeRegistryComponent } from './compose-registry-renderers'

const meta = {
  title: 'Registry/ComposeRegistryComponent',
  component: ComposeRegistryComponent,
  args: {
    mode: 'preview',
    node: {
      id: 'story-card',
      kind: 'component',
      name: 'Story card',
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, width: 240, height: 120, rotation: 0 },
      componentType: 'story.card',
      props: { label: 'Compose card' },
    },
    registry: storyRegistry,
  },
  decorators: [(Story) => <div style={{ height: 120, width: 240 }}><Story /></div>],
} satisfies Meta<typeof ComposeRegistryComponent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Unknown: Story = {
  args: {
    node: {
      id: 'unknown',
      kind: 'component',
      name: 'Unknown',
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, width: 240, height: 120, rotation: 0 },
      componentType: 'unknown',
      props: {},
    },
  },
}
