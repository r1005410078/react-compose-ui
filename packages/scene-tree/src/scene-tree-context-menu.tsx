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
  commands: ComposeSceneTreeCommandController
  messages?: SceneTreeMessages
  nodeId: string | null
  rootProps: ComposeContextMenuRootProps
}

/** 使用共享 ComposeContextMenu 呈现场景树领域命令。 */
export function SceneTreeContextMenu({
  commands,
  messages = getSceneTreeMessages('zh-CN'),
  nodeId,
  rootProps,
}: SceneTreeContextMenuProps) {
  const entries = nodeId === null ? ROOT_MENU_ENTRIES : NODE_MENU_ENTRIES
  return (
    <ComposeContextMenu {...rootProps}>
      <ComposeContextMenuContent>
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
      </ComposeContextMenuContent>
    </ComposeContextMenu>
  )
}
