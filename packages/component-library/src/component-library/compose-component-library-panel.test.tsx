import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createComposeEntityRegistry } from '@compose-ui/component-registry'
import type { ComposeComponentStore } from '../component-store'
import type { ComposeComponentShelf } from './component-shelf'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as libraryApi from '../index'

interface PanelApi {
  readonly ComposeComponentLibraryPanel?: React.ComponentType<{
    readonly registry: ReturnType<typeof createComposeEntityRegistry>
    readonly store?: ComposeComponentStore
    readonly shelf?: ComposeComponentShelf
    readonly onCreateIntent?: (item: unknown) => void
    readonly onOpenIntent?: (descriptor: unknown) => void
    readonly onCreateVariantIntent?: (descriptor: unknown) => void
    readonly onItemDragStart?: (event: unknown) => void
    readonly onItemDragEnd?: (event: unknown) => void
    readonly onShelfChange?: (shelf: ComposeComponentShelf) => void
    readonly onCustomize?: () => void
    readonly onRevealFolder?: (folderPath: readonly string[]) => void
    readonly mode?: 'grid' | 'list'
    readonly onModeChange?: (mode: 'grid' | 'list') => void
  }>
}

const api = libraryApi as unknown as PanelApi

const registry = createComposeEntityRegistry({
  presets: [{
    id: 'container',
    label: '容器',
    createComponents: () => ({
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: 0, y: 0 },
        width: { mode: 'fixed', value: 100, min: 1, max: null },
        height: { mode: 'fixed', value: 100, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      Hierarchy: { childIds: [] },
    }),
  }],
})

function componentStore(): ComposeComponentStore {
  return {
    providerId: 'project',
    createReference: (assetKey) => ({
      kind: 'component',
      providerId: 'project',
      assetKey,
      scope: 'persistent',
    }),
    listComponents: vi.fn(async () => ({
      components: [
        {
          entryId: 'button',
          assetKey: 'button',
          displayName: 'Button',
          componentId: 'button',
          kind: 'base' as const,
          revision: '1',
          reference: { kind: 'component' as const, providerId: 'project', assetKey: 'button', scope: 'persistent' as const },
          folderPath: [] as readonly string[],
        },
        {
          entryId: 'danger',
          assetKey: 'danger',
          displayName: 'Button Danger',
          componentId: 'button-danger',
          kind: 'variant' as const,
          revision: '1',
          reference: { kind: 'component' as const, providerId: 'project', assetKey: 'danger', scope: 'persistent' as const },
          folderPath: [] as readonly string[],
        },
      ],
      issues: [],
      folders: [],
    })),
    readComponent: vi.fn(),
    createComponent: vi.fn(),
    saveComponent: vi.fn(),
    resolveComponent: vi.fn(),
    invalidate: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
    dispose: vi.fn(),
  }
}

