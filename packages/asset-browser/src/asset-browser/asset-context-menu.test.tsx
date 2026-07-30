import type { ComposeAssetEntry, ComposeAssetProvider } from '@compose-ui/assets'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ComposeAssetBrowser } from '../index'
import type { ComposeAssetContextMenuItem } from '../index'

const root: ComposeAssetEntry = { id: 'root', parentId: null, name: 'Assets', kind: 'folder' }
const pages: ComposeAssetEntry = { id: 'pages', parentId: 'root', name: 'Pages', kind: 'folder' }
const home: ComposeAssetEntry = {
  id: 'home',
  parentId: 'pages',
  name: 'Home.page.json',
  kind: 'file',
  mediaType: 'application/json',
  revision: '1',
  assetKey: 'Pages/Home.page.json',
}
const logo: ComposeAssetEntry = {
  id: 'logo',
  parentId: 'root',
  name: 'logo.svg',
  kind: 'file',
  mediaType: 'image/svg+xml',
  revision: '1',
  assetKey: 'logo-key',
}

function createProvider(overrides: Partial<ComposeAssetProvider> = {}): ComposeAssetProvider {
  return {
    id: 'memory',
    label: 'Assets',
    root,
    capabilities: {
      createFile: true,
      createFolder: true,
      rename: true,
      move: true,
      delete: true,
      write: true,
    },
    list: vi.fn(async ({ folderId }) => {
      if (folderId === 'root') return [pages, logo]
      if (folderId === 'pages') return [home]
      return []
    }),
    read: vi.fn(async () => ({ blob: new Blob(['{}']), revision: '1' })),
    createFile: vi.fn(async ({ parentId, name }) => ({
      id: `created-${name}`,
      parentId,
      name,
      kind: 'file' as const,
    })),
    ...overrides,
  }
}

function getTreeRow(name: RegExp) {
  return within(screen.getByRole('treegrid')).findByRole('row', { name })
}

