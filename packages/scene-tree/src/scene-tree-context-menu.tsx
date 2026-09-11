import {
  ComposeContextMenu,
  ComposeContextMenuContent,
  ComposeContextMenuItem,
  ComposeContextMenuSeparator,
  ComposeContextMenuShortcut,
  formatComposeKeybindings,
} from '@compose-ui/components'
import type {
  ComposeContextMenuRootProps,
  ComposeKeybinding,
} from '@compose-ui/components'
import type { ComposeSceneTreeCommand, ComposeSceneTreeCommandController } from './index'
import { getSceneTreeMessages } from './scene-tree-i18n'
import type { SceneTreeMessages } from './scene-tree-i18n'

interface MenuEntry {
  command: ComposeSceneTreeCommand
  danger?: boolean
  separatorBefore?: boolean
  shortcut?: readonly ComposeKeybinding[]
}

const NODE_MENU_ENTRIES: readonly MenuEntry[] = [
  { command: 'create-child' },
  { command: 'create-sibling' },
  { command: 'copy', separatorBefore: true, shortcut: [{ code: 'KeyC', primary: true }] },
  { command: 'cut', shortcut: [{ code: 'KeyX', primary: true }] },
  { command: 'paste-child' },
  { command: 'paste-sibling' },
  { command: 'delete', danger: true, separatorBefore: true, shortcut: [{ code: 'Delete' }] },
]

const ROOT_MENU_ENTRIES: readonly MenuEntry[] = [
  { command: 'create-root' },
  { command: 'paste-root' },
]

interface SceneTreeContextMenuProps {
  /** 目标节点可否进入；仅节点菜单有意义。 */
  canEnter?: boolean
  commands: ComposeSceneTreeCommandController
  messages?: SceneTreeMessages
  nodeId: string | null
  rootProps: ComposeContextMenuRootProps
  onCreateComponentIntent?: (nodeIds: readonly string[]) => void
  onEnter?: () => void
  selectedIds?: readonly string[]
}

/** 使用共享 ComposeContextMenu 呈现场景树领域命令。 */
export function SceneTreeContextMenu({
  canEnter = false,
  commands,
  messages = getSceneTreeMessages('zh-CN'),
  nodeId,
  rootProps,
  onCreateComponentIntent,
  onEnter,
  selectedIds = [],
}: SceneTreeContextMenuProps) {
  const entries = nodeId === null ? ROOT_MENU_ENTRIES : NODE_MENU_ENTRIES
  return (
    <ComposeContextMenu {...rootProps}>
      <ComposeContextMenuContent>
        {/* 进入排在首项并与既有分组隔开：它离开这份树，与其余就地编辑的命令不是一类。 */}
        {nodeId !== null && canEnter && onEnter ? (
          <>
            <ComposeContextMenuItem onClick={onEnter}>{messages.enterAction}</ComposeContextMenuItem>
            <ComposeContextMenuSeparator />
          </>
        ) : null}
        {entries.map((entry) => {
          const enabled = commands.isEnabled(entry.command, nodeId)
          const shortcut = formatComposeKeybindings(entry.shortcut)
          return (
            <div key={entry.command}>
              {entry.separatorBefore ? <ComposeContextMenuSeparator /> : null}
              <ComposeContextMenuItem
                disabled={!enabled}
                variant={entry.danger ? 'destructive' : 'default'}
                onClick={() => commands.execute(entry.command, nodeId)}
              >
                {messages.commands[entry.command]}
                {shortcut ? <ComposeContextMenuShortcut>{shortcut}</ComposeContextMenuShortcut> : null}
              </ComposeContextMenuItem>
            </div>
          )
        })}
        {nodeId !== null && onCreateComponentIntent ? (
          <>
            <ComposeContextMenuSeparator />
            <ComposeContextMenuItem
              disabled={selectedIds.length === 0}
              onClick={() => { onCreateComponentIntent(selectedIds) }}
            >创建组件…</ComposeContextMenuItem>
          </>
        ) : null}
      </ComposeContextMenuContent>
    </ComposeContextMenu>
  )
}
