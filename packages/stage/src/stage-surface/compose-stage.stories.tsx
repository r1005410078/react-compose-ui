import type { Meta, StoryObj } from '@storybook/react-vite'
import { useRef, useState, useSyncExternalStore } from 'react'
import { createTransactionRuntime } from '@compose-ui/core'
import { createStoryDocument, storyRegistry } from '@compose-ui/storybook-fixtures'
import { ComposeStage } from './compose-stage'

function StageFixture({ selected = true }: { readonly selected?: boolean }) {
  const runtimeRef = useRef<ReturnType<typeof createTransactionRuntime> | null>(null)
  if (!runtimeRef.current) runtimeRef.current = createTransactionRuntime({ document: createStoryDocument() })
  const runtime = runtimeRef.current
  const state = useSyncExternalStore(runtime.subscribe, runtime.getState, runtime.getState)
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 })
  const [selectedIds, setSelectedIds] = useState<readonly string[]>(selected ? ['story-card'] : [])
  return (
    <ComposeStage
      dispatch={runtime.dispatch}
      document={state.document}
      onSelectedIdsChange={setSelectedIds}
      onViewportChange={setViewport}
      registry={storyRegistry}
      selectedIds={selectedIds}
      style={{ height: 560, width: 900 }}
      tool="select"
      viewport={viewport}
    />
  )
}

const meta = {
  title: 'Stage/ComposeStage',
  render: () => <StageFixture />,
  parameters: { layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const EmptySelection: Story = { render: () => <StageFixture selected={false} /> }
