import type { Meta, StoryObj } from '@storybook/react-vite'
import { createComposeEntityRegistry } from '../registry'
import { ComposeRegistryEntityRenderer } from './compose-registry-renderers'

const registry = createComposeEntityRegistry({
  renderers: [{
    type: 'story.text',
    label: 'Story Text',
    renderer: ({ props }) => <span>{String(props.text)}</span>,
  }],
})

const entity = {
  id: 'story-entity',
  name: 'Story',
  components: {
    Composition: {
      presetId: null,
      baseComponentKeys: ['Transform', 'Visibility', 'Lock', 'Renderer'],
      capabilityIds: [],
    },
    Transform: {
      position: { x: 0, y: 0 },
      size: { width: 160, height: 48 },
      rotation: 0,
    },
    Visibility: { visible: true },
    Lock: { locked: false },
    Renderer: { type: 'story.text', props: { text: 'Entity Renderer' } },
  },
} as const

const meta = {
  title: 'Registry/EntityRenderer',
  component: ComposeRegistryEntityRenderer,
  args: { registry, entity, mode: 'editor' },
} satisfies Meta<typeof ComposeRegistryEntityRenderer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
