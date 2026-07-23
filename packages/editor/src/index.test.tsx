import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HistoryNavigationController } from '@compose-ui/history'

const initializeWorkspaceMock = vi.hoisted(() => vi.fn())
const sceneHistoryDockviewMock = vi.hoisted(() => ({
  height: 480,
  addGroup: vi.fn((options: { id: string }) => ({
    id: options.id,
    locked: undefined as string | undefined,
  })),
  addPanel: vi.fn((options: { id: string }) => ({
    id: options.id,
    api: { setActive: vi.fn() },
  })),
  getGroup: vi.fn(() => undefined),
  getPanel: vi.fn(() => undefined),
}))

vi.mock('./workspace-layout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./workspace-layout')>()

  return {
    ...actual,
    initializeWorkspace: initializeWorkspaceMock,
  }
})

vi.mock('@compose-ui/scene-tree', async () => {
  const React = await import('react')
  return {
    SceneTree: ({ nodes }: { nodes: ReadonlyArray<{ label: string }> }) =>
      React.createElement(
        'div',
        { 'data-testid': 'default-scene-tree' },
        nodes.map((node) => node.label).join(','),
      ),
  }
})

vi.mock('dockview-react', async () => {
  const React = await import('react')
  const readyEvent = { api: { id: 'test-api' } }

  return {
    themeAbyss: { name: 'abyss', className: 'dockview-theme-abyss' },
    DockviewDefaultTab: ({ api }: { api: { title?: string } }) =>
      React.createElement('span', null, api.title),
    DockviewReact: ({ className, components, onReady }: {
      className?: string
      components: Record<string, React.FunctionComponent>
      onReady: (event: { api: unknown }) => void
    }) => {
      const nested = className === 'compose-editor__scene-history-dockview'
      React.useEffect(() => {
        onReady(nested ? { api: sceneHistoryDockviewMock } : readyEvent)
      }, [nested, onReady])

      return React.createElement(
        'div',
        { 'data-testid': nested ? 'scene-history-dockview' : 'dockview' },
        Object.entries(components).map(([name, Component]) =>
          React.createElement(Component, { key: name }),
        ),
      )
    },
  }
})

import { ComposeEditor } from './index'

function createHistoryController(
  overrides: Partial<HistoryNavigationController> = {},
): HistoryNavigationController {
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
  initializeWorkspaceMock.mockClear()
  Object.values(sceneHistoryDockviewMock).forEach((member) => {
    if (typeof member === 'function' && 'mockClear' in member) member.mockClear()
  })
})

