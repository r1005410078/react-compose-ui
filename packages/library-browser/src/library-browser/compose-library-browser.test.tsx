import type {
  ComposeLibraryPort,
  ComposeLibraryRecord,
} from '@compose-ui/library'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComposeLibraryBrowser } from './compose-library-browser'

function record(overrides: Partial<ComposeLibraryRecord> = {}): ComposeLibraryRecord {
  return {
    pageKey: 'k1',
    title: 'PCS 详情',
    kind: 'project',
    categories: ['pcs'],
    thumbnailUrl: null,
    width: 1920,
    height: 1080,
    useCount: 34,
    deletedAt: null,
    createdAt: 1,
    modifiedAt: 1_700_000_000_000,
    ...overrides,
  }
}

const CATEGORIES = [
  { id: 'overview', label: '总览大屏' },
  { id: 'pcs', label: 'PCS' },
]

function createPort(overrides: Partial<ComposeLibraryPort> = {}): ComposeLibraryPort {
  const items = [
    record(),
    record({ pageKey: 'k2', title: '一次接线图', categories: ['overview'], useCount: 0 }),
  ]
  return {
    id: 'test',
    capabilities: {
      create: true,
      update: true,
      trash: true,
      purge: true,
      thumbnail: true,
      recents: true,
    },
    query: vi.fn(async ({ kind }) => ({
      items: kind === 'template' ? [record({ pageKey: 't1', title: 'PCS 标准画法' })] : items,
      nextCursor: null,
      facets: {
        byCategory: kind === 'template'
          ? [{ category: 'overview', count: 0 }, { category: 'pcs', count: 42 }, { category: null, count: 0 }]
          : [{ category: 'overview', count: 68 }, { category: 'pcs', count: 64 }, { category: null, count: 30 }],
        byLocation: { project: 418, template: 42, trash: 6 },
      },
    })),
    get: vi.fn(async () => items[0]!),
    listCategories: vi.fn(async () => CATEGORIES),
    instantiate: vi.fn(async ({ title }) => record({ pageKey: 'new', title })),
    ...overrides,
  }
}

afterEach(cleanup)

describe('OpenSpec: library-browser / 左栏是两段，不是一棵树', () => {
  it('两种选中可分：去处是导航，筛选是开关', async () => {
    render(<ComposeLibraryBrowser onOpenPage={vi.fn()} port={createPort()} />)
    await screen.findByRole('button', { name: '打开 PCS 详情' })

    const project = screen.getByRole('button', { name: /^项目/u })
    // 去处是**导航**：aria-current。它画一块实底。
    expect(project).toHaveAttribute('aria-current', 'page')
    expect(project).not.toHaveAttribute('aria-pressed')

    const pcs = screen.getByRole('button', { name: /^PCS\s*64$/u })
    // 筛选是**开关**：aria-pressed。它画左边一条竖条。
    // 两段的画法不同，背后就是这两种不同的语义——不是装饰。
    expect(pcs).toHaveAttribute('aria-pressed', 'false')
    expect(pcs).not.toHaveAttribute('aria-current')

    fireEvent.click(pcs)
    await waitFor(() => { expect(pcs).toHaveAttribute('aria-pressed', 'true') })
  })

  it('切到模板：下段仍是同一组场景类型，计数换成模板的', async () => {
    render(<ComposeLibraryBrowser onOpenPage={vi.fn()} port={createPort()} />)
    await screen.findByRole('button', { name: /^PCS\s*64$/u })

    fireEvent.click(screen.getByRole('button', { name: /^模板/u }))

    // 同一组场景类型还在，只是计数换了——树会把这八项在两棵子树下各渲染一遍。
    await screen.findByRole('button', { name: /^PCS\s*42$/u })
    expect(screen.getByRole('button', { name: /^总览大屏\s*0$/u })).toBeInTheDocument()
  })

  it('计数为 0 的场景类型仍然列出来', async () => {
    render(<ComposeLibraryBrowser onOpenPage={vi.fn()} port={createPort()} />)
    fireEvent.click(await screen.findByRole('button', { name: /^模板/u }))
    // 行随筛选出现又消失会让左栏在用户眼皮底下跳，而那一跳屏幕上没有东西解释。
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^总览大屏\s*0$/u })).toBeInTheDocument()
    })
  })

  it('上段不含「全部」这一行', async () => {
    render(<ComposeLibraryBrowser onOpenPage={vi.fn()} port={createPort()} />)
    await screen.findByRole('button', { name: /^项目/u })
    // 「全部」与上段的 418 是同一个数写两遍；没有筛选就是全部。
    expect(screen.queryByRole('button', { name: /^全部/u })).not.toBeInTheDocument()
  })
})

