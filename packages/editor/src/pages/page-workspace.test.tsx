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
import type { ComposeLibraryPort } from '@compose-ui/library'
import type { ComposeEditorController } from '../editor-controller'
import type { ComposeEditorLibraryConfig } from './page-workspace-types'

/**
 * 单一 Dockview 的替身。
 *
 * @remarks
 * `initializeWorkspace` 不 mock：它会对这个假 api 真的建组、建面板，因此形状要跟
 * workspace-layout.test.ts 里的 createWorkspaceApi 一致，并多实现动画模式重组需要的底部边缘组
 * 与面板增删。文档不是 Dockview 面板——页面与资源标签由编辑器自己的标签条渲染，测试按
 * `role="tab"` 查。
 */
const dockviewMock = vi.hoisted(() => {
  interface FakePanel {
    id: string
    api: {
      id: string
      isActive: boolean
      close: ReturnType<typeof vi.fn>
      setActive: () => void
      setTitle: ReturnType<typeof vi.fn>
    }
  }
  interface FakeGroup {
    id: string
    locked: string | undefined
    api: { setVisible: ReturnType<typeof vi.fn> }
  }
  const groups = new Map<string, FakeGroup>()
  const panels = new Map<string, FakePanel>()
  let collapsed = true
  let bottomAdded = false
  const bottomGroup = {
    id: 'compose-bottom-edge',
    locked: undefined as string | undefined,
    isCollapsed: () => collapsed,
    expand: vi.fn(() => { collapsed = false }),
    collapse: vi.fn(() => { collapsed = true }),
  }
  const api = {
    height: 600,
    addGroup: vi.fn((options: { id: string }) => {
      const group: FakeGroup = { id: options.id, locked: undefined, api: { setVisible: vi.fn() } }
      groups.set(options.id, group)
      return group
    }),
    getGroup: vi.fn((id: string) => groups.get(id)),
    addEdgeGroup: vi.fn(() => {
      bottomAdded = true
      return bottomGroup
    }),
    getEdgeGroup: vi.fn((position: string) => (position === 'bottom' && bottomAdded ? bottomGroup : undefined)),
    addPanel: vi.fn((options: { id: string }) => {
      const panel: FakePanel = {
        id: options.id,
        api: {
          id: options.id,
          isActive: false,
          close: vi.fn(() => { panels.delete(options.id) }),
          setActive: () => {
            panels.forEach((item) => { item.api.isActive = item.id === options.id })
          },
          setTitle: vi.fn(),
        },
      }
      panels.set(options.id, panel)
      return panel
    }),
    getPanel: vi.fn((id: string) => panels.get(id)),
    removePanel: vi.fn((panel: { id: string }) => { panels.delete(panel.id) }),
    // 工作区切换走 `clear` + 重建：清空之后 preset 里没有的面板（如时间线）就不会再回来。
    clear: vi.fn(() => {
      panels.clear()
      groups.clear()
      bottomAdded = false
    }),
    onDidActivePanelChange: vi.fn(() => ({ dispose: () => undefined })),
  }
  return {
    api,
    panels,
    groups,
    bottomGroup,
    get collapsed() { return collapsed },
    reset() {
      panels.clear()
      groups.clear()
      collapsed = true
      bottomAdded = false
      bottomGroup.expand.mockClear()
      bottomGroup.collapse.mockClear()
      api.addGroup.mockClear()
      api.addPanel.mockClear()
      api.removePanel.mockClear()
    },
  }
})
const assetPreviewPropsMock = vi.hoisted(() => vi.fn())

