import {
  createComposeAnimationCommandHandlers,
  createComposeAnimationFile,
  serializeComposeAnimationFile,
  setComposeAnimationFileFrame,
} from '@compose-ui/animation'
import type { ComposeAssetEntry, ComposeAssetProvider } from '@compose-ui/assets'
import { ComposeAssetError } from '@compose-ui/assets'
import {
  BUILTIN_COMMAND_TYPES,
  COMPOSE_PAGE_MEDIA_TYPE,
  createEmptyComposePageFile,
  serializeComposePageFile,
} from '@compose-ui/core'
import type {
  ComposeLoadedScriptModule,
  ComposePageSetup,
  ComposeScriptModuleLoader,
} from '@compose-ui/script-runtime'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComposeEditorController } from '../editor-controller'

// dockviewMock 代表内层 scene/canvas/inspector Dockview（页面/资源文档都挂在这个实例上）；
// 外层只有 core 面板 + bottom Edge Group，本文件不关心它的结构，两个 init 函数都整体 mock 掉。
const initializeCoreWorkspaceMock = vi.hoisted(() => vi.fn())
const initializeOuterWorkspaceMock = vi.hoisted(() => vi.fn())
/**
 * 外层 Dockview 替身：initializeOuterWorkspace 被 mock，因此初始没有任何面板；
 * 只实现模式切换器需要的 bottom Edge Group 与面板增删，供动画模式重组断言。
 */
const outerDockviewMock = vi.hoisted(() => {
  interface OuterFakePanel {
    id: string
    api: { id: string; isActive: boolean; setActive: () => void; setTitle: ReturnType<typeof vi.fn> }
  }
  const panels = new Map<string, OuterFakePanel>()
  let collapsed = true
  const bottomGroup = {
    id: 'compose-bottom-edge',
    isCollapsed: () => collapsed,
    expand: vi.fn(() => { collapsed = false }),
    collapse: vi.fn(() => { collapsed = true }),
  }
  const api = {
    getEdgeGroup: vi.fn((position: string) => (position === 'bottom' ? bottomGroup : undefined)),
    getPanel: vi.fn((id: string) => panels.get(id)),
    addPanel: vi.fn((options: { id: string }) => {
      const panel: OuterFakePanel = {
        id: options.id,
        api: {
          id: options.id,
          isActive: false,
          setActive: () => {
            panels.forEach((item) => { item.api.isActive = item.id === options.id })
          },
          setTitle: vi.fn(),
        },
      }
      panels.set(options.id, panel)
      return panel
    }),
    removePanel: vi.fn((panel: { id: string }) => { panels.delete(panel.id) }),
    onDidActivePanelChange: vi.fn(() => ({ dispose: () => undefined })),
  }
  return {
    api,
    panels,
    bottomGroup,
    get collapsed() { return collapsed },
    reset() {
      panels.clear()
      collapsed = true
      bottomGroup.expand.mockClear()
      bottomGroup.collapse.mockClear()
      api.addPanel.mockClear()
      api.removePanel.mockClear()
    },
  }
})
const assetPreviewPropsMock = vi.hoisted(() => vi.fn())

/**
 * 记录已创建面板并支持切换活动面板的 Dockview 替身。
 *
 * @remarks
 * 页面工作区的行为完全依赖面板 ID 与活动面板事件，因此替身必须把 `api.id` 传给面板组件，
 * 并能触发 `onDidActivePanelChange`。
 */
const dockviewMock = vi.hoisted(() => {
  interface FakePanel {
    id: string
    component: string
    title: string
    api: {
      id: string
      title: string
      isActive: boolean
      close: ReturnType<typeof vi.fn>
      setActive: () => void
      setTitle: ReturnType<typeof vi.fn>
    }
  }
  const panels = new Map<string, FakePanel>()
  const activeListeners = new Set<(change: { panel: FakePanel | undefined }) => void>()
  let activeId: string | null = null
  const setActive = (id: string) => {
    activeId = id
    panels.forEach((panel) => { panel.api.isActive = panel.id === id })
    activeListeners.forEach((listener) => { listener({ panel: panels.get(id) }) })
  }
  return {
    panels,
    reset() {
      panels.clear()
      activeListeners.clear()
      activeId = null
    },
    activate: setActive,
    get activeId() { return activeId },
    api: {
      addPanel: vi.fn((options: { id: string; component: string; title: string }) => {
        const panel: FakePanel = {
          id: options.id,
          component: options.component,
          title: options.title,
          api: {
            id: options.id,
            title: options.title,
            isActive: false,
            close: vi.fn(() => { panels.delete(options.id) }),
            setActive: () => setActive(options.id),
            setTitle: vi.fn(),
          },
        }
        panels.set(options.id, panel)
        setActive(options.id)
        return panel
      }),
      getPanel: vi.fn((id: string) => panels.get(id)),
      onDidActivePanelChange: (listener: (change: { panel: FakePanel | undefined }) => void) => {
        activeListeners.add(listener)
        return { dispose: () => activeListeners.delete(listener) }
      },
    },
  }
})

vi.mock('../workspace-layout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../workspace-layout')>()
  return {
    ...actual,
    initializeCoreWorkspace: initializeCoreWorkspaceMock,
    initializeOuterWorkspace: initializeOuterWorkspaceMock,
  }
})

vi.mock('dockview-react', async () => {
  const React = await import('react')
  return {
    themeAbyss: { name: 'abyss', className: 'dockview-theme-abyss' },
    DockviewDefaultTab: () => null,
    DockviewReact: ({ className, components, tabComponents, onReady }: {
      className?: string
      components: Record<string, React.FunctionComponent<{ api?: unknown }>>
      tabComponents?: Record<string, React.FunctionComponent<{ api?: unknown }>>
      onReady: (event: { api: unknown }) => void
    }) => {
      const nested = className === 'compose-editor__scene-history-dockview'
      // 页面/资源文档都挂在内层 core Dockview 上（initializedApi.current 由它的 onReady 设置），
      // 外层只是宿主，用一个静态假 api 打发 handleOuterReady 的幂等判断即可。
      const isCore = className === 'compose-editor__core-dockview'
      const [, force] = React.useState(0)
      React.useEffect(() => {
        if (nested) return
        onReady({ api: isCore ? dockviewMock.api : outerDockviewMock.api })
        if (!isCore) return
        // 面板集合的变化不经过 React，测试里靠订阅活动面板变化触发重渲染。
        const subscription = dockviewMock.api.onDidActivePanelChange(() => { force((n) => n + 1) })
        return () => { subscription.dispose() }
      }, [isCore, nested, onReady])
      if (nested) return React.createElement('div', { 'data-testid': 'scene-history-dockview' })
      if (!isCore) {
        // 外层只有 core 宿主面板 + bottom Edge Group 的四个工具标签，静态渲染一次即可。
        return React.createElement(
          'div',
          { 'data-testid': 'dockview' },
          Object.entries(components).map(([name, Component]) =>
            React.createElement(Component, { key: `static-${name}` })),
        )
      }
      const Tab = tabComponents?.workspaceTab
      return React.createElement(
        'div',
        { 'data-testid': 'core-dockview' },
        // initializeCoreWorkspace 被 mock，因此基础面板不会进入面板表；固定面板（资源浏览器等）
        // 无条件渲染一次，动态面板另外按其 api 渲染。
        Object.entries(components).map(([name, Component]) =>
          React.createElement(Component, { key: `static-${name}` })),
        [...dockviewMock.panels.values()].map((panel) => React.createElement(
          'div',
          { key: panel.id, 'data-panel-id': panel.id },
          Tab ? React.createElement(Tab, { api: panel.api }) : null,
          React.createElement(
            components[panel.component] ?? (() => null),
            { api: panel.api },
          ),
        )),
      )
    },
  }
})

