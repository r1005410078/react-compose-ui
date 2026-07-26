import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ComposeTree } from './index'

type StoryItem = {
  readonly id: string
  readonly label: string
  readonly children?: readonly StoryItem[]
  readonly disabled?: boolean
}

const items: readonly StoryItem[] = [
  {
    id: 'pages',
    label: 'Pages',
    children: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'settings', label: 'Settings' },
    ],
  },
  { id: 'assets', label: 'Assets', disabled: true },
]

function TreeFixture({ empty = false }: { readonly empty?: boolean }) {
  const [selectedIds, setSelectedIds] = useState<readonly string[]>(['dashboard'])
  const [expandedIds, setExpandedIds] = useState<readonly string[]>(['pages'])
  return (
    <ComposeTree
      adapter={{
        getChildren: (item) => item.children,
        getId: (item) => item.id,
        getLabel: (item) => item.label,
        isDisabled: (item) => Boolean(item.disabled),
      }}
      expandedIds={expandedIds}
      items={empty ? [] : items}
      onExpandedChange={setExpandedIds}
      onSelectionChange={setSelectedIds}
      renderLabel={({ item }) => item.label}
      selectedIds={selectedIds}
      style={{ height: 240, width: 320 }}
    />
  )
}

const meta = {
  title: 'Components/ComposeTree',
  render: () => <TreeFixture />,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { render: () => <TreeFixture empty /> }
export const LargeData: Story = {
  render: () => <TreeFixture />,
}
