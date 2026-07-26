import { useLayoutEffect } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { clampPortalPosition } from './drag-model'
import type { ComposeSceneTreeCommand, ComposeSceneTreeCommandController } from './index'
import { resolveMenuFocusIndex } from './interaction-model'
import type { ContextMenuState } from './use-scene-tree-interaction'
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

interface SceneTreeContextMenuProps extends ContextMenuState {
  commands: ComposeSceneTreeCommandController
  menuRef: RefObject<HTMLDivElement | null>
  onClose: () => void
  messages?: SceneTreeMessages
}

/** Portal 渲染的场景树命令菜单。 */
export function SceneTreeContextMenu({
  commands,
  menuRef,
  nodeId,
  onClose,
  messages = getSceneTreeMessages('zh-CN'),
  x,
  y,
}: SceneTreeContextMenuProps) {
  const entries = nodeId === null ? ROOT_MENU_ENTRIES : NODE_MENU_ENTRIES
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const rect = menu.getBoundingClientRect()
    const position = clampPortalPosition(
      x,
      y,
      rect.width,
      rect.height,
      window.innerWidth,
      window.innerHeight,
    )
    menu.style.left = `${position.left}px`
    menu.style.top = `${position.top}px`
  }, [menuRef, x, y])

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      onClose()
      event.preventDefault()
      return
    }
    const menu = event.currentTarget.closest('[role="menu"]')
    const enabled = [...(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])]
    const next = resolveMenuFocusIndex(
      event.key,
      enabled.indexOf(event.currentTarget),
      enabled.length,
    )
    if (next === null) return
    enabled[next]?.focus()
    event.preventDefault()
  }
  const firstEnabledCommand = entries.find((entry) => commands.isEnabled(entry.command, nodeId))?.command
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      ref={menuRef}
      className="st:fixed st:z-50 st:min-w-44 st:rounded-[4px] st:border st:border-[#454b55] st:bg-[#1f2329] st:p-1 st:shadow-[0_8px_24px_rgb(0_0_0_/_45%)]"
      role="menu"
      style={{ left: x, top: y }}
    >
      {entries.map((entry) => {
        const enabled = commands.isEnabled(entry.command, nodeId)
        return (
          <div key={entry.command}>
            {entry.separatorBefore ? <div className="st:my-1 st:h-px st:bg-[#3a4049]" role="separator" /> : null}
            <button
              autoFocus={entry.command === firstEnabledCommand}
              className={`st:w-full st:rounded-[3px] st:border-0 st:bg-transparent st:px-2.5 st:py-1 st:text-left st:text-[12px] st:text-[#d7dce4] st:hover:bg-[#094771] st:hover:text-white st:focus:bg-[#094771] st:focus:text-white st:focus:outline-none st:disabled:cursor-default st:disabled:text-[#6f7782] st:disabled:hover:bg-transparent ${entry.danger ? 'st:enabled:text-[#ff9aa2]' : ''}`}
              data-danger={entry.danger ? 'true' : undefined}
              disabled={!enabled}
              role="menuitem"
              type="button"
              onClick={() => {
                commands.execute(entry.command, nodeId)
                onClose()
              }}
              onKeyDown={handleKeyDown}
            >
              {messages.commands[entry.command]}
            </button>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}