describe('OpenSpec: library-browser / 主区是图墙，卡上只放有区分度的东西', () => {
  it('没被用过的不写次数', async () => {
    render(<ComposeLibraryBrowser onOpenPage={vi.fn()} port={createPort()} />)
    await screen.findByText('一次接线图')

    const used = screen.getByText('PCS 详情').closest('li')!
    expect(within(used).getByText('34×')).toBeInTheDocument()

    const unused = screen.getByText('一次接线图').closest('li')!
    // 使用次数为 0 时不写：那一行的空缺本身也是信息。
    expect(within(unused).queryByText(/×$/u)).not.toBeInTheDocument()
  })

  it('尺寸与修改时间住在 hover 才显形的那一层里', async () => {
    const { container } = render(<ComposeLibraryBrowser onOpenPage={vi.fn()} port={createPort()} />)
    await screen.findByText('PCS 详情')

    const tile = screen.getByText('PCS 详情').closest('li')!
    const cap = tile.querySelector('.compose-library__tile-cap')!
    const veil = tile.querySelector('.compose-library__tile-veil')!
    // 常驻那一层只有名称与次数；尺寸在 veil 里，而 veil 静息是透明且不吃指针的。
    expect(cap.textContent).toContain('PCS 详情')
    expect(cap.textContent).not.toContain('1920')
    expect(veil.textContent).toContain('1920 × 1080')
    expect(container.querySelector('.compose-library__wall')).toBeInTheDocument()
  })

  it('图墙不给每张图再套一个带独立文字区的卡片', async () => {
    const { container } = render(<ComposeLibraryBrowser onOpenPage={vi.fn()} port={createPort()} />)
    await screen.findByText('PCS 详情')
    const tile = screen.getByText('PCS 详情').closest('li')!
    // 名称压在图的底边上（绝对定位在 tile 之内），而不是图下面另起一块。
    expect(tile.querySelector('.compose-library__tile-cap')).not.toBeNull()
    expect(container.querySelectorAll('.compose-library__tile').length).toBe(2)
  })

  it('打开一块图', async () => {
    const onOpenPage = vi.fn()
    render(<ComposeLibraryBrowser onOpenPage={onOpenPage} port={createPort()} />)
    fireEvent.click(await screen.findByRole('button', { name: '打开 PCS 详情' }))
    expect(onOpenPage).toHaveBeenCalledWith('k1')
  })
})

describe('OpenSpec: library-browser / 「就用这个」只问一个必须问的问题', () => {
  it('只要求名称一项', async () => {
    render(<ComposeLibraryBrowser onOpenPage={vi.fn()} port={createPort()} />)
    fireEvent.click(await screen.findByRole('button', { name: '以 PCS 详情 新建' }))

    const dialog = await screen.findByRole('dialog')
    // 客户就在旁边等着：分类、落点这些之后都能改，在这一步问它们只是让他多站几秒。
    expect(within(dialog).getAllByRole('textbox')).toHaveLength(1)
    expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('落地成功后直接打开新页面', async () => {
    const onOpenPage = vi.fn()
    const port = createPort()
    render(<ComposeLibraryBrowser onOpenPage={onOpenPage} port={port} />)
    fireEvent.click(await screen.findByRole('button', { name: '以 PCS 详情 新建' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '南山储能 PCS' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '新建' }))

    await waitFor(() => { expect(onOpenPage).toHaveBeenCalledWith('new') })
    expect(port.instantiate).toHaveBeenCalledWith({ sourcePageKey: 'k1', title: '南山储能 PCS' })
  })

  it('「新建页面」与它是同一个框，走端口自己的 create', async () => {
    const onOpenPage = vi.fn()
    const port = createPort({
      create: vi.fn(async ({ title }) => record({ pageKey: 'blank', title })),
    })
    render(<ComposeLibraryBrowser onOpenPage={onOpenPage} port={port} />)
    fireEvent.click(await screen.findByRole('button', { name: '新建页面' }))

    /*
     * 两条路各自要回答的都只有这一个问题（叫什么），分两个框写必然在焦点、回车与错误呈现上
     * 漂移。新建那一档没有底图，因此没有那块缩略图。
     */
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getAllByRole('textbox')).toHaveLength(1)
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '空白一张' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '新建' }))

    await waitFor(() => { expect(onOpenPage).toHaveBeenCalledWith('blank') })
    expect(port.create).toHaveBeenCalledWith({ title: '空白一张', kind: 'project' })
    expect(port.instantiate).not.toHaveBeenCalled()
  })

  it('端口不支持新建时不画那颗按钮', async () => {
    render(<ComposeLibraryBrowser onOpenPage={vi.fn()} port={createPort()} />)
    await screen.findByText('PCS 详情')
    // 宿主不必再接一个新建回调：新页面落进哪个文件夹是端口知道的事。
    expect(screen.queryByRole('button', { name: '新建页面' })).not.toBeInTheDocument()
  })

  it('端口不支持复制时不画那颗按钮', async () => {
    const port: ComposeLibraryPort = { ...createPort(), instantiate: undefined }
    render(<ComposeLibraryBrowser onOpenPage={vi.fn()} port={port} />)
    await screen.findByText('PCS 详情')
    // 一个按下去什么都不发生的按钮比没有更差。
    expect(screen.queryByRole('button', { name: /新建$/u })).not.toBeInTheDocument()
  })
})