vi.mock('@compose-ui/asset-browser', async () => {
  const React = await import('react')
  return {
    // 双击与右键行为由 asset-browser 自己的测试覆盖；这里只暴露宿主回调入口。
    ComposeAssetBrowser: ({ contextMenuItems, onAssetOpen, onBeforeAssetMutation, renderEntryBadge }: {
      contextMenuItems?: readonly {
        id: string
        label: string
        isVisible?: (context: unknown) => boolean
        isDisabled?: (context: unknown) => boolean
        onSelect: (context: unknown) => void | Promise<void>
      }[]
      onAssetOpen?: (entry: ComposeAssetEntry) => void
      onBeforeAssetMutation?: (mutation: unknown) => boolean | Promise<boolean>
      renderEntryBadge?: (context: {
        entry: ComposeAssetEntry
        surface: 'tree' | 'grid'
        selected: boolean
        expanded: boolean
      }) => React.ReactNode
    }) => React.createElement(
      'div',
      { 'data-testid': 'asset-browser' },
      // 标记插槽在树与网格双处调用；这里各调一次以覆盖两个表面。
      (['tree', 'grid'] as const).map((surface) => React.createElement(
        'div',
        { key: surface, 'data-testid': `badge-host-${surface}` },
        renderEntryBadge?.({ entry: pageEntry, surface, selected: false, expanded: false }),
      )),
      React.createElement('button', {
        type: 'button',
        onClick: () => { void onBeforeAssetMutation?.({ type: 'delete', entries: [pageEntry] }) },
      }, 'delete-page'),
      React.createElement('button', {
        type: 'button',
        onClick: () => onAssetOpen?.(pageEntry),
      }, 'open-page'),
      React.createElement('button', {
        type: 'button',
        onClick: () => onAssetOpen?.(scriptEntry),
      }, 'open-script'),
      React.createElement('button', {
        type: 'button',
        onClick: () => onAssetOpen?.(setupScriptEntry),
      }, 'open-setup'),
      (contextMenuItems ?? [])
        .filter((item) => item.isVisible?.(menuContext) !== false)
        .map((item) => React.createElement('button', {
          key: item.id,
          type: 'button',
          disabled: item.isDisabled?.(menuContext) === true,
          onClick: () => { void item.onSelect(menuContext) },
        }, item.label)),
    ),
    ComposeAssetPreview: (props: unknown) => {
      assetPreviewPropsMock(props)
      return React.createElement('div', { 'data-testid': 'asset-preview' })
    },
  }
})

const { ComposeEditor } = await import('../compose-editor')
const { PageInspector } = await import('../inspector')

const pageText = serializeComposePageFile(createEmptyComposePageFile())

const root: ComposeAssetEntry = { id: 'root', parentId: null, name: 'Assets', kind: 'folder' }
const pageEntry: ComposeAssetEntry = {
  id: 'home',
  parentId: 'root',
  name: 'Home.page.json',
  kind: 'file',
  mediaType: COMPOSE_PAGE_MEDIA_TYPE,
  revision: '1',
  assetKey: 'Home.page.json',
}
const scriptEntry: ComposeAssetEntry = {
  id: 'script',
  parentId: 'root',
  name: 'dashboard.ts',
  kind: 'file',
  mediaType: 'text/typescript',
  revision: '1',
  assetKey: 'dashboard.ts',
}
const setupScriptEntry: ComposeAssetEntry = {
  id: 'setup-script',
  parentId: 'root',
  name: 'Counter.setup.js',
  kind: 'file',
  mediaType: 'text/javascript',
  revision: '1',
  assetKey: 'Counter.setup.js',
}
const manifestEntry: ComposeAssetEntry = {
  id: 'app.json',
  parentId: 'root',
  name: 'app.json',
  kind: 'file',
  mediaType: 'application/json',
  revision: '1',
  assetKey: 'app.json',
}
const menuContext = {
  entry: pageEntry,
  entries: [pageEntry],
  parentId: null,
  promptName: async () => 'Detail',
  refresh: () => undefined,
}

function createProvider(overrides: Partial<ComposeAssetProvider> = {}): ComposeAssetProvider {
  const files = new Map<string, string>([['Home.page.json', pageText]])
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
      reference: true,
    },
    list: vi.fn(async ({ folderId }) => folderId === 'root' ? [pageEntry, scriptEntry] : []),
    read: vi.fn(async ({ fileId }) => ({
      blob: new Blob([files.get(fileId === 'home' ? 'Home.page.json' : fileId) ?? '{}']),
      revision: '1',
    })),
    createFile: vi.fn(async ({ parentId, name }) => ({
      id: `created-${name}`,
      parentId,
      name,
      kind: 'file' as const,
      assetKey: name,
      revision: '1',
    })),
    writeFile: vi.fn(async ({ fileId }) => ({ ...pageEntry, id: fileId, revision: '2' })),
    ...overrides,
  }
}

function renderEditor(provider: ComposeAssetProvider, onActiveSessionChange = vi.fn()) {
  render(
    <ComposeEditor
      assets={{ browser: { provider } }}
      pages={{ onActiveSessionChange }}
    />,
  )
  return { onActiveSessionChange }
}

/** 取最近一次活动页面回调的参数；本包 lib target 不含 Array.prototype.at。 */
function lastSession(spy: ReturnType<typeof vi.fn>) {
  const calls = spy.mock.calls
  return calls.length === 0 ? undefined : calls[calls.length - 1]?.[0]
}

