import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComposeUIProvider } from '@compose-ui/ui-context'
import type { ComposeWorkspaceDocumentSession, WorkspaceContent } from './workspace-context'
import type { ComposeWorkspaceSessionHandle } from './use-workspace-session'
import { DEFAULT_WORKSPACE_SEEDS } from './workspace-definition'
import { DEFAULT_TOOLS_WEIGHT } from './workspace-layout'
import { WorkspaceContentContext } from './workspace-context'
import { EditorTopBar, WorkspaceDocumentTabs, WorkspaceSwitcher } from './workspace-chrome'
import { WORKSPACE_PANEL_IDS } from './workspace-layout'

afterEach(cleanup)

function pageSession(panelId: string, displayName: string, dirty = false) {
  return { kind: 'page', panelId, displayName, dirty } as unknown as ComposeWorkspaceDocumentSession
}

/** 一个只有一个内建工作区的会话句柄替身。 */
function workspaceHandle(overrides: Partial<ComposeWorkspaceSessionHandle> = {}): ComposeWorkspaceSessionHandle {
  const page = { id: 'page', title: '页面', description: undefined, icon: undefined, modified: false, injected: true }
  return {
    items: [page],
    currentId: 'page',
    current: page,
    palette: undefined,
  toolbar: undefined,
  setToolbarShelf: () => {},
  setPaletteShelf: () => {},
    seeds: DEFAULT_WORKSPACE_SEEDS,
    toolsWeight: DEFAULT_TOOLS_WEIGHT,
    canvasOnly: false,
    dialog: null,
    switchTo: vi.fn(),
    next: vi.fn(),
    previous: vi.fn(),
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
    saveAs: vi.fn(),
    rename: vi.fn(),
    reset: vi.fn(),
    remove: vi.fn(),
    toggleCanvasOnly: vi.fn(),
    documentsRemembering: () => 0,
    fallbackFor: () => page,
    ...overrides,
  }
}

function fakeContent(overrides: Partial<WorkspaceContent>) {
  return {
    workspace: workspaceHandle(),
    documents: new Map(),
    activeDocumentPanelId: null,
    activateDocument: vi.fn(),
    requestDocumentClose: vi.fn(),
    stageHostPanelId: '',
    settingsOpen: false,
    settingsPanelId: 'settings',
    setSettingsButton: () => undefined,
    toggleSettings: vi.fn(),
    openCommandPanel: vi.fn(),
    sideCollapsed: { left: false, right: false, bottom: false },
    toggleSide: vi.fn(),
    ...overrides,
  } as unknown as WorkspaceContent
}

/** 顶栏上的文档标签条。 */
function renderTabs(overrides: Partial<WorkspaceContent>) {
  const content = fakeContent(overrides)
  render(
    <ComposeUIProvider locale="zh-CN">
      <WorkspaceContentContext.Provider value={content}>
        <WorkspaceDocumentTabs />
      </WorkspaceContentContext.Provider>
    </ComposeUIProvider>,
  )
  return content
}

/** 应用顶栏：标志 ▾ ｜ 文档标签条 ｜ 工作区 ｜ 三个布局开关。 */
function renderTopBar(overrides: Partial<WorkspaceContent> = {}) {
  const content = fakeContent(overrides)
  render(
    <ComposeUIProvider locale="zh-CN">
      <WorkspaceContentContext.Provider value={content}>
        <EditorTopBar />
      </WorkspaceContentContext.Provider>
    </ComposeUIProvider>,
  )
  return content
}