describe('OpenSpec: library-browser / 全屏演示屏', () => {
  it('演示屏上没有内部信息，只有图、序号与一条控制条', async () => {
    render(
      <ComposeLibraryBrowser
        onOpenPage={vi.fn()}
        port={createPort()}
        renderPage={(item) => <div data-testid="live">{`真实渲染 ${item.title}`}</div>}
      />,
    )
    fireEvent.click(await screen.findByRole('button', { name: '演示' }))

    const demo = await screen.findByRole('dialog')
    // 真实渲染而不是缩略图：客户要凑近看数值与线宽。
    expect(within(demo).getByTestId('live')).toHaveTextContent('真实渲染 PCS 详情')
    // 位置只写序号与总数；分类、文件名与修改时间是我们自己的记账。
    expect(within(demo).getByText('方案 1 / 2')).toBeInTheDocument()
    expect(within(demo).queryByText(/1920/u)).not.toBeInTheDocument()
    expect(within(demo).queryByText('PCS')).not.toBeInTheDocument()
    expect(demo.querySelector('.compose-library__tile')).toBeNull()
  })

  it('左右翻页，Escape 退回页面库', async () => {
    render(
      <ComposeLibraryBrowser
        onOpenPage={vi.fn()}
        port={createPort()}
        renderPage={(item) => <div data-testid="live">{item.title}</div>}
      />,
    )
    fireEvent.click(await screen.findByRole('button', { name: '演示' }))
    await screen.findByText('方案 1 / 2')

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await screen.findByText('方案 2 / 2')
    // 翻到头绕回去：用户此刻正在客户面前连续按，死键没有任何好处。
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await screen.findByText('方案 1 / 2')

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => { expect(screen.queryByTestId('live')).not.toBeInTheDocument() })
  })

  it('演示屏与图墙的「就用这个」落到同一条路径', async () => {
    const onOpenPage = vi.fn()
    render(
      <ComposeLibraryBrowser
        onOpenPage={onOpenPage}
        port={createPort()}
        renderPage={(item) => <div data-testid="live">{item.title}</div>}
      />,
    )
    fireEvent.click(await screen.findByRole('button', { name: '演示' }))
    await screen.findByText('方案 1 / 2')

    fireEvent.click(screen.getByRole('button', { name: '就用这个' }))
    // 开的是同一个只问名称的框——两处各写一份迟早行为不同。
    const dialog = await screen.findByRole('dialog', { name: '以此新建页面' })
    fireEvent.click(within(dialog).getByRole('button', { name: '新建' }))
    await waitFor(() => { expect(onOpenPage).toHaveBeenCalledWith('new') })
  })

  it('宿主没接渲染器时不画演示入口', async () => {
    render(<ComposeLibraryBrowser onOpenPage={vi.fn()} port={createPort()} />)
    await screen.findByText('PCS 详情')
    expect(screen.queryByRole('button', { name: '演示' })).not.toBeInTheDocument()
  })
})

describe('OpenSpec: library-browser / 缩略图可以缺席', () => {
  it('没有缩略图时画占位而不是留空或报错', async () => {
    const { container } = render(<ComposeLibraryBrowser onOpenPage={vi.fn()} port={createPort()} />)
    await screen.findByText('PCS 详情')
    expect(container.querySelectorAll('.compose-library__tile-placeholder').length).toBe(2)
    expect(container.querySelector('.compose-library__tile-image')).toBeNull()
  })
})
