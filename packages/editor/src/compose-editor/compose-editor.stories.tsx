import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo } from 'react'
import { createTransactionRuntime } from '@compose-ui/core'
import { createStoryDocument, storyRegistry } from '@compose-ui/storybook-fixtures'
import { useComposeEditorController } from '../controller'
import { ComposeEditor } from './compose-editor'

function EditorFixture() {
  const runtime = useMemo(() => createTransactionRuntime({ document: createStoryDocument() }), [])
  const controller = useComposeEditorController({
    initialSelection: ['story-card'],
    registry: storyRegistry,
    runtime,
  })
  return <ComposeEditor controller={controller} style={{ height: 760, width: 1180 }} />
}

const meta = {
  title: 'Workspace/ComposeEditor',
  render: () => <EditorFixture />,
  parameters: { layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
