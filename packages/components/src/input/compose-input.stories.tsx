import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  createComposeThemeStyle,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import type {
  ComponentProps,
  CSSProperties,
} from 'react'
import { ComposeInput } from './index'

function InputFixture(props: ComponentProps<typeof ComposeInput>) {
  const theme = useComposeThemeContext()
  return (
    <label
      className="cu:grid cu:max-w-sm cu:gap-2 cu:rounded-lg cu:bg-background cu:p-4 cu:text-sm cu:font-medium cu:text-foreground"
      data-compose-theme={theme?.resolvedTheme ?? 'dark'}
      style={theme ? createComposeThemeStyle(theme.tokens) as CSSProperties : undefined}
    >
      文件名
      <ComposeInput {...props} />
    </label>
  )
}

const meta = {
  title: 'Components/ComposeInput',
  component: ComposeInput,
  render: (args) => <InputFixture {...args} />,
  args: {
    defaultValue: 'untitled.ts',
  },
} satisfies Meta<typeof ComposeInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Disabled: Story = { args: { disabled: true } }
export const Invalid: Story = { args: { 'aria-invalid': true, defaultValue: '名称已存在' } }
