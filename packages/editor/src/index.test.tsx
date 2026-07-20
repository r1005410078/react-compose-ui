import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const initializeWorkspaceMock = vi.hoisted(() => vi.fn())

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
    DockviewReact: ({ components, onReady }: {
      components: Record<string, React.FunctionComponent>
      onReady: (event: typeof readyEvent) => void
    }) => {
      React.useEffect(() => {
        onReady(readyEvent)
      }, [onReady])

      return React.createElement(
        'div',
        { 'data-testid': 'dockview' },
        Object.entries(components).map(([name, Component]) =>
          React.createElement(Component, { key: name }),
        ),
      )
    },
  }
})

import { ComposeEditor } from './index'

afterEach(() => {
  cleanup()
  initializeWorkspaceMock.mockClear()
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
