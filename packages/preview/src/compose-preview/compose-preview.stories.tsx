import type { Meta, StoryObj } from '@storybook/react-vite'
import { createStoryDocument, storyRegistry } from '@compose-ui/storybook-fixtures'
import { ComposePreview } from './compose-preview'

const meta = {
  title: 'Preview/ComposePreview',
  component: ComposePreview,
  args: {
    document: createStoryDocument(),
    registry: storyRegistry,
  },
  decorators: [(Story) => <div style={{ maxWidth: 800 }}><Story /></div>],
} satisfies Meta<typeof ComposePreview>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const FrameTarget: Story = {
  args: { target: { kind: 'frame', frameId: 'story-frame' } },
}
export const Error: Story = {
  args: { target: { kind: 'frame', frameId: 'missing-frame' } },
}
