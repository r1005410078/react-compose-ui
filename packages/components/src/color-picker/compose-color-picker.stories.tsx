import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComposePaint } from '@compose-ui/core'
import { useState } from 'react'
import { ComposeColorHistoryProvider } from './compose-color-history'
import { ComposeColorPicker } from './compose-color-picker'
import { ComposePaintPicker } from './compose-paint-picker'

const meta = {
  title: 'Components/ComposePaintPicker',
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

function ColorFixture() {
  const [value, setValue] = useState('#2f7df6')
  return <ComposeColorPicker label="背景" value={value} onValueChange={setValue} />
}

function PaintFixture() {
  const [value, setValue] = useState<ComposePaint>({
    kind: 'linear-gradient' as const,
    start: { x: 0, y: 0.5 },
    end: { x: 1, y: 0.5 },
    stops: [
      { id: 'violet', position: 0, color: '#8b5cf6' as const },
      { id: 'cyan', position: 0.56, color: '#22d3eecc' as const },
      { id: 'transparent', position: 1, color: 'transparent' as const },
    ],
  })
  return <ComposePaintPicker label="背景填充" value={value} onValueChange={setValue} />
}

export const Solid: Story = {
  render: () => (
    <ComposeColorHistoryProvider defaultColors={['#f97316', '#0ea5e9', '#22c55e']}>
      <ColorFixture />
    </ComposeColorHistoryProvider>
  ),
}

export const Gradient: Story = {
  render: () => (
    <ComposeColorHistoryProvider defaultColors={['#8b5cf6', '#22d3eecc']}>
      <PaintFixture />
    </ComposeColorHistoryProvider>
  ),
}

export const Readonly: Story = {
  render: () => <ComposePaintPicker label="背景填充" readOnly value={{ kind: 'solid', color: '#33415580' }} />,
}
