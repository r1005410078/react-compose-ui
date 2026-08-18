import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  createComposeGroupEntitySeed,
  createDefaultCanvasSettings,
  type ComposeDocument,
  type ComposeEntity,
  type JsonObject,
  type ComposeResolvedComponentSnapshot,
} from '@compose-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComposeComponentInstanceOverridesPanel } from './component-instance-overrides-panel'

/** 给组件根就地加上 Frame Component：组件文档的单根必须是 Frame。 */
function withFrame(entity: ComposeEntity, width: number, height: number): ComposeEntity {
  return {
    ...entity,
    components: {
      ...entity.components,
      Frame: { size: { width, height }, guides: [] },
    },
  }
}

function componentDocument(): ComposeDocument {
  const root = createComposeGroupEntitySeed({ id: 'root', childIds: ['text'] })
  const text: ComposeEntity = {
    id: 'text',
    name: 'Text',
    components: {
      Composition: {
        presetId: 'text',
        baseComponentKeys: ['Transform', 'LayoutItem', 'Visibility', 'Lock', 'Renderer'],
        capabilityIds: [],
      },
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: 0, y: 0 },
        width: { mode: 'fixed', value: 100, min: 1, max: null },
        height: { mode: 'fixed', value: 30, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      Renderer: { type: 'text', props: { text: 'Base' } },
    },
  }
  return {
    schemaVersion: 7,
    canvas: createDefaultCanvasSettings(),
    // 组件文档的单根必须是 Frame；这里给既有根就地加上 Frame Component。
    rootIds: ['root'],
    entities: { root: withFrame(root, 100, 30), text },
  }
}

function componentSnapshot(): ComposeResolvedComponentSnapshot {
  return {
    componentId: 'label',
    kind: 'base',
    revision: '1',
    document: componentDocument(),
    appliedLineage: [],
  }
}

function instanceEntity(
  operations: readonly { id: string; kind: string; entityId: string }[] = [],
): ComposeEntity {
  const snapshot = componentSnapshot()
  return {
    id: 'instance',
    name: 'Label instance',
    components: {
      Composition: {
        presetId: 'component-instance',
        baseComponentKeys: ['Transform', 'LayoutItem', 'Visibility', 'Lock', 'Renderer'],
        capabilityIds: [],
      },
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: 0, y: 0 },
        width: { mode: 'hug', value: 100, min: 1, max: null },
        height: { mode: 'hug', value: 30, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      Renderer: {
        type: 'component-instance',
        props: {
          reference: {
            kind: 'component',
            providerId: 'project',
            assetKey: 'label',
            scope: 'persistent',
          },
          resolvedSnapshot: snapshot,
          instanceOverrides: { operations },
        } as unknown as JsonObject,
      },
    },
  }
}

afterEach(cleanup)

