import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import { useWorkspaceContent } from './workspace-context'
import { getEditorMessages } from '../editor-i18n'

/**
 * 应用标志。
 *
 * @remarks
 * 两块实心圆角方块加一段 accent 正交导线——这个产品的画面就是这个：一堆块，块之间横平竖直的
 * 线。**必须是实心**：顶栏右端那三颗布局开关是描边圆角矩形，两者相距不到一屏，同形会让它们
 * 读成一家人。只有导线是彩色的，因为「把东西连起来」正是它做的事。
 */
function BrandMark() {
  return (
    <svg aria-hidden="true" className="compose-editor__brand-mark" viewBox="0 0 24 24">
      <rect fill="currentColor" height="9.4" rx="2.4" width="9.8" x="1.8" y="12.8" />
      <rect fill="currentColor" height="8.6" rx="2.2" width="8.8" x="13.4" y="1.8" />
      <path
        className="compose-editor__brand-wire"
        d="M11.6 17.5h6.2v-7.1"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
    </svg>
  )
}

/**
 * 顶栏最左的标志与应用菜单。
 *
 * @remarks
 * 它承载的是**应用作用域**——顶栏右端此前那颗设置齿轮收进这里，右端因此只剩三颗布局开关。
 * 菜单本期恰好两项（设置、命令面板），两项都不是各自能力的唯一入口：`editor.settings` 的动作
 * 与键位仍在，命令面板也仍是底部的一个面板。
 *
 * 标志不带文字标记：30px 一行里的字母会挤掉紧邻的工作区，而标志的职责是那颗把手，不是署名。
 * @internal
 */
export function EditorBrandMenu() {
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage)
  const { openCommandPanel, setSettingsButton, settingsOpen, settingsPanelId, toggleSettings }
    = useWorkspaceContent()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }
  const choose = (action: () => void) => {
    setOpen(false)
    action()
  }
  const expand = () => {
    setOpen(true)
    window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    })
  }
  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
    const index = event.target instanceof HTMLButtonElement ? items.indexOf(event.target) : -1
    const next = event.key === 'ArrowDown'
      ? (index + 1 + items.length) % items.length
      : (index - 1 + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <div className="compose-editor__brand-anchor">
      <button
        aria-controls={open ? menuId : settingsOpen ? settingsPanelId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={messages.appMenu}
        className="compose-editor__brand"
        ref={(element) => {
          triggerRef.current = element
          // 设置弹框关闭后焦点回到这里：它现在是设置的入口，也是它唯一的锚点。
          setSettingsButton(element)
        }}
        title={messages.appMenu}
        type="button"
        onClick={() => { if (open) setOpen(false); else expand() }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown') return
          event.preventDefault()
          expand()
        }}
      >
        <BrandMark />
        <span className="compose-editor__brand-chevron"><ChevronIcon /></span>
      </button>
      {open ? (
        <div
          aria-label={messages.appMenu}
          className="compose-editor__brand-menu"
          id={menuId}
          ref={menuRef}
          role="menu"
          onKeyDown={onMenuKeyDown}
        >
          <button role="menuitem" type="button" onClick={() => choose(toggleSettings)}>
            {messages.settings}
          </button>
          <button role="menuitem" type="button" onClick={() => choose(openCommandPanel)}>
            {messages.commandPanel}
          </button>
        </div>
      ) : null}
    </div>
  )
}
