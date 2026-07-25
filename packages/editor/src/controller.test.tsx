import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComponentRegistry } from '@compose-ui/component-registry'
import {
  createDefaultCanvasSettings,
  createTransactionRuntime,
} from '@compose-ui/core'
import type { NodeInspectorProps } from '@compose-ui/component-registry'
import type { ComposeFrameNode, ComposeGroupNode } from '@compose-ui/core'
import type {
  ComposeDocument,
  EditorCommand,
  TransactionRuntime,
} from '@compose-ui/core'
import { useComposeEditorController } from './controller'
import type { ComposeEditorTransactionEvent } from './controller'

const documentFixture: ComposeDocument = {
  schemaVersion: 2,
  canvas: createDefaultCanvasSettings(),
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

function ContainerInspector({
  node,
  dispatch,
}: NodeInspectorProps<ComposeFrameNode | ComposeGroupNode>) {
  return (
    <button
      type="button"
      onClick={() => dispatch({
        id: 'container-style',
        type: 'node.style.set',
        payload: { nodeId: node.id, path: ['backgroundColor'], value: '#123456' },
        meta: {
          label: `Update ${node.name} · background #123456`,
          source: 'inspector',
          targetIds: [node.id],
        },
      })}
    >
      修改容器样式
    </button>
  )
}

function StrictControllerWorkspace({
  transactionRuntime,
}: {
  transactionRuntime: TransactionRuntime
}) {
  const controller = useComposeEditorController({
    runtime: transactionRuntime,
    registry,
  })
  return (
    <>
      {controller.componentLibraryPanel}
      {controller.stage}
    </>
  )
}

afterEach(cleanup)

describe('useComposeEditorController', () => {
  it('OpenSpec: editor-workspace-layout / 共享 Stage controller / Stage 与 Palette 使用同一实例并在卸载时释放', async () => {
    const editorRuntime = runtime()
    const hook = renderHook(() => useComposeEditorController({
      runtime: editorRuntime,
      registry,
    }))
    const controller = hook.result.current.interactionController
    const palette = hook.result.current.componentLibraryPanel as ReactElement<{
      interactionController: unknown
    }>

    expect(hook.result.current.stageProps.interactionController).toBe(controller)
    expect(palette.props.interactionController).toBe(controller)

    hook.unmount()
    await act(async () => new Promise<void>((resolve) => queueMicrotask(resolve)))
    expect(() => controller.connectSurface({
      resolveClientPoint: (point) => point,
      applyEffects: () => undefined,
    })).toThrow(/disposed/)
  })

  it('OpenSpec: editor-workspace-layout / 共享 Stage controller / StrictMode 重放后保持可用', async () => {
    const editorRuntime = runtime()
    const hook = renderHook(() => useComposeEditorController({
      runtime: editorRuntime,
      registry,
    }), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <StrictMode>{children}</StrictMode>
      ),
    })
    const controller = hook.result.current.interactionController
    const disconnect = controller.connectSurface({
      resolveClientPoint: (point) => point,
      applyEffects: () => undefined,
    })

    disconnect()
    hook.unmount()
    await act(async () => new Promise<void>((resolve) => queueMicrotask(resolve)))
    expect(() => controller.connectSurface({
      resolveClientPoint: (point) => point,
      applyEffects: () => undefined,
    })).toThrow(/disposed/)
  })

  it('OpenSpec: editor-workspace-layout / 共享 Stage controller / StrictMode 组合 Stage 与 Palette', () => {
    expect(() => render(
      <StrictMode>
        <StrictControllerWorkspace transactionRuntime={runtime()} />
      </StrictMode>,
    )).not.toThrow()

    expect(screen.getByRole('application', { name: 'Stage' })).toBeInTheDocument()
  })

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

  // OpenSpec: component-registry / 通用节点 Inspector 上下文 / 组合结构节点 Inspector
  it('OpenSpec: editor-workspace-layout / Frame presets 与结构节点 Inspector / 默认工作区组合基础物料', () => {
    const editorRuntime = runtime()
    const { result } = renderHook(() => useComposeEditorController({
      runtime: editorRuntime,
      registry,
      initialSelection: ['frame'],
      containerInspector: ContainerInspector,
      framePresets: [{
        id: 'desktop',
        label: 'Frame',
        name: 'Desktop',
        defaultSize: { width: 1280, height: 720 },
        createDefaultStyle: () => ({ backgroundColor: '#ffffff' }),
      }],
      idFactory: () => 'controller-frame',
    }))

    const inspector = render(result.current.inspectorPanel)
    fireEvent.click(screen.getByRole('button', { name: '修改容器样式' }))
    expect(editorRuntime.document.nodes.frame?.style?.backgroundColor).toBe('#123456')
    inspector.unmount()

    render(result.current.componentLibraryPanel)
    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label')))
      .toEqual(['Add Frame', 'Add 文本'])
  })

  it('OpenSpec: editor-workspace-layout / Frame presets 与结构节点 Inspector / 保持未配置宿主兼容', () => {
    const editorRuntime = runtime()
    const { result } = renderHook(() => useComposeEditorController({
      runtime: editorRuntime,
      registry,
      initialSelection: ['frame'],
    }))

    render(result.current.componentLibraryPanel)
    expect(screen.queryByRole('button', { name: 'Add Frame' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add 文本' })).toBeInTheDocument()
    cleanup()

    render(result.current.inspectorPanel)
    expect(screen.getByRole('status')).toHaveTextContent(
      '选择一个节点以编辑其属性',
    )
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
    expect(screen.getByRole('button', { name: '适配 Frame' })).toBeDisabled()
    expect(screen.getByLabelText('缩放比例')).toHaveTextContent('100%')

    fireEvent.click(screen.getByRole('button', { name: '平移' }))
    toolbar.rerender(result.current.stageToolbar)
    expect(result.current.tool).toBe('pan')
    expect(screen.getByRole('button', { name: '平移' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('OpenSpec: stage / 受控无限视口 / 使用真实 surface 尺寸 - fit Frame', () => {
    const editorRuntime = runtime()
    const { result } = renderHook(() => useComposeEditorController({
      runtime: editorRuntime,
      registry,
      initialActiveFrameId: 'frame',
    }))
    const toolbar = render(result.current.stageToolbar)

    act(() => result.current.stageProps.onSurfaceSizeChange?.({ width: 400, height: 300 }))
    toolbar.rerender(result.current.stageToolbar)
    fireEvent.click(screen.getByRole('button', { name: '适配 Frame' }))

    const expectedZoom = 172 / 600
    expect(result.current.viewport).toEqual({
      x: 400 / 2 - (40 + 800 / 2) * expectedZoom,
      y: 300 / 2 - (30 + 600 / 2) * expectedZoom,
      zoom: expectedZoom,
    })
  })

  // OpenSpec: editor-workspace-layout / Stage 吸附工具栏 / 清空辅助线
  it('OpenSpec: editor-workspace-layout / Stage 吸附工具栏 / 快捷切换吸附', () => {
    const editorRuntime = runtime()
    act(() => {
      editorRuntime.dispatch({
        id: 'seed-guide',
        type: 'canvas.guide.create',
        payload: { guide: { id: 'guide', axis: 'x', position: 32 } },
      })
      editorRuntime.dispatch({
        id: 'seed-guide-y',
        type: 'canvas.guide.create',
        payload: { guide: { id: 'guide-y', axis: 'y', position: -16 } },
      })
    })
    const { result } = renderHook(() => useComposeEditorController({
      runtime: editorRuntime,
      registry,
      initialActiveFrameId: 'frame',
      idFactory: (() => {
        let value = 0
        return () => `canvas-command-${value++}`
      })(),
    }))
    const toolbar = render(result.current.stageToolbar)

    fireEvent.click(screen.getByRole('button', { name: '网格吸附' }))
    toolbar.rerender(result.current.stageToolbar)
    expect(editorRuntime.document.canvas.grid.snapEnabled).toBe(false)
    expect(screen.getByRole('button', { name: '网格吸附' }))
      .toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(screen.getByRole('button', { name: '画布设置' }))
    toolbar.rerender(result.current.stageToolbar)
    fireEvent.change(screen.getByRole('textbox', { name: 'X 步长' }), {
      target: { value: '0' },
    })
    fireEvent.click(screen.getByRole('button', { name: '应用' }))
    expect(screen.getByRole('alert')).toHaveTextContent('步长必须为正数')
    expect(editorRuntime.document.canvas.grid.stepX).toBe(8)

    fireEvent.change(screen.getByRole('textbox', { name: 'X 步长' }), {
      target: { value: '16' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: '节点吸附' }))
    fireEvent.click(screen.getByRole('button', { name: '清空辅助线（2）' }))
    const beforeApply = editorRuntime.entries.length
    fireEvent.click(screen.getByRole('button', { name: '应用' }))

    expect(editorRuntime.entries).toHaveLength(beforeApply + 1)
    expect(editorRuntime.document.canvas.grid.stepX).toBe(16)
    expect(editorRuntime.document.canvas.smartSnap.nodes).toBe(false)
    expect(editorRuntime.document.canvas.guides).toEqual([])
    toolbar.rerender(result.current.stageToolbar)
    expect(screen.queryByRole('dialog', { name: '画布网格与吸附设置' }))
      .not.toBeInTheDocument()

    act(() => editorRuntime.undo())
    expect(editorRuntime.document.canvas.grid.stepX).toBe(8)
    expect(editorRuntime.document.canvas.guides).toEqual([
      { id: 'guide', axis: 'x', position: 32 },
      { id: 'guide-y', axis: 'y', position: -16 },
    ])
  })

  it('OpenSpec: editor-workspace-layout / Stage 吸附工具栏 / 应用或取消画布设置', () => {
    const editorRuntime = runtime()
    const { result } = renderHook(() => useComposeEditorController({
      runtime: editorRuntime,
      registry,
    }))
    const toolbar = render(result.current.stageToolbar)
    fireEvent.click(screen.getByRole('button', { name: '画布设置' }))
    toolbar.rerender(result.current.stageToolbar)
    fireEvent.change(screen.getByRole('textbox', { name: 'Y 偏移' }), {
      target: { value: '42' },
    })
    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    expect(editorRuntime.document.canvas.grid.offsetY).toBe(0)
    expect(editorRuntime.entries).toHaveLength(1)
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