describe('Component property panels', () => {
  it('OpenSpec: component-library / 实例层结构覆盖 / 单项与全部 Apply/Revert 及显式更新', async () => {
    const onApply = vi.fn()
    const onChange = vi.fn()
    const onCreateVariant = vi.fn()
    const onUpdate = vi.fn(async (discardConflicts?: boolean) => discardConflicts
      ? {
          status: 'updated' as const,
          snapshot: componentSnapshot(),
          overrides: { operations: [] },
          discardedOperationIds: ['op-1'],
        }
      : {
          status: 'conflict' as const,
          operationIds: ['op-1'],
          messages: ['结构操作 op-1 的目标在最新来源中已不存在'],
        })
    render(
      <ComposeComponentInstanceOverridesPanel
        entity={instanceEntity([{ id: 'op-1', kind: 'remove-entity', entityId: 'label' }])}
        onApply={onApply}
        onChange={onChange}
        onCreateVariant={onCreateVariant}
        onUpdate={onUpdate}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onApply).toHaveBeenCalledWith(['op-1'])
    fireEvent.click(screen.getByRole('button', { name: 'Apply 全部实例覆盖' }))
    expect(onApply).toHaveBeenLastCalledWith()

    fireEvent.click(screen.getByRole('button', { name: 'Revert' }))
    expect(onChange).toHaveBeenCalledWith({ operations: [] })

    fireEvent.click(screen.getByRole('button', { name: '创建变体' }))
    expect(onCreateVariant).toHaveBeenCalled()

    // 冲突先预览，确认后才丢弃。
    fireEvent.click(screen.getByRole('button', { name: '检查更新' }))
    await screen.findByText(/目标在最新来源中已不存在/)
    fireEvent.click(screen.getByRole('button', { name: /丢弃 1 项失效覆盖并更新/ }))
    await screen.findByText(/已更新，并丢弃 1 项失效覆盖/)
  })

  it('无覆盖时不展示通栏 Apply/Revert，头部批量操作禁用', () => {
    render(
      <ComposeComponentInstanceOverridesPanel
        entity={instanceEntity([])}
        onApply={vi.fn()}
        onChange={vi.fn()}
        onCreateVariant={vi.fn()}
        onUpdate={vi.fn()}
      />,
    )
    expect(screen.getByText(/尚无本层覆盖/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply 全部实例覆盖' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Revert 全部实例覆盖' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument()
  })

  it('inspector 布局把工具栏与覆盖条拆成 chrome 片段，无覆盖时 banner 为空', () => {
    const onApply = vi.fn()
    render(
      <ComposeComponentInstanceOverridesPanel
        entity={instanceEntity([{ id: 'op-1', kind: 'remove-entity', entityId: 'label' }])}
        layout="inspector"
        onApply={onApply}
        onChange={vi.fn()}
        onCreateVariant={vi.fn()}
        onUpdate={vi.fn()}
      >
        {({ leading, subtitle, trailing, statusSlot, banner }) => (
          <div>
            <div data-testid="leading">{leading}</div>
            <div data-testid="subtitle">{subtitle}</div>
            <div data-testid="trailing">{trailing}</div>
            <div data-testid="status">{statusSlot === null ? 'empty' : statusSlot}</div>
            <div data-testid="banner">{banner}</div>
          </div>
        )}
      </ComposeComponentInstanceOverridesPanel>,
    )
    expect(screen.getByTestId('leading').querySelector('svg')).toBeTruthy()
    expect(screen.getByText('1 项本层覆盖')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '检查更新' })).toBeInTheDocument()
    expect(screen.getByTestId('status')).toHaveTextContent('empty')
    expect(screen.getByTestId('banner')).toHaveTextContent('删除实体')
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onApply).toHaveBeenCalledWith(['op-1'])
  })

  it('inspector 无覆盖时 banner 与 statusSlot 为 null', () => {
    render(
      <ComposeComponentInstanceOverridesPanel
        entity={instanceEntity([])}
        layout="inspector"
        onApply={vi.fn()}
        onChange={vi.fn()}
        onCreateVariant={vi.fn()}
        onUpdate={vi.fn()}
      >
        {({ subtitle, statusSlot, banner }) => (
          <div>
            <div data-testid="subtitle">{subtitle}</div>
            <div data-testid="status">{statusSlot === null ? 'empty' : 'filled'}</div>
            <div data-testid="banner">{banner === null ? 'empty' : 'filled'}</div>
          </div>
        )}
      </ComposeComponentInstanceOverridesPanel>,
    )
    expect(screen.getByText('实例 · 与源同步')).toBeInTheDocument()
    expect(screen.getByTestId('status')).toHaveTextContent('empty')
    expect(screen.getByTestId('banner')).toHaveTextContent('empty')
  })

  it('更新反馈进入 statusSlot 且可关闭', async () => {
    const onUpdate = vi.fn(async () => ({
      status: 'updated' as const,
      snapshot: componentSnapshot(),
      overrides: { operations: [] },
      discardedOperationIds: [] as string[],
    }))
    render(
      <ComposeComponentInstanceOverridesPanel
        entity={instanceEntity([])}
        layout="inspector"
        onApply={vi.fn()}
        onChange={vi.fn()}
        onCreateVariant={vi.fn()}
        onUpdate={onUpdate}
      >
        {({ trailing, statusSlot }) => (
          <div>
            <div data-testid="trailing">{trailing}</div>
            <div data-testid="status">{statusSlot}</div>
          </div>
        )}
      </ComposeComponentInstanceOverridesPanel>,
    )
    fireEvent.click(screen.getByRole('button', { name: '检查更新' }))
    await screen.findByText('实例已更新到来源最新 revision')
    fireEvent.click(screen.getByRole('button', { name: '关闭状态' }))
    expect(screen.queryByText('实例已更新到来源最新 revision')).not.toBeInTheDocument()
  })
})

describe('实例结构覆盖面板', () => {
  it('Revert 全部清空结构操作', () => {
    const onChange = vi.fn()
    const onApply = vi.fn()
    render(
      <ComposeComponentInstanceOverridesPanel
        entity={instanceEntity([{ id: 'op-1', kind: 'remove-entity', entityId: 'label' }])}
        onApply={onApply}
        onChange={onChange}
        onCreateVariant={vi.fn()}
        onUpdate={vi.fn()}
      />,
    )

    const applyAll = screen.getByRole('button', { name: 'Apply 全部实例覆盖' })
    expect(applyAll).toBeEnabled()
    const revertAll = screen.getByRole('button', { name: 'Revert 全部实例覆盖' })
    expect(revertAll).toBeEnabled()

    fireEvent.click(revertAll)
    expect(onChange).toHaveBeenCalledWith({ operations: [] })
  })

  it('逐条列出结构覆盖', () => {
    render(
      <ComposeComponentInstanceOverridesPanel
        entity={instanceEntity([
          { id: 'op-1', kind: 'remove-entity', entityId: 'label' },
          { id: 'op-2', kind: 'remove-entity', entityId: 'other' },
        ])}
        onApply={vi.fn()}
        onChange={vi.fn()}
        onCreateVariant={vi.fn()}
        onUpdate={vi.fn()}
      />,
    )
    expect(screen.getByText('2 项本层覆盖')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Revert' })).toHaveLength(2)
    expect(screen.getAllByText('删除实体')).toHaveLength(2)
  })
})