function pageDocumentPanels() {
  return [...dockviewMock.panels.values()].filter((panel) => panel.component === 'pageDocument')
}

beforeEach(() => {
  dockviewMock.reset()
  dockviewMock.api.addPanel.mockClear()
  outerDockviewMock.reset()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('OpenSpec: editor-workspace-layout / 页面文档标签与按页面事务运行时', () => {
  it('页面文件打开为页面标签而不是资源标签', async () => {
    renderEditor(createProvider())

    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))

    await waitFor(() => { expect(pageDocumentPanels()).toHaveLength(1) })
    expect(pageDocumentPanels()[0]?.title).toBe('Home')
    expect([...dockviewMock.panels.values()].some((p) => p.component === 'assetDocument'))
      .toBe(false)
  })

  it('非页面文件仍打开为资源标签', async () => {
    renderEditor(createProvider())

    fireEvent.click(screen.getByRole('button', { name: 'open-script' }))

    await waitFor(() => {
      expect([...dockviewMock.panels.values()].some((p) => p.component === 'assetDocument'))
        .toBe(true)
    })
    expect(pageDocumentPanels()).toHaveLength(0)
  })

  it('页面能力启用时只为 *.setup.js 资源会话注入 Setup Profile', async () => {
    renderEditor(createProvider())

    fireEvent.click(screen.getByRole('button', { name: 'open-script' }))
    await waitFor(() => {
      expect(assetPreviewPropsMock).toHaveBeenCalledWith(expect.objectContaining({
        entry: expect.objectContaining({ name: 'dashboard.ts' }),
        scriptIntelligence: undefined,
      }))
    })

    fireEvent.click(screen.getByRole('button', { name: 'open-setup' }))
    await waitFor(() => {
      expect(assetPreviewPropsMock).toHaveBeenCalledWith(expect.objectContaining({
        entry: expect.objectContaining({ name: 'Counter.setup.js' }),
        scriptIntelligence: expect.objectContaining({ id: 'compose-page-setup' }),
      }))
    })
    fireEvent.click(screen.getByRole('button', { name: 'open-setup' }))
    expect([...dockviewMock.panels.values()]
      .filter(({ title }) => title === 'Counter.setup.js')).toHaveLength(1)
  })

  it('页面能力未启用时 setup 文件保持普通 JavaScript 会话', async () => {
    render(<ComposeEditor assets={{ browser: { provider: createProvider() } }} />)

    fireEvent.click(screen.getByRole('button', { name: 'open-setup' }))
    await waitFor(() => {
      expect(assetPreviewPropsMock).toHaveBeenCalledWith(expect.objectContaining({
        entry: expect.objectContaining({ name: 'Counter.setup.js' }),
        scriptIntelligence: undefined,
      }))
    })
  })

  it('重复打开同一页面激活既有标签而不新建运行时', async () => {
    const { onActiveSessionChange } = renderEditor(createProvider())
    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))
    await waitFor(() => { expect(pageDocumentPanels()).toHaveLength(1) })
    const firstRuntime = lastSession(onActiveSessionChange)?.runtime

    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))

    await waitFor(() => { expect(pageDocumentPanels()).toHaveLength(1) })
    const latestRuntime = lastSession(onActiveSessionChange)?.runtime
    expect(latestRuntime).toBe(firstRuntime)
  })

  it('活动页面的运行时回传给宿主', async () => {
    const { onActiveSessionChange } = renderEditor(createProvider())

    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))

    await waitFor(() => {
      expect(onActiveSessionChange).toHaveBeenCalledWith(expect.objectContaining({
        pageKey: 'Home.page.json',
        displayName: 'Home',
      }))
    })
    const session = lastSession(onActiveSessionChange)
    expect(session?.runtime.document.schemaVersion).toBe(7)
  })
})

describe('OpenSpec: editor-workspace-layout / 设计与动画模式切换器', () => {
  it('切到动画加入并激活时间线面板且展开底部组；切回设计移除面板并恢复折叠', async () => {
    renderEditor(createProvider())
    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))
    await waitFor(() => { expect(pageDocumentPanels()).toHaveLength(1) })

    const designRadio = screen.getByRole('radio', { name: '设计' })
    expect(designRadio).toHaveAttribute('aria-checked', 'true')
    expect(outerDockviewMock.panels.has('compose-animation')).toBe(false)

    fireEvent.click(screen.getByRole('radio', { name: '动画' }))
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: '动画' })).toHaveAttribute('aria-checked', 'true')
    })
    expect(outerDockviewMock.api.addPanel).toHaveBeenCalledWith(expect.objectContaining({
      id: 'compose-animation',
      position: { referenceGroup: 'compose-bottom-edge' },
    }))
    expect(outerDockviewMock.bottomGroup.expand).toHaveBeenCalledTimes(1)
    expect(outerDockviewMock.panels.get('compose-animation')?.api.isActive).toBe(true)

    fireEvent.click(screen.getByRole('radio', { name: '设计' }))
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: '设计' })).toHaveAttribute('aria-checked', 'true')
    })
    expect(outerDockviewMock.api.removePanel).toHaveBeenCalledTimes(1)
    expect(outerDockviewMock.panels.has('compose-animation')).toBe(false)
    // 进入动画模式前底部处于折叠状态：切换器退出后恢复折叠。
    expect(outerDockviewMock.bottomGroup.collapse).toHaveBeenCalledTimes(1)
  })
})

