import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

/** 布局标题栏菜单的单个操作。 @internal */
export interface LayoutActionMenuItem {
  readonly content: ReactNode
  readonly disabled?: boolean
  readonly label: string
  readonly onSelect: () => void
  readonly title?: string
}

/**
 * 布局标题栏的按钮锚定菜单。
 *
 * @remarks
 * `@compose-ui/components` 目前只提供指针锚定的 ContextMenu，没有按钮锚定的下拉 Pattern，
 * 因此这里按 WAI-ARIA Menu Button 自行实现：触发器 `aria-haspopup="menu"`，popup 内使用
 * roving focus，并支持 Arrow/Home/End 环绕移动与 Escape 归还焦点。
 *
 * @internal
 */
export function LayoutActionMenu({
  disabled = false,
  items,
  menuLabel,
  trigger,
  triggerLabel,
}: {
  readonly disabled?: boolean
  readonly items: readonly LayoutActionMenuItem[]
  readonly menuLabel: string
  readonly trigger: ReactNode
  readonly triggerLabel: string
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  // 打开后把焦点交给第一个可用项；菜单项全部禁用时焦点留在触发器上。
  useEffect(() => {
    if (!open) return
    const first = itemRefs.current.findIndex((item, index) => item && !items[index]?.disabled)
    if (first >= 0) itemRefs.current[first]?.focus()
  }, [items, open])

  const closeAndRestore = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  // 环绕跳过禁用项；全部禁用时返回原位，避免死循环。
  const focusFrom = (index: number, step: number) => {
    const total = items.length
    for (let offset = 1; offset <= total; offset += 1) {
      const next = (index + step * offset + total * offset) % total
      if (!items[next]?.disabled) {
        itemRefs.current[next]?.focus()
        return
      }
    }
  }

  const moveInMenu = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      focusFrom(index, event.key === 'ArrowDown' ? 1 : -1)
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      focusFrom(event.key === 'Home' ? -1 : items.length, event.key === 'Home' ? 1 : -1)
      return
    }
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault()
      closeAndRestore()
    }
  }

  return (
    <div
      className="flex-layout-inspector__menu"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={triggerLabel}
        disabled={disabled}
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
            return
          }
          if (event.key === 'Escape' && open) {
            event.preventDefault()
            setOpen(false)
          }
        }}
      >
        {trigger}
      </button>
      {open ? (
        <div aria-label={menuLabel} className="flex-layout-inspector__menu-popup" role="menu">
          {items.map((item, index) => (
            <button
              aria-label={item.label}
              disabled={item.disabled}
              key={item.label}
              ref={(node) => {
                itemRefs.current[index] = node
              }}
              role="menuitem"
              tabIndex={-1}
              title={item.title}
              type="button"
              onClick={() => {
                item.onSelect()
                closeAndRestore()
              }}
              onKeyDown={(event) => moveInMenu(event, index)}
            >
              {item.content}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
