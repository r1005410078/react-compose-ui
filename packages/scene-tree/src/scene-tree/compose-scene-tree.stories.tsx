import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ComposeSceneTree } from './compose-scene-tree'
import type { ComposeSceneTreeNode } from '../index'

const nodes: readonly ComposeSceneTreeNode[] = [
  {
    id: 'landing',
    label: 'Landing page',
    children: [
      { id: 'hero', label: 'Hero section' },
      { id: 'cta', label: 'Call to action', locked: true },
    ],
  },
]

function SceneTreeFixture({ empty = false }: { readonly empty?: boolean }) {
  const [selectedIds, setSelectedIds] = useState<readonly string[]>(['hero'])
  const [expandedIds, setExpandedIds] = useState<readonly string[]>(['landing'])
  return (
    <ComposeSceneTree
      expandedIds={expandedIds}
      nodes={empty ? [] : nodes}
      onExpandedChange={setExpandedIds}
      onSelectionChange={setSelectedIds}
      selectedIds={selectedIds}
      style={{ height: 360, width: 340 }}
    />
  )
}

const meta = {
  title: 'Workspace/ComposeSceneTree',
  render: () => <SceneTreeFixture />,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { render: () => <SceneTreeFixture empty /> }