describe('OpenSpec: pages / 页面动画关联写入 / 编辑器水合与回写', () => {
  const animationEntry: ComposeAssetEntry = {
    id: 'home-animation',
    parentId: 'root',
    name: 'Home.animation.json',
    kind: 'file',
    revision: 'a1',
    assetKey: 'Home.animation.json',
  }
  const animationFileText = serializeComposeAnimationFile(
    createComposeAnimationFile('frame-root', {
      id: 'intro',
      name: '入场',
      durationMs: 500,
      playbackMode: 'loop',
    }),
  )
  // v7 的动画绑定挂在 Frame 的 Animations.source 上。
  const boundPageText = (() => {
    const page = createEmptyComposePageFile()
    const frameId = page.document.rootIds[0]!
    const frame = page.document.entities[frameId]!
    return serializeComposePageFile({
      ...page,
      document: {
        ...page.document,
        entities: {
          ...page.document.entities,
          [frameId]: {
            ...frame,
            components: {
              ...frame.components,
              Animations: {
                items: [],
                source: {
                  providerId: 'memory',
                  assetKey: 'Home.animation.json',
                  scope: 'persistent',
                },
              },
            },
          },
        },
      },
    })
  })()

  function createBoundProvider(overrides: Partial<ComposeAssetProvider> = {}) {
    return createProvider({
      list: vi.fn(async ({ folderId }) =>
        folderId === 'root' ? [pageEntry, scriptEntry, animationEntry] : []),
      read: vi.fn(async ({ fileId }) => fileId === 'home-animation'
        ? { blob: new Blob([animationFileText]), revision: 'a1' }
        : { blob: new Blob([boundPageText]), revision: '1' }),
      ...overrides,
    })
  }

  it('打开页面时把绑定动画文件的清单水合进文档镜像', async () => {
    const { onActiveSessionChange } = renderEditor(createBoundProvider())
    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))
    await waitFor(() => { expect(pageDocumentPanels()).toHaveLength(1) })
    const session = lastSession(onActiveSessionChange)
    // 清单归属 Frame：水合写进默认 Frame 的 Animations.items。
    const frameId = session.runtime.document.rootIds[0]!
    const animations = session.runtime.document.entities[frameId]?.components.Animations as
      { items?: readonly unknown[] } | undefined
    expect(animations?.items).toEqual([
      expect.objectContaining({ id: 'intro', name: '入场', durationMs: 500, playbackMode: 'loop' }),
    ])
  })

  it('动画文件加载失败时保留页面内嵌镜像并照常打开', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const provider = createBoundProvider({
      read: vi.fn(async ({ fileId }) => {
        if (fileId === 'home-animation') throw new ComposeAssetError('not-found', 'missing')
        return { blob: new Blob([boundPageText]), revision: '1' }
      }),
    })
    const { onActiveSessionChange } = renderEditor(provider)
    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))
    await waitFor(() => { expect(pageDocumentPanels()).toHaveLength(1) })
    const session = lastSession(onActiveSessionChange)
    expect(session?.runtime.document.animations ?? []).toEqual([])
    warn.mockRestore()
  })

  it('保存页面时把镜像清单变化回写动画文件', async () => {
    const provider = createBoundProvider()
    const { onActiveSessionChange } = renderEditor(provider)
    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))
    await waitFor(() => { expect(pageDocumentPanels()).toHaveLength(1) })
    const session = lastSession(onActiveSessionChange)
    // 无 controller 场景下动画 handler 不会被编辑器注册；镜像编辑仍走同一命令协议。
    for (const handler of createComposeAnimationCommandHandlers()) {
      try { session.runtime.registerHandler(handler) }
      catch { /* 已注册 */ }
    }
    act(() => session.runtime.dispatch({
      id: 'configure-animation',
      type: 'animation.configure',
      payload: {
        frameId: session.runtime.document.rootIds[0]!,
        animationId: 'intro',
        durationMs: 800,
      },
    }))
    await screen.findByRole('img', { name: '有未保存改动' })

    fireEvent.click(screen.getByRole('button', { name: '保存页面' }))

    await waitFor(() => {
      expect(provider.writeFile).toHaveBeenCalledWith(expect.objectContaining({
        fileId: 'home-animation',
        expectedRevision: 'a1',
      }))
    })
    const writeInput = (provider.writeFile as ReturnType<typeof vi.fn>).mock.calls
      .map(([input]) => input as { fileId: string; content: Blob })
      .find((input) => input.fileId === 'home-animation')
    const written = JSON.parse(await writeInput!.content.text()) as {
      kind: string
      frames: Record<string, { durationMs: number }[]>
    }
    expect(written.kind).toBe('compose-animation')
    expect(written.frames['frame-root']?.[0]?.durationMs).toBe(800)
  })

  it('镜像清单未变化时保存不回写动画文件', async () => {
    const provider = createBoundProvider()
    const { onActiveSessionChange } = renderEditor(provider)
    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))
    await waitFor(() => { expect(pageDocumentPanels()).toHaveLength(1) })
    const session = lastSession(onActiveSessionChange)
    act(() => session.runtime.dispatch({
      id: 'configure',
      type: BUILTIN_COMMAND_TYPES.setFrameSize,
      payload: {
        entityId: session.runtime.document.rootIds[0]!,
        size: { width: 800, height: 600 },
      },
    }))
    await screen.findByRole('img', { name: '有未保存改动' })

    fireEvent.click(screen.getByRole('button', { name: '保存页面' }))

    await waitFor(() => { expect(provider.writeFile).toHaveBeenCalled() })
    const animationWrites = (provider.writeFile as ReturnType<typeof vi.fn>).mock.calls
      .filter(([input]) => (input as { fileId: string }).fileId === 'home-animation')
    expect(animationWrites).toHaveLength(0)
  })
})

