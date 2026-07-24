import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComponentRegistry } from '@compose-ui/component-registry'
import { createTransactionRuntime } from '@compose-ui/core'
import type {
  ComposeDocument,
  EditorCommand,
  TransactionRuntime,
} from '@compose-ui/core'
import { useComposeEditorController } from './controller'
import type { ComposeEditorTransactionEvent } from './controller'

const documentFixture: ComposeDocument = {
  schemaVersion: 1,
  rootIds: ['frame'],
  nodes: {
    frame: {
      id: 'frame',
      kind: 'frame',
      name: 'Dashboard',
      visible: true,
      locked: false,
      transform: { x: 40, y: 30, width: 800, height: 600, rotation: 0 },
      childIds: ['group'],
    },
    group: {
      id: 'group',
      kind: 'group',
      name: 'Header',
      visible: true,
      locked: false,
      transform: { x: 20, y: 20, width: 400, height: 100, rotation: 0 },
      childIds: ['title'],
    },
    title: {
      id: 'title',
      kind: 'component',
      name: 'Title',
      visible: true,
      locked: false,
      transform: { x: 10, y: 10, width: 180, height: 40, rotation: 0 },
      componentType: 'text',
      props: { text: 'Before' },
    },
  },
}

function runtime() {
  let transactionIndex = 0
  return createTransactionRuntime({
    document: documentFixture,
    idFactory: () => `transaction-${transactionIndex++}`,
    clock: () => transactionIndex * 10,
  })
}

const registry = createComponentRegistry([{
  type: 'text',
  label: '文本',
  defaultSize: { width: 180, height: 40 },
  createDefaultProps: () => ({ text: 'New' }),
  renderer: ({ props }) => <span>{String(props.text)}</span>,
  inspector: ({ node, dispatch }) => (
    <button
      type="button"
      onClick={() => dispatch({
        id: 'inspector-command',
        type: 'node.props.set',
        payload: { nodeId: node.id, path: ['text'], value: 'After' },
        meta: { label: '修改文本', source: 'inspector', targetIds: [node.id] },
      })}
    >
      修改属性
    </button>
  ),
}])

afterEach(cleanup)

