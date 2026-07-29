import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useMemo } from 'react'
import { createTransactionRuntime, type CommandHandler } from '@compose-ui/core'
import { createStoryDocument } from '@compose-ui/storybook-fixtures'
import { ComposeCommandPanel } from './compose-command-panel'

const renameHandler: CommandHandler = {
  type: 'storybook.rename',
  execute: (_document, command) => ({
    status: 'patches',
    patches: [{ op: 'set', path: ['entities', 'story-card', 'name'], value: command.payload.name }],
  }),
}

function CommandPanelFixture({ populated = true }: { readonly populated?: boolean }) {
  const runtime = useMemo(() => createTransactionRuntime({
    document: createStoryDocument(),
    handlers: [renameHandler],
  }), [])
  useEffect(() => {
    if (!populated) return
    runtime.dispatch({
      id: 'storybook-rename',
      type: 'storybook.rename',
      payload: { name: 'Renamed story card' },
      meta: { label: 'Rename story card', source: 'storybook', targetIds: ['story-card'] },
    })
  }, [populated, runtime])
  return <ComposeCommandPanel runtime={runtime} style={{ width: 560 }} />
}

const meta = {
  title: 'Workspace/ComposeCommandPanel',
  render: () => <CommandPanelFixture />,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { render: () => <CommandPanelFixture populated={false} /> }
