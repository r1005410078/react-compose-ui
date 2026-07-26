import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo, useState } from 'react'
import { ComposeHistoryPanel } from './compose-history-panel'

function HistoryFixture({ empty = false }: { readonly empty?: boolean }) {
  const [activeEntryId, setActiveEntryId] = useState<string | null>(empty ? null : 'resize')
  const entries = useMemo(() => empty ? [] : [
    { id: 'start', label: '开始' },
    { id: 'move', label: '移动卡片 · x 24 → 96' },
    { id: 'resize', label: '调整卡片大小 · 240 × 120 → 320 × 180' },
  ], [empty])
  return (
    <ComposeHistoryPanel
      controller={{
        activeEntryId,
        canRedo: false,
        canUndo: activeEntryId !== 'start',
        entries,
        navigate: setActiveEntryId,
        redo: () => undefined,
        undo: () => setActiveEntryId('move'),
      }}
      style={{ maxWidth: 360 }}
    />
  )
}

const meta = {
  title: 'Workspace/ComposeHistoryPanel',
  render: () => <HistoryFixture />,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { render: () => <HistoryFixture empty /> }
