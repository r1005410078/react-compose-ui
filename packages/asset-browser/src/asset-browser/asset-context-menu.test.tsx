import type { ComposeAssetEntry, ComposeAssetProvider } from '@compose-ui/assets'
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
import {
  COMPOSE_ASSET_REFERENCE_DRAG_MEDIA_TYPE,
  ComposeAssetBrowser,
  parseComposeAssetReferenceDragData,
} from '../index'
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
  it('文件树行与目录网格块都渲染标记，且标记留在无障碍树中', async () => {
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
    // 命中测试由 pointer-events: none 排除；标记本身必须可被读出，因此不能 aria-hidden。
    expect(screen.getByTestId('badge-tree').closest('[aria-hidden="true"]')).toBeNull()
    expect(screen.getByTestId('badge-tree').closest('.asset-browser__entry-badge')).not.toBeNull()
    expect(screen.getByTestId('badge-grid').closest('.asset-browser__entry-badge')).not.toBeNull()
  })

  it('返回空结果时不产生额外元素', async () => {
    render(
      <ComposeAssetBrowser provider={createProvider()} renderEntryBadge={() => null} />,
    )
    await getTreeRow(/logo\.svg/)
    expect(document.querySelector('.asset-browser__entry-badge')).toBeNull()
  })
})

describe('OpenSpec: asset-browser / 资源 Canvas 拖拽意图', () => {
  const referenceCapableProvider = () => createProvider({
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
      blob: new Blob(['{}']),
      revision: '1',
      mediaType: 'application/json',
    })),
  })

  /** 在条目上触发 dragstart 并捕获写入的拖拽数据。 */
  function startDragOnTreeRow(row: HTMLElement) {
    const written = new Map<string, string>()
    const dragStart = createEvent.dragStart(row)
    Object.defineProperties(dragStart, {
      clientX: { value: 10 },
      clientY: { value: 20 },
      dataTransfer: {
        value: {
          effectAllowed: 'uninitialized',
          setData: (type: string, value: string) => { written.set(type, value) },
        },
      },
    })
    fireEvent(row, dragStart)
    return written
  }

  it('宿主放宽白名单后非图片文件也可拖入 Canvas', async () => {
    const onCanvasDrag = vi.fn()
    render(
      <ComposeAssetBrowser
        canDragEntryToCanvas={(entry) => entry.name.endsWith('.page.json')}
        provider={referenceCapableProvider()}
        onCanvasDrag={onCanvasDrag}
      />,
    )
    const pagesRow = await getTreeRow(/Pages/)
    fireEvent.click(pagesRow)
    // 文件树默认不展开子目录。
    fireEvent.keyDown(pagesRow, { key: 'ArrowRight' })
    const pageRow = await getTreeRow(/Home\.page\.json/)
    fireEvent.click(pageRow)

    startDragOnTreeRow(pageRow)

    expect(onCanvasDrag).toHaveBeenCalledWith(expect.objectContaining({
      type: 'start',
      items: [expect.objectContaining({
        name: 'Home.page.json',
        mediaType: 'application/json',
        reference: expect.objectContaining({ assetKey: 'Pages/Home.page.json' }),
      })],
    }))
  })

  it('未被宿主接受的文件仍被排除', async () => {
    const onCanvasDrag = vi.fn()
    render(
      <ComposeAssetBrowser
        canDragEntryToCanvas={(entry) => entry.name.endsWith('.page.json')}
        provider={referenceCapableProvider()}
        onCanvasDrag={onCanvasDrag}
      />,
    )
    const logoRow = await getTreeRow(/logo\.svg/)
    fireEvent.click(logoRow)

    startDragOnTreeRow(logoRow)

    expect(onCanvasDrag).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'start' }))
  })

  it('稳定引用载荷在条目不可移动时同样写入', async () => {
    render(
      <ComposeAssetBrowser
        canDragEntryToCanvas={() => true}
        provider={referenceCapableProvider()}
      />,
    )
    // 资源根的直接子项 parentId 不为空但 logo 可移动；这里用不可移动的条目覆盖该分支。
    const logoRow = await getTreeRow(/logo\.svg/)
    fireEvent.click(logoRow)

    const written = startDragOnTreeRow(logoRow)

    const payload = written.get(COMPOSE_ASSET_REFERENCE_DRAG_MEDIA_TYPE)
    expect(payload).toBeDefined()
    const items = parseComposeAssetReferenceDragData(payload ?? '')
    expect(items).toHaveLength(1)
    expect(items[0]?.reference.assetKey).toBe('logo-key')
    // 两个载荷相互独立：内部移动 ID 仍然只包含可移动条目。
    expect(written.get('application/x-compose-asset-ids')).toBe('logo')
  })

  it('解析非法或版本不受支持的载荷时返回空结果', () => {
    expect(parseComposeAssetReferenceDragData('not json')).toEqual([])
    expect(parseComposeAssetReferenceDragData('{"version":2,"items":[]}')).toEqual([])
    expect(parseComposeAssetReferenceDragData('{"version":1,"items":[{"name":1}]}')).toEqual([])
  })
})

