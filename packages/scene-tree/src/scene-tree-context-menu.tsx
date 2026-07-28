import {
  ComposeContextMenu,
  ComposeContextMenuContent,
  ComposeContextMenuItem,
  ComposeContextMenuSeparator,
} from '@compose-ui/components'
import type { ComposeContextMenuRootProps } from '@compose-ui/components'
import type { ComposeSceneTreeCommand, ComposeSceneTreeCommandController } from './index'
import { getSceneTreeMessages } from './scene-tree-i18n'
import type { SceneTreeMessages } from './scene-tree-i18n'

interface MenuEntry {
  command: ComposeSceneTreeCommand
  danger?: boolean
  separatorBefore?: boolean
}

const NODE_MENU_ENTRIES: readonly MenuEntry[] = [
  { command: 'create-child' },
  { command: 'create-sibling' },
  { command: 'copy', separatorBefore: true },
  { command: 'cut' },
  { command: 'paste-child' },
  { command: 'paste-sibling' },
  { command: 'delete', danger: true, separatorBefore: true },
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
          return (
            <div key={entry.command}>
              {entry.separatorBefore ? <ComposeContextMenuSeparator /> : null}
              <ComposeContextMenuItem
                disabled={!enabled}
                variant={entry.danger ? 'destructive' : 'default'}
                onClick={() => commands.execute(entry.command, nodeId)}
              >
                {messages.commands[entry.command]}
              </ComposeContextMenuItem>
            </div>
          )
        })}
      </ComposeContextMenuContent>
    </ComposeContextMenu>
  )
}
