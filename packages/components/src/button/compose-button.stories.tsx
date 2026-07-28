import type { Meta, StoryObj } from '@storybook/react-vite'
import { ComposeThemeProvider } from '@compose-ui/ui-context'
import { ComposeButton } from './index'

const meta = {
  title: 'Components/ComposeButton',
  component: ComposeButton,
  args: {
    children: '保存',
  },
} satisfies Meta<typeof ComposeButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Disabled: Story = { args: { disabled: true } }
export const Destructive: Story = {
  args: { children: '删除', variant: 'destructive' },
}
export const LongContent: Story = {
  args: { children: '将修改保存到当前工作区' },
}
export const LightTokenOverride: Story = {
  decorators: [
    (Story) => (
      <ComposeThemeProvider
        overrides={{ light: { accent: '#7c3aed' } }}
        theme="light"
      >
        <Story />
      </ComposeThemeProvider>
    ),
  ],
}