describe('OpenSpec: editor-workspace-layout / 多场景动画会话 / 按绑定文件聚合回写', () => {
  const sceneAEntry: ComposeAssetEntry = {
    id: 'anim-a',
    parentId: 'root',
    name: 'Home-主屏.animation.json',
    kind: 'file',
    revision: 'a1',
    assetKey: 'Home-主屏.animation.json',
  }
  const sceneBEntry: ComposeAssetEntry = {
    id: 'anim-b',
    parentId: 'root',
    name: 'Home-副屏.animation.json',
    kind: 'file',
    revision: 'b1',
    assetKey: 'Home-副屏.animation.json',
  }
  const sceneAFileText = serializeComposeAnimationFile(
    createComposeAnimationFile('frame-root', {
      id: 'intro-a',
      name: '入场 A',
      durationMs: 300,
      playbackMode: 'play-once',
    }),
  )
  const sceneBFileText = serializeComposeAnimationFile(
    createComposeAnimationFile('frame-two', {
      id: 'intro-b',
      name: '入场 B',
      durationMs: 300,
      playbackMode: 'play-once',
    }),
  )
  // 两块根场景各自绑定自己的动画文件：source 是 per-Frame 的文档状态。
  const twoScenePageText = (() => {
    const page = createEmptyComposePageFile()
    const frameId = page.document.rootIds[0]!
    const frame = page.document.entities[frameId]!
    const bind = (assetKey: string) => ({
      items: [],
      source: { providerId: 'memory', assetKey, scope: 'persistent' },
    })
    return serializeComposePageFile({
      ...page,
      document: {
        ...page.document,
        rootIds: [frameId, 'frame-two'],
        entities: {
          ...page.document.entities,
          [frameId]: {
            ...frame,
            components: { ...frame.components, Animations: bind(sceneAEntry.assetKey!) },
          },
          'frame-two': {
            ...frame,
            id: 'frame-two',
            name: '副屏',
            components: { ...frame.components, Animations: bind(sceneBEntry.assetKey!) },
          },
        },
      },
    })
  })()

  function createTwoSceneProvider(overrides: Partial<ComposeAssetProvider> = {}) {
    return createProvider({
      list: vi.fn(async ({ folderId }) =>
        folderId === 'root' ? [pageEntry, scriptEntry, sceneAEntry, sceneBEntry] : []),
      read: vi.fn(async ({ fileId }) => {
        if (fileId === 'anim-a') return { blob: new Blob([sceneAFileText]), revision: 'a1' }
        if (fileId === 'anim-b') return { blob: new Blob([sceneBFileText]), revision: 'b1' }
        return { blob: new Blob([twoScenePageText]), revision: '1' }
      }),
      ...overrides,
    })
  }

  /** 打开双场景页面并把两条清单各改一笔，制造两份文件的待回写变化。 */
  async function openAndTouchBothScenes(
    provider: ComposeAssetProvider,
  ) {
    const onActiveSessionChange = vi.fn()
    renderEditor(provider, onActiveSessionChange)
    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))
    await waitFor(() => { expect(pageDocumentPanels()).toHaveLength(1) })
    const session = lastSession(onActiveSessionChange)
    for (const handler of createComposeAnimationCommandHandlers()) {
      try { session.runtime.registerHandler(handler) }
      catch { /* 已注册 */ }
    }
    act(() => session.runtime.dispatch({
      id: 'configure-a',
      type: 'animation.configure',
      payload: { frameId: 'frame-root', animationId: 'intro-a', durationMs: 800 },
    }))
    act(() => session.runtime.dispatch({
      id: 'configure-b',
      type: 'animation.configure',
      payload: { frameId: 'frame-two', animationId: 'intro-b', durationMs: 900 },
    }))
    await screen.findByRole('img', { name: '有未保存改动' })
    return session
  }

  it('独立文件各自回写：两份文件各写一次且只含所属场景的分区', async () => {
    const provider = createTwoSceneProvider()
    await openAndTouchBothScenes(provider)

    fireEvent.click(screen.getByRole('button', { name: '保存页面' }))

    await waitFor(() => {
      expect(provider.writeFile).toHaveBeenCalledWith(expect.objectContaining({ fileId: 'anim-a' }))
      expect(provider.writeFile).toHaveBeenCalledWith(expect.objectContaining({ fileId: 'anim-b' }))
    })
    const writes = (provider.writeFile as ReturnType<typeof vi.fn>).mock.calls
      .map(([input]) => input as { fileId: string; content: Blob })
    const animationWrites = writes.filter((input) => input.fileId.startsWith('anim-'))
    expect(animationWrites).toHaveLength(2)
    const writtenA = JSON.parse(await animationWrites
      .find((input) => input.fileId === 'anim-a')!.content.text()) as {
      frames: Record<string, { durationMs: number }[]>
    }
    const writtenB = JSON.parse(await animationWrites
      .find((input) => input.fileId === 'anim-b')!.content.text()) as {
      frames: Record<string, { durationMs: number }[]>
    }
    expect(Object.keys(writtenA.frames)).toEqual(['frame-root'])
    expect(writtenA.frames['frame-root']?.[0]?.durationMs).toBe(800)
    expect(Object.keys(writtenB.frames)).toEqual(['frame-two'])
    expect(writtenB.frames['frame-two']?.[0]?.durationMs).toBe(900)
  })

  it('共享文件合并回写：两块场景绑定同一份文件时只写一次且含两个分区', async () => {
    // 既有共享文件页面：两块场景的 source 指向同一 assetKey，文件里已有两个分区。
    const sharedFileText = serializeComposeAnimationFile(setComposeAnimationFileFrame(
      createComposeAnimationFile('frame-root', {
        id: 'intro-a',
        name: '入场 A',
        durationMs: 300,
        playbackMode: 'play-once',
      }),
      'frame-two',
      [{ id: 'intro-b', name: '入场 B', durationMs: 300, playbackMode: 'play-once' }],
    ))
    const sharedPageText = (() => {
      const page = JSON.parse(twoScenePageText) as {
        document: { entities: Record<string, { components: Record<string, unknown> }> }
      }
      const bind = {
        items: [],
        source: { providerId: 'memory', assetKey: sceneAEntry.assetKey, scope: 'persistent' },
      }
      page.document.entities['frame-root']!.components.Animations = bind
      page.document.entities['frame-two']!.components.Animations = bind
      return JSON.stringify(page)
    })()
    const provider = createTwoSceneProvider({
      read: vi.fn(async ({ fileId }) => fileId === 'anim-a'
        ? { blob: new Blob([sharedFileText]), revision: 'a1' }
        : { blob: new Blob([sharedPageText]), revision: '1' }),
    })
    await openAndTouchBothScenes(provider)

    fireEvent.click(screen.getByRole('button', { name: '保存页面' }))

    await waitFor(() => {
      expect(provider.writeFile).toHaveBeenCalledWith(expect.objectContaining({ fileId: 'anim-a' }))
    })
    const animationWrites = (provider.writeFile as ReturnType<typeof vi.fn>).mock.calls
      .map(([input]) => input as { fileId: string; content: Blob })
      .filter((input) => input.fileId.startsWith('anim-'))
    expect(animationWrites).toHaveLength(1)
    const written = JSON.parse(await animationWrites[0]!.content.text()) as {
      frames: Record<string, { durationMs: number }[]>
    }
    expect(written.frames['frame-root']?.[0]?.durationMs).toBe(800)
    expect(written.frames['frame-two']?.[0]?.durationMs).toBe(900)
  })

  it('单份动画文件写入失败不阻塞页面本体与其他文件，并按文件名提示', async () => {
    const provider = createTwoSceneProvider()
    const writeFile = provider.writeFile as ReturnType<typeof vi.fn>
    writeFile.mockImplementation(async ({ fileId }: { fileId: string }) => {
      if (fileId === 'anim-b') throw new ComposeAssetError('io', 'disk full')
      return { ...pageEntry, id: fileId, revision: '2' }
    })
    await openAndTouchBothScenes(provider)

    fireEvent.click(screen.getByRole('button', { name: '保存页面' }))

    // 页面本体与场景 A 的文件照常写入；失败的只有 B。
    await waitFor(() => {
      expect(provider.writeFile).toHaveBeenCalledWith(expect.objectContaining({ fileId: 'home' }))
      expect(provider.writeFile).toHaveBeenCalledWith(expect.objectContaining({ fileId: 'anim-a' }))
      expect(provider.writeFile).toHaveBeenCalledWith(expect.objectContaining({ fileId: 'anim-b' }))
    })
    await waitFor(() => {
      expect(document.querySelector('.compose-editor__page-notice'))
        .toHaveTextContent('动画文件保存失败：Home-副屏.animation.json；页面已保存，下次保存会重试')
    })
    // 页面本体保存成功：未保存标记消失，失败只属于那份动画文件。
    expect(screen.queryByRole('img', { name: '有未保存改动' })).not.toBeInTheDocument()
  })
})