vi.mock('dockview-react', async () => {
  const React = await import('react')
  return {
    themeAbyss: { name: 'abyss', className: 'dockview-theme-abyss' },
    DockviewDefaultTab: () => null,
    DockviewReact: ({ components, onReady }: {
      components: Record<string, React.FunctionComponent>
      onReady: (event: { api: unknown }) => void
    }) => {
      React.useEffect(() => {
        onReady({ api: dockviewMock.api })
      }, [onReady])
      // 面板组件各渲染一次；文档不是面板，它们的标签与表面由编辑器自己渲染。
      return React.createElement(
        'div',
        { 'data-testid': 'dockview' },
        Object.entries(components).map(([name, Component]) =>
          React.createElement(Component, { key: name })),
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

function renderEditor(
  provider: ComposeAssetProvider,
  onActiveSessionChange = vi.fn(),
  library?: ComposeEditorLibraryConfig,
) {
  render(
    <ComposeEditor
      assets={{ browser: { provider } }}
      pages={{ onActiveSessionChange, ...(library === undefined ? {} : { library }) }}
    />,
  )
  return { onActiveSessionChange }
}

/** 一个只实现读那三条的库端口替身；写的每一条都可以缺席。 */
function createLibrary(overrides: Partial<ComposeLibraryPort> = {}): ComposeLibraryPort {
  return {
    id: 'test-library',
    capabilities: {
      create: false,
      update: false,
      trash: false,
      purge: false,
      thumbnail: true,
      recents: true,
    },
    query: vi.fn(async () => ({
      items: [],
      nextCursor: null,
      facets: { byCategory: [], byLocation: { project: 0, template: 0, trash: 0 } },
    })),
    get: vi.fn(async () => { throw new ComposeAssetError('not-found', 'x') }),
    listCategories: vi.fn(async () => []),
    putThumbnail: vi.fn(async () => undefined),
    recordOpen: vi.fn(async () => undefined),
    ...overrides,
  }
}

/** 打开 Home 并改一笔，让它变脏。 */
async function openAndDirty(onActiveSessionChange: ReturnType<typeof vi.fn>) {
  fireEvent.click(screen.getByRole('button', { name: 'open-page' }))
  await waitFor(() => { expect(pageTabs()).toHaveLength(1) })
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
}

/**
 * 保存活动文档。
 *
 * @remarks
 * 标签条上那颗保存按钮已经删掉——「改没改过」标签上的脏点已经在回答了。保存现在是
 * `document.save` 动作，默认键位仍是 `Cmd/Ctrl+S`，因此这里敲它而不是点按钮。
 */
function saveActiveDocument() {
  const editor = document.querySelector('.compose-editor')
  if (!editor) throw new Error('编辑器未渲染')
  fireEvent.keyDown(editor, { key: 's', code: 'KeyS', metaKey: true })
}

/** 取最近一次活动页面回调的参数；本包 lib target 不含 Array.prototype.at。 */
function lastSession(spy: ReturnType<typeof vi.fn>) {
  const calls = spy.mock.calls
  return calls.length === 0 ? undefined : calls[calls.length - 1]?.[0]
}

/** 标签条上带某个前缀的文档标签；文档不是 Dockview 面板，标签条是编辑器自己的 tablist。 */
function documentTabs(prefix: string) {
  return screen.queryAllByRole('tab')
    .filter((tab) => tab.getAttribute('data-workspace-tab')?.startsWith(prefix) ?? false)
}

function pageTabs() {
  return documentTabs('compose-page-document:')
}

function assetTabs() {
  return documentTabs('compose-asset-document:')
}

beforeEach(() => {
  dockviewMock.reset()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('OpenSpec: editor-workspace-layout / 页面文档标签与按页面事务运行时', () => {
  it('页面文件打开为页面标签而不是资源标签', async () => {
    renderEditor(createProvider())

    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))

    await waitFor(() => { expect(pageTabs()).toHaveLength(1) })
    expect(pageTabs()[0]).toHaveAttribute('title', 'Home')
    expect(assetTabs()).toHaveLength(0)
  })

  it('非页面文件仍打开为资源标签', async () => {
    renderEditor(createProvider())

    fireEvent.click(screen.getByRole('button', { name: 'open-script' }))

    await waitFor(() => { expect(assetTabs()).toHaveLength(1) })
    expect(pageTabs()).toHaveLength(0)
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
    expect(assetTabs().filter((tab) => tab.getAttribute('title') === 'Counter.setup.js'))
      .toHaveLength(1)
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
    await waitFor(() => { expect(pageTabs()).toHaveLength(1) })
    const firstRuntime = lastSession(onActiveSessionChange)?.runtime

    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))

    await waitFor(() => { expect(pageTabs()).toHaveLength(1) })
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

describe('OpenSpec: editor-workspace-layout / 动画编辑开关', () => {
  const workspaceRadio = (name: string) => (
    within(screen.getByRole('radiogroup', { name: '工作区' })).getByRole('radio', { name })
  )
  const animationToggle = () => screen.getByRole('button', { name: '动画编辑' })

  it('切到动画工作区只换布局；开关、时间线交互进入；换到没有时间线的布局退出', async () => {
    renderEditor(createProvider())
    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))
    await waitFor(() => { expect(pageTabs()).toHaveLength(1) })

    // 顶栏没有「设计 / 动画」切换器；页面工作区的布局里没有时间线。
    expect(screen.queryByRole('radiogroup', { name: '编辑模式' })).toBeNull()
    expect(dockviewMock.panels.has('compose-animation')).toBe(false)

    fireEvent.click(workspaceRadio('动画'))
    await waitFor(() => {
      expect(workspaceRadio('动画')).toHaveAttribute('aria-checked', 'true')
    })
    // 时间线随 preset 落进底部组、活动；切换本身不打开动画编辑。
    expect(dockviewMock.api.addPanel).toHaveBeenCalledWith(expect.objectContaining({
      id: 'compose-animation',
      position: { referenceGroup: 'compose-bottom-edge' },
    }))
    expect(dockviewMock.panels.get('compose-animation')?.api.isActive).toBe(true)
    expect(animationToggle()).toHaveAttribute('aria-pressed', 'false')

    // 按开关进入：时间线被亮出来（设为活动、底部展开）。
    fireEvent.click(animationToggle())
    await waitFor(() => { expect(animationToggle()).toHaveAttribute('aria-pressed', 'true') })
    expect(dockviewMock.bottomGroup.expand).toHaveBeenCalled()
    fireEvent.click(animationToggle())
    await waitFor(() => { expect(animationToggle()).toHaveAttribute('aria-pressed', 'false') })

    // 换到没有时间线的布局：面板随 `clear` + 重建消失，动画编辑跟着退出。
    fireEvent.click(animationToggle())
    await waitFor(() => { expect(animationToggle()).toHaveAttribute('aria-pressed', 'true') })
    fireEvent.click(workspaceRadio('页面'))
    await waitFor(() => {
      expect(workspaceRadio('页面')).toHaveAttribute('aria-checked', 'true')
      expect(dockviewMock.panels.has('compose-animation')).toBe(false)
    })
    await waitFor(() => { expect(animationToggle()).toHaveAttribute('aria-pressed', 'false') })
    // 从没有时间线的工作区里跑「动画编辑」动作不会进入：它唯一的可见依据不在。
    expect(dockviewMock.api.removePanel).not.toHaveBeenCalled()
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
    await waitFor(() => { expect(pageTabs()).toHaveLength(1) })
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
    await waitFor(() => { expect(pageTabs()).toHaveLength(1) })
    const session = lastSession(onActiveSessionChange)
    expect(session?.runtime.document.animations ?? []).toEqual([])
    warn.mockRestore()
  })

  it('保存页面时把镜像清单变化回写动画文件', async () => {
    const provider = createBoundProvider()
    const { onActiveSessionChange } = renderEditor(provider)
    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))
    await waitFor(() => { expect(pageTabs()).toHaveLength(1) })
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

    saveActiveDocument()

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
    await waitFor(() => { expect(pageTabs()).toHaveLength(1) })
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

    saveActiveDocument()

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
    await waitFor(() => { expect(pageTabs()).toHaveLength(1) })
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

    saveActiveDocument()

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

    saveActiveDocument()

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

    saveActiveDocument()

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
    await waitFor(() => { expect(pageTabs()).toHaveLength(1) })
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

    const panelId = pageTabs()[0]!.getAttribute('data-workspace-tab')
    fireEvent.click(screen.getByRole('button', { name: '关闭页面 Home' }))
    // 关闭会先弹确认；这里改为直接走保存路径验证脏状态清除。
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(screen.queryByRole('img', { name: '有未保存改动' })).not.toBeInTheDocument()
    })
    expect(provider.writeFile).toHaveBeenCalled()
    expect(pageTabs().some((tab) => tab.getAttribute('data-workspace-tab') === panelId)).toBe(false)
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
    await waitFor(() => { expect(pageTabs()).toHaveLength(1) })
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
    await waitFor(() => { expect(pageTabs()).toHaveLength(1) })
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
    await waitFor(() => { expect(pageTabs()).toHaveLength(1) })
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
      renderStage: () => null,
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
      expect(pageTabs().some((tab) => tab.getAttribute('title') === 'Detail')).toBe(true)
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
    await waitFor(() => { expect(pageTabs()).toHaveLength(1) })

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
      renderStage: () => null,
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
    await waitFor(() => { expect(assetTabs()).toHaveLength(1) })
    await act(async () => {
      resolveReload?.({ module: { setup: setupWithValue(10) }, revision: '2' })
      await Promise.resolve()
    })
    fireEvent.click(pageTabs()[0]!)

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

    await waitFor(() => { expect(pageTabs()).toHaveLength(1) })
    expect(pageTabs()[0]).toHaveAttribute('title', 'Home')
    expect(pageTabs()[0]).toHaveAttribute('aria-selected', 'true')
    // 中央画布组只承载画布：页面模式下不再有无文件的固定 Canvas，画布表面跟随活动页面。
    expect(document.querySelector('[data-workspace-panel="canvas-document"]')).toBeNull()
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
    await waitFor(() => { expect(pageTabs()).toHaveLength(1) })

    fireEvent.click(await screen.findByRole('button', { name: '打开页面 JSON' }))

    await waitFor(() => { expect(assetTabs()).toHaveLength(1) })
    // 前缀不同，因此同一页面的两个标签互不覆盖。
    expect(pageTabs()).toHaveLength(1)
    const readOnlyTab = assetTabs()[0]
    expect(readOnlyTab?.getAttribute('data-workspace-tab')).toContain(':readonly')
    expect(readOnlyTab).toHaveAttribute('title', 'Home.page.json（只读）')
  })

  it('只读标签不显示未保存指示', async () => {
    renderEditor(createProvider())

    fireEvent.click(await screen.findByRole('button', { name: '打开页面 JSON' }))

    await waitFor(() => { expect(assetTabs()).toHaveLength(1) })
    expect(screen.queryByRole('img', { name: '有未保存改动' })).not.toBeInTheDocument()
  })
})

describe('OpenSpec: page-library / 缩略图由编辑器在保存之后产出', () => {
  it('保存成功之后异步上传缩略图', async () => {
    const provider = createProvider()
    const library = createLibrary()
    const onActiveSessionChange = vi.fn()
    renderEditor(provider, onActiveSessionChange, {
      port: library,
      renderThumbnail: vi.fn(async () => new Blob(['png'])),
    })
    await openAndDirty(onActiveSessionChange)

    saveActiveDocument()
    await waitFor(() => { expect(library.putThumbnail).toHaveBeenCalled() })
    expect(vi.mocked(library.putThumbnail!).mock.calls[0]![0]).toMatchObject({ pageKey: 'Home.page.json' })
  })

  it('上传失败不影响保存', async () => {
    const provider = createProvider()
    const onDiagnostic = vi.fn()
    const library = createLibrary({
      putThumbnail: vi.fn(async () => { throw new ComposeAssetError('io', '存储挂了') }),
    })
    const onActiveSessionChange = vi.fn()
    renderEditor(provider, onActiveSessionChange, {
      port: library,
      renderThumbnail: vi.fn(async () => new Blob(['png'])),
      onDiagnostic,
    })
    await openAndDirty(onActiveSessionChange)

    saveActiveDocument()
    // 页面本体已落盘：脏点消失。让保存因为一张缩略图失败是不可接受的。
    await waitFor(() => {
      expect(screen.queryByRole('img', { name: '有未保存改动' })).not.toBeInTheDocument()
    })
    await waitFor(() => { expect(onDiagnostic).toHaveBeenCalled() })
    expect(onDiagnostic.mock.calls[0]![0]).toMatchObject({ code: 'thumbnail-failed', pageKey: 'Home.page.json' })
  })

  it('宿主没接光栅化时一张也不传', async () => {
    const provider = createProvider()
    const library = createLibrary()
    const onActiveSessionChange = vi.fn()
    // renderThumbnail 缺席即不产出缩略图——图墙画占位，而不是让保存背上一件它做不到的事。
    renderEditor(provider, onActiveSessionChange, { port: library })
    await openAndDirty(onActiveSessionChange)

    saveActiveDocument()
    await waitFor(() => { expect(provider.writeFile).toHaveBeenCalled() })
    expect(library.putThumbnail).not.toHaveBeenCalled()
  })
})

describe('OpenSpec: page-library / 最近打开', () => {
  it('打开页面时记一次', async () => {
    const provider = createProvider()
    const library = createLibrary()
    renderEditor(provider, vi.fn(), { port: library })
    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))
    await waitFor(() => { expect(library.recordOpen).toHaveBeenCalledWith({ pageKey: 'Home.page.json' }) })
  })

  it('记不上也照样打开', async () => {
    const provider = createProvider()
    const onDiagnostic = vi.fn()
    const library = createLibrary({
      recordOpen: vi.fn(async () => { throw new ComposeAssetError('io', '记不上') }),
    })
    renderEditor(provider, vi.fn(), { port: library, onDiagnostic })
    fireEvent.click(screen.getByRole('button', { name: 'open-page' }))
    // 「最近打开」记不上不是打不开页面的理由。
    await waitFor(() => { expect(pageTabs()).toHaveLength(1) })
    await waitFor(() => { expect(onDiagnostic).toHaveBeenCalled() })
  })
})