describe('ComposeEditor', () => {
  it('mounts the six content sources in their semantic workspace panels', () => {
    render(
      <ComposeEditor
        sceneGraphPanel="Scene slot"
        canvasToolbar="Toolbar slot"
        inspectorPanel="Inspector slot"
        transactionLogPanel="Transaction slot"
        commandPanel="Command slot"
      >
        Canvas slot
      </ComposeEditor>,
    )

    expect(screen.getByText('Scene slot')).toBeInTheDocument()
    expect(screen.getByText('Toolbar slot')).toBeInTheDocument()
    expect(screen.getByText('Canvas slot')).toBeInTheDocument()
    expect(screen.getByText('Inspector slot')).toBeInTheDocument()
    expect(screen.getByText('Transaction slot')).toBeInTheDocument()
    expect(screen.getByText('Command slot')).toBeInTheDocument()
  })

  it('updates slot content without reinitializing the workspace', () => {
    const { rerender } = render(
      <ComposeEditor inspectorPanel="First inspector" />,
    )

    rerender(<ComposeEditor inspectorPanel="Latest inspector" />)

    expect(screen.getByText('Latest inspector')).toBeInTheDocument()
    expect(screen.queryByText('First inspector')).not.toBeInTheDocument()
    expect(initializeWorkspaceMock).toHaveBeenCalledTimes(1)
  })

  it('OpenSpec: editor-workspace-layout / 可选场景历史分栏 / 使用默认历史面板', () => {
    const history = createHistoryController()
    render(<ComposeEditor history={history} />)

    expect(screen.getByTestId('default-scene-tree')).toBeInTheDocument()
    expect(screen.getByTestId('scene-history-dockview')).toBeInTheDocument()
    expect(screen.getByLabelText('历史记录')).toHaveAttribute('data-compose-ui', 'history')
    expect(screen.queryByRole('separator', { name: '调整场景树与历史记录高度' }))
      .not.toBeInTheDocument()
    expect(sceneHistoryDockviewMock.addPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'compose-history-panel',
        initialHeight: 192,
        minimumHeight: 120,
        position: { referenceGroup: 'compose-history-group' },
      }),
    )

    const historyButton = screen.getByRole('button', { name: '开始' })
    fireEvent.click(historyButton)
    expect(history.navigate).toHaveBeenCalledWith('beginning')
  })

  it('OpenSpec: editor-workspace-layout / 可选场景历史分栏 / 覆盖历史面板', () => {
    const history = createHistoryController()
    const { rerender } = render(
      <ComposeEditor history={history} historyPanel={<div>自定义历史</div>} />,
    )

    expect(screen.getByText('自定义历史')).toBeInTheDocument()
    expect(screen.getByTestId('scene-history-dockview')).toBeInTheDocument()
    expect(screen.queryByLabelText('历史记录')).not.toBeInTheDocument()

    rerender(<ComposeEditor history={history} historyPanel={null} />)
    expect(screen.queryByText('自定义历史')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('历史记录')).not.toBeInTheDocument()
    expect(screen.getByTestId('scene-history-dockview')).toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / 可选场景历史分栏 / 不启用历史', () => {
    render(<ComposeEditor />)

    expect(screen.queryByRole('separator', { name: '调整场景树与历史记录高度' }))
      .not.toBeInTheDocument()
    expect(screen.queryByLabelText('历史记录')).not.toBeInTheDocument()
    expect(screen.queryByTestId('scene-history-dockview')).not.toBeInTheDocument()
  })

  it('runs history shortcuts from editor inputs while preserving the controlled panel override', () => {
    const history = createHistoryController({ canRedo: true })
    render(
      <ComposeEditor
        commandPanel={<input aria-label="编辑器命令" />}
        history={history}
        historyPanel={<div>自定义历史</div>}
      />,
    )
    const input = screen.getByLabelText('编辑器命令')

    expect(fireEvent.keyDown(input, { key: 'z', ctrlKey: true })).toBe(false)
    fireEvent.keyDown(input, { key: 'z', ctrlKey: true, shiftKey: true })
    expect(history.undo).toHaveBeenCalledTimes(1)
    expect(history.redo).toHaveBeenCalledTimes(1)
  })

  it('OpenSpec: editor-workspace-layout / Dockview 场景历史布局 / 调整历史高度', () => {
    render(<ComposeEditor history={createHistoryController()} />)
    expect(sceneHistoryDockviewMock.addGroup).toHaveBeenCalledWith({
      direction: 'right',
      id: 'compose-scene-content-group',
      constraints: { minimumHeight: 160 },
    })
    expect(sceneHistoryDockviewMock.addGroup).toHaveBeenCalledWith({
      constraints: { minimumHeight: 120 },
      direction: 'below',
      id: 'compose-history-group',
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
    expect(sceneHistoryDockviewMock.addPanel).toHaveBeenCalledTimes(2)
  })

  it('OpenSpec: editor-workspace-layout / Dockview 场景历史布局 / 编辑器内容更新', () => {
    const firstHistory = createHistoryController()
    const { rerender } = render(
      <ComposeEditor history={firstHistory} inspectorPanel="第一版属性" />,
    )
    const nestedDockview = screen.getByTestId('scene-history-dockview')

    rerender(
      <ComposeEditor
        history={createHistoryController({
          entries: [...firstHistory.entries, { id: 'latest', label: '最新动作' }],
          activeEntryId: 'latest',
        })}
        inspectorPanel="第二版属性"
      />,
    )

    expect(screen.getByRole('button', { name: '最新动作' })).toBeInTheDocument()
    expect(screen.getByText('第二版属性')).toBeInTheDocument()
    expect(screen.getByTestId('scene-history-dockview')).toBe(nestedDockview)
    expect(sceneHistoryDockviewMock.addPanel).toHaveBeenCalledTimes(2)
    expect(initializeWorkspaceMock).toHaveBeenCalledTimes(1)
  })

  it('OpenSpec: editor-workspace-layout / React 内容插槽 / 默认显示空场景树', () => {
    render(<ComposeEditor />)

    expect(screen.getByTestId('default-scene-tree')).toBeEmptyDOMElement()
    expect(screen.getAllByRole('status')).toHaveLength(4)
    expect(screen.getByText('Canvas toolbar')).toBeInTheDocument()
    expect(screen.getByText('Component inspector content')).toBeInTheDocument()
    expect(screen.getByText('Transaction log content')).toBeInTheDocument()
    expect(screen.getByText('Command content')).toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / React 内容插槽 / 插槽与场景树内容更新', () => {
    const { rerender } = render(
      <ComposeEditor
        sceneTreeProps={{ nodes: [{ id: 'first', label: 'First' }], selectedIds: [], expandedIds: [] }}
      />,
    )

    rerender(
      <ComposeEditor
        sceneTreeProps={{ nodes: [{ id: 'latest', label: 'Latest' }], selectedIds: [], expandedIds: [] }}
      />,
    )

    expect(screen.getByTestId('default-scene-tree')).toHaveTextContent('Latest')
    expect(initializeWorkspaceMock).toHaveBeenCalledTimes(1)
  })

  it('OpenSpec: editor-workspace-layout / React 内容插槽 / 宿主覆盖场景树', () => {
    const { rerender } = render(<ComposeEditor sceneGraphPanel="Custom scene" />)
    expect(screen.getByText('Custom scene')).toBeInTheDocument()
    expect(screen.queryByTestId('default-scene-tree')).not.toBeInTheDocument()

    rerender(<ComposeEditor sceneGraphPanel={null} />)
    expect(screen.queryByTestId('default-scene-tree')).not.toBeInTheDocument()
  })

  it('preserves root section attributes and events', () => {
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

  it('guards workspace initialization during Strict Mode effect replay', () => {
    render(
      <StrictMode>
        <ComposeEditor />
      </StrictMode>,
    )

    expect(initializeWorkspaceMock).toHaveBeenCalledTimes(1)
  })
})