describe('OpenSpec: editor-workspace-layout / 页面保存与写入冲突', () => {
  it('派发事务后标签出现未保存指示，保存后消失', async () => {
    const provider = createProvider()
    const { onActiveSessionChange } = renderEditor(provider)
    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))
    await waitFor(() => { expect(pageDocumentPanels()).toHaveLength(1) })
    const session = lastSession(onActiveSessionChange)

    act(() => session.runtime.dispatch({
      id: 'configure',
      type: BUILTIN_COMMAND_TYPES.setFrameSize,
      payload: {
        entityId: session.runtime.document.rootIds[0]!,
        size: { width: 800, height: 600 },
      },
    }))

    const dirty = await screen.findByRole('img', { name: '有未保存改动' })
    expect(dirty).toBeInTheDocument()

    const panelId = pageDocumentPanels()[0]!.id
    fireEvent.click(screen.getByRole('button', { name: '关闭页面 Home' }))
    // 关闭会先弹确认；这里改为直接走保存路径验证脏状态清除。
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(screen.queryByRole('img', { name: '有未保存改动' })).not.toBeInTheDocument()
    })
    expect(provider.writeFile).toHaveBeenCalled()
    expect(dockviewMock.panels.has(panelId)).toBe(false)
  })

  it('写入冲突时呈现覆盖确认，覆盖后写入成功', async () => {
    let conflicted = false
    const provider = createProvider({
      writeFile: vi.fn(async ({ force }) => {
        if (!force && !conflicted) {
          conflicted = true
          throw new ComposeAssetError('conflict', 'revision changed')
        }
        return { ...pageEntry, revision: '3' }
      }),
    })
    const { onActiveSessionChange } = renderEditor(provider)
    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))
    await waitFor(() => { expect(pageDocumentPanels()).toHaveLength(1) })
    const session = lastSession(onActiveSessionChange)
    act(() => session.runtime.dispatch({
      id: 'configure',
      type: BUILTIN_COMMAND_TYPES.setFrameSize,
      payload: {
        entityId: session.runtime.document.rootIds[0]!,
        size: { width: 800, height: 600 },
      },
    }))
    await screen.findByRole('img', { name: '有未保存改动' })

    fireEvent.click(screen.getByRole('button', { name: '关闭页面 Home' }))
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    expect(await screen.findByText('页面已被外部修改')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '覆盖保存' }))

    await waitFor(() => {
      expect(provider.writeFile).toHaveBeenCalledWith(expect.objectContaining({ force: true }))
    })
  })

  it('关闭存在未保存改动的页面标签时呈现关闭确认', async () => {
    const { onActiveSessionChange } = renderEditor(createProvider())
    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))
    await waitFor(() => { expect(pageDocumentPanels()).toHaveLength(1) })
    const session = lastSession(onActiveSessionChange)
    act(() => session.runtime.dispatch({
      id: 'configure',
      type: BUILTIN_COMMAND_TYPES.setFrameSize,
      payload: {
        entityId: session.runtime.document.rootIds[0]!,
        size: { width: 800, height: 600 },
      },
    }))
    await screen.findByRole('img', { name: '有未保存改动' })

    fireEvent.click(screen.getByRole('button', { name: '关闭页面 Home' }))

    expect(await screen.findByText('页面尚未保存')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    await waitFor(() => { expect(pageDocumentPanels()).toHaveLength(1) })
  })
})

