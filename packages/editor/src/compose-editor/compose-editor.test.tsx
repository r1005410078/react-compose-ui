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

// 外层 initializeOuterWorkspace 保持 mock：本文件只关心中央/文档面板行为
// （现在挂在内层 core Dockview 上），bottom Edge Group 的结构已经在
// workspace-layout.test.ts 里覆盖。
const initializeOuterWorkspaceMock = vi.hoisted(() => vi.fn())
// 外层 mock api 只需要是一个跨渲染稳定的引用，供 handleOuterReady 的幂等判断使用；
// initializeOuterWorkspace 本身被整体 mock 掉，不会真的调用它的方法。
const outerDockviewMock = vi.hoisted(() => ({}))
// 内层 scene/canvas/inspector Dockview：initializeCoreWorkspace 未被 mock，会真的对这个
// 假 api 调用 addGroup/addEdgeGroup/addPanel，所以形状要跟 workspace-layout.test.ts 里的
// createWorkspaceApi 一致，而不只是原来的 addPanel/getPanel。
const workspaceDockviewMock = vi.hoisted(() => {
  const groups = new Map<string, { id: string; locked?: string }>()
  const edgeGroups = new Map<string, { id: string; locked?: string }>()
  const panels = new Map<string, { id: string; api: { close: ReturnType<typeof vi.fn>; setActive: ReturnType<typeof vi.fn> } }>()
  return {
    addGroup: vi.fn((options: { id: string }) => {
      const group = { id: options.id, locked: undefined as string | undefined }
      groups.set(options.id, group)
      return group
    }),
    getGroup: vi.fn((id: string) => groups.get(id)),
    addEdgeGroup: vi.fn((position: string, options: { id: string }) => {
      const group = { id: options.id, locked: undefined as string | undefined }
      groups.set(options.id, group)
      edgeGroups.set(position, group)
      return group
    }),
    getEdgeGroup: vi.fn((position: string) => edgeGroups.get(position)),
    addPanel: vi.fn((options: { id: string }) => {
      const panel = {
        id: options.id,
        api: { close: vi.fn(), setActive: vi.fn() },
      }
      panels.set(options.id, panel)
      return panel
    }),
    getPanel: vi.fn((id: string) => panels.get(id)),
    groups,
    edgeGroups,
    panels,
  }
})
const sceneHistoryDockviewMock = vi.hoisted(() => {
  const groups = new Map<string, { id: string; locked?: string }>()
  const panels = new Map<string, {
    id: string
    api: { close: ReturnType<typeof vi.fn>; setActive: ReturnType<typeof vi.fn> }
  }>()
  return {
    height: 480,
    addGroup: vi.fn((options: { id: string }) => {
      const group = { id: options.id, locked: undefined as string | undefined }
      groups.set(options.id, group)
      return group
    }),
    addPanel: vi.fn((options: { id: string }) => {
      const panel = {
        id: options.id,
        api: {
          close: vi.fn(() => panels.delete(options.id)),
          setActive: vi.fn(),
        },
      }
      panels.set(options.id, panel)
      return panel
    }),
    getGroup: vi.fn((id: string) => groups.get(id)),
    getPanel: vi.fn((id: string) => panels.get(id)),
    groups,
    panels,
  }
})

vi.mock('../workspace-layout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../workspace-layout')>()

  return {
    ...actual,
    initializeOuterWorkspace: initializeOuterWorkspaceMock,
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
  // 三层 Dockview：外层（只挂 core 面板 + bottom Edge Group，被 initializeOuterWorkspace mock
  // 整体接管）、中层 core（scene/canvas/inspector，真的跑 initializeCoreWorkspace）、
  // 最内层 scene-history（场景/组件库/历史，真的跑 initializeSceneToolsWorkspace）。
  const apiByClassName: Record<string, unknown> = {
    'compose-editor__core-dockview': workspaceDockviewMock,
    'compose-editor__scene-history-dockview': sceneHistoryDockviewMock,
  }
  const testIdByClassName: Record<string, string> = {
    'compose-editor__core-dockview': 'core-dockview',
    'compose-editor__scene-history-dockview': 'scene-history-dockview',
  }

  return {
    themeAbyss: { name: 'abyss', className: 'dockview-theme-abyss' },
    DockviewDefaultTab: ({ api }: { api: { title?: string } }) =>
      React.createElement('span', null, api.title),
    DockviewReact: ({ className, components, onReady, rightHeaderActionsComponent: HeaderActions }: {
      className?: string
      components: Record<string, React.FunctionComponent>
      onReady: (event: { api: unknown }) => void
      rightHeaderActionsComponent?: React.FunctionComponent<{
        group: { id: string }
      }>
    }) => {
      const api = (className && apiByClassName[className]) || outerDockviewMock
      const testId = (className && testIdByClassName[className]) || 'dockview'
      React.useEffect(() => {
        onReady({ api })
      }, [api, onReady])

      return React.createElement(
        'div',
        { 'data-testid': testId },
        className === 'compose-editor__core-dockview' && HeaderActions
          ? React.createElement(HeaderActions, {
              group: { id: 'compose-scene-edge' },
            })
          : null,
        Object.entries(components).map(([name, Component]) =>
          React.createElement(Component, { key: name }),
        ),
      )
    },
  }
})