describe('WorkspaceDocumentTabs', () => {
  it('OpenSpec: editor-workspace-layout / 文档标签条 / 键盘在文档间移动', () => {
    const documents = new Map([
      ['a', pageSession('a', 'Home')],
      ['b', pageSession('b', 'Counter', true)],
      ['c', pageSession('c', 'Detail')],
    ])
    const content = renderTabs({ documents, activeDocumentPanelId: 'b' })
    const tablist = screen.getByRole('tablist', { name: '文档' })
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    // 只有活动标签在 Tab 序里。
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[1]).toHaveAttribute('tabindex', '0')
    expect(tabs[0]).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('img', { name: '有未保存改动' })).toBeInTheDocument()
    expect(tablist).toBeInTheDocument()

    fireEvent.keyDown(tabs[1]!, { key: 'ArrowRight' })
    expect(content.activateDocument).toHaveBeenLastCalledWith('c')
    fireEvent.keyDown(tabs[1]!, { key: 'ArrowLeft' })
    expect(content.activateDocument).toHaveBeenLastCalledWith('a')
    fireEvent.keyDown(tabs[1]!, { key: 'End' })
    expect(content.activateDocument).toHaveBeenLastCalledWith('c')
    fireEvent.keyDown(tabs[1]!, { key: 'Home' })
    expect(content.activateDocument).toHaveBeenLastCalledWith('a')
    // Delete 不关闭：关闭要走 dirty 确认流程。
    fireEvent.keyDown(tabs[1]!, { key: 'Delete' })
    expect(content.requestDocumentClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '关闭页面 Home' }))
    expect(content.requestDocumentClose).toHaveBeenCalledWith('a')
    expect(content.activateDocument).toHaveBeenCalledTimes(4)
  })

  it('OpenSpec: editor-workspace-layout / 文档标签条 / 未启用页面系统时固定画布是第一个标签', () => {
    const documents = new Map([['asset', { kind: 'asset', panelId: 'asset', readOnly: false, dirty: false, entry: { name: 'logo.svg' } } as unknown as ComposeWorkspaceDocumentSession]])
    const content = renderTabs({
      documents,
      activeDocumentPanelId: WORKSPACE_PANEL_IDS.canvas,
      stageHostPanelId: WORKSPACE_PANEL_IDS.canvas,
    })
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(2)
    expect(tabs[0]).toHaveAttribute('data-workspace-tab', WORKSPACE_PANEL_IDS.canvas)
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    // 固定画布没有关闭按钮。
    expect(screen.queryByRole('button', { name: /画布/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '关闭资源 logo.svg' })).toBeInTheDocument()
    fireEvent.click(tabs[1]!)
    expect(content.activateDocument).toHaveBeenCalledWith('asset')
  })

  it('OpenSpec: editor-workspace-layout / 动画编辑开关 / 标签行尾没有模式切换器', () => {
    /*
     * 「设计 / 动画」切换器已删：布局那一半归了工作区（时间线是面板），语义那一半归了时间线
     * chrome 上的开关。标签行只剩文档。
     */
    const documents = new Map([['b', pageSession('b', 'Counter', true)]])
    renderTabs({
      documents,
      activeDocumentPanelId: 'b',
      animationEditing: false,
      toggleAnimationEditing: vi.fn(),
      saveDocument: vi.fn(),
    })
    expect(screen.queryByRole('radiogroup', { name: '编辑模式' })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: '动画' })).not.toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / 进入层的呈现 / 层不占标签条且高亮停在来路', () => {
    const documents = new Map([
      ['page-a', pageSession('page-a', 'Home')],
      ['component-breaker', pageSession('component-breaker', 'Breaker')],
    ])
    /*
     * 当前文档 id 照旧指向层——只有条目列表与高亮改读来路。层没有关闭控件：离开一层的
     * 唯一出口是返回，而返回箭头与关闭按钮长得一样却含义不同。
     */
    renderTabs({
      documents,
      activeDocumentPanelId: 'component-breaker',
      entryLayerPanelIds: ['component-breaker'],
      entryOriginPanelId: 'page-a',
    })
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toHaveAttribute('data-workspace-tab', 'page-a')
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('button', { name: /Breaker/ })).not.toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / 进入层的呈现 / 没有层时高亮照旧跟着当前文档', () => {
    const documents = new Map([
      ['page-a', pageSession('page-a', 'Home')],
      ['component-breaker', pageSession('component-breaker', 'Breaker')],
    ])
    renderTabs({ documents, activeDocumentPanelId: 'component-breaker', entryLayerPanelIds: [] })
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(2)
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('OpenSpec: editor-workspace-layout / 文档标签条 / 标签条上没有顶栏那三段', () => {
    // 标签条只剩文档：布局开关、工作区与设置都搬到了应用顶栏。
    renderTabs({ documents: new Map([['a', pageSession('a', 'Home')]]), activeDocumentPanelId: 'a' })
    expect(screen.queryByRole('radiogroup', { name: '工作区' })).toBeNull()
    expect(screen.queryByRole('button', { name: '应用菜单' })).toBeNull()
    expect(screen.queryByRole('button', { name: /面板$/ })).toBeNull()
  })
})