describe('ComposeComponentLibraryPanel', () => {
  afterEach(cleanup)

  /** 一个没有任何组件、但有若干文件夹的目录：符号库第一次打开就是这一档。 */
  function emptyStore(): ComposeComponentStore {
    return {
      ...componentStore(),
      listComponents: vi.fn(async () => ({
        components: [],
        issues: [],
        folders: [['Symbols'], ['Symbols', 'dianciganying']] as readonly (readonly string[])[],
      })),
    }
  }

  const symbolShelf: ComposeComponentShelf = {
    title: '符号库',
    sections: [
      { kind: 'folder', id: 'symbols', folderPath: ['Symbols'], groupBy: 'subfolder' },
      { kind: 'folder', id: 'nested', folderPath: ['Symbols', 'dianciganying'] },
    ],
  }

  const EMPTY_HINT = /还没有导入成组件/

  it('OpenSpec: component-library / 货架整块为空时说明原因 / 一个组件都没有就给引导', async () => {
    const Panel = api.ComposeComponentLibraryPanel!
    render(<Panel registry={registry} shelf={symbolShelf} store={emptyStore()} />)
    await waitFor(() => {
      expect(screen.getByText(EMPTY_HINT)).toBeInTheDocument()
    })
    // 只说一次：九个段各写一遍是同一句话说九遍。
    expect(screen.getAllByText(EMPTY_HINT)).toHaveLength(1)
  })

  it('OpenSpec: component-library / 货架整块为空时说明原因 / 有一段有货就不出', async () => {
    const Panel = api.ComposeComponentLibraryPanel!
    /*
     * 判别性夹具：组件落在 `Symbols/dianciganying` 下，因此**其中一段**有货、另一段仍是 0。
     * 拿一份组件在根目录的 store 来测会让两段都是 0，得到的是上一条用例的结论。
     */
    const store: ComposeComponentStore = {
      ...componentStore(),
      listComponents: vi.fn(async () => ({
        components: [{
          entryId: 'transformer',
          assetKey: 'transformer',
          displayName: '变压器1',
          componentId: 'transformer',
          kind: 'base' as const,
          revision: '1',
          reference: {
            kind: 'component' as const,
            providerId: 'project',
            assetKey: 'transformer',
            scope: 'persistent' as const,
          },
          folderPath: ['Symbols', 'dianciganying'] as readonly string[],
        }],
        issues: [],
        folders: [['Symbols'], ['Symbols', 'dianciganying']] as readonly (readonly string[])[],
      })),
    }
    render(<Panel registry={registry} shelf={symbolShelf} store={store} />)
    // 两段都列它：`Symbols` 段含后代，`dianciganying` 段是它自己那一层。
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '添加主组件 变压器1' }).length)
        .toBeGreaterThan(0)
    })
    expect(screen.queryByText(EMPTY_HINT)).toBeNull()
  })

  it('OpenSpec: component-library / 货架整块为空时说明原因 / 只有一个文件夹段时不出', async () => {
    const Panel = api.ComposeComponentLibraryPanel!
    /*
     * 一行写着 `(0)` 说的是「这一格还没有东西」，用户读得懂；而这一档里下一步也不是「去资源
     * 里导入 .svg」——页面货架的「项目组件」是从画布上提取出来的。
     */
    render(
      <Panel
        registry={registry}
        shelf={{ sections: [
          { kind: 'folder', id: 'components', folderPath: [] },
          { kind: 'presets', id: 'basics' },
        ] }}
        store={emptyStore()}
      />,
    )
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /添加 容器/ })).toBeInTheDocument()
    })
    expect(screen.queryByText(EMPTY_HINT)).toBeNull()
  })

  it('OpenSpec: component-library / 货架整块为空时说明原因 / 搜索期间不出', async () => {
    const Panel = api.ComposeComponentLibraryPanel!
    render(<Panel registry={registry} shelf={symbolShelf} store={emptyStore()} />)
    await waitFor(() => {
      expect(screen.getByText(EMPTY_HINT)).toBeInTheDocument()
    })
    // 搜到 0 条与「还没导入」是两句话，下一步完全不同。
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '变压器' } })
    expect(screen.queryByText(EMPTY_HINT)).toBeNull()
  })

  it('OpenSpec: component-library / 混合组件目录 / 区分 Base 与 Variant', async () => {
    expect(api.ComposeComponentLibraryPanel).toBeTypeOf('function')
    const onCreateIntent = vi.fn()
    const Panel = api.ComposeComponentLibraryPanel!
    render(<Panel registry={registry} store={componentStore()} onCreateIntent={onCreateIntent} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '添加主组件 Button' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: '添加变体 Button Danger' })).toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: '添加主组件 Button' }))
      .getByTestId('component-library-base-icon')).toBeInTheDocument()
    expect(screen.getByTestId('component-library-variant-icon')).toBeInTheDocument()
    // 主组件实心、变体空心：test id 可区分。
    expect(screen.queryByTestId('component-library-instance-icon')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '添加主组件 Button' }))
    expect(onCreateIntent).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'component',
      descriptor: expect.objectContaining({ assetKey: 'button' }),
    }))
  })

  it('OpenSpec: component-library / 混合组件目录 / 按货架分段、搜索跨段、找不到的文件夹可去掉', async () => {
    const Panel = api.ComposeComponentLibraryPanel!
    render(
      <Panel
        registry={registry}
        shelf={{
          title: '符号库',
          sections: [
            { kind: 'folder', id: 'symbols', folderPath: ['Symbols'], groupBy: 'subfolder' },
            { kind: 'folder', id: 'components', folderPath: [] },
            { kind: 'presets', id: 'basics', collapsed: true },
          ],
        }}
        store={componentStore()}
      />,
    )
    // 标题就是面板的可访问名：标签上已经写着它，面板内部不再画第二遍。
    expect(screen.getByRole('region', { name: '符号库' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '项目组件 (2)' })).toBeInTheDocument()
    })
    // 折叠的段只剩标题，展开后瓦片出现。
    expect(screen.queryByRole('button', { name: '添加 容器' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '基础组件 (1)' }))
    expect(screen.getByRole('button', { name: '添加 容器' })).toBeInTheDocument()
    // 搜索跨段：段标题保留，不匹配的瓦片消失。
    fireEvent.change(screen.getByTestId('component-library-search'), { target: { value: 'danger' } })
    expect(screen.getByRole('heading', { name: '项目组件 (1)' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '添加主组件 Button' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '添加变体 Button Danger' })).toBeInTheDocument()
    fireEvent.change(screen.getByTestId('component-library-search'), { target: { value: '' } })
    // 引用的文件夹不在资源里：那一段说找不到并可去掉，其余段照常。
    expect(screen.getByRole('heading', { name: 'Symbols' })).toBeInTheDocument()
    expect(screen.getByText('找不到这个文件夹')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '去掉' }))
    expect(screen.queryByRole('heading', { name: 'Symbols' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '项目组件 (2)' })).toBeInTheDocument()
  })

  it('OpenSpec: component-library / 混合组件目录 / 无 Store 保持兼容', () => {
    const onCreateIntent = vi.fn()
    const Panel = api.ComposeComponentLibraryPanel!
    render(<Panel registry={registry} onCreateIntent={onCreateIntent} />)
    fireEvent.click(screen.getByRole('button', { name: '添加 容器' }))
    expect(onCreateIntent).toHaveBeenCalledWith({ kind: 'preset', presetId: 'container' })
    expect(screen.queryByText('项目组件')).not.toBeInTheDocument()
  })

  it('面板外松手的拖拽不吞掉下一次点击添加', () => {
    // 拖拽在画布上松手时 click 不会落在 tile 上，click 抑制标志曾滞留到下一次
    // 纯点击并把它静默吞掉——用户看到的是"拖入一个节点后再点添加没反应"。
    const onCreateIntent = vi.fn()
    const Panel = api.ComposeComponentLibraryPanel!
    render(
      <Panel
        registry={registry}
        onCreateIntent={onCreateIntent}
        onItemDragEnd={vi.fn()}
        onItemDragStart={vi.fn()}
      />,
    )
    const tile = screen.getByRole('button', { name: '添加 容器' })

    // 一次完整的拖出面板：按下 → 超过 4px 阈值 → 在面板外松手（无 click）。
    fireEvent.pointerDown(tile, { button: 0, pointerId: 7, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 60, clientY: 10 })
    fireEvent.pointerUp(window, { pointerId: 7, clientX: 400, clientY: 300 })
    expect(onCreateIntent).not.toHaveBeenCalled()

    // 随后的纯点击必须照常创建。
    fireEvent.pointerDown(tile, { button: 0, pointerId: 8, clientX: 10, clientY: 10 })
    fireEvent.pointerUp(window, { pointerId: 8, clientX: 10, clientY: 10 })
    fireEvent.click(tile)
    expect(onCreateIntent).toHaveBeenCalledWith({ kind: 'preset', presetId: 'container' })
  })

  it('OpenSpec: editor-workspace-layout / 组件独立标签 / 双击打开并从 Base 创建 Variant', async () => {
    const onOpenIntent = vi.fn()
    const onCreateVariantIntent = vi.fn()
    const Panel = api.ComposeComponentLibraryPanel!
    render(
      <Panel
        registry={registry}
        store={componentStore()}
        onOpenIntent={onOpenIntent}
        onCreateVariantIntent={onCreateVariantIntent}
      />,
    )

    const base = await screen.findByRole('button', { name: '添加主组件 Button' })
    fireEvent.doubleClick(base)
    expect(onOpenIntent).toHaveBeenCalledWith(expect.objectContaining({ assetKey: 'button' }))

    fireEvent.click(screen.getByRole('button', { name: '创建变体 Button' }))
    expect(onCreateVariantIntent).toHaveBeenCalledWith(expect.objectContaining({
      assetKey: 'button',
      kind: 'base',
    }))
  })
})