import { ComposeEditor } from '../index'
import type { ComposeEditorController } from '../index'
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
  initializeOuterWorkspaceMock.mockClear()
  workspaceDockviewMock.groups.clear()
  workspaceDockviewMock.edgeGroups.clear()
  workspaceDockviewMock.panels.clear()
  Object.values(workspaceDockviewMock).forEach((member) => {
    if (typeof member === 'function' && 'mockClear' in member) member.mockClear()
  })
  sceneHistoryDockviewMock.groups.clear()
  sceneHistoryDockviewMock.panels.clear()
  Object.values(sceneHistoryDockviewMock).forEach((member) => {
    if (typeof member === 'function' && 'mockClear' in member) member.mockClear()
  })
})

describe('ComposeEditor', () => {
  it('OpenSpec: editor-workspace-layout / 中央 Canvas Group 承载资源文档 / 打开同一资源只创建一个 always 标签', async () => {
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
    // 初次挂载已经为内层 Dockview 建了 canvas/scene/inspector 三个面板；
    // 下面只关心打开资源文档这一次动作触发的 addPanel 调用。
    workspaceDockviewMock.addPanel.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'mock asset open' }))
    await waitFor(() => expect(workspaceDockviewMock.addPanel).toHaveBeenCalledWith(expect.objectContaining({
      component: 'assetDocument',
      id: 'compose-asset-document:memory:logo-key',
      renderer: 'always',
      title: 'logo.svg',
      position: { direction: 'within', referenceGroup: 'compose-canvas-group' },
    })))

    fireEvent.click(screen.getByRole('button', { name: 'mock asset open' }))
    expect(workspaceDockviewMock.addPanel).toHaveBeenCalledTimes(1)
    expect(workspaceDockviewMock.getPanel('compose-asset-document:memory:logo-key')?.api.setActive)
      .toHaveBeenCalledTimes(1)
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
    expect(initializeOuterWorkspaceMock).toHaveBeenCalledTimes(1)
  })

  it('OpenSpec: editor-workspace-layout / 场景下方工具分栏 / 使用默认历史面板', () => {
    const history = createHistoryController()
    render(<ComposeEditor history={history} />)

    expect(screen.getByTestId('default-scene-tree')).toBeInTheDocument()
    expect(screen.getByTestId('scene-history-dockview')).toBeInTheDocument()
    expect(screen.getByLabelText('历史记录')).toHaveAttribute('data-compose-ui', 'history')
    expect(screen.queryByRole('separator', { name: '调整场景树与历史记录高度' }))
      .not.toBeInTheDocument()
    expect(sceneHistoryDockviewMock.addPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'compose-component-library-panel',
        position: { referenceGroup: 'compose-scene-tools-group' },
      }),
    )
    expect(sceneHistoryDockviewMock.addPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'compose-history-panel',
        initialHeight: 192,
        minimumHeight: 120,
        position: { referenceGroup: 'compose-scene-tools-group' },
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
    expect(screen.getByTestId('scene-history-dockview')).toBeInTheDocument()
    expect(screen.queryByLabelText('历史记录')).not.toBeInTheDocument()

    rerender(<ComposeEditor history={history} slots={{ history: null }} />)
    expect(screen.queryByText('自定义历史')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('历史记录')).not.toBeInTheDocument()
    expect(screen.getByTestId('scene-history-dockview')).toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / 场景下方工具分栏 / 不启用历史', () => {
    render(<ComposeEditor />)

    expect(screen.getByTestId('scene-history-dockview')).toBeInTheDocument()
    expect(sceneHistoryDockviewMock.addPanel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'compose-component-library-panel' }),
    )
    expect(sceneHistoryDockviewMock.addPanel).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'compose-history-panel' }),
    )
    expect(screen.queryByLabelText('历史记录')).not.toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / 场景下方工具分栏 / 不启用历史：动态移除 History', () => {
    const history = createHistoryController()
    const { rerender } = render(<ComposeEditor history={history} />)
    const historyPanel = sceneHistoryDockviewMock.getPanel('compose-history-panel')

    rerender(<ComposeEditor />)

    expect(historyPanel?.api.close).toHaveBeenCalledTimes(1)
    expect(sceneHistoryDockviewMock.getPanel('compose-history-panel')).toBeUndefined()
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
    expect(sceneHistoryDockviewMock.addGroup).toHaveBeenCalledWith({
      direction: 'right',
      id: 'compose-scene-content-group',
      constraints: { minimumHeight: 160 },
    })
    expect(sceneHistoryDockviewMock.addGroup).toHaveBeenCalledWith({
      constraints: { minimumHeight: 120 },
      direction: 'below',
      id: 'compose-scene-tools-group',
      initialHeight: 192,
      referenceGroup: 'compose-scene-content-group',
    })
    expect(sceneHistoryDockviewMock.addPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'compose-scene-content-panel',
        minimumHeight: 160,
      }),
    )
    expect(sceneHistoryDockviewMock.addGroup).toHaveBeenCalledTimes(2)
    expect(sceneHistoryDockviewMock.addPanel).toHaveBeenCalledTimes(3)
    expect(sceneHistoryDockviewMock.getPanel('compose-component-library-panel')?.api.setActive)
      .toHaveBeenCalledTimes(1)
  })

  it('OpenSpec: editor-workspace-layout / Dockview 场景工具布局 / 编辑器内容更新', () => {
    const firstHistory = createHistoryController()
    const { rerender } = render(
      <ComposeEditor history={firstHistory} slots={{ inspector: '第一版属性' }} />,
    )
    const nestedDockview = screen.getByTestId('scene-history-dockview')

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
    expect(screen.getByTestId('scene-history-dockview')).toBe(nestedDockview)
    expect(sceneHistoryDockviewMock.addPanel).toHaveBeenCalledTimes(3)
    expect(initializeOuterWorkspaceMock).toHaveBeenCalledTimes(1)
  })

  it('OpenSpec: editor-workspace-layout / React 内容插槽 / 默认显示空场景树', () => {
    render(<ComposeEditor />)

    expect(screen.getByTestId('default-scene-tree')).toBeEmptyDOMElement()
    expect(screen.getAllByRole('status')).toHaveLength(8)
    expect(screen.getByText('舞台工具栏')).toBeInTheDocument()
    expect(screen.getByText('基础组件内容')).toBeInTheDocument()
    expect(screen.getByText('连接资源 Provider 以浏览文件')).toBeInTheDocument()
    expect(screen.getByText('组件属性内容')).toBeInTheDocument()
    expect(screen.getByText('事务日志内容')).toBeInTheDocument()
    expect(screen.getByText('命令内容')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '动画编辑器' })).toBeInTheDocument()
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
    expect(initializeOuterWorkspaceMock).toHaveBeenCalledTimes(1)
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

  it('OpenSpec: editor-workspace-layout / 四区编辑器工作区 / Strict Mode 重放初始化', () => {
    render(
      <StrictMode>
        <ComposeEditor />
      </StrictMode>,
    )

    expect(initializeOuterWorkspaceMock).toHaveBeenCalledTimes(1)
  })

  it('OpenSpec: editor-preferences / 设置模态弹框 / 打开和关闭设置', async () => {
    const { container } = render(<ComposeEditor />)

    const button = screen.getByRole('button', { name: '设置' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')

    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: '设置' })).toHaveAttribute(
      'aria-modal',
      'true',
    )
    expect(screen.getByTestId('dockview').parentElement).toHaveAttribute('inert')
    await waitFor(() => {
      expect(screen.getByRole('searchbox', { name: '搜索设置' })).toHaveFocus()
    })
    expect(screen.getByRole('dialog', { name: '设置' }).closest('[data-base-ui-portal]'))
      .not.toBe(container)

    fireEvent.click(screen.getByRole('button', { name: '关闭设置' }))
    expect(screen.queryByRole('dialog', { name: '设置' })).not.toBeInTheDocument()
    expect(screen.getByTestId('dockview').parentElement).not.toHaveAttribute('inert')
    expect(button).toHaveFocus()
  })

  it('OpenSpec: editor-preferences / 设置模态弹框 / 使用 Escape 关闭设置', () => {
    render(<ComposeEditor />)
    fireEvent.click(screen.getByRole('button', { name: '设置' }))
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
    expect(screen.getByRole('button', { name: '设置' })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: '设置' }))
    fireEvent.mouseDown(screen.getByTestId('settings-backdrop'))
    expect(screen.queryByRole('dialog', { name: '设置' })).not.toBeInTheDocument()
  })

  it('OpenSpec: editor-preferences / 主题解析 / 切换明确主题', () => {
    const onPreferencesChange = vi.fn()
    render(<ComposeEditor onPreferencesChange={onPreferencesChange} />)
    const editor = screen.getByRole('region', { name: 'Compose editor' })

    expect(editor).toHaveAttribute('data-compose-theme', 'dark')
    fireEvent.click(screen.getByRole('button', { name: '设置' }))
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
    fireEvent.click(screen.getByRole('button', { name: '设置' }))
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
    fireEvent.click(screen.getByRole('button', { name: '设置' }))
    fireEvent.click(screen.getByRole('button', { name: '语言' }))
    fireEvent.click(screen.getByRole('radio', { name: 'English' }))

    // Modal 打开时 Base UI 会将背景从可访问树隔离，仍通过渲染容器断言其语言状态。
    const editor = container.querySelector('[data-compose-ui="editor"]')
    expect(editor).not.toBeNull()
    expect(editor).toHaveAttribute('lang', 'en-US')
    expect(container.querySelector('.compose-editor__settings-icon'))
      .toHaveAttribute('aria-label', 'Settings')
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
    fireEvent.click(screen.getByRole('button', { name: '设置' }))
    fireEvent.click(screen.getByRole('button', { name: '快捷键' }))
    fireEvent.click(screen.getByRole('button', { name: '修改平移工具快捷键' }))
    fireEvent.keyDown(screen.getByRole('button', { name: '修改平移工具快捷键' }), {
      code: 'KeyV',
      key: 'v',
    })

    expect(screen.getByRole('alert')).toHaveTextContent('选择工具')
    expect(onPreferencesChange).not.toHaveBeenCalled()
  })

  it('OpenSpec: editor-preferences / 实例级编辑器偏好 / 通知完整偏好', () => {
    const onPreferencesChange = vi.fn()
    render(<ComposeEditor onPreferencesChange={onPreferencesChange} />)
    fireEvent.click(screen.getByRole('button', { name: '设置' }))
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

  it('OpenSpec: editor-workspace-layout / 设置入口保持布局独立 / 从活动栏打开设置', () => {
    const { container } = render(<ComposeEditor />)
    const canvasPanel = container.querySelector('[data-workspace-panel="canvas"]')

    fireEvent.click(screen.getByRole('button', { name: '设置' }))

    expect(screen.getByRole('dialog', { name: '设置' })).toBeInTheDocument()
    expect(canvasPanel).toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / 设置入口保持布局独立 / 更新设置期间保持布局', () => {
    const { container } = render(<ComposeEditor />)
    const canvasPanel = container.querySelector('[data-workspace-panel="canvas"]')
    fireEvent.click(screen.getByRole('button', { name: '设置' }))

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
    expect(screen.getByRole('button', { name: '偏好设置' })).toBeInTheDocument()
  })

  it('OpenSpec: editor-preferences / 可配置单次快捷键 / 清除和恢复快捷键', () => {
    const onPreferencesChange = vi.fn()
    render(<ComposeEditor onPreferencesChange={onPreferencesChange} />)
    fireEvent.click(screen.getByRole('button', { name: '设置' }))
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
    fireEvent.click(screen.getByRole('button', { name: '设置' }))
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
    fireEvent.click(screen.getByRole('button', { name: '设置' }))
    expect(screen.getByRole('searchbox', { name: '搜索设置' })).toHaveValue('')
    expect(screen.getByRole('heading', { name: '外观' })).toBeInTheDocument()
  })

  it('OpenSpec: editor-preferences / 快捷键输入隔离 / 查看只读手势', () => {
    render(<ComposeEditor />)
    fireEvent.click(screen.getByRole('button', { name: '设置' }))
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索设置' }), {
      target: { value: '方向键' },
    })

    expect(screen.getByText('方向键')).toBeInTheDocument()
    expect(screen.getByText('微调 1 世界单位；Shift 为 10')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /方向键/ })).not.toBeInTheDocument()
  })
})