/** 一条能被图墙画出来的记录。 */
function libraryRecord(pageKey: string, title: string) {
  return {
    pageKey,
    title,
    kind: 'project' as const,
    categories: [],
    thumbnailUrl: null,
    width: null,
    height: null,
    useCount: 0,
    deletedAt: null,
    createdAt: 0,
    modifiedAt: 0,
  }
}

describe('OpenSpec: editor-workspace-layout / 页面库是 body 的一种状态', () => {
  it('接了端口就从页面库开始，而不是从一块空画布', async () => {
    const provider = createProvider()
    const library = createLibrary({
      query: vi.fn(async () => ({
        items: [libraryRecord('Home.page.json', 'Home')],
        nextCursor: null,
        facets: { byCategory: [], byLocation: { project: 1, template: 0, trash: 0 } },
      })),
    })
    renderEditor(provider, vi.fn(), { port: library })
    // 顶栏上的标志成为回库的门；页面库那一屏此刻就在 body 上。
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '打开 Home' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: '回页面库' })).toBeInTheDocument()
    // 那一屏没有画布，因而没有工作区。
    expect(screen.queryByRole('radiogroup', { name: '工作区' })).toBeNull()
    // 首页没有被自动打开：它才是入口，自动打开等于让用户越过那一屏。
    expect(pageTabs()).toHaveLength(0)
  })

  it('从库里打开一页即离开库，点标志再回去', async () => {
    const provider = createProvider()
    const library = createLibrary({
      query: vi.fn(async () => ({
        items: [libraryRecord('Home.page.json', 'Home')],
        nextCursor: null,
        facets: { byCategory: [], byLocation: { project: 1, template: 0, trash: 0 } },
      })),
    })
    renderEditor(provider, vi.fn(), { port: library })
    fireEvent.click(await screen.findByRole('button', { name: '打开 Home' }))
    await waitFor(() => { expect(pageTabs()).toHaveLength(1) })
    // 离开库之后工作区切换器回来了，而标签条自始至终都在。
    expect(screen.getByRole('radiogroup', { name: '工作区' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '回页面库' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '打开 Home' })).toBeInTheDocument()
    })
    /*
     * 标签一个都没关：它正是「我手上开着哪几张图」，去库里找下一张时最需要它——
     * 这也正是标签条搬进顶栏的全部理由。
     */
    expect(pageTabs()).toHaveLength(1)
    expect(screen.queryByRole('radiogroup', { name: '工作区' })).toBeNull()
  })

  it('没接端口时编辑器照旧是入口', async () => {
    renderEditor(createProvider())
    await waitFor(() => {
      expect(screen.getByRole('radiogroup', { name: '工作区' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: '回页面库' })).toBeNull()
  })
})