describe('OpenSpec: component-library / 自定义物料面板 / 瓦片右键', () => {
  // 这一组是上面那个 describe 的同级，因此要自己卸载——否则第二次 render 之后同名瓦片有两个。
  afterEach(cleanup)

  const shelf: ComposeComponentShelf = {
    sections: [
      { kind: 'presets', id: 'basics' },
      { kind: 'folder', id: 'components', folderPath: [] },
    ],
  }

  function renderPanel(overrides: Record<string, unknown> = {}) {
    const Panel = api.ComposeComponentLibraryPanel!
    const onShelfChange = vi.fn()
    const onCustomize = vi.fn()
    const onRevealFolder = vi.fn()
    render(
      <Panel
        onCustomize={onCustomize}
        onRevealFolder={onRevealFolder}
        onShelfChange={onShelfChange}
        registry={registry}
        shelf={shelf}
        store={componentStore()}
        {...overrides}
      />,
    )
    return { onCustomize, onRevealFolder, onShelfChange }
  }

  it('基础瓦片给「从面板隐藏」，写出的是其余 Preset 的清单', async () => {
    const { onShelfChange } = renderPanel()
    fireEvent.contextMenu(await screen.findByRole('button', { name: '添加 容器' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '从面板隐藏' }))
    // `include` 缺省表示「全部」，因此藏掉一个必须把其余的写出来。夹具只有 Container 一个
    // 可见 Preset，写出来的就是空清单——那正是「这一段什么都不列」。
    expect(onShelfChange).toHaveBeenCalledTimes(1)
    expect(onShelfChange.mock.calls[0]![0].sections[0]).toMatchObject({ id: 'basics', include: [] })
  })

  it('文件夹瓦片不给单个隐藏，只给整段的两件事', async () => {
    const { onRevealFolder } = renderPanel()
    fireEvent.contextMenu(await screen.findByRole('button', { name: '添加主组件 Button' }))
    // 单个隐藏会让「往这个文件夹里再导十个符号，它们自动出现」变成谎言。
    expect(screen.queryByRole('menuitem', { name: '从面板隐藏' })).not.toBeInTheDocument()
    expect(await screen.findByRole('menuitem', { name: '只看这一组' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: '在资源里打开此文件夹' }))
    expect(onRevealFolder).toHaveBeenCalledWith([])
  })

  it('「只看这一组」把货架收成只剩那一段', async () => {
    const { onShelfChange } = renderPanel()
    fireEvent.contextMenu(await screen.findByRole('button', { name: '添加主组件 Button' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '只看这一组' }))
    expect(onShelfChange.mock.calls[0]![0].sections.map((s: { id: string }) => s.id))
      .toEqual(['components'])
  })

  it('空白处只给自定义入口：那里没有可操作的目标', async () => {
    const { onCustomize } = renderPanel()
    fireEvent.contextMenu(screen.getByRole('region', { name: '组件库内容' }))
    expect(screen.queryByRole('menuitem', { name: '从面板隐藏' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: '只看这一组' })).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('menuitem', { name: '自定义物料面板…' }))
    expect(onCustomize).toHaveBeenCalledTimes(1)
  })

  it('宿主不给回调时整个菜单不出现：右键落回浏览器默认', async () => {
    const Panel = api.ComposeComponentLibraryPanel!
    render(<Panel registry={registry} shelf={shelf} store={componentStore()} />)
    fireEvent.contextMenu(await screen.findByRole('button', { name: '添加 容器' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  describe('OpenSpec: component-library / 物料面板的网格与列表两种排法', () => {
    const gridOf = () => screen.getByRole('region', { name: '组件库内容' })
      .querySelector('.compose-component-library__grid')

    it('默认是网格', async () => {
      const Panel = api.ComposeComponentLibraryPanel!
      render(<Panel registry={registry} />)
      await screen.findByRole('button', { name: '添加 容器' })
      expect(gridOf()).toHaveAttribute('data-mode', 'grid')
      expect(screen.getByTestId('component-library-mode-grid')).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByTestId('component-library-mode-list')).toHaveAttribute('aria-pressed', 'false')
    })

    it('不受控时点一下就换排法', async () => {
      const Panel = api.ComposeComponentLibraryPanel!
      render(<Panel registry={registry} />)
      fireEvent.click(await screen.findByTestId('component-library-mode-list'))
      expect(gridOf()).toHaveAttribute('data-mode', 'list')
    })

    it('受控时只上报，宿主不回传就不改变排法', async () => {
      const Panel = api.ComposeComponentLibraryPanel!
      const onModeChange = vi.fn()
      render(<Panel registry={registry} mode="grid" onModeChange={onModeChange} />)
      fireEvent.click(await screen.findByTestId('component-library-mode-list'))
      expect(onModeChange).toHaveBeenCalledWith('list')
      // 面板自己不持久化：宿主没回传，排法就还是网格。
      expect(gridOf()).toHaveAttribute('data-mode', 'grid')
    })

    it('网格里长名字不塌成同一个前缀：名字整串仍在 DOM 上', async () => {
      const Panel = api.ComposeComponentLibraryPanel!
      render(<Panel registry={registry} store={componentStore()} />)
      // 两个同前缀的项目组件在网格里各自留着完整名字，靠两行封顶排下去而不是截断成一个词。
      expect(await screen.findByText('Button')).toBeInTheDocument()
      expect(await screen.findByText('Button Danger')).toBeInTheDocument()
    })
  })
})
