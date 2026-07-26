import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import * as v from 'valibot'
import { ComposePropertyPanel } from './compose-property-panel'

const schema = v.object({
  label: v.pipe(v.string(), v.title('Label')),
  width: v.pipe(v.number(), v.minValue(0), v.title('Width')),
  visible: v.pipe(v.boolean(), v.title('Visible')),
})

function PropertyPanelFixture() {
  const [value, setValue] = useState({ label: 'Story card', width: 240, visible: true })
  return (
    <ComposePropertyPanel
      header={{ title: 'Story card', subtitle: 'Component', icon: 'S' }}
      schema={schema}
      style={{ maxWidth: 420 }}
      value={value}
      onValueChange={(next) => setValue(next)}
    />
  )
}

const meta = {
  title: 'Workspace/ComposePropertyPanel',
  render: () => <PropertyPanelFixture />,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
