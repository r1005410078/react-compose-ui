import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createComposeEntityRegistry } from '@compose-ui/component-registry'
import type { ComposeComponentStore } from '../component-store'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as libraryApi from '../index'

interface PanelApi {
  readonly ComposeComponentLibraryPanel?: React.ComponentType<{
    readonly registry: ReturnType<typeof createComposeEntityRegistry>
    readonly store?: ComposeComponentStore
    readonly onCreateIntent?: (item: unknown) => void
    readonly onOpenIntent?: (descriptor: unknown) => void
    readonly onCreateVariantIntent?: (descriptor: unknown) => void
    readonly onItemDragStart?: (event: unknown) => void
    readonly onItemDragEnd?: (event: unknown) => void
  }>
}

const api = libraryApi as unknown as PanelApi

const registry = createComposeEntityRegistry({
  presets: [{
    id: 'container',
    label: 'Container',
    createComponents: () => ({
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: 0, y: 0 },
        width: { mode: 'fixed', value: 100, min: 1, max: null },
        height: { mode: 'fixed', value: 100, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      Hierarchy: { childIds: [] },
    }),
  }],
})

function componentStore(): ComposeComponentStore {
  return {
    providerId: 'project',
    createReference: (assetKey) => ({
      kind: 'component',
      providerId: 'project',
      assetKey,
      scope: 'persistent',
    }),
    listComponents: vi.fn(async () => ({
      components: [
        {
          entryId: 'button',
          assetKey: 'button',
          displayName: 'Button',
          componentId: 'button',
          kind: 'base' as const,
          revision: '1',
          reference: { kind: 'component' as const, providerId: 'project', assetKey: 'button', scope: 'persistent' as const },
        },
        {
          entryId: 'danger',
          assetKey: 'danger',
          displayName: 'Button Danger',
          componentId: 'button-danger',
          kind: 'variant' as const,
          revision: '1',
          reference: { kind: 'component' as const, providerId: 'project', assetKey: 'danger', scope: 'persistent' as const },
        },
      ],
      issues: [],
    })),
    readComponent: vi.fn(),
    createComponent: vi.fn(),
    saveComponent: vi.fn(),
    resolveComponent: vi.fn(),
    invalidate: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
    dispose: vi.fn(),
  }
}

describe('ComposeComponentLibraryPanel', () => {
  afterEach(cleanup)

  it('OpenSpec: component-library / 混合组件目录 / 区分 Base 与 Variant', async () => {
    expect(api.ComposeComponentLibraryPanel).toBeTypeOf('function')
    const onCreateIntent = vi.fn()
    const Panel = api.ComposeComponentLibraryPanel!
    render(<Panel registry={registry} store={componentStore()} onCreateIntent={onCreateIntent} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '添加主组件 Button' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: '添加变体 Button Danger' })).toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: '添加主组件 Button' }))
      .getByTestId('component-library-base-icon')).toBeInTheDocument()
    expect(screen.getByTestId('component-library-variant-icon')).toBeInTheDocument()
    // 主组件实心、变体空心：test id 可区分。
    expect(screen.queryByTestId('component-library-instance-icon')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '添加主组件 Button' }))
    expect(onCreateIntent).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'component',
      descriptor: expect.objectContaining({ assetKey: 'button' }),
    }))
  })

  it('OpenSpec: component-library / 混合组件目录 / 无 Store 保持兼容', () => {
    const onCreateIntent = vi.fn()
    const Panel = api.ComposeComponentLibraryPanel!
    render(<Panel registry={registry} onCreateIntent={onCreateIntent} />)
    fireEvent.click(screen.getByRole('button', { name: '添加 Container' }))
    expect(onCreateIntent).toHaveBeenCalledWith({ kind: 'preset', presetId: 'container' })
    expect(screen.queryByText('项目组件')).not.toBeInTheDocument()
  })

  it('面板外松手的拖拽不吞掉下一次点击添加', () => {
    // 拖拽在画布上松手时 click 不会落在 tile 上，click 抑制标志曾滞留到下一次
    // 纯点击并把它静默吞掉——用户看到的是"拖入一个节点后再点添加没反应"。
    const onCreateIntent = vi.fn()
    const Panel = api.ComposeComponentLibraryPanel!
    render(
      <Panel
        registry={registry}
        onCreateIntent={onCreateIntent}
        onItemDragEnd={vi.fn()}
        onItemDragStart={vi.fn()}
      />,
    )
    const tile = screen.getByRole('button', { name: '添加 Container' })

    // 一次完整的拖出面板：按下 → 超过 4px 阈值 → 在面板外松手（无 click）。
    fireEvent.pointerDown(tile, { button: 0, pointerId: 7, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 60, clientY: 10 })
    fireEvent.pointerUp(window, { pointerId: 7, clientX: 400, clientY: 300 })
    expect(onCreateIntent).not.toHaveBeenCalled()

    // 随后的纯点击必须照常创建。
    fireEvent.pointerDown(tile, { button: 0, pointerId: 8, clientX: 10, clientY: 10 })
    fireEvent.pointerUp(window, { pointerId: 8, clientX: 10, clientY: 10 })
    fireEvent.click(tile)
    expect(onCreateIntent).toHaveBeenCalledWith({ kind: 'preset', presetId: 'container' })
  })

  it('OpenSpec: editor-workspace-layout / 组件独立标签 / 双击打开并从 Base 创建 Variant', async () => {
    const onOpenIntent = vi.fn()
    const onCreateVariantIntent = vi.fn()
    const Panel = api.ComposeComponentLibraryPanel!
    render(
      <Panel
        registry={registry}
        store={componentStore()}
        onOpenIntent={onOpenIntent}
        onCreateVariantIntent={onCreateVariantIntent}
      />,
    )

    const base = await screen.findByRole('button', { name: '添加主组件 Button' })
    fireEvent.doubleClick(base)
    expect(onOpenIntent).toHaveBeenCalledWith(expect.objectContaining({ assetKey: 'button' }))

    fireEvent.click(screen.getByRole('button', { name: '创建变体 Button' }))
    expect(onCreateVariantIntent).toHaveBeenCalledWith(expect.objectContaining({
      assetKey: 'button',
      kind: 'base',
    }))
  })
})