/** 在文件树条目上打开上下文菜单。 */
async function openMenuOnTreeRow(name: RegExp) {
  const row = await getTreeRow(name)
  fireEvent.contextMenu(row, { clientX: 40, clientY: 40 })
  return screen.getByRole('menu')
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', undefined)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('OpenSpec: asset-browser / 宿主上下文菜单项扩展', () => {
  it('宿主项排在内建项之后，且不可见项不渲染', async () => {
    const items: readonly ComposeAssetContextMenuItem[] = [
      { id: 'host.always', label: '宿主项', onSelect: vi.fn() },
      {
        id: 'host.hidden',
        label: '仅页面可见',
        isVisible: (context) => context.entry?.name.endsWith('.page.json') === true,
        onSelect: vi.fn(),
      },
    ]
    render(<ComposeAssetBrowser contextMenuItems={items} provider={createProvider()} />)
    const menu = await openMenuOnTreeRow(/logo\.svg/)

    const labels = within(menu).getAllByRole('menuitem').map((item) => item.textContent)
    expect(labels).toEqual(['新建文件', '新建目录', '重命名F2', '删除Delete', '宿主项'])
    expect(within(menu).queryByRole('menuitem', { name: '仅页面可见' })).not.toBeInTheDocument()
  })

  it('宿主项按上下文渲染为禁用且点击不触发', async () => {
    const onSelect = vi.fn()
    render(
      <ComposeAssetBrowser
        contextMenuItems={[{ id: 'host.disabled', label: '不可用', isDisabled: () => true, onSelect }]}
        provider={createProvider()}
      />,
    )
    const menu = await openMenuOnTreeRow(/logo\.svg/)
    const item = within(menu).getByRole('menuitem', { name: '不可用' })

    expect(item).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(item)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('上下文携带命中条目与新建应使用的父目录', async () => {
    const onSelect = vi.fn()
    render(
      <ComposeAssetBrowser
        contextMenuItems={[{ id: 'host.inspect', label: '检查', onSelect }]}
        provider={createProvider()}
      />,
    )
    // 目录上右键时 parentId 取目录自身；文件上右键时取其父目录。
    fireEvent.click(await getTreeRow(/Pages/))
    const folderMenu = await openMenuOnTreeRow(/Pages/)
    fireEvent.click(within(folderMenu).getByRole('menuitem', { name: '检查' }))
    await waitFor(() => { expect(onSelect).toHaveBeenCalledTimes(1) })
    expect(onSelect.mock.calls[0][0]).toMatchObject({
      entry: expect.objectContaining({ id: 'pages' }),
      parentId: 'pages',
    })

    const fileMenu = await openMenuOnTreeRow(/logo\.svg/)
    fireEvent.click(within(fileMenu).getByRole('menuitem', { name: '检查' }))
    await waitFor(() => { expect(onSelect).toHaveBeenCalledTimes(2) })
    // 资源根在上下文中表达为 null，宿主据此走 Provider 的根目录。
    expect(onSelect.mock.calls[1][0]).toMatchObject({
      entry: expect.objectContaining({ id: 'logo' }),
      parentId: null,
    })
  })

  it('复用内建命名对话框，确认返回名称', async () => {
    let resolved: string | null | undefined
    render(
      <ComposeAssetBrowser
        contextMenuItems={[{
          id: 'host.prompt',
          label: '取名',
          onSelect: async (context) => {
            resolved = await context.promptName({ title: '新建页面', initialValue: 'untitled' })
          },
        }]}
        provider={createProvider()}
      />,
    )
    const menu = await openMenuOnTreeRow(/logo\.svg/)
    fireEvent.click(within(menu).getByRole('menuitem', { name: '取名' }))

    const input = await screen.findByLabelText('名称')
    expect(screen.getByText('新建页面')).toBeInTheDocument()
    expect(input).toHaveValue('untitled')
    fireEvent.change(input, { target: { value: 'Detail' } })
    fireEvent.click(screen.getByRole('button', { name: '创建' }))

    await waitFor(() => { expect(resolved).toBe('Detail') })
    expect(screen.queryByLabelText('名称')).not.toBeInTheDocument()
  })

  it('取消命名对话框时取名返回空结果', async () => {
    let resolved: string | null | undefined = 'unset'
    render(
      <ComposeAssetBrowser
        contextMenuItems={[{
          id: 'host.prompt',
          label: '取名',
          onSelect: async (context) => {
            resolved = await context.promptName({ title: '新建页面', initialValue: 'untitled' })
          },
        }]}
        provider={createProvider()}
      />,
    )
    const menu = await openMenuOnTreeRow(/logo\.svg/)
    fireEvent.click(within(menu).getByRole('menuitem', { name: '取名' }))

    await screen.findByLabelText('名称')
    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    await waitFor(() => { expect(resolved).toBeNull() })
  })

  it('宿主写入后 refresh 重新列举目录', async () => {
    const provider = createProvider()
    render(
      <ComposeAssetBrowser
        contextMenuItems={[{
          id: 'host.refresh',
          label: '刷新',
          onSelect: (context) => { context.refresh() },
        }]}
        provider={provider}
      />,
    )
    fireEvent.click(await getTreeRow(/Pages/))
    await getTreeRow(/Pages/)
    const listMock = provider.list as ReturnType<typeof vi.fn>
    const before = listMock.mock.calls.length

    const menu = await openMenuOnTreeRow(/Pages/)
    fireEvent.click(within(menu).getByRole('menuitem', { name: '刷新' }))

    await waitFor(() => { expect(listMock.mock.calls.length).toBeGreaterThan(before) })
  })

  it('未提供宿主项时菜单只有内建项', async () => {
    render(<ComposeAssetBrowser provider={createProvider()} />)
    const menu = await openMenuOnTreeRow(/logo\.svg/)
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(4)
  })
})

describe('OpenSpec: asset-browser / 条目标记插槽', () => {
  it('文件树行与目录网格块都渲染标记，且标记不参与命中测试', async () => {
    render(
      <ComposeAssetBrowser
        provider={createProvider()}
        renderEntryBadge={({ entry, surface }) => entry.name.endsWith('.page.json')
          ? <span data-testid={`badge-${surface}`}>★</span>
          : null}
      />,
    )
    fireEvent.click(await getTreeRow(/Pages/))
    fireEvent.keyDown(await getTreeRow(/Pages/), { key: 'ArrowRight' })

    await waitFor(() => {
      expect(screen.getByTestId('badge-tree')).toBeInTheDocument()
    })
    expect(screen.getByTestId('badge-grid')).toBeInTheDocument()
    expect(screen.getByTestId('badge-tree').closest('[aria-hidden="true"]')).not.toBeNull()
    expect(screen.getByTestId('badge-grid').closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('返回空结果时不产生额外元素', async () => {
    render(
      <ComposeAssetBrowser provider={createProvider()} renderEntryBadge={() => null} />,
    )
    await getTreeRow(/logo\.svg/)
    expect(document.querySelector('.asset-browser__entry-badge')).toBeNull()
  })
})