describe('useComposeEditorController', () => {
  it('OpenSpec: editor-workspace-layout / Controller 驱动的默认组合 / 统一派发不同面板意图', () => {
    const editorRuntime = runtime()
    const { result } = renderHook(() => useComposeEditorController({
      runtime: editorRuntime,
      registry,
      initialSelection: ['title'],
      initialExpandedIds: ['frame', 'group'],
      initialActiveFrameId: 'frame',
      idFactory: () => 'controller-command',
    }))

    expect(result.current.document).toBe(editorRuntime.document)
    expect(result.current.stageProps.document).toBe(editorRuntime.document)
    expect(result.current.sceneTreeProps.nodes[0]?.children?.[0]?.children?.[0]?.label)
      .toBe('Title')
    expect(result.current.history).toBe(editorRuntime)

    act(() => {
      result.current.sceneTreeProps.onOperation?.({
        type: 'rename',
        nodeId: 'title',
        label: 'Latest title',
      })
    })
    expect(editorRuntime.document.nodes.title?.name).toBe('Latest title')
    expect(result.current.stageProps.document.nodes.title?.name).toBe('Latest title')

    const { rerender } = render(result.current.inspectorPanel)
    fireEvent.click(screen.getByRole('button', { name: '修改属性' }))
    rerender(result.current.inspectorPanel)
    expect(editorRuntime.document.nodes.title?.kind === 'component'
      ? editorRuntime.document.nodes.title.props.text
      : null).toBe('After')
  })

  it('OpenSpec: editor-workspace-layout / Controller 驱动的默认组合 / 清理失效会话状态', () => {
    const editorRuntime = runtime()
    const { result } = renderHook(() => useComposeEditorController({
      runtime: editorRuntime,
      registry,
      initialSelection: ['title'],
      initialExpandedIds: ['frame', 'group', 'title'],
      initialActiveFrameId: 'frame',
    }))

    act(() => {
      editorRuntime.dispatch({
        id: 'hide',
        type: 'node.set-visibility',
        payload: { nodeIds: ['title'], visible: false },
      })
    })

    expect(result.current.selectedIds).toEqual([])
    expect(result.current.expandedIds).toEqual(['frame', 'group'])

    act(() => {
      editorRuntime.dispatch({
        id: 'delete-frame',
        type: 'node.delete',
        payload: { nodeIds: ['frame'] },
      })
    })
    expect(result.current.expandedIds).toEqual([])
    expect(result.current.activeFrameId).toBeNull()
  })

  it('以紧凑图标工具栏暴露完整的可访问名称和工具状态', () => {
    const editorRuntime = runtime()
    const { result } = renderHook(() => useComposeEditorController({
      runtime: editorRuntime,
      registry,
      initialActiveFrameId: 'frame',
    }))
    const toolbar = render(result.current.stageToolbar)

    expect(screen.getByRole('toolbar', { name: 'Stage 工具栏' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '适配选择' })).toBeDisabled()
    expect(screen.getByLabelText('缩放比例')).toHaveTextContent('100%')

    fireEvent.click(screen.getByRole('button', { name: '平移' }))
    toolbar.rerender(result.current.stageToolbar)
    expect(result.current.tool).toBe('pan')
    expect(screen.getByRole('button', { name: '平移' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('maps a cross-parent SceneTree move to a geometry-preserving transaction', () => {
    const editorRuntime = runtime()
    const { result } = renderHook(() => useComposeEditorController({
      runtime: editorRuntime,
      registry,
      idFactory: () => 'move-command',
    }))

    act(() => {
      result.current.sceneTreeProps.onOperation?.({
        type: 'move',
        nodeIds: ['title'],
        parentId: 'frame',
        index: 0,
      })
    })

    expect(editorRuntime.document.nodes.frame?.kind === 'frame'
      ? editorRuntime.document.nodes.frame.childIds
      : []).toContain('title')
    expect(editorRuntime.document.nodes.title?.transform).toEqual(
      expect.objectContaining({ x: 30, y: 30 }),
    )
  })

  // OpenSpec: editor-workspace-layout / 单一事务观察边界 / 日志写入失败
  it('OpenSpec: editor-workspace-layout / 单一事务观察边界 / 记录成功事务和导航', async () => {
    const editorRuntime = runtime()
    const observer = vi.fn((event: ComposeEditorTransactionEvent) => {
      void event
      return Promise.reject(new Error('log unavailable'))
    })
    renderHook(() => useComposeEditorController({
      runtime: editorRuntime,
      registry,
      onTransaction: observer,
    }))
    const rename: EditorCommand = {
      id: 'rename',
      type: 'node.rename',
      payload: { nodeId: 'title', name: 'Committed title' },
      meta: { source: 'scene-tree', targetIds: ['title'] },
    }

    act(() => {
      editorRuntime.dispatch(rename)
      editorRuntime.undo()
    })
    await act(async () => Promise.resolve())

    expect(observer).toHaveBeenCalledTimes(2)
    expect(observer.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      direction: 'commit',
      source: 'scene-tree',
      targets: ['title'],
      transaction: expect.objectContaining({ commandId: 'rename' }),
    }))
    expect(observer.mock.calls[1]?.[0]).toEqual(expect.objectContaining({
      direction: 'undo',
      source: 'history',
      targets: ['title'],
      transaction: expect.objectContaining({ commandId: 'rename' }),
    }))
    expect(editorRuntime.document.nodes.title?.name).toBe('Title')
  })

  it('OpenSpec: editor-workspace-layout / 单一事务观察边界 / 忽略非成功编辑', () => {
    const editorRuntime: TransactionRuntime = runtime()
    const observer = vi.fn()
    renderHook(() => useComposeEditorController({
      runtime: editorRuntime,
      registry,
      onTransaction: observer,
    }))

    act(() => {
      editorRuntime.dispatch({
        id: 'noop',
        type: 'node.rename',
        payload: { nodeId: 'title', name: 'Title' },
      })
      editorRuntime.dispatch({ id: 'rejected', type: 'unknown', payload: {} })
      editorRuntime.reset(documentFixture)
    })

    expect(observer).not.toHaveBeenCalled()
  })
})