describe('OpenSpec: editor-workspace-layout / 资源面板页面操作', () => {
  it('OpenSpec: editor-workspace-layout / 页面脚本作为 Canvas Inspector 属性 / 页面与 Inspector 目标切换', async () => {
    const provider = createProvider({
      list: vi.fn(async ({ folderId }) => folderId === 'root'
        ? [pageEntry, scriptEntry, setupScriptEntry]
        : []),
    })
    const onActiveSessionChange = vi.fn()
    const controller = {
      sceneTreeProps: { nodes: [], selectedIds: [], expandedIds: [] },
      componentLibraryPanel: null,
      stage: null,
      inspectorPanel: (
        <PageInspector
          activeFrameId={createEmptyComposePageFile().document.rootIds[0]!}
          document={createEmptyComposePageFile().document}
        />
      ),
      commandPanel: null,
      stageToolbar: null,
    } as unknown as ComposeEditorController

    render(
      <ComposeEditor
        assets={{ browser: { provider } }}
        controller={controller}
        pages={{ onActiveSessionChange }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))

    const inspector = await screen.findByRole('region', { name: '页面属性' })
    const pageScriptSelect = within(inspector).getByRole('combobox', { name: '脚本文件' })
    await waitFor(() => { expect(pageScriptSelect).toBeEnabled() })
    expect(within(inspector).getAllByRole('searchbox', { name: '搜索属性' })).toHaveLength(1)

    fireEvent.change(pageScriptSelect, {
      target: { value: 'Counter.setup.js' },
    })
    await waitFor(() => { expect(provider.writeFile).toHaveBeenCalled() })
    await waitFor(() => {
      expect(lastSession(onActiveSessionChange)?.page.setupScript).toEqual({
        providerId: 'memory',
        assetKey: 'Counter.setup.js',
        scope: 'persistent',
      })
    })
    fireEvent.click(within(inspector).getByRole('button', { name: '更多页面脚本操作' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '解除页面脚本' }))
    await waitFor(() => {
      expect(lastSession(onActiveSessionChange)?.page.setupScript).toBeNull()
    })
  })

  it('创建页面写入规范化文件名并随即打开该页面', async () => {
    const provider = createProvider()
    renderEditor(provider)

    fireEvent.click(await screen.findByRole('button', { name: '创建页面' }))

    await waitFor(() => {
      expect(provider.createFile).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Detail.page.json',
      }))
    })
    await waitFor(() => {
      expect(pageDocumentPanels().some((panel) => panel.title === 'Detail')).toBe(true)
    })
  })

  it('Provider 缺少创建能力时创建页面项禁用', async () => {
    const provider = createProvider()
    renderEditor({
      ...provider,
      capabilities: { ...provider.capabilities, createFile: false },
    })

    expect(await screen.findByRole('button', { name: '创建页面' })).toBeDisabled()
  })

  it('OpenSpec: editor-workspace-layout / 页面 setup 资源流程 / 创建并解除 setup 引用', async () => {
    const provider = createProvider()
    const { onActiveSessionChange } = renderEditor(provider)
    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))
    await waitFor(() => { expect(pageDocumentPanels()).toHaveLength(1) })

    fireEvent.click(screen.getByRole('button', { name: '创建页面脚本' }))

    await waitFor(() => {
      expect(provider.createFile).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Home.setup.js',
      }))
    })
    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))
    await waitFor(() => {
      expect(lastSession(onActiveSessionChange)?.page.setupScript).toEqual(expect.objectContaining({
        providerId: 'memory',
        assetKey: 'Home.setup.js',
      }))
    })

    fireEvent.click(screen.getByRole('button', { name: '解除页面脚本' }))
    await waitFor(() => {
      expect(lastSession(onActiveSessionChange)?.page.setupScript).toBeNull()
    })
  })

  it('OpenSpec: page-script-runtime / setup 重载 / 手动重载与资源 revision 更新共用页面重载路径', async () => {
    const listeners = new Set<() => void>()
    const scriptedPageText = serializeComposePageFile({
      ...createEmptyComposePageFile(),
      setupScript: {
        providerId: 'memory',
        assetKey: 'dashboard.ts',
        scope: 'persistent',
      },
    })
    const setupWithValue = (value: number): ComposePageSetup => (ctx) => {
      const count = ctx.state(value)
      return { count }
    }
    let resolveReload: ((loaded: ComposeLoadedScriptModule) => void) | undefined
    let loadCount = 0
    const scriptModuleLoader: ComposeScriptModuleLoader = {
      load: vi.fn((): Promise<ComposeLoadedScriptModule> => {
        loadCount += 1
        if (loadCount === 1) {
          return Promise.resolve({ module: { setup: setupWithValue(0) }, revision: '1' })
        }
        if (loadCount === 2) {
          return new Promise<ComposeLoadedScriptModule>((resolve) => { resolveReload = resolve })
        }
        return Promise.resolve({ module: { setup: setupWithValue(20) }, revision: '3' })
      }),
    }
    const provider = createProvider({
      read: vi.fn(async ({ fileId }) => ({
        blob: new Blob([fileId === 'home' ? scriptedPageText : 'export {}']),
        revision: '1',
      })),
      resolveAsset: vi.fn(async () => ({
        blob: new Blob(['export {}']),
        mediaType: 'text/javascript',
        revision: '1',
      })),
      subscribe(listener) {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    })
    const onActiveSessionChange = vi.fn()
    const controller = {
      sceneTreeProps: { nodes: [], selectedIds: [], expandedIds: [] },
      componentLibraryPanel: null,
      stage: null,
      inspectorPanel: (
        <PageInspector
          activeFrameId={createEmptyComposePageFile().document.rootIds[0]!}
          document={createEmptyComposePageFile().document}
        />
      ),
      commandPanel: null,
      stageToolbar: null,
    } as unknown as ComposeEditorController
    render(
      <ComposeEditor
        assets={{ browser: { provider } }}
        controller={controller}
        pages={{ onActiveSessionChange, scriptModuleLoader }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))
    await waitFor(() => {
      expect(lastSession(onActiveSessionChange)?.scriptScope?.getExport('count'))
        .toMatchObject({ value: 0 })
      expect(listeners.size).toBeGreaterThan(0)
    })

    fireEvent.click(await screen.findByRole('button', { name: '重新加载脚本' }))
    await waitFor(() => { expect(scriptModuleLoader.load).toHaveBeenCalledTimes(2) })
    fireEvent.click(screen.getByRole('button', { name: 'open-script' }))
    await waitFor(() => {
      expect([...dockviewMock.panels.values()].some((panel) => panel.component === 'assetDocument'))
        .toBe(true)
    })
    await act(async () => {
      resolveReload?.({ module: { setup: setupWithValue(10) }, revision: '2' })
      await Promise.resolve()
    })
    dockviewMock.activate(pageDocumentPanels()[0]!.id)

    await waitFor(() => {
      expect(lastSession(onActiveSessionChange)?.scriptScope?.getExport('count'))
        .toMatchObject({ value: 10 })
    })

    act(() => { listeners.forEach((listener) => { listener() }) })
    await waitFor(() => {
      expect(scriptModuleLoader.load).toHaveBeenCalledTimes(3)
      expect(lastSession(onActiveSessionChange)?.scriptScope?.getExport('count'))
        .toMatchObject({ value: 20 })
    })
  })

  it('OpenSpec: page-script-runtime / setup 作用域生命周期 / StrictMode 重放挂载后打开页面仍持有作用域', async () => {
    const scriptedPageText = serializeComposePageFile({
      ...createEmptyComposePageFile(),
      setupScript: {
        providerId: 'memory',
        assetKey: 'dashboard.ts',
        scope: 'persistent',
      },
    })
    const setup: ComposePageSetup = (ctx) => ({ count: ctx.state(7) })
    const scriptModuleLoader: ComposeScriptModuleLoader = {
      load: vi.fn(async (): Promise<ComposeLoadedScriptModule> => ({
        module: { setup },
        revision: '1',
      })),
    }
    const provider = createProvider({
      read: vi.fn(async ({ fileId }) => ({
        blob: new Blob([fileId === 'home' ? scriptedPageText : 'export {}']),
        revision: '1',
      })),
      resolveAsset: vi.fn(async () => ({
        blob: new Blob(['export {}']),
        mediaType: 'text/javascript',
        revision: '1',
      })),
    })
    const onActiveSessionChange = vi.fn()
    render(
      <StrictMode>
        <ComposeEditor
          assets={{ browser: { provider } }}
          pages={{ onActiveSessionChange, scriptModuleLoader }}
        />
      </StrictMode>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))

    await waitFor(() => {
      expect(lastSession(onActiveSessionChange)?.scriptScope?.getExport('count'))
        .toMatchObject({ value: 7 })
    })
  })
})

