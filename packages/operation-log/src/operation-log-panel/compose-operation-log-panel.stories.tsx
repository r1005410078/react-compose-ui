import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect } from 'react'
import {
  ComposeOperationLogPanel,
  ComposeOperationLogProvider,
  createComposeMemoryOperationLogStore,
  useComposeOperationLog,
} from '../index'

function RecordStoryEntry() {
  const { record } = useComposeOperationLog()
  useEffect(() => {
    void record({
      action: 'entity.move',
      category: 'scene',
      summary: 'Move Story card',
      targets: [{ componentId: 'story-card', componentLabel: 'Story card' }],
    })
  }, [record])
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
