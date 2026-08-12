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
    schemaVersion: 6,
    canvas: createDefaultCanvasSettings(),
    output: { width: 100, height: 30, backgroundPaint: { kind: 'solid', color: 'transparent' } },
    rootIds: ['root'],
    entities: { root, text },
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

    fireEvent.click(screen.getByRole('button', { name: '创建变体…' }))
    expect(onCreateVariant).toHaveBeenCalled()

    // 冲突先预览，确认后才丢弃。
    fireEvent.click(screen.getByRole('button', { name: '检查更新' }))
    await screen.findByText(/目标在最新来源中已不存在/)
    fireEvent.click(screen.getByRole('button', { name: /丢弃 1 项失效覆盖并更新/ }))
    await screen.findByText(/已更新，并丢弃 1 项失效覆盖/)
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
    expect(screen.getAllByRole('button', { name: 'Revert' })).toHaveLength(2)
  })
})
