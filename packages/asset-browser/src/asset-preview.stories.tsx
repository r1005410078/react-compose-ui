import type { Meta, StoryObj } from '@storybook/react-vite'
import { createStoryAssetProvider } from '@compose-ui/storybook-fixtures'
import { ComposeAssetPreview } from './asset-preview'

const provider = createStoryAssetProvider()

const meta = {
  title: 'Assets/ComposeAssetPreview',
  component: ComposeAssetPreview,
  args: {
    provider,
    entry: {
      id: 'compose-logo',
      parentId: 'assets',
      name: 'compose-logo.svg',
      kind: 'file',
      mediaType: 'image/svg+xml',
      revision: '1',
      size: 180,
    },
  },
  decorators: [(Story) => <div style={{ height: 520, width: 920 }}><Story /></div>],
} satisfies Meta<typeof ComposeAssetPreview>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Script: Story = {
  args: {
    entry: {
      id: 'readme',
      parentId: 'assets',
      name: 'readme.md',
      kind: 'file',
      mediaType: 'text/markdown',
      revision: '1',
      size: 64,
    },
  },
}
