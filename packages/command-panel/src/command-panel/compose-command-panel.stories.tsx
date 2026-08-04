import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useMemo } from 'react'
import { createTransactionRuntime, type CommandHandler } from '@compose-ui/core'
import { createStoryDocument } from '@compose-ui/storybook-fixtures'
import { ComposeCommandPanel } from './compose-command-panel'
import type { ComposeCommandAction } from '../types'

const renameHandler: CommandHandler = {
  type: 'storybook.rename',
  execute: (_document, command) => ({
    status: 'patches',
    patches: [{ op: 'set', path: ['entities', 'story-card', 'name'], value: command.payload.name }],
  }),
}

/** 覆盖有分组、未分组、带键位与不可用四种结果形态。 */
const storyActions: readonly ComposeCommandAction[] = [
  {
    id: 'stage.zoomIn',
    title: '放大',
    category: '舞台',
    keywords: ['zoom in'],
    shortcut: [{ code: 'Equal', primary: true }],
    run: () => {},
  },
  {
    id: 'stage.zoomOut',
    title: '缩小',
    category: '舞台',
    keywords: ['zoom out'],
    shortcut: [{ code: 'Minus', primary: true }],
    run: () => {},
  },
  {
    id: 'stage.fitSelection',
    title: '适配选中对象',
    category: '舞台',
    shortcut: [{ code: 'KeyF' }],
    disabledReason: '当前没有选中对象',
    run: () => {},
  },
  {
    id: 'edit.group',
    title: '编组',
    category: '编辑',
    shortcut: [{ code: 'KeyG', primary: true }],
    disabledReason: '至少选中两个对象',
    run: () => {},
  },
  {
    id: 'edit.delete',
    title: '删除',
    category: '编辑',
    shortcut: [{ code: 'Delete' }],
    run: () => {},
  },
  { id: 'history.undo', title: '撤销', category: '历史', run: () => {} },
  { id: 'history.redo', title: '重做', category: '历史', disabledReason: '没有可重做的操作', run: () => {} },
  { id: 'editor.settings', title: '打开设置', run: () => {} },
]

function CommandPanelFixture({
  actions,
  populated = true,
}: {
  readonly actions?: readonly ComposeCommandAction[]
  readonly populated?: boolean
}) {
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
  return <ComposeCommandPanel actions={actions} runtime={runtime} style={{ width: 560 }} />
}

const meta = {
  title: 'Workspace/ComposeCommandPanel',
  render: () => <CommandPanelFixture />,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { render: () => <CommandPanelFixture populated={false} /> }
export const WithActions: Story = { render: () => <CommandPanelFixture actions={storyActions} /> }
