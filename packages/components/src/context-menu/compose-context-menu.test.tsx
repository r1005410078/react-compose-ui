import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ComposeThemeProvider } from '@compose-ui/ui-context'
import * as publicApi from '../index'

afterEach(cleanup)

describe('ComposeContextMenu', () => {
  it('OpenSpec: components / 共享 ContextMenu 与运行时右键 Hook / 用声明式 Trigger 打开共享菜单', () => {
    const ContextMenu = publicApi.ComposeContextMenu
    const ContextMenuTrigger = publicApi.ComposeContextMenuTrigger
    const ContextMenuContent = publicApi.ComposeContextMenuContent
    const ContextMenuItem = publicApi.ComposeContextMenuItem

    render(
      <ContextMenu>
        <ContextMenuTrigger aria-label="目标">目标</ContextMenuTrigger>
        <ContextMenuContent aria-label="操作">
          <ContextMenuItem>重命名</ContextMenuItem>
          <ContextMenuItem disabled variant="destructive">删除</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    )

    fireEvent.contextMenu(screen.getByLabelText('目标'), { clientX: 64, clientY: 48 })

    expect(screen.getByRole('menu', { name: '操作' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '删除' })).toHaveAttribute('data-danger', 'true')
    expect(screen.getByRole('menuitem', { name: '删除' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('menuitem', { name: '删除' })).toHaveAttribute('data-disabled')
    expect(screen.getByLabelText('目标').parentElement).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByLabelText('目标').parentElement).not.toHaveAttribute('inert')
  })

  it('OpenSpec: components / 共享 ContextMenu 与运行时右键 Hook / 用 Hook 在动态目标处打开菜单', () => {
    const useContextMenu = publicApi.useComposeContextMenu as <T,>() => {
      readonly anchorPoint: { readonly x: number; readonly y: number } | null
      readonly payload: T | null
      readonly rootProps: Record<string, unknown>
      openAt: (point: { readonly x: number; readonly y: number }, payload: T) => void
    }
    const ContextMenu = publicApi.ComposeContextMenu
    const ContextMenuContent = publicApi.ComposeContextMenuContent
    const ContextMenuItem = publicApi.ComposeContextMenuItem

    function Fixture() {
      const menu = useContextMenu<string>()
      return (
        <>
          <button type="button" onClick={() => menu.openAt({ x: 180, y: 96 }, 'asset-a')}>打开</button>
          <output>{menu.payload ?? 'none'}:{menu.anchorPoint?.x ?? 0}</output>
          <ContextMenu {...menu.rootProps}>
            <ContextMenuContent aria-label="资源操作">
              <ContextMenuItem>重命名</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </>
      )
    }

    render(<Fixture />)
    fireEvent.click(screen.getByRole('button', { name: '打开' }))

    expect(screen.getByText('asset-a:180')).toBeInTheDocument()
    expect(screen.getByRole('menu', { name: '资源操作' })).toBeInTheDocument()
  })

  it('OpenSpec: components / 共享 ContextMenu 与运行时右键 Hook / Escape 关闭并恢复右键目标焦点', async () => {
    const useContextMenu = publicApi.useComposeContextMenu as <T,>() => {
      readonly rootProps: Record<string, unknown>
      openAt: (event: React.MouseEvent<HTMLButtonElement>, payload: T) => void
    }
    const ContextMenu = publicApi.ComposeContextMenu
    const ContextMenuContent = publicApi.ComposeContextMenuContent
    const ContextMenuItem = publicApi.ComposeContextMenuItem

    function Fixture() {
      const menu = useContextMenu<string>()
      return (
        <>
          <button type="button" onContextMenu={(event) => menu.openAt(event, 'asset-a')}>资源</button>
          <ContextMenu {...menu.rootProps}>
            <ContextMenuContent aria-label="资源操作">
              <ContextMenuItem>重命名</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </>
      )
    }

    render(<Fixture />)
    const target = screen.getByRole('button', { name: '资源' })
    target.focus()
    fireEvent.contextMenu(target, { clientX: 32, clientY: 40 })
    const menu = screen.getByRole('menu', { name: '资源操作' })
    await waitFor(() => expect(menu).toContainElement(document.activeElement as HTMLElement))
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('menu', { name: '资源操作' })).not.toBeInTheDocument()
      expect(target).toHaveFocus()
    })
  })

  it('OpenSpec: components / 共享 ContextMenu 与运行时右键 Hook / Portal 内容继承 Compose Theme token', () => {
    const ContextMenu = publicApi.ComposeContextMenu
    const ContextMenuTrigger = publicApi.ComposeContextMenuTrigger
    const ContextMenuContent = publicApi.ComposeContextMenuContent
    const ContextMenuItem = publicApi.ComposeContextMenuItem

    render(
      <ComposeThemeProvider overrides={{ light: { accent: '#7c3aed' } }} theme="light">
        <ContextMenu>
          <ContextMenuTrigger>目标</ContextMenuTrigger>
          <ContextMenuContent aria-label="操作"><ContextMenuItem>复制</ContextMenuItem></ContextMenuContent>
        </ContextMenu>
      </ComposeThemeProvider>,
    )

    fireEvent.contextMenu(screen.getByText('目标'), { clientX: 64, clientY: 48 })
    expect(screen.getByRole('menu', { name: '操作' })).toHaveAttribute('data-compose-theme', 'light')
    expect(screen.getByRole('menu', { name: '操作' })).toHaveStyle({ '--compose-accent': '#7c3aed' })
  })

})