describe('OpenSpec: asset-browser / 空白区域右键菜单', () => {
  /** 在目录网格的空白区域触发右键。 */
  function openMenuOnBlankArea() {
    const content = document.querySelector('.asset-browser__content')
    if (!content) throw new Error('asset browser content area is missing')
    fireEvent.contextMenu(content, { clientX: 200, clientY: 200 })
    return screen.getByRole('menu')
  }

  it('目录网格空白区域可以打开菜单', async () => {
    render(<ComposeAssetBrowser provider={createProvider()} />)
    await getTreeRow(/logo\.svg/)

    const menu = openMenuOnBlankArea()

    expect(within(menu).getByRole('menuitem', { name: '新建文件' })).toBeEnabled()
    expect(within(menu).getByRole('menuitem', { name: '新建目录' })).toBeEnabled()
  })

  it('空白区域右键时重命名与删除禁用', async () => {
    render(<ComposeAssetBrowser provider={createProvider()} />)
    // 先选中一个条目，验证空白右键不会把菜单指向该选择。
    fireEvent.click(await getTreeRow(/logo\.svg/))

    const menu = openMenuOnBlankArea()

    expect(within(menu).getByRole('menuitem', { name: '重命名F2' }))
      .toHaveAttribute('aria-disabled', 'true')
    expect(within(menu).getByRole('menuitem', { name: '删除Delete' }))
      .toHaveAttribute('aria-disabled', 'true')
  })

  it('宿主项在空白区域得到不含命中条目的上下文', async () => {
    const onSelect = vi.fn()
    render(
      <ComposeAssetBrowser
        contextMenuItems={[{ id: 'host.blank', label: '检查', onSelect }]}
        provider={createProvider()}
      />,
    )
    await getTreeRow(/logo\.svg/)

    const menu = openMenuOnBlankArea()
    fireEvent.click(within(menu).getByRole('menuitem', { name: '检查' }))

    await waitFor(() => { expect(onSelect).toHaveBeenCalledTimes(1) })
    const context = onSelect.mock.calls[0][0]
    expect(context.entry).toBeUndefined()
    // 新建仍落在当前目录：资源根表达为 null。
    expect(context.parentId).toBeNull()
  })

  it('文件树空白区域同样可以打开菜单', async () => {
    render(<ComposeAssetBrowser provider={createProvider()} />)
    await getTreeRow(/logo\.svg/)

    const pane = document.querySelector('.asset-browser__tree-pane')
    if (!pane) throw new Error('tree pane is missing')
    fireEvent.contextMenu(pane, { clientX: 40, clientY: 300 })

    expect(within(screen.getByRole('menu')).getByRole('menuitem', { name: '新建文件' }))
      .toBeEnabled()
  })
})

