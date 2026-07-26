import type { Meta, StoryObj } from '@storybook/react-vite'
import { createStoryAssetProvider } from '@compose-ui/storybook-fixtures'
import { ComposeAssetBrowser } from './compose-asset-browser'

const meta = {
  title: 'Assets/ComposeAssetBrowser',
  component: ComposeAssetBrowser,
  args: { provider: createStoryAssetProvider() },
  decorators: [(Story) => <div style={{ height: 520, width: 920 }}><Story /></div>],
} satisfies Meta<typeof ComposeAssetBrowser>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = {
  args: { emptyState: <p>No asset source connected.</p>, provider: undefined },
}
