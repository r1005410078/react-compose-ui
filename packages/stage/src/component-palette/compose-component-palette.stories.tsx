import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useMemo } from 'react'
import { createStageInteractionController } from '@compose-ui/stage-engine'
import { storyRegistry } from '@compose-ui/storybook-fixtures'
import { ComposeComponentPalette } from './compose-component-palette'

function PaletteFixture() {
  const interactionController = useMemo(() => createStageInteractionController(), [])
  useEffect(() => () => interactionController.dispose(), [interactionController])
  return (
    <ComposeComponentPalette
      interactionController={interactionController}
      registry={storyRegistry}
      style={{ width: 280 }}
    />
  )
}

const meta = {
  title: 'Stage/ComposeComponentPalette',
  render: () => <PaletteFixture />,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
