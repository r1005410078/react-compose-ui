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
  args: { frameId: 'story-frame' },
}
export const Contain: Story = {
  args: { fit: 'contain' },
  decorators: [(Story) => <div style={{ width: 400, height: 260 }}><Story /></div>],
}
export const Error: Story = {
  args: { frameId: 'missing-frame' },
}
