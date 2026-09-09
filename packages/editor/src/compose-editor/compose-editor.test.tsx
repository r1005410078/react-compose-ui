import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComposeHistoryNavigationController } from '@compose-ui/history'
import { ComposePaintPicker } from '@compose-ui/components'
import {
  ComposeUIProvider,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'

/**
 * 单一 Dockview 的替身：`initializeWorkspace` 未被 mock，会真的对它调用
 * addGroup/addEdgeGroup/addPanel，所以形状要跟 workspace-layout.test.ts 里的 createWorkspaceApi 一致。
 */
const workspaceDockviewMock = vi.hoisted(() => {
  interface FakeGroup {
    id: string
    locked: string | undefined
    api: { setVisible: ReturnType<typeof vi.fn> }
  }
  const groups = new Map<string, FakeGroup>()
  const edgeGroups = new Map<string, { id: string; locked?: string; isCollapsed: () => boolean; expand: () => void; collapse: () => void }>()
  const panels = new Map<string, { id: string; api: { close: ReturnType<typeof vi.fn>; setActive: ReturnType<typeof vi.fn> } }>()
  return {
    height: 600,
    addGroup: vi.fn((options: { id: string }) => {
      const group: FakeGroup = { id: options.id, locked: undefined, api: { setVisible: vi.fn() } }
      groups.set(options.id, group)
      return group
    }),
    getGroup: vi.fn((id: string) => groups.get(id)),
    addEdgeGroup: vi.fn((position: string, options: { id: string }) => {
      let collapsed = true
      const group = {
        id: options.id,
        locked: undefined as string | undefined,
        isCollapsed: () => collapsed,
        expand: () => { collapsed = false },
        collapse: () => { collapsed = true },
      }
      edgeGroups.set(position, group)
      return group
    }),
    getEdgeGroup: vi.fn((position: string) => edgeGroups.get(position)),
    addPanel: vi.fn((options: { id: string }) => {
      const panel = {
        id: options.id,
        api: { close: vi.fn(() => { panels.delete(options.id) }), setActive: vi.fn() },
      }
      panels.set(options.id, panel)
      return panel
    }),
    getPanel: vi.fn((id: string) => panels.get(id)),
    removePanel: vi.fn((panel: { id: string }) => { panels.delete(panel.id) }),
    onDidActivePanelChange: vi.fn(() => ({ dispose: () => undefined })),
    groups,
    edgeGroups,
    panels,
  }
})

vi.mock('@compose-ui/scene-tree', async () => {
  const React = await import('react')
  return {
    ComposeSceneTree: ({ nodes }: { nodes: ReadonlyArray<{ label: string }> }) =>
      React.createElement(
        'div',
        { 'data-testid': 'default-scene-tree' },
        nodes.map((node) => node.label).join(','),
      ),
  }
})

vi.mock('@compose-ui/asset-browser', async () => {
  const React = await import('react')
  return {
    // 资源文档表面只需要一个能挂进画布面板的替身；Monaco 的行为由 asset-browser 自己的测试覆盖。
    ComposeAssetPreview: React.forwardRef<HTMLDivElement, { entry: { name: string } }>(
      function ComposeAssetPreviewMock({ entry }, ref) {
        return React.createElement('div', { ref, 'data-testid': 'asset-preview' }, entry.name)
      },
    ),
    ComposeAssetBrowser: ({
      provider,
      onAssetOpen,
      onCanvasDrag,
    }: {
      provider?: { label?: string }
      onAssetOpen?: (entry: unknown) => void
      onCanvasDrag?: (event: unknown) => void
    }) =>
      React.createElement(
        'div',
        { 'data-testid': 'default-asset-browser' },
        provider?.label ?? 'No asset provider',
        React.createElement('button', {
          'aria-label': 'mock asset drag',
          onClick: () => onCanvasDrag?.({
            type: 'start',
            clientPoint: { x: 10, y: 20 },
            items: [{
              name: 'logo.svg',
              mediaType: 'image/svg+xml',
              reference: {
                providerId: 'memory',
                assetKey: 'logo',
                scope: 'persistent',
              },
            }],
          }),
        }),
        React.createElement('button', {
          'aria-label': 'mock asset open',
          onClick: () => onAssetOpen?.({
            id: 'logo',
            assetKey: 'logo-key',
            parentId: 'root',
            name: 'logo.svg',
            kind: 'file',
            mediaType: 'image/svg+xml',
          }),
        }),
      ),
  }
})

vi.mock('dockview-react', async () => {
  const React = await import('react')
  return {
    themeAbyss: { name: 'abyss', className: 'dockview-theme-abyss' },
    DockviewDefaultTab: ({ api }: { api: { title?: string } }) =>
      React.createElement('span', null, api.title),
    DockviewReact: ({ components, onReady, rightHeaderActionsComponent: HeaderActions }: {
      components: Record<string, React.FunctionComponent>
      onReady: (event: { api: unknown }) => void
      rightHeaderActionsComponent?: React.FunctionComponent<{
        group: { id: string }
      }>
    }) => {
      React.useEffect(() => {
        onReady({ api: workspaceDockviewMock })
      }, [onReady])

      // 组头动作只有场景组与属性组有（各一个折叠按钮）；面板组件各渲染一次。
      return React.createElement(
        'div',
        { 'data-testid': 'dockview' },
        HeaderActions
          ? ['compose-left-0', 'compose-right-0'].map((id) =>
              React.createElement(HeaderActions, { key: id, group: { id } }))
          : null,
        Object.entries(components).map(([name, Component]) =>
          React.createElement(Component, { key: name }),
        ),
      )
    },
  }
})

import { COMPOSE_DEFAULT_WORKSPACES, ComposeEditor } from '../index'
import type { ComposeEditorController, ComposeEditorStageOverrides } from '../index'
import { getRequiredEditorMessage } from '../editor-i18n'
import { createDefaultComposeEditorPreferences } from '../editor-preferences'

function UIContextProbe() {
  const theme = useComposeThemeContext()
  const i18n = useComposeI18nContext()
  return (
    <output data-testid="ui-context-probe">
      {JSON.stringify({
        theme: theme?.theme,
        resolvedTheme: theme?.resolvedTheme,
        accent: theme?.tokens.accent,
        locale: i18n?.locale,
        settings: i18n?.formatMessage('editor.settings', '设置'),
      })}
    </output>
  )
}

function createHistoryController(
  overrides: Partial<ComposeHistoryNavigationController> = {},
): ComposeHistoryNavigationController {
  return {
    entries: [
      { id: 'beginning', label: '开始' },
      { id: 'current', label: '新增节点' },
    ],
    activeEntryId: 'current',
    canUndo: true,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
    navigate: vi.fn(),
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  workspaceDockviewMock.groups.clear()
  workspaceDockviewMock.edgeGroups.clear()
  workspaceDockviewMock.panels.clear()
  Object.values(workspaceDockviewMock).forEach((member) => {
    if (typeof member === 'function' && 'mockClear' in member) member.mockClear()
  })
})

/** 设置的入口是应用菜单里的一项（顶栏右端那颗齿轮已删），因此要先点标志。 */
function openSettings() {
  fireEvent.click(screen.getByRole('button', { name: '应用菜单' }))
  fireEvent.click(screen.getByRole('menuitem', { name: '设置' }))
}

describe('ComposeEditor', () => {
  it('OpenSpec: editor-workspace-layout / 文档标签条 / 重复打开同一资源只激活现有标签', async () => {
    const provider = {
      id: 'memory',
      label: 'Memory assets',
      root: { id: 'root', parentId: null, name: 'Assets', kind: 'folder' as const },
      capabilities: {
        createFile: false,
        createFolder: false,
        rename: false,
        move: false,
        delete: false,
        write: false,
      },
      list: vi.fn(async () => []),
      read: vi.fn(),
    }
    render(<ComposeEditor assets={{ browser: { provider } }} />)
    // 未启用页面系统：固定画布是标签条上的第一个、不可关闭的标签。
    const canvasTab = screen.getByRole('tab', { name: '画布' })
    expect(canvasTab).toHaveAttribute('aria-selected', 'true')
    const addPanelCalls = workspaceDockviewMock.addPanel.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'mock asset open' }))
    const tab = await screen.findByRole('tab', { name: /logo\.svg/ })
    expect(tab).toHaveAttribute('data-workspace-tab', 'compose-asset-document:memory:logo-key')
    expect(tab).toHaveAttribute('aria-selected', 'true')
    expect(canvasTab).toHaveAttribute('aria-selected', 'false')
    // 文档不是 Dockview 面板：打开它不往 Dockview 里加任何东西。
    expect(workspaceDockviewMock.addPanel).toHaveBeenCalledTimes(addPanelCalls)

    fireEvent.click(canvasTab)
    expect(canvasTab).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'mock asset open' }))
    expect(screen.getAllByRole('tab', { name: /logo\.svg/ })).toHaveLength(1)
    expect(screen.getByRole('tab', { name: /logo\.svg/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('OpenSpec: editor-workspace-layout / Editor 资源拖入桥接 / 默认资源面板拖入当前 Stage', async () => {
    const send = vi.fn()
    const resolved = {
      blob: new Blob(['svg'], { type: 'image/svg+xml' }),
      revision: '1',
      mediaType: 'image/svg+xml',
    }
    const provider = {
      id: 'memory',
      label: 'Memory assets',
      root: { id: 'root', parentId: null, name: 'Assets', kind: 'folder' as const },
      capabilities: {
        createFile: false,
        createFolder: false,
        rename: false,
        move: false,
        delete: false,
        write: false,
        reference: true,
      },
      list: vi.fn(async () => []),
      read: vi.fn(),
      resolveAsset: vi.fn(async () => resolved),
    }
    function StageProbe(props: {
      assetResolver?: { resolve(input: unknown): Promise<unknown> }
    }) {
      return (
        <div data-has-asset-resolver={String(Boolean(props.assetResolver))}>
          Asset Stage
        </div>
      )
    }
    const controller = {
      sceneTreeProps: { nodes: [], selectedIds: [], expandedIds: [] },
      stage: <StageProbe />,
      // 桩如实消费覆盖：resolver 现在经 services 送达，断言仍是「Stage 拿到了 resolver」。
      renderStage: (overrides?: ComposeEditorStageOverrides) => (
        <StageProbe assetResolver={overrides?.services?.assetResolver} />
      ),
      componentLibraryPanel: null,
      inspectorPanel: null,
      commandPanel: null,
      stageToolbar: null,
      interactionController: { send },
    } as unknown as ComposeEditorController

    render(
      <ComposeEditor
        assets={{ browser: { provider } }}
        controller={controller}
      />,
    )

    expect(screen.getByText('Asset Stage')).toHaveAttribute(
      'data-has-asset-resolver',
      'true',
    )
    fireEvent.click(screen.getByRole('button', { name: 'mock asset drag' }))
    expect(send).toHaveBeenCalledWith({
      type: 'external.begin',
      clientPoint: { x: 10, y: 20 },
      item: {
        kind: 'assets',
        items: [{
          providerId: 'memory',
          assetKey: 'logo',
          scope: 'persistent',
          name: 'logo.svg',
          mediaType: 'image/svg+xml',
        }],
      },
    })
  })

  it('OpenSpec: editor-workspace-layout / React 内容插槽 / 宿主提供全部工作区内容', () => {
    render(
      <ComposeEditor
        slots={{
          sceneGraph: 'Scene slot',
          componentLibrary: 'Library slot',
          stageToolbar: 'Toolbar slot',
          stage: 'Canvas slot',
          inspector: 'Inspector slot',
          transactionLog: 'Transaction slot',
          command: 'Command slot',
          assetBrowser: 'Asset slot',
        }}
      />,
    )

    expect(screen.getByText('Scene slot')).toBeInTheDocument()
    expect(screen.getByText('Library slot')).toBeInTheDocument()
    expect(screen.getByText('Toolbar slot')).toBeInTheDocument()
    expect(screen.getByText('Canvas slot')).toBeInTheDocument()
    expect(screen.getByText('Inspector slot')).toBeInTheDocument()
    expect(screen.getByText('Transaction slot')).toBeInTheDocument()
    expect(screen.getByText('Command slot')).toBeInTheDocument()
    expect(screen.getByText('Asset slot')).toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / 资源面板标签 / panel 覆盖优先于 props', () => {
    const provider = {
      id: 'memory',
      label: 'Memory assets',
      root: { id: 'root', parentId: null, name: 'Assets', kind: 'folder' as const },
      capabilities: {
        createFile: false,
        createFolder: false,
        rename: false,
        move: false,
        delete: false,
        write: false,
      },
      list: vi.fn(async () => []),
      read: vi.fn(),
    }
    const { rerender } = render(<ComposeEditor assets={{ browser: { provider } }} />)
    expect(screen.getByTestId('default-asset-browser')).toHaveTextContent('Memory assets')

    rerender(
      <ComposeEditor
        assets={{ browser: { provider } }}
        slots={{ assetBrowser: <div>Custom asset panel</div> }}
      />,
    )
    expect(screen.getByText('Custom asset panel')).toBeInTheDocument()
    expect(screen.queryByTestId('default-asset-browser')).not.toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / React 内容插槽 / Stage Toolbar slot', () => {
    const { rerender } = render(<ComposeEditor slots={{ stageToolbar: 'Stage toolbar' }} />)

    expect(screen.getByText('Stage toolbar')).toBeInTheDocument()

    rerender(<ComposeEditor slots={{ stageToolbar: 'Latest toolbar' }} />)
    expect(screen.getByText('Latest toolbar')).toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / Controller 驱动的默认组合 / 使用默认 Controller 工作区', () => {
    const controllerHistory = createHistoryController()
    const controller = {
      runtime: controllerHistory,
      history: controllerHistory,
      sceneTreeProps: {
        nodes: [{ id: 'from-controller', label: 'Controller node' }],
        selectedIds: [],
        expandedIds: [],
      },
      componentLibraryPanel: <div>Controller palette</div>,
      stage: <div>Controller stage</div>,
      renderStage: () => <div>Controller stage</div>,
      inspectorPanel: <div>Controller inspector</div>,
      commandPanel: <div>Controller command</div>,
      stageToolbar: <div>Controller toolbar</div>,
    } as unknown as ComposeEditorController

    render(<ComposeEditor controller={controller} />)

    expect(screen.getByText('Controller node')).toBeInTheDocument()
    expect(screen.getByText('Controller palette')).toBeInTheDocument()
    expect(screen.getByText('Controller stage')).toBeInTheDocument()
    expect(screen.getByText('Controller inspector')).toBeInTheDocument()
    expect(screen.getByText('Controller command')).toBeInTheDocument()
    expect(screen.getByText('Controller toolbar')).toBeInTheDocument()
    expect(screen.getByLabelText('历史记录')).toBeInTheDocument()
  })

  it('OpenSpec: redesign-color-image-picker / Editor 图片资源端口 / 注入默认 Inspector', () => {
    const onValueChange = vi.fn()
    const controllerHistory = createHistoryController()
    const controller = {
      runtime: controllerHistory,
      history: controllerHistory,
      sceneTreeProps: { nodes: [], selectedIds: [], expandedIds: [] },
      componentLibraryPanel: null,
      stage: null,
      renderStage: () => null,
      inspectorPanel: (
        <ComposePaintPicker
          label="背景填充"
          value={{ kind: 'solid', color: '#111827' }}
          onValueChange={onValueChange}
        />
      ),
      commandPanel: null,
      stageToolbar: null,
    } as unknown as ComposeEditorController

    render(
      <ComposeEditor
        assets={{
          paintImageLibrary: {
            recent: [{
              asset: {
                providerId: 'memory',
                assetKey: 'nebula',
                scope: 'persistent',
              },
              label: '星云',
              previewUrl: 'https://example.test/nebula.png',
            }],
          },
        }}
        controller={controller}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '背景填充' }))
    fireEvent.click(screen.getByRole('button', { name: '图片' }))
    fireEvent.click(screen.getByRole('button', { name: '星云' }))
    expect(onValueChange).toHaveBeenLastCalledWith(expect.objectContaining({
      kind: 'image',
      asset: {
        providerId: 'memory',
        assetKey: 'nebula',
        scope: 'persistent',
      },
    }))
  })

  it('OpenSpec: redesign-color-image-picker / Editor 图片资源自动适配 / 从 Provider 注入默认 Inspector', async () => {
    const onValueChange = vi.fn()
    const createObjectURL = vi.fn(() => 'blob:nebula')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const provider = {
      id: 'memory',
      label: 'Memory assets',
      root: { id: 'root', parentId: null, name: 'Assets', kind: 'folder' as const },
      capabilities: {
        createFile: true,
        createFolder: false,
        rename: false,
        move: false,
        delete: false,
        write: false,
        reference: true,
      },
      referenceScope: 'persistent' as const,
      list: vi.fn(async ({ folderId }: { folderId: string }) => folderId === 'root'
        ? [{ id: 'images', parentId: 'root', name: 'Images', kind: 'folder' as const }]
        : [{
            id: 'nebula-file',
            parentId: 'images',
            name: 'nebula.png',
            kind: 'file' as const,
            mediaType: 'image/png',
            assetKey: 'nebula',
          }]),
      read: vi.fn(),
      resolveAsset: vi.fn(async () => ({
        blob: new Blob(['png'], { type: 'image/png' }),
        revision: '1',
        mediaType: 'image/png',
      })),
      createFile: vi.fn(),
    }
    const controller = {
      runtime: createHistoryController(),
      history: createHistoryController(),
      sceneTreeProps: { nodes: [], selectedIds: [], expandedIds: [] },
      componentLibraryPanel: null,
      stage: null,
      renderStage: () => null,
      inspectorPanel: (
        <ComposePaintPicker
          label="背景填充"
          value={{ kind: 'solid', color: '#111827' }}
          onValueChange={onValueChange}
        />
      ),
      commandPanel: null,
      stageToolbar: null,
    } as unknown as ComposeEditorController

    const { unmount } = render(
      <ComposeEditor
        assets={{ browser: { provider } }}
        controller={controller}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '背景填充' }))
    fireEvent.click(screen.getByRole('button', { name: '图片' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'nebula.png' })).toBeVisible())
    fireEvent.click(screen.getByRole('button', { name: 'nebula.png' }))
    expect(onValueChange).toHaveBeenLastCalledWith(expect.objectContaining({
      kind: 'image',
      asset: {
        providerId: 'memory',
        assetKey: 'nebula',
        scope: 'persistent',
      },
    }))
    unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:nebula')
  })

  it('OpenSpec: redesign-color-image-picker / 上传图片到配置目录 / 使用唯一名称并选择稳定引用', async () => {
    const onValueChange = vi.fn()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((blob: Blob) => `blob:${blob.type || 'unknown'}`),
      revokeObjectURL: vi.fn(),
    })
    const createFile = vi.fn(async ({ parentId, name }: {
      parentId: string
      name: string
      content: Blob
    }) => ({
      id: 'uploaded',
      parentId,
      name,
      kind: 'file' as const,
      mediaType: 'image/png',
      assetKey: 'uploaded-key',
    }))
    const provider = {
      id: 'memory',
      label: 'Memory assets',
      root: { id: 'root', parentId: null, name: 'Assets', kind: 'folder' as const },
      capabilities: {
        createFile: true,
        createFolder: false,
        rename: false,
        move: false,
        delete: false,
        write: false,
        reference: true,
      },
      referenceScope: 'persistent' as const,
      list: vi.fn(async ({ folderId }: { folderId: string }) => folderId === 'uploads'
        ? [{
            id: 'existing',
            parentId: 'uploads',
            name: 'hero.png',
            kind: 'file' as const,
            mediaType: 'image/png',
            assetKey: 'existing-key',
          }]
        : []),
      read: vi.fn(),
      resolveAsset: vi.fn(async () => ({
        blob: new Blob(['png'], { type: 'image/png' }),
        revision: '1',
        mediaType: 'image/png',
      })),
      createFile,
    }
    const controller = {
      runtime: createHistoryController(),
      history: createHistoryController(),
      sceneTreeProps: { nodes: [], selectedIds: [], expandedIds: [] },
      componentLibraryPanel: null,
      stage: null,
      renderStage: () => null,
      inspectorPanel: (
        <ComposePaintPicker
          label="背景填充"
          value={{ kind: 'solid', color: '#111827' }}
          onValueChange={onValueChange}
        />
      ),
      commandPanel: null,
      stageToolbar: null,
    } as unknown as ComposeEditorController

    render(
      <ComposeEditor
        assets={{
          browser: { provider },
          paintImageUploadParentId: 'uploads',
        }}
        controller={controller}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '背景填充' }))
    fireEvent.click(screen.getByRole('button', { name: '图片' }))
    const file = new File(['png'], 'hero.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('上传图片'), {
      target: { files: [file] },
    })
    await waitFor(() => expect(createFile).toHaveBeenCalledWith({
      parentId: 'uploads',
      name: 'hero-2.png',
      content: file,
    }))
    expect(onValueChange).toHaveBeenLastCalledWith(expect.objectContaining({
      kind: 'image',
      asset: {
        providerId: 'memory',
        assetKey: 'uploaded-key',
        scope: 'persistent',
      },
    }))
  })

  it('OpenSpec: redesign-color-image-picker / 显式图片适配器覆盖自动适配 / 不扫描 Provider', () => {
    const onValueChange = vi.fn()
    const list = vi.fn(async () => [])
    const provider = {
      id: 'memory',
      label: 'Memory assets',
      root: { id: 'root', parentId: null, name: 'Assets', kind: 'folder' as const },
      capabilities: {
        createFile: false,
        createFolder: false,
        rename: false,
        move: false,
        delete: false,
        write: false,
        reference: true,
      },
      list,
      read: vi.fn(),
      resolveAsset: vi.fn(),
    }
    const controller = {
      runtime: createHistoryController(),
      history: createHistoryController(),
      sceneTreeProps: { nodes: [], selectedIds: [], expandedIds: [] },
      componentLibraryPanel: null,
      stage: null,
      renderStage: () => null,
      inspectorPanel: (
        <ComposePaintPicker
          label="背景填充"
          value={{ kind: 'solid', color: '#111827' }}
          onValueChange={onValueChange}
        />
      ),
      commandPanel: null,
      stageToolbar: null,
    } as unknown as ComposeEditorController

    render(
      <ComposeEditor
        assets={{
          browser: { provider },
          paintImageLibrary: {
            recent: [{
              asset: {
                providerId: 'explicit',
                assetKey: 'configured',
                scope: 'persistent',
              },
              label: '显式图片',
              previewUrl: 'https://example.test/configured.png',
            }],
          },
        }}
        controller={controller}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '背景填充' }))
    fireEvent.click(screen.getByRole('button', { name: '图片' }))
    fireEvent.click(screen.getByRole('button', { name: '显式图片' }))
    expect(list).not.toHaveBeenCalled()
    expect(onValueChange).toHaveBeenLastCalledWith(expect.objectContaining({
      asset: expect.objectContaining({ providerId: 'explicit' }),
    }))
  })

  it('keeps explicit children ahead of a controller default Stage', () => {
    const controllerHistory = createHistoryController()
    const controller = {
      runtime: controllerHistory,
      history: controllerHistory,
      sceneTreeProps: {
        nodes: [],
        selectedIds: [],
        expandedIds: [],
      },
      componentLibraryPanel: null,
      stage: <div>Controller stage</div>,
      renderStage: () => <div>Controller stage</div>,
      inspectorPanel: null,
      commandPanel: null,
      stageToolbar: null,
    } as unknown as ComposeEditorController

    render(
      <ComposeEditor controller={controller} slots={{ stage: 'Explicit canvas' }} />,
    )

    expect(screen.getByText('Explicit canvas')).toBeInTheDocument()
    expect(screen.queryByText('Controller stage')).not.toBeInTheDocument()
  })

  it('updates slot content without reinitializing the workspace', () => {
    const { rerender } = render(
      <ComposeEditor slots={{ inspector: 'First inspector' }} />,
    )

    rerender(<ComposeEditor slots={{ inspector: 'Latest inspector' }} />)

    expect(screen.getByText('Latest inspector')).toBeInTheDocument()
    expect(screen.queryByText('First inspector')).not.toBeInTheDocument()
    expect(workspaceDockviewMock.addGroup).toHaveBeenCalledTimes(4)
  })

  it('OpenSpec: editor-workspace-layout / 场景下方工具分栏 / 使用默认历史面板', () => {
    const history = createHistoryController()
    render(<ComposeEditor history={history} />)

    expect(screen.getByTestId('default-scene-tree')).toBeInTheDocument()
    expect(screen.getByLabelText('历史记录')).toHaveAttribute('data-compose-ui', 'history')
    expect(screen.queryByRole('separator', { name: '调整场景树与历史记录高度' }))
      .not.toBeInTheDocument()
    expect(workspaceDockviewMock.addPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'compose-component-library-panel',
        position: { referenceGroup: 'compose-left-1' },
      }),
    )
    expect(workspaceDockviewMock.addPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'compose-history-panel',
        inactive: true,
        position: { referenceGroup: 'compose-left-1' },
      }),
    )

    const historyButton = screen.getByRole('button', { name: '开始' })
    fireEvent.click(historyButton)
    expect(history.navigate).toHaveBeenCalledWith('beginning')
  })

  it('OpenSpec: editor-workspace-layout / 场景下方工具分栏 / 覆盖历史面板', () => {
    const history = createHistoryController()
    const { rerender } = render(
      <ComposeEditor history={history} slots={{ history: <div>自定义历史</div> }} />,
    )

    expect(screen.getByText('自定义历史')).toBeInTheDocument()
    expect(screen.queryByLabelText('历史记录')).not.toBeInTheDocument()

    rerender(<ComposeEditor history={history} slots={{ history: null }} />)
    expect(screen.queryByText('自定义历史')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('历史记录')).not.toBeInTheDocument()
    expect(screen.getByTestId('dockview')).toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / 场景下方工具分栏 / 不启用历史', () => {
    render(<ComposeEditor />)

    expect(workspaceDockviewMock.addPanel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'compose-component-library-panel' }),
    )
    expect(workspaceDockviewMock.addPanel).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'compose-history-panel' }),
    )
    expect(screen.queryByLabelText('历史记录')).not.toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / 场景下方工具分栏 / 不启用历史：动态移除 History', () => {
    const history = createHistoryController()
    const { rerender } = render(<ComposeEditor history={history} />)
    const historyPanel = workspaceDockviewMock.getPanel('compose-history-panel')

    rerender(<ComposeEditor />)

    expect(historyPanel?.api.close).toHaveBeenCalledTimes(1)
    expect(workspaceDockviewMock.getPanel('compose-history-panel')).toBeUndefined()
  })

  it('runs history shortcuts from editor inputs while preserving the controlled panel override', () => {
    const history = createHistoryController({ canRedo: true })
    render(
      <ComposeEditor
        history={history}
        slots={{
          command: <input aria-label="编辑器命令" />,
          history: <div>自定义历史</div>,
        }}
      />,
    )
    const input = screen.getByLabelText('编辑器命令')

    expect(fireEvent.keyDown(input, { key: 'z', ctrlKey: true })).toBe(false)
    fireEvent.keyDown(input, { key: 'z', ctrlKey: true, shiftKey: true })
    expect(history.undo).toHaveBeenCalledTimes(1)
    expect(history.redo).toHaveBeenCalledTimes(1)
  })

  it('OpenSpec: editor-workspace-layout / Dockview 场景工具布局 / 调整下方工具高度', () => {
    render(<ComposeEditor history={createHistoryController()} />)
    expect(workspaceDockviewMock.addGroup).toHaveBeenCalledWith(expect.objectContaining({
      direction: 'left',
      referenceGroup: 'compose-canvas-group',
      id: 'compose-left-0',
      constraints: { minimumWidth: 180, minimumHeight: 160 },
    }))
    // 工具组取可用高度（替身报 600）的 40%。
    expect(workspaceDockviewMock.addGroup).toHaveBeenCalledWith(expect.objectContaining({
      constraints: { minimumHeight: 120 },
      direction: 'below',
      id: 'compose-left-1',
      initialHeight: 240,
      referenceGroup: 'compose-left-0',
    }))
    expect(workspaceDockviewMock.addPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'compose-scene-content-panel',
        minimumHeight: 160,
      }),
    )
    expect(workspaceDockviewMock.addGroup).toHaveBeenCalledTimes(4)
    expect(workspaceDockviewMock.addPanel).toHaveBeenCalledTimes(8)
    expect(workspaceDockviewMock.getPanel('compose-component-library-panel')?.api.setActive)
      .toHaveBeenCalledTimes(1)
  })

  it('OpenSpec: editor-workspace-layout / Dockview 场景工具布局 / 编辑器内容更新', () => {
    const firstHistory = createHistoryController()
    const { rerender } = render(
      <ComposeEditor history={firstHistory} slots={{ inspector: '第一版属性' }} />,
    )
    const dockview = screen.getByTestId('dockview')

    rerender(
      <ComposeEditor
        history={createHistoryController({
          entries: [...firstHistory.entries, { id: 'latest', label: '最新动作' }],
          activeEntryId: 'latest',
        })}
        slots={{ inspector: '第二版属性' }}
      />,
    )

    expect(screen.getByRole('button', { name: '最新动作' })).toBeInTheDocument()
    expect(screen.getByText('第二版属性')).toBeInTheDocument()
    expect(screen.getByTestId('dockview')).toBe(dockview)
    expect(workspaceDockviewMock.addPanel).toHaveBeenCalledTimes(8)
    expect(workspaceDockviewMock.addGroup).toHaveBeenCalledTimes(4)
  })

  it('OpenSpec: editor-workspace-layout / React 内容插槽 / 默认显示空场景树', () => {
    render(<ComposeEditor />)

    expect(screen.getByTestId('default-scene-tree')).toBeEmptyDOMElement()
    // 动画时间线在空文档下渲染空状态：时间读数与提示 live region（2 个 status）不再出现，
    // 面板不再回退到演示数据（animation-panel REMOVED: 默认关键帧演示时间线）。
    expect(screen.getAllByRole('status')).toHaveLength(6)
    expect(screen.getByText('舞台工具栏')).toBeInTheDocument()
    expect(screen.getByText('基础组件内容')).toBeInTheDocument()
    expect(screen.getByText('连接资源 Provider 以浏览文件')).toBeInTheDocument()
    expect(screen.getByText('组件属性内容')).toBeInTheDocument()
    expect(screen.getByText('事务日志内容')).toBeInTheDocument()
    expect(screen.getByText('命令内容')).toBeInTheDocument()
    // 时间线与别的面板一样常驻渲染（在不在屏幕上由布局决定）；纯插槽宿主没有文档，chrome 上
    // 也就没有「动画编辑」开关。
    expect(screen.getByRole('region', { name: '动画编辑器' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '动画编辑' })).not.toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / React 内容插槽 / 插槽与场景树内容更新', () => {
    const { rerender } = render(
      <ComposeEditor
        sceneTree={{ nodes: [{ id: 'first', label: 'First' }], selectedIds: [], expandedIds: [] }}
      />,
    )

    rerender(
      <ComposeEditor
        sceneTree={{ nodes: [{ id: 'latest', label: 'Latest' }], selectedIds: [], expandedIds: [] }}
      />,
    )

    expect(screen.getByTestId('default-scene-tree')).toHaveTextContent('Latest')
    expect(workspaceDockviewMock.addGroup).toHaveBeenCalledTimes(4)
  })

  it('OpenSpec: editor-workspace-layout / React 内容插槽 / 宿主覆盖场景树', () => {
    const { rerender } = render(<ComposeEditor slots={{ sceneGraph: 'Custom scene' }} />)
    expect(screen.getByText('Custom scene')).toBeInTheDocument()
    expect(screen.queryByTestId('default-scene-tree')).not.toBeInTheDocument()

    rerender(<ComposeEditor slots={{ sceneGraph: null }} />)
    expect(screen.queryByTestId('default-scene-tree')).not.toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / 嵌入与公共 API 边界 / 透传宿主属性', () => {
    const handleClick = vi.fn()
    render(
      <ComposeEditor
        aria-label="Customer editor"
        className="host-editor"
        onClick={handleClick}
        style={{ minHeight: 640 }}
      />,
    )

    const editor = screen.getByRole('region', { name: 'Customer editor' })
    expect(editor).toHaveClass('compose-editor', 'host-editor')
    expect(editor).toHaveAttribute('data-compose-ui', 'editor')
    expect(editor).toHaveAttribute('data-compose-core', '@compose-ui/core')
    expect(editor).toHaveStyle({ minHeight: '640px' })

    fireEvent.click(editor)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('OpenSpec: editor-workspace-layout / 单一 Dockview 实例 / Strict Mode 下唯一', () => {
    render(
      <StrictMode>
        <ComposeEditor />
      </StrictMode>,
    )

    // onReady 在 Strict Mode 下重放，按 api 身份去重：每组每面板各只建一次。
    expect(workspaceDockviewMock.addGroup).toHaveBeenCalledTimes(4)
    expect(workspaceDockviewMock.addEdgeGroup).toHaveBeenCalledTimes(1)
    expect(workspaceDockviewMock.addPanel).toHaveBeenCalledTimes(7)
    expect(screen.getAllByTestId('dockview')).toHaveLength(1)
  })

  it('OpenSpec: editor-workspace-layout / 工作区定义与注入 / 重名抛错', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const page = COMPOSE_DEFAULT_WORKSPACES[0]!
    expect(() => render(<ComposeEditor workspaces={[page, { ...page, title: '再来一个' }]} />))
      .toThrow(/duplicate workspace id "page"/)
    spy.mockRestore()
  })

  it('OpenSpec: editor-workspace-layout / 工作区定义与注入 / 宿主注入工作区', () => {
    const page = COMPOSE_DEFAULT_WORKSPACES[0]!
    render(
      <ComposeEditor
        workspaces={[page, {
          id: 'substation',
          title: '变电站',
          description: '符号库在右',
          layout: { kind: 'preset', left: [['sceneGraph']], right: [['componentLibrary'], ['inspector']] },
          session: page.session,
          seeds: page.seeds,
        }]}
      />,
    )
    const group = screen.getByRole('radiogroup', { name: '工作区' })
    const radios = screen.getAllByRole('radio').filter((radio) => group.contains(radio))
    expect(radios.map((radio) => radio.textContent)).toEqual(['页面', '变电站'])
    expect(radios[0]).toHaveAttribute('aria-checked', 'true')
    expect(radios[1]).toHaveAttribute('title', '符号库在右')
    // 命令行的词汇表里也有它：切换到某个工作区是动作目录的一条。
    fireEvent.click(radios[1]!)
    expect(radios[1]).toHaveAttribute('aria-checked', 'true')
  })

  it('OpenSpec: editor-workspace-layout / 切换不打断画布 / Strict Mode 下宿主元素唯一', () => {
    render(
      <StrictMode>
        <ComposeEditor slots={{ stage: <div data-testid="stage-probe">Stage</div> }} />
      </StrictMode>,
    )
    // 画布内容渲染进一个稳定的宿主元素，Dockview 面板只把它搬进盒子：重放挂载之后仍只有一份。
    expect(screen.getAllByTestId('stage-probe')).toHaveLength(1)
    expect(document.querySelectorAll('[data-workspace-host="canvas"]')).toHaveLength(1)
  })

  it('OpenSpec: editor-preferences / 设置模态弹框 / 打开和关闭设置', async () => {
    const { container } = render(<ComposeEditor />)

    const button = screen.getByRole('button', { name: '应用菜单' })
    expect(button).toHaveAttribute('aria-haspopup', 'menu')

    openSettings()
    expect(screen.getByRole('dialog', { name: '设置' })).toHaveAttribute(
      'aria-modal',
      'true',
    )
    expect(screen.getByTestId('dockview').closest('.compose-editor__workspace')).toHaveAttribute('inert')
    await waitFor(() => {
      expect(screen.getByRole('searchbox', { name: '搜索设置' })).toHaveFocus()
    })
    expect(screen.getByRole('dialog', { name: '设置' }).closest('[data-base-ui-portal]'))
      .not.toBe(container)

    fireEvent.click(screen.getByRole('button', { name: '关闭设置' }))
    expect(screen.queryByRole('dialog', { name: '设置' })).not.toBeInTheDocument()
    expect(screen.getByTestId('dockview').closest('.compose-editor__workspace')).not.toHaveAttribute('inert')
    expect(button).toHaveFocus()
  })

  it('OpenSpec: editor-preferences / 设置模态弹框 / 使用 Escape 关闭设置', () => {
    render(<ComposeEditor />)
    openSettings()
    fireEvent.click(screen.getByRole('button', { name: '快捷键' }))
    const capture = screen.getByRole('button', { name: '修改临时平移快捷键' })
    fireEvent.click(capture)
    fireEvent.keyDown(capture, {
      code: 'Escape',
      key: 'Escape',
    })
    expect(screen.getByRole('dialog', { name: '设置' })).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('dialog', { name: '设置' }), {
      code: 'Escape',
      key: 'Escape',
    })

    expect(screen.queryByRole('dialog', { name: '设置' })).not.toBeInTheDocument()
    // 焦点回到标志：它现在是设置的入口，也是它唯一的锚点。
    expect(screen.getByRole('button', { name: '应用菜单' })).toHaveFocus()

    openSettings()
    fireEvent.mouseDown(screen.getByTestId('settings-backdrop'))
    expect(screen.queryByRole('dialog', { name: '设置' })).not.toBeInTheDocument()
  })

  it('OpenSpec: editor-preferences / 主题解析 / 切换明确主题', () => {
    const onPreferencesChange = vi.fn()
    render(<ComposeEditor onPreferencesChange={onPreferencesChange} />)
    const editor = screen.getByRole('region', { name: 'Compose editor' })

    expect(editor).toHaveAttribute('data-compose-theme', 'dark')
    openSettings()
    fireEvent.click(screen.getByRole('radio', { name: '浅色' }))

    expect(editor).toHaveAttribute('data-compose-theme', 'light')
    expect(onPreferencesChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ theme: 'light', locale: 'zh-CN' }),
    )
  })

  it('OpenSpec: editor-preferences / 主题解析 / 跟随系统主题', () => {
    let dark = false
    let listener: (() => void) | null = null
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      get matches() {
        return dark
      },
      addEventListener: (_type: string, next: () => void) => {
        listener = next
      },
      removeEventListener: vi.fn(),
    })))
    const onPreferencesChange = vi.fn()
    const preferences = {
      ...createDefaultComposeEditorPreferences(),
      theme: 'system' as const,
    }
    render(
      <ComposeEditor
        onPreferencesChange={onPreferencesChange}
        preferences={preferences}
      />,
    )
    const editor = screen.getByRole('region', { name: 'Compose editor' })
    expect(editor).toHaveAttribute('data-compose-theme', 'light')

    dark = true
    act(() => listener?.())

    expect(editor).toHaveAttribute('data-compose-theme', 'dark')
    expect(onPreferencesChange).not.toHaveBeenCalled()
  })

  it('OpenSpec: editor-preferences / 实例级编辑器偏好 / 使用受控偏好', () => {
    const preferences = createDefaultComposeEditorPreferences()
    const onPreferencesChange = vi.fn()
    const { rerender } = render(
      <ComposeEditor
        onPreferencesChange={onPreferencesChange}
        preferences={preferences}
      />,
    )
    const editor = screen.getByRole('region', { name: 'Compose editor' })
    openSettings()
    fireEvent.click(screen.getByRole('radio', { name: '浅色' }))

    expect(onPreferencesChange).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'light' }),
    )
    expect(editor).toHaveAttribute('data-compose-theme', 'dark')

    rerender(
      <ComposeEditor
        onPreferencesChange={onPreferencesChange}
        preferences={{ ...preferences, theme: 'light' }}
      />,
    )
    expect(editor).toHaveAttribute('data-compose-theme', 'light')
  })

  it('OpenSpec: editor-preferences / 内建界面语言 / 切换默认工作区语言', () => {
    const { container } = render(<ComposeEditor />)
    openSettings()
    fireEvent.click(screen.getByRole('button', { name: '语言' }))
    fireEvent.click(screen.getByRole('radio', { name: 'English' }))

    // Modal 打开时 Base UI 会将背景从可访问树隔离，仍通过渲染容器断言其语言状态。
    const editor = container.querySelector('[data-compose-ui="editor"]')
    expect(editor).not.toBeNull()
    expect(editor).toHaveAttribute('lang', 'en-US')
    expect(container.querySelector('.compose-editor__brand'))
      .toHaveAttribute('aria-label', 'Application menu')
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })

  it('OpenSpec: editor-preferences / 内建界面语言 / 检测缺失翻译', () => {
    expect(() => getRequiredEditorMessage('en-US', 'missing-key'))
      .toThrow('Missing editor translation: en-US.missing-key')
  })

  it('opens settings from the configurable primary shortcut', () => {
    render(<ComposeEditor />)
    const editor = screen.getByRole('region', { name: 'Compose editor' })

    fireEvent.keyDown(editor, {
      code: 'Comma',
      key: ',',
      ctrlKey: true,
    })
    expect(screen.getByRole('dialog', { name: '设置' })).toBeInTheDocument()

    fireEvent.keyDown(editor, {
      code: 'Comma',
      key: ',',
      ctrlKey: true,
    })
    expect(screen.queryByRole('dialog', { name: '设置' })).not.toBeInTheDocument()
  })

  it('OpenSpec: editor-preferences / 可配置单次快捷键 / 执行重绑定历史动作', () => {
    const history = createHistoryController()
    const defaults = createDefaultComposeEditorPreferences()
    render(
      <ComposeEditor
        history={history}
        preferences={{
          ...defaults,
          shortcuts: {
            ...defaults.shortcuts,
            'history.undo': [{ code: 'KeyU' }],
          },
        }}
      />,
    )
    const editor = screen.getByRole('region', { name: 'Compose editor' })

    fireEvent.keyDown(editor, { code: 'KeyZ', key: 'z', ctrlKey: true })
    expect(history.undo).not.toHaveBeenCalled()
    fireEvent.keyDown(editor, { code: 'KeyU', key: 'u' })
    expect(history.undo).toHaveBeenCalledTimes(1)
  })

  it('OpenSpec: editor-workspace-layout / 默认历史面板 / 将当前历史快捷键同步到右键菜单', () => {
    const history = createHistoryController()
    const defaults = createDefaultComposeEditorPreferences()
    render(
      <ComposeEditor
        history={history}
        preferences={{
          ...defaults,
          shortcuts: {
            ...defaults.shortcuts,
            'history.undo': [{ code: 'KeyU' }],
          },
        }}
      />,
    )

    fireEvent.contextMenu(screen.getByRole('button', { name: '新增节点' }))

    expect(screen.getByRole('menuitem', { name: '撤销U' })
      .querySelector('[data-slot="context-menu-shortcut"]')).toHaveTextContent('U')
  })

  it('OpenSpec: editor-preferences / 可配置单次快捷键 / 拒绝同作用域冲突', () => {
    const onPreferencesChange = vi.fn()
    render(<ComposeEditor onPreferencesChange={onPreferencesChange} />)
    openSettings()
    fireEvent.click(screen.getByRole('button', { name: '快捷键' }))
    // 换过三次：平移、旋转、缩放，三个工具都已删除——旋转与缩放的入口都并进了变换指示器，
    // 而那是 chrome 的可见性、不是工具。换成仍然存在的创建容器。
    fireEvent.click(screen.getByRole('button', { name: '修改容器工具快捷键' }))
    fireEvent.keyDown(screen.getByRole('button', { name: '修改容器工具快捷键' }), {
      code: 'KeyV',
      key: 'v',
    })

    expect(screen.getByRole('alert')).toHaveTextContent('选择工具')
    expect(onPreferencesChange).not.toHaveBeenCalled()
  })

  it('OpenSpec: editor-preferences / 实例级编辑器偏好 / 通知完整偏好', () => {
    const onPreferencesChange = vi.fn()
    render(<ComposeEditor onPreferencesChange={onPreferencesChange} />)
    openSettings()
    fireEvent.click(screen.getByRole('button', { name: '快捷键' }))
    const capture = screen.getByRole('button', { name: '修改临时平移快捷键' })
    fireEvent.click(capture)
    fireEvent.keyDown(capture, { code: 'KeyP', key: 'p' })

    expect(onPreferencesChange).toHaveBeenCalledTimes(1)
    expect(onPreferencesChange).toHaveBeenCalledWith(expect.objectContaining({
      theme: 'dark',
      locale: 'zh-CN',
      shortcuts: expect.objectContaining({
        'stage.temporaryPan': [{ code: 'KeyP' }],
      }),
    }))
  })

  it('OpenSpec: editor-workspace-layout / 设置入口保持布局独立 / 从标签条打开设置', () => {
    const { container } = render(<ComposeEditor />)
    const canvasPanel = container.querySelector('[data-workspace-panel="canvas"]')

    openSettings()

    expect(screen.getByRole('dialog', { name: '设置' })).toBeInTheDocument()
    expect(canvasPanel).toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / 设置入口保持布局独立 / 更新设置期间保持布局', () => {
    const { container } = render(<ComposeEditor />)
    const canvasPanel = container.querySelector('[data-workspace-panel="canvas"]')
    openSettings()

    fireEvent.click(screen.getByRole('radio', { name: '浅色' }))

    expect(canvasPanel).toBeInTheDocument()
    expect(container.querySelector('[data-compose-ui="editor"]'))
      .toHaveAttribute('data-compose-theme', 'light')
  })

  it('OpenSpec: editor-workspace-layout / 工作区主题 token / 显示浅色默认工作区', () => {
    const { container } = render(
      <ComposeEditor
        defaultPreferences={{
          ...createDefaultComposeEditorPreferences(),
          theme: 'light',
        }}
      />,
    )

    expect(screen.getByRole('region', { name: 'Compose editor' }))
      .toHaveAttribute('data-compose-theme', 'light')
    expect(container.querySelector('[data-workspace-panel="canvas"]'))
      .toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / 工作区主题 token / 保持深色视觉', () => {
    const { container } = render(<ComposeEditor />)

    expect(screen.getByRole('region', { name: 'Compose editor' }))
      .toHaveAttribute('data-compose-theme', 'dark')
    expect(container.querySelector('[data-workspace-panel="canvas"]'))
      .toBeInTheDocument()
  })

  it('OpenSpec: ui-context / 共享 UI Context 包 / 组合共享 UI 环境 - Editor 注入并继承覆盖', () => {
    const defaults = createDefaultComposeEditorPreferences()
    render(
      <ComposeUIProvider
        locale="zh-CN"
        messages={{ 'editor.settings': '偏好设置' }}
        overrides={{ light: { accent: '#ff00aa' } }}
        theme="dark"
      >
        <ComposeEditor
          defaultPreferences={{
            ...defaults,
            locale: 'en-US',
            theme: 'light',
          }}
          slots={{ stageToolbar: <UIContextProbe /> }}
        />
      </ComposeUIProvider>,
    )

    expect(screen.getByTestId('ui-context-probe')).toHaveTextContent(
      JSON.stringify({
        theme: 'light',
        resolvedTheme: 'light',
        accent: '#ff00aa',
        locale: 'en-US',
        settings: '偏好设置',
      }),
    )
    expect(screen.getByRole('region', { name: 'Compose editor' }))
      .toHaveStyle({ '--compose-accent': '#ff00aa' })
    // 宿主注入的 `editor.settings` 文案落在应用菜单那一项上——设置的入口现在在那里。
    fireEvent.click(screen.getByRole('button', { name: 'Application menu' }))
    expect(screen.getByRole('menuitem', { name: '偏好设置' })).toBeInTheDocument()
  })

  it('OpenSpec: editor-preferences / 可配置单次快捷键 / 清除和恢复快捷键', () => {
    const onPreferencesChange = vi.fn()
    render(<ComposeEditor onPreferencesChange={onPreferencesChange} />)
    openSettings()
    fireEvent.click(screen.getByRole('button', { name: '快捷键' }))

    fireEvent.click(screen.getByRole('button', { name: '清除临时平移快捷键' }))
    expect(onPreferencesChange).toHaveBeenLastCalledWith(expect.objectContaining({
      shortcuts: expect.objectContaining({ 'stage.temporaryPan': [] }),
    }))

    fireEvent.click(screen.getByRole('button', { name: '恢复临时平移默认快捷键' }))
    expect(onPreferencesChange).toHaveBeenLastCalledWith(expect.objectContaining({
      shortcuts: expect.objectContaining({
        'stage.temporaryPan': [{ code: 'Space' }],
      }),
    }))
  })

  it('OpenSpec: editor-preferences / 设置模态弹框 / 搜索设置', () => {
    render(<ComposeEditor />)
    openSettings()
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索设置' }), {
      target: { value: '临时平移' },
    })

    expect(screen.getByText('临时平移')).toBeInTheDocument()
    expect(screen.queryByText('选择工具')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '外观' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '外观' }))
    expect(screen.getByRole('searchbox', { name: '搜索设置' })).toHaveValue('')
    expect(screen.getByRole('heading', { name: '外观' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '快捷键' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '关闭设置' }))
    openSettings()
    expect(screen.getByRole('searchbox', { name: '搜索设置' })).toHaveValue('')
    expect(screen.getByRole('heading', { name: '外观' })).toBeInTheDocument()
  })

  it('OpenSpec: editor-preferences / 快捷键输入隔离 / 查看只读手势', () => {
    render(<ComposeEditor />)
    openSettings()
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索设置' }), {
      target: { value: '方向键' },
    })

    expect(screen.getByText('方向键')).toBeInTheDocument()
    expect(screen.getByText('微调 1 世界单位；Shift 为 10')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /方向键/ })).not.toBeInTheDocument()
  })
})
