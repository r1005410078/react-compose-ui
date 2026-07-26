import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect } from 'react'
import {
  ComposeOperationLogPanel,
  ComposeOperationLogProvider,
  createComposeMemoryOperationLogStore,
  useComposeOperationLog,
} from '../index'

function RecordStoryEntry() {
  const log = useComposeOperationLog()
  useEffect(() => {
    void log.record({
      action: 'node.move',
      category: 'scene',
      summary: 'Move Story card',
      targets: [{ componentId: 'story-card', componentLabel: 'Story card' }],
    })
  }, [log])
  return <ComposeOperationLogPanel style={{ height: 360, width: 560 }} />
}

const meta = {
  title: 'Workspace/ComposeOperationLogPanel',
  render: () => (
    <ComposeOperationLogProvider
      scopeId="storybook"
      store={createComposeMemoryOperationLogStore()}
    >
      <RecordStoryEntry />
    </ComposeOperationLogProvider>
  ),
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