describe('EditorTopBar', () => {
  it('OpenSpec: editor-workspace-layout / 应用标志与应用菜单 / 标志打开应用菜单', () => {
    const content = renderTopBar()
    const trigger = screen.getByRole('button', { name: '应用菜单' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    fireEvent.click(trigger)
    const menu = screen.getByRole('menu', { name: '应用菜单' })
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent))
      .toEqual(['设置', '命令面板'])
    fireEvent.click(screen.getByRole('menuitem', { name: '设置' }))
    expect(content.toggleSettings).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('OpenSpec: editor-workspace-layout / 应用标志与应用菜单 / 键盘可达', () => {
    const content = renderTopBar()
    const trigger = screen.getByRole('button', { name: '应用菜单' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const menu = screen.getByRole('menu', { name: '应用菜单' })
    fireEvent.click(within(menu).getByRole('menuitem', { name: '命令面板' }))
    expect(content.openCommandPanel).toHaveBeenCalledTimes(1)

    // Escape 关闭并把焦点还给标志。
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('menu', { name: '应用菜单' }), { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('OpenSpec: editor-workspace-layout / 应用顶栏 / 顶栏恰好四段', () => {
    renderTopBar({ documents: new Map([['a', pageSession('a', 'Home')]]), activeDocumentPanelId: 'a' })
    // 标志、文档标签条、工作区切换器、三个布局开关。
    expect(screen.getByRole('button', { name: '应用菜单' })).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: '文档' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(1)
    expect(screen.getByRole('radiogroup', { name: '工作区' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '收起左侧面板' })).toBeInTheDocument()
    // 保存按钮与模式切换器仍不在顶栏上：它们是文档作用域。
    expect(screen.queryByRole('button', { name: /保存/ })).toBeNull()
    expect(screen.queryByRole('radiogroup', { name: '编辑模式' })).toBeNull()
  })

  it('OpenSpec: editor-workspace-layout / 应用顶栏 / 页面库状态下没有工作区切换器', () => {
    /*
     * 那一屏没有画布，因而没有工作区；而标签条照常——它正是「我手上开着哪几张图」，
     * 去库里找下一张时最需要它。
     */
    renderTopBar({
      documents: new Map([['a', pageSession('a', 'Home')]]),
      activeDocumentPanelId: 'a',
      libraryOpen: true,
      openLibrary: vi.fn(),
    })
    expect(screen.queryByRole('radiogroup', { name: '工作区' })).toBeNull()
    expect(screen.getAllByRole('tab')).toHaveLength(1)
    expect(screen.getByRole('button', { name: '收起左侧面板' })).toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / 应用顶栏 / 标志是回页面库的门', () => {
    const openLibrary = vi.fn()
    renderTopBar({ openLibrary })
    /*
     * 接了页面库时标志与 `▾` 是两颗按钮：一颗按钮只能有一个动作。菜单仍在——回库不取代
     * 应用菜单，两者是顶栏最左这一段的两件事。
     */
    fireEvent.click(screen.getByRole('button', { name: '返回页面库' }))
    expect(openLibrary).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '应用菜单' }))
    expect(screen.getByRole('menu', { name: '应用菜单' })).toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / 应用顶栏 / 标志不是回库的唯一入口', () => {
    /*
     * 「货架不得成为任何能力的唯一入口」在这里的样子：一个 19px 的图形认不认得出是「回去」，
     * 取决于用户见没见过；菜单里那条带文字，读得出来。两条走的是同一个回调。
     */
    const openLibrary = vi.fn()
    renderTopBar({ openLibrary })
    fireEvent.click(screen.getByRole('button', { name: '应用菜单' }))
    const menu = screen.getByRole('menu', { name: '应用菜单' })
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent))
      .toEqual(['返回页面库', '设置', '命令面板'])
    fireEvent.click(within(menu).getByRole('menuitem', { name: '返回页面库' }))
    expect(openLibrary).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('OpenSpec: editor-workspace-layout / 应用顶栏 / 没接页面库时菜单里也没有那一条', () => {
    renderTopBar()
    fireEvent.click(screen.getByRole('button', { name: '应用菜单' }))
    expect(within(screen.getByRole('menu', { name: '应用菜单' })).getAllByRole('menuitem'))
      .toHaveLength(2)
  })

  it('OpenSpec: editor-workspace-layout / 应用顶栏 / 没接页面库时标志只是菜单把手', () => {
    // 拆成两颗会多出一颗按下去什么都不发生的按钮。
    renderTopBar()
    expect(screen.queryByRole('button', { name: '返回页面库' })).toBeNull()
    expect(screen.getByRole('button', { name: '应用菜单' })).toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / 顶栏布局开关 / 三颗常驻', () => {
    // 三颗都在，而且**两种状态都渲染**：只在其中一态出现的指示器无法让用户确认另一态。
    const content = renderTopBar({ sideCollapsed: { left: false, right: true, bottom: false } })
    const left = screen.getByRole('button', { name: '收起左侧面板' })
    const right = screen.getByRole('button', { name: '展开右侧面板' })
    const bottom = screen.getByRole('button', { name: '收起底部面板' })

    expect(left).toHaveAttribute('aria-pressed', 'true')
    expect(right).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(right)
    expect(content.toggleSide).toHaveBeenCalledWith('right')
    fireEvent.click(bottom)
    expect(content.toggleSide).toHaveBeenCalledWith('bottom')
  })

  it('OpenSpec: editor-workspace-layout / 文档标签条 / 标签条上没有保存按钮', () => {
    /*
     * 「改没改过」标签上已经画着脏点，同一个问题不该在两处回答；保存改由 `document.save`
     * 动作承担，因此这里断的是**没有**那颗按钮，而不是它变成了什么样子。
     */
    renderTabs({
      documents: new Map([['a', pageSession('a', 'Home', true)]]),
      activeDocumentPanelId: 'a',
    })
    expect(screen.queryByRole('button', { name: /保存/ })).toBeNull()
  })
})

describe('WorkspaceSwitcher', () => {
  const items = [
    { id: 'page', title: '页面', description: undefined, icon: undefined, modified: true, injected: true },
    { id: 'drawing', title: '绘图', description: '符号库拉高', icon: undefined, modified: false, injected: true },
    { id: 'custom-1', title: '变电站', description: undefined, icon: undefined, modified: false, injected: false },
  ]

  it('OpenSpec: editor-workspace-layout / 工作区切换 / 方向键按索引循环', () => {
    const switchTo = vi.fn()
    renderTopBar({ workspace: workspaceHandle({ items, current: items[2]!, currentId: 'custom-1', switchTo }) })
    const group = screen.getByRole('radiogroup', { name: '工作区' })
    const radios = screen.getAllByRole('radio').filter((radio) => group.contains(radio))
    expect(radios).toHaveLength(3)
    expect(radios[2]).toHaveAttribute('aria-checked', 'true')
    expect(radios[2]).toHaveAttribute('tabindex', '0')
    expect(radios[0]).toHaveAttribute('tabindex', '-1')
    // hover / focus 的提示说这个工作区会换的东西。
    expect(radios[1]).toHaveAttribute('title', '符号库拉高')
    expect(radios[0]).toHaveAttribute('title', '面板布局与画布默认值')
    // 修改点只在挪过面板的那一段上。
    expect(screen.getByRole('img', { name: '布局已改动' }).closest('[role="radio"]')).toBe(radios[0])

    fireEvent.keyDown(radios[2]!, { key: 'ArrowRight' })
    expect(switchTo).toHaveBeenLastCalledWith('page')
    fireEvent.keyDown(radios[2]!, { key: 'ArrowLeft' })
    expect(switchTo).toHaveBeenLastCalledWith('drawing')
    fireEvent.click(radios[1]!)
    expect(switchTo).toHaveBeenLastCalledWith('drawing')
  })

  it('OpenSpec: editor-workspace-layout / 工作区管理 / 内建不可删', () => {
    const openDialog = vi.fn()
    const reset = vi.fn()
    renderTopBar({ workspace: workspaceHandle({ items, current: items[0]!, currentId: 'page', openDialog, reset }) })
    fireEvent.click(screen.getByRole('button', { name: '管理工作区' }))
    const menu = screen.getByRole('menu', { name: '管理工作区' })
    expect(menu).toBeInTheDocument()
    const remove = screen.getByRole('menuitem', { name: '删除（内建）' })
    expect(remove).toHaveAttribute('aria-disabled', 'true')
    expect(remove).toHaveAttribute('title', '内建工作区不可删除或重命名')
    fireEvent.click(remove)
    expect(openDialog).not.toHaveBeenCalled()
    expect(screen.getByRole('menuitem', { name: '重命名…（内建）' })).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(screen.getByRole('menuitem', { name: '重置' }))
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('OpenSpec: editor-workspace-layout / 工作区管理 / 焦点在触发器上时 Escape 也关得掉菜单', () => {
    renderTopBar({ workspace: workspaceHandle({ items, current: items[0]!, currentId: 'page' }) })
    const trigger = screen.getByRole('button', { name: '管理工作区' })
    fireEvent.click(trigger)
    // 打开即把焦点送进菜单，不等动画帧——用户用鼠标点开、随手按 Escape 时它必须已经在里面。
    expect(screen.getByRole('menuitem', { name: '另存为工作区…' })).toHaveFocus()

    /*
     * 判别性：把焦点**放回触发按钮**再按 Escape。那是这个 Pattern 的合法状态（`close()` 正是
     * 把焦点还给它的），而按钮不在菜单元素里——处理器挂在菜单自己身上时这一下收不到，菜单
     * 关不掉。只断「打开之后按 Escape 能关」在那个实现上同样会绿。
     */
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.queryByRole('menu', { name: '管理工作区' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('OpenSpec: editor-workspace-layout / 工作区管理 / 焦点在菜单项上时 Escape 关闭并还回焦点', () => {
    renderTopBar({ workspace: workspaceHandle({ items, current: items[0]!, currentId: 'page' }) })
    const trigger = screen.getByRole('button', { name: '管理工作区' })
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('menuitem', { name: '另存为工作区…' }), { key: 'Escape' })
    expect(screen.queryByRole('menu', { name: '管理工作区' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('OpenSpec: editor-workspace-layout / 工作区管理 / 自定义工作区的菜单项都可用', () => {
    const openDialog = vi.fn()
    const toggleCanvasOnly = vi.fn()
    renderTopBar({ workspace: workspaceHandle({ items, current: items[2]!, currentId: 'custom-1', openDialog, toggleCanvasOnly }) })
    fireEvent.click(screen.getByRole('button', { name: '管理工作区' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '另存为工作区…' }))
    expect(openDialog).toHaveBeenLastCalledWith('saveAs')
    fireEvent.click(screen.getByRole('button', { name: '管理工作区' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '删除' }))
    expect(openDialog).toHaveBeenLastCalledWith('delete')
    fireEvent.click(screen.getByRole('button', { name: '管理工作区' }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: '只看画布' }))
    expect(toggleCanvasOnly).toHaveBeenCalledTimes(1)
  })

  it('OpenSpec: editor-workspace-layout / 工作区切换 / 加号复制当前工作区', () => {
    const openDialog = vi.fn()
    renderTopBar({ workspace: workspaceHandle({ items, current: items[0]!, currentId: 'page', openDialog }) })
    /*
     * `＋` 与管理菜单的「另存为」是同一条流程的两个入口——断的就是这一点：它派发的是同一个
     * dialog，而不是自己另开一条。
     */
    fireEvent.click(screen.getByRole('button', { name: '新建工作区' }))
    expect(openDialog).toHaveBeenLastCalledWith('saveAs')
    // 它在 radiogroup 之外：方向键序列里只有三个工作区。
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('OpenSpec: editor-workspace-layout / 工作区切换 / 切换器不是标签', () => {
    renderTopBar({ workspace: workspaceHandle({ items, current: items[0]!, currentId: 'page' }) })
    // 切换器是 radiogroup 而不是 tablist：它的形状是一组 pill，语义跟着形状走。
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(screen.getByRole('radiogroup', { name: '工作区' })).toBeInTheDocument()
    render(
      <ComposeUIProvider locale="zh-CN">
        <WorkspaceContentContext.Provider value={{ workspace: workspaceHandle({ items, current: items[0]!, currentId: 'page' }) } as unknown as WorkspaceContent}>
          <WorkspaceSwitcher />
        </WorkspaceContentContext.Provider>
      </ComposeUIProvider>,
    )
    expect(screen.getAllByRole('radiogroup', { name: '工作区' })).toHaveLength(2)
  })
})