describe('OpenSpec: editor-workspace-layout / 首页标记与清单对账', () => {
  it('OpenSpec: editor-workspace-layout / 启动时打开标记首页 / 页面模式不显示根画布并自动激活首页', async () => {
    renderEditor(createProvider({
      list: vi.fn(async ({ folderId }) => folderId === 'root'
        ? [pageEntry, scriptEntry, manifestEntry]
        : []),
      read: vi.fn(async ({ fileId }) => ({
        blob: new Blob([fileId === 'app.json'
          ? '{"schemaVersion":1,"homePageKey":"Home.page.json"}'
          : pageText]),
        revision: '1',
      })),
    }))

    await waitFor(() => { expect(pageDocumentPanels()).toHaveLength(1) })
    expect(pageDocumentPanels()[0]).toMatchObject({ title: 'Home' })
    expect(dockviewMock.activeId).toBe(pageDocumentPanels()[0]?.id)
    expect(initializeCoreWorkspaceMock).toHaveBeenCalledWith(
      dockviewMock.api,
      'zh-CN',
      undefined,
      { includeCanvas: false },
    )
  })

  it('设为首页后标记在树与网格双处渲染', async () => {
    const provider = createProvider()
    renderEditor(provider)

    fireEvent.click(await screen.findByRole('button', { name: '设为首页' }))

    await waitFor(() => {
      expect(within(screen.getByTestId('badge-host-tree'))
        .getByRole('img', { name: '首页' })).toBeInTheDocument()
    })
    expect(within(screen.getByTestId('badge-host-grid'))
      .getByRole('img', { name: '首页' })).toBeInTheDocument()
    expect(provider.createFile).toHaveBeenCalledWith(expect.objectContaining({
      name: 'app.json',
    }))
  })

  it('已是首页时设为首页项禁用', async () => {
    renderEditor(createProvider({
      list: vi.fn(async ({ folderId }) => folderId === 'root'
        ? [pageEntry, scriptEntry, manifestEntry]
        : []),
      read: vi.fn(async ({ fileId }) => ({
        blob: new Blob([fileId === 'app.json'
          ? '{"schemaVersion":1,"homePageKey":"Home.page.json"}'
          : pageText]),
        revision: '1',
      })),
    }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '设为首页' })).toBeDisabled()
    })
  })

  it('清单不可写时设为首页项禁用但标记仍渲染', async () => {
    const provider = createProvider({
      list: vi.fn(async ({ folderId }) => folderId === 'root'
        ? [pageEntry, scriptEntry, manifestEntry]
        : []),
      read: vi.fn(async ({ fileId }) => ({
        blob: new Blob([fileId === 'app.json'
          ? '{"schemaVersion":1,"homePageKey":"Home.page.json"}'
          : pageText]),
        revision: '1',
      })),
    })
    delete (provider as { writeFile?: unknown }).writeFile
    renderEditor(provider)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '设为首页' })).toBeDisabled()
    })
    expect(within(screen.getByTestId('badge-host-tree'))
      .getByRole('img', { name: '首页' })).toBeInTheDocument()
  })

  it('清单损坏时降级为无首页且不渲染标记', async () => {
    renderEditor(createProvider({
      list: vi.fn(async ({ folderId }) => folderId === 'root'
        ? [pageEntry, scriptEntry, manifestEntry]
        : []),
      read: vi.fn(async ({ fileId }) => ({
        blob: new Blob([fileId === 'app.json' ? '{ broken' : pageText]),
        revision: '1',
      })),
    }))

    await waitFor(() => { expect(screen.getByTestId('badge-host-tree')).toBeInTheDocument() })
    expect(within(screen.getByTestId('badge-host-tree'))
      .queryByRole('img', { name: '首页' })).not.toBeInTheDocument()
  })

  it('首页 key 悬空时不渲染标记但给出非阻断提示', async () => {
    const provider = createProvider({
      list: vi.fn(async ({ folderId }) => folderId === 'root'
        ? [pageEntry, scriptEntry, manifestEntry]
        : []),
      read: vi.fn(async ({ fileId }) => ({
        blob: new Blob([fileId === 'app.json'
          ? '{"schemaVersion":1,"homePageKey":"Pages/Gone.page.json"}'
          : pageText]),
        revision: '1',
      })),
    })
    renderEditor(provider)

    // role="status" 在工作区里不唯一（面板占位也用它），限定到页面通知本身。
    await waitFor(() => {
      expect(document.querySelector('.compose-editor__page-notice'))
        .toHaveTextContent('首页指向的页面不存在')
    })
    expect(within(screen.getByTestId('badge-host-tree'))
      .queryByRole('img', { name: '首页' })).not.toBeInTheDocument()
    // 悬空只提示，不改写清单。
    expect(provider.writeFile).not.toHaveBeenCalled()
  })

  it('本编辑器内删除首页页面时清空清单指向', async () => {
    const provider = createProvider({
      list: vi.fn(async ({ folderId }) => folderId === 'root'
        ? [pageEntry, scriptEntry, manifestEntry]
        : []),
      read: vi.fn(async ({ fileId }) => ({
        blob: new Blob([fileId === 'app.json'
          ? '{"schemaVersion":1,"homePageKey":"Home.page.json"}'
          : pageText]),
        revision: '1',
      })),
    })
    renderEditor(provider)
    await waitFor(() => {
      expect(within(screen.getByTestId('badge-host-tree'))
        .getByRole('img', { name: '首页' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'delete-page' }))

    await waitFor(() => {
      expect(provider.writeFile).toHaveBeenCalledWith(expect.objectContaining({
        fileId: 'app.json',
      }))
    })
    const written = (provider.writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
    expect(await (written.content as Blob).text()).toContain('"homePageKey": null')
  })
})

describe('OpenSpec: editor-workspace-layout / 只读页面 JSON 标签', () => {
  it('打开页面 JSON 以只读资源标签呈现，且与页面标签并存', async () => {
    renderEditor(createProvider())
    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))
    await waitFor(() => { expect(pageDocumentPanels()).toHaveLength(1) })

    fireEvent.click(await screen.findByRole('button', { name: '打开页面 JSON' }))

    await waitFor(() => {
      expect([...dockviewMock.panels.values()]
        .filter((panel) => panel.component === 'assetDocument')).toHaveLength(1)
    })
    // 前缀不同，因此同一页面的两个标签互不覆盖。
    expect(pageDocumentPanels()).toHaveLength(1)
    const readOnlyPanel = [...dockviewMock.panels.values()]
      .find((panel) => panel.component === 'assetDocument')
    expect(readOnlyPanel?.id).toContain(':readonly')
    expect(readOnlyPanel?.title).toBe('Home.page.json（只读）')
  })

  it('只读标签不显示未保存指示', async () => {
    renderEditor(createProvider())

    fireEvent.click(await screen.findByRole('button', { name: '打开页面 JSON' }))

    await waitFor(() => {
      expect([...dockviewMock.panels.values()]
        .some((panel) => panel.component === 'assetDocument')).toBe(true)
    })
    expect(screen.queryByRole('img', { name: '有未保存改动' })).not.toBeInTheDocument()
  })
})
