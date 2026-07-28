import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ComposeUIProvider } from '@compose-ui/ui-context'
import type { ComposeAssetEntry, ComposeAssetProvider } from '@compose-ui/assets'
import { ComposeAssetBrowser } from '../index'

/** Tree 与资源网格都使用 row/grid 语义；测试必须限定到左侧 treegrid，避免依赖全局角色顺序。 */
function getAssetTreeRow(name: RegExp) {
  return within(screen.getByRole('treegrid')).getByRole('row', { name })
}

async function findAssetTreeRow(name: RegExp) {
  return within(screen.getByRole('treegrid')).findByRole('row', { name })
}

const root: ComposeAssetEntry = {
  id: 'root',
  parentId: null,
  name: 'Assets',
  kind: 'folder',
}
const images: ComposeAssetEntry = {
  id: 'images',
  parentId: 'root',
  name: 'Images',
  kind: 'folder',
}
const logo: ComposeAssetEntry = {
  id: 'logo',
  parentId: 'root',
  name: 'logo.svg',
  kind: 'file',
  mediaType: 'image/svg+xml',
  size: 64,
  revision: '1',
  assetKey: 'logo-key',
}
const nestedLogo: ComposeAssetEntry = {
  id: 'nested-logo',
  parentId: 'images',
  name: 'nested-logo.svg',
  kind: 'file',
  mediaType: 'image/svg+xml',
  size: 32,
  revision: '1',
  assetKey: 'nested-logo-key',
}
const binary: ComposeAssetEntry = {
  id: 'binary',
  parentId: 'root',
  name: 'mesh.bin',
  kind: 'file',
  mediaType: 'application/octet-stream',
  size: 1024,
  revision: '1',
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
      if (folderId === 'root') return [images, logo, binary]
      if (folderId === 'images') return [nestedLogo]
      return []
    }),
    read: vi.fn(async ({ fileId }) => ({
      blob: fileId === 'logo'
        ? new Blob(['<svg><script>unsafe()</script><rect /></svg>'], { type: 'image/svg+xml' })
        : new Blob(['binary']),
      revision: '1',
    })),
    createFolder: vi.fn(async ({ parentId, name }) => ({
      id: `created-${name}`,
      parentId,
      name,
      kind: 'folder' as const,
    })),
    createFile: vi.fn(async ({ parentId, name, content }) => ({
      id: `created-${name}`,
      parentId,
      name,
      kind: 'file' as const,
      size: content.size,
    })),
    renameEntry: vi.fn(async ({ entryId, name }) => ({
      ...(entryId === 'logo' ? logo : binary),
      id: `${entryId}-renamed`,
      name,
    })),
    moveEntry: vi.fn(async ({ entryId, parentId }) => ({
      ...(entryId === 'logo' ? logo : binary),
      id: `${parentId}-${entryId}`,
      parentId,
    })),
    deleteEntry: vi.fn(async () => undefined),
    writeFile: vi.fn(async () => logo),
    ...overrides,
  }
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', undefined)
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:asset'),
    revokeObjectURL: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ComposeAssetBrowser', () => {
  it('OpenSpec: asset-browser / 资源 Canvas 拖拽意图 / 拖动单项或多项图片', async () => {
    const onCanvasDrag = vi.fn()
    const provider = createProvider({
      referenceScope: 'persistent',
      capabilities: {
        createFile: true,
        createFolder: true,
        rename: true,
        move: true,
        delete: true,
        write: true,
        reference: true,
      },
      resolveAsset: vi.fn(async () => ({
        blob: new Blob(['svg'], { type: 'image/svg+xml' }),
        revision: '1',
        mediaType: 'image/svg+xml',
      })),
    })
    render(
      <ComposeAssetBrowser
        onCanvasDrag={onCanvasDrag}
        provider={provider}
      />,
    )
    const treeItem = await findAssetTreeRow(/logo.svg/)
    fireEvent.click(treeItem)
    fireEvent.click(getAssetTreeRow(/mesh.bin/), {
      ctrlKey: true,
    })
    expect(treeItem).toHaveAttribute('aria-selected', 'true')
    expect(getAssetTreeRow(/mesh.bin/))
      .toHaveAttribute('aria-selected', 'true')
    const dragStart = createEvent.dragStart(treeItem)
    Object.defineProperties(dragStart, {
      clientX: { value: 100 },
      clientY: { value: 200 },
      dataTransfer: {
        value: {
          effectAllowed: 'uninitialized',
          setData: vi.fn(),
        },
      },
    })
    fireEvent(treeItem, dragStart)
    expect(onCanvasDrag).toHaveBeenCalledWith({
      type: 'start',
      clientPoint: { x: 100, y: 200 },
      items: [{
        name: 'logo.svg',
        mediaType: 'image/svg+xml',
        reference: {
          providerId: 'memory',
          assetKey: 'logo-key',
          scope: 'persistent',
        },
      }],
    })
  })

  it('OpenSpec: asset-browser / 资源 Canvas 拖拽意图 / 资源内部移动不创建节点', async () => {
    const onCanvasDrag = vi.fn()
    const provider = createProvider({
      referenceScope: 'persistent',
      capabilities: {
        createFile: true,
        createFolder: true,
        rename: true,
        move: true,
        delete: true,
        write: true,
        reference: true,
      },
      resolveAsset: vi.fn(async () => ({
        blob: new Blob(['svg'], { type: 'image/svg+xml' }),
        revision: '1',
        mediaType: 'image/svg+xml',
      })),
    })
    render(<ComposeAssetBrowser onCanvasDrag={onCanvasDrag} provider={provider} />)
    const logoRow = await findAssetTreeRow(/logo.svg/)
    const imagesRow = getAssetTreeRow(/Images/)
    const dataTransfer = {
      effectAllowed: 'uninitialized',
      setData: vi.fn(),
      types: [] as string[],
    }
    const dragStart = createEvent.dragStart(logoRow)
    Object.defineProperties(dragStart, {
      clientX: { value: 40 },
      clientY: { value: 50 },
      dataTransfer: { value: dataTransfer },
    })
    fireEvent(logoRow, dragStart)
    fireEvent.dragOver(imagesRow, { dataTransfer })
    fireEvent.drop(imagesRow, { dataTransfer })
    fireEvent.dragEnd(logoRow, {
      clientX: 100,
      clientY: 120,
      dataTransfer,
    })

    await waitFor(() => {
      expect(provider.moveEntry).toHaveBeenCalledWith({
        entryId: 'logo',
        parentId: 'images',
      })
    })
    expect(onCanvasDrag).toHaveBeenCalledWith({
      type: 'start',
      clientPoint: { x: 40, y: 50 },
      items: [expect.objectContaining({ name: 'logo.svg' })],
    })
    expect(onCanvasDrag).toHaveBeenCalledWith({ type: 'cancel' })
    expect(onCanvasDrag).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'end' }),
    )
  })
  it('OpenSpec: asset-browser / 目录浏览与预览 / 懒加载目录并显示直属资源网格', async () => {
    const provider = createProvider()
    render(<ComposeAssetBrowser provider={provider} />)
    const grid = await screen.findByRole('grid', { name: 'Assets' })
    expect(await within(grid).findByRole('gridcell', { name: /logo.svg/ })).toBeVisible()
    expect(provider.list).toHaveBeenCalledWith(expect.objectContaining({
      folderId: 'root',
      signal: expect.any(AbortSignal),
    }))
    fireEvent.doubleClick(within(grid).getByRole('gridcell', { name: /Images/ }))
    await waitFor(() => expect(provider.list).toHaveBeenCalledWith(expect.objectContaining({
      folderId: 'images',
    })))
    expect(await within(screen.getByRole('grid', { name: 'Images' }))
      .findByRole('gridcell', { name: /nested-logo.svg/ })).toBeVisible()
  })

  it('OpenSpec: asset-browser / 资源浏览与显式打开预览分离 / 单击不读取，激活才发出打开意图', async () => {
    const provider = createProvider()
    const onAssetOpen = vi.fn()
    render(<ComposeAssetBrowser provider={provider} onAssetOpen={onAssetOpen} />)
    const grid = await screen.findByRole('grid', { name: 'Assets' })
    const card = within(grid).getByRole('gridcell', { name: /logo.svg/ })
    const readMock = provider.read as ReturnType<typeof vi.fn>
    const readsBeforeSelection = readMock.mock.calls.length
    fireEvent.click(card)
    expect(readMock).toHaveBeenCalledTimes(readsBeforeSelection)
    expect(screen.getByRole('grid', { name: 'Assets' })).toBeVisible()

    const readsBeforeOpen = readMock.mock.calls.length
    fireEvent.doubleClick(card)
    expect(onAssetOpen).toHaveBeenCalledTimes(1)
    expect(onAssetOpen).toHaveBeenCalledWith(logo)
    expect(readMock).toHaveBeenCalledTimes(readsBeforeOpen)
  })

  it('OpenSpec: asset-browser / 资源浏览与显式打开预览分离 / Tree Enter 激活文件且目录仍导航', async () => {
    const onAssetOpen = vi.fn()
    const provider = createProvider()
    render(<ComposeAssetBrowser provider={provider} onAssetOpen={onAssetOpen} />)
    const treeLogo = await findAssetTreeRow(/logo.svg/)
    fireEvent.keyDown(treeLogo, { key: 'Enter' })
    expect(onAssetOpen).toHaveBeenCalledTimes(1)
    expect(onAssetOpen).toHaveBeenCalledWith(logo)

    const grid = await screen.findByRole('grid', { name: 'Assets' })
    fireEvent.doubleClick(within(grid).getByRole('gridcell', { name: /Images/ }))
    expect(await screen.findByRole('grid', { name: 'Images' })).toBeVisible()
  })

  it('OpenSpec: asset-browser / 资源写操作与部分成功 / 新建目录并刷新当前目录', async () => {
    const provider = createProvider()
    const { container } = render(<ComposeAssetBrowser provider={provider} />)
    await screen.findByRole('grid', { name: 'Assets' })
    fireEvent.click(screen.getByTitle('新建目录'))
    const dialog = screen.getByRole('dialog', { name: '新建目录' })
    expect(dialog.closest('[data-base-ui-portal]')).not.toBe(container)
    await waitFor(() => {
      expect(within(dialog).getByRole('textbox', { name: '名称' })).toHaveFocus()
    })
    expect(within(dialog).getByRole('textbox', { name: '名称' })).toHaveAttribute(
      'data-compose-ui',
      'input',
    )
    expect(within(dialog).getByRole('button', { name: '创建' })).toHaveAttribute(
      'data-compose-ui',
      'button',
    )
    fireEvent.change(within(dialog).getByRole('textbox', { name: '名称' }), {
      target: { value: 'Textures' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: '创建' }))
    await waitFor(() => expect(provider.createFolder).toHaveBeenCalledWith({
      parentId: 'root',
      name: 'Textures',
    }))
    expect(provider.list).toHaveBeenCalledTimes(2)
  })

  it('OpenSpec: asset-browser / Provider 能力与错误 / 禁用缺失 capability 的操作', async () => {
    const provider = createProvider({
      capabilities: {
        createFile: false,
        createFolder: false,
        rename: false,
        move: false,
        delete: false,
        write: false,
      },
      createFolder: undefined,
      createFile: undefined,
      renameEntry: undefined,
      moveEntry: undefined,
      deleteEntry: undefined,
      writeFile: undefined,
    })
    render(<ComposeAssetBrowser provider={provider} />)
    await screen.findByRole('grid', { name: 'Assets' })
    expect(screen.getByTitle('新建文件')).toBeDisabled()
    expect(screen.getByTitle('新建目录')).toBeDisabled()
    expect(screen.getByTitle('删除')).toBeDisabled()
  })

  it('OpenSpec: asset-browser / 资源浏览器复用共享右键菜单 / 在不同资源视图中打开一致菜单', async () => {
    render(<ComposeAssetBrowser provider={createProvider()} />)
    const treeLogo = await findAssetTreeRow(/logo.svg/)

    fireEvent.contextMenu(treeLogo, { clientX: 96, clientY: 72 })

    const menu = screen.getByRole('menu')
    expect(menu).toHaveAttribute('data-compose-ui', 'context-menu')
    expect(within(menu).getByRole('menuitem', { name: '重命名F2' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: '删除Delete' })).toHaveAttribute('data-danger', 'true')
    expect(within(menu).getByRole('menuitem', { name: '重命名F2' })
      .querySelector('[data-slot="context-menu-shortcut"]')).toHaveTextContent('F2')
    expect(within(menu).getByRole('menuitem', { name: '删除Delete' })
      .querySelector('[data-slot="context-menu-shortcut"]')).toHaveTextContent('Delete')
  })

  it('Asset Browser / 资源网格右键菜单 / 右键后的非主键 click 不会重复资源选择', async () => {
    const onSelectionChange = vi.fn()
    render(
      <ComposeAssetBrowser
        provider={createProvider()}
        selectedIds={['root']}
        onSelectionChange={onSelectionChange}
      />,
    )
    const grid = await screen.findByRole('grid', { name: 'Assets' })
    const logoCard = within(grid).getByRole('gridcell', { name: /logo.svg/ })

    fireEvent.contextMenu(logoCard, { button: 2, clientX: 96, clientY: 72 })
    fireEvent.click(logoCard, { button: 2 })

    expect(onSelectionChange).toHaveBeenCalledTimes(1)
    expect(onSelectionChange).toHaveBeenCalledWith(['logo'])
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('Asset Browser / 资源网格右键菜单 / 右键后的主键兼容 click 不会重复资源选择', async () => {
    const onSelectionChange = vi.fn()
    render(
      <ComposeAssetBrowser
        provider={createProvider()}
        selectedIds={['root']}
        onSelectionChange={onSelectionChange}
      />,
    )
    const grid = await screen.findByRole('grid', { name: 'Assets' })
    const logoCard = within(grid).getByRole('gridcell', { name: /logo.svg/ })

    fireEvent.contextMenu(logoCard, { button: 2, clientX: 96, clientY: 72 })
    // 部分浏览器/宿主会在 contextmenu 后补发 button=0 的 click。
    fireEvent.click(logoCard, { button: 0 })

    expect(onSelectionChange).toHaveBeenCalledTimes(1)
    expect(onSelectionChange).toHaveBeenCalledWith(['logo'])
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('Asset Browser / 资源树右键菜单 / 右键后的主键兼容 click 不会重复资源选择', async () => {
    const onSelectionChange = vi.fn()
    render(
      <ComposeAssetBrowser
        provider={createProvider()}
        selectedIds={['root']}
        onSelectionChange={onSelectionChange}
      />,
    )
    const treeLogo = await findAssetTreeRow(/logo.svg/)

    fireEvent.contextMenu(treeLogo, { button: 2, clientX: 96, clientY: 72 })
    fireEvent.click(treeLogo, { button: 0 })

    // contextmenu 自身会选中未选中行；后续兼容 click 不得再次触发选择。
    expect(onSelectionChange).toHaveBeenCalledTimes(1)
    expect(onSelectionChange).toHaveBeenCalledWith(['logo'])
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('OpenSpec: editor-preferences / 资源面板 Context / 使用浅色 token、英文及消息覆盖', async () => {
    render(
      <ComposeUIProvider
        locale="en-US"
        messages={{ 'assetBrowser.search': 'Find files' }}
        theme="light"
      >
        <ComposeAssetBrowser provider={createProvider()} />
      </ComposeUIProvider>,
    )
    await screen.findByRole('grid', { name: 'Assets' })
    const browser = screen.getByRole('searchbox', { name: 'Find files' })
      .closest('[data-compose-ui="asset-browser"]')
    expect(browser).toHaveAttribute('lang', 'en-US')
    expect(browser).toHaveAttribute('data-compose-theme', 'light')
    expect(browser).toHaveStyle({ '--compose-panel-bg': '#ffffff' })
  })

  it('OpenSpec: asset-browser / 资源浏览与显式打开预览分离 / 宿主拒绝 rename 时不调用 Provider', async () => {
    const provider = createProvider()
    const onBeforeAssetMutation = vi.fn(async () => false)
    render(
      <ComposeAssetBrowser
        provider={provider}
        onBeforeAssetMutation={onBeforeAssetMutation}
      />,
    )
    const grid = await screen.findByRole('grid', { name: 'Assets' })
    fireEvent.click(within(grid).getByRole('gridcell', { name: /logo.svg/ }))
    fireEvent.click(screen.getByTitle('重命名'))
    fireEvent.change(screen.getByRole('textbox', { name: '名称' }), {
      target: { value: 'renamed.svg' },
    })
    fireEvent.click(screen.getByRole('button', { name: '重命名' }))
    await waitFor(() => expect(onBeforeAssetMutation).toHaveBeenCalledWith({
      type: 'rename',
      entries: [logo],
    }))
    expect(provider.renameEntry).not.toHaveBeenCalled()
  })
})