describe('OpenSpec: asset-browser / 条目图标插槽', () => {
  it('宿主图标在文件树与目录网格双处生效，返回空结果时回退内建图标', async () => {
    render(
      <ComposeAssetBrowser
        provider={createProvider()}
        renderEntryIcon={({ entry, surface }) => entry.mediaType === 'application/json'
          ? <span data-testid={`icon-${surface}`}>P</span>
          : null}
      />,
    )
    const pagesRow = await getTreeRow(/Pages/)
    fireEvent.click(pagesRow)
    fireEvent.keyDown(pagesRow, { key: 'ArrowRight' })

    await waitFor(() => { expect(screen.getByTestId('icon-tree')).toBeInTheDocument() })
    expect(screen.getByTestId('icon-grid')).toBeInTheDocument()
    // 非页面条目回退到内建图标，不渲染宿主图标。
    expect(screen.queryAllByTestId('icon-tree')).toHaveLength(1)
  })
})

describe('OpenSpec: asset-browser / 条目名称插槽', () => {
  it('宿主可覆盖显示名，原始名称仍作为 title 保留', async () => {
    render(
      <ComposeAssetBrowser
        provider={createProvider()}
        renderEntryLabel={({ entry }) => entry.name.endsWith('.page.json')
          ? entry.name.replace('.page.json', '')
          : null}
      />,
    )
    const pagesRow = await getTreeRow(/Pages/)
    fireEvent.click(pagesRow)
    fireEvent.keyDown(pagesRow, { key: 'ArrowRight' })

    // 网格块显示覆盖后的名称，title 仍是原始名称，因此可读名与 title 分别取自两处。
    const label = await waitFor(() => {
      const found = document.querySelector('[title="Home.page.json"]')
      if (!found) throw new Error('page entry label is missing')
      return found
    })
    expect(label).toHaveTextContent('Home')
    expect(label.textContent).not.toContain('.page.json')
  })

  it('返回空结果时使用条目原始名称', async () => {
    render(<ComposeAssetBrowser provider={createProvider()} renderEntryLabel={() => null} />)
    expect(await getTreeRow(/logo\.svg/)).toBeTruthy()
  })
})

describe('OpenSpec: asset-browser / 条目名称转换', () => {
  it('重命名输入框只出现可编辑名，提交时还原存储名', async () => {
    const provider = createProvider({
      renameEntry: vi.fn(async ({ entryId, name }) => ({
        ...home,
        id: entryId,
        name,
      })),
    })
    render(
      <ComposeAssetBrowser
        entryNaming={{
          toEditableName: (entry) => entry.name.replace('.page.json', ''),
          toStoredName: (_entry, editable) => `${editable}.page.json`,
        }}
        provider={provider}
      />,
    )
    const pagesRow = await getTreeRow(/Pages/)
    fireEvent.click(pagesRow)
    fireEvent.keyDown(pagesRow, { key: 'ArrowRight' })
    const pageRow = await getTreeRow(/Home/)
    fireEvent.click(pageRow)

    fireEvent.keyDown(pageRow, { key: 'F2' })

    const input = await screen.findByLabelText('名称')
    // 输入框里没有存储后缀
    expect(input).toHaveValue('Home')
    fireEvent.change(input, { target: { value: 'Landing' } })
    fireEvent.click(screen.getByRole('button', { name: '重命名' }))

    await waitFor(() => {
      expect(provider.renameEntry).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Landing.page.json',
      }))
    })
  })

  it('未提供转换时重命名使用原始名称', async () => {
    const provider = createProvider({
      renameEntry: vi.fn(async ({ entryId, name }) => ({ ...logo, id: entryId, name })),
    })
    render(<ComposeAssetBrowser provider={provider} />)
    const row = await getTreeRow(/logo\.svg/)
    fireEvent.click(row)

    fireEvent.keyDown(row, { key: 'F2' })

    expect(await screen.findByLabelText('名称')).toHaveValue('logo.svg')
  })
})
