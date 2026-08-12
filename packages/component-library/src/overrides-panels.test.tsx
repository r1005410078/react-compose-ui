import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  createComposeGroupEntitySeed,
  createDefaultCanvasSettings,
  type ComposeDocument,
  type ComposeEntity,
  type JsonObject,
  type ComposeResolvedComponentSnapshot,
} from '@compose-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComposeBasePropertiesPanel } from './base-properties-panel'
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
    properties: [{
      id: 'label',
      name: 'Label',
      valueType: 'string',
      target: { entityId: 'text', componentKey: 'Renderer', fieldPath: ['props', 'text'] },
    }],
    appliedLineage: [],
  }
}

function instanceEntity(propertyOverrides: Readonly<Record<string, string>> = {}): ComposeEntity {
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
          propertyOverrides,
        } as unknown as JsonObject,
      },
    },
  }
}

afterEach(cleanup)

describe('Component property panels', () => {
  it('OpenSpec: component-library / 暴露属性 / Base 只接受存在且类型兼容的稳定字段', () => {
    const onChange = vi.fn()
    render(
      <ComposeBasePropertiesPanel
        document={componentDocument()}
        properties={[]}
        selectedEntityId="text"
        onChange={onChange}
      />,
    )

    fireEvent.change(screen.getByLabelText('字段路径'), { target: { value: 'props.missing' } })
    fireEvent.click(screen.getByRole('button', { name: '添加暴露属性' }))
    expect(screen.getByRole('alert')).toHaveTextContent('字段路径不存在或值类型不兼容')
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('字段路径'), { target: { value: 'props.text' } })
    fireEvent.click(screen.getByRole('button', { name: '添加暴露属性' }))
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({
      id: 'property',
      target: { entityId: 'text', componentKey: 'Renderer', fieldPath: ['props', 'text'] },
    })])
  })

  it('OpenSpec: component-library / 实例属性覆盖 / 单项和全部 Apply/Revert、显式更新与创建 Variant', async () => {
    const onApply = vi.fn()
    const onChange = vi.fn()
    const onCreateVariant = vi.fn()
    const onUpdate = vi.fn(async (discardConflicts?: boolean) => discardConflicts
      ? {
          status: 'updated' as const,
          snapshot: componentSnapshot(),
          propertyOverrides: {},
          discardedPropertyIds: ['label'],
        }
      : { status: 'conflict' as const, propertyIds: ['label'], messages: ['Label 已删除'] })
    const view = render(
      <ComposeComponentInstanceOverridesPanel
        entity={instanceEntity()}
        onApply={onApply}
        onChange={onChange}
        onCreateVariant={onCreateVariant}
        onUpdate={onUpdate}
      />,
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Label' }), { target: { value: 'Changed' } })
    expect(onChange).toHaveBeenCalledWith({ label: 'Changed' })

    view.rerender(
      <ComposeComponentInstanceOverridesPanel
        entity={instanceEntity({ label: 'Changed' })}
        onApply={onApply}
        onChange={onChange}
        onCreateVariant={onCreateVariant}
        onUpdate={onUpdate}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply 全部实例覆盖' }))
    fireEvent.click(screen.getByRole('button', { name: 'Revert 全部实例覆盖' }))
    fireEvent.click(screen.getByRole('button', { name: '创建变体…' }))
    expect(onApply).toHaveBeenNthCalledWith(1, ['label'])
    expect(onApply).toHaveBeenNthCalledWith(2)
    expect(onChange).toHaveBeenLastCalledWith({})
    expect(onCreateVariant).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: '检查更新' }))
    const confirm = await screen.findByRole('button', { name: '丢弃 1 项冲突并更新' })
    fireEvent.click(confirm)
    await waitFor(() => expect(onUpdate).toHaveBeenNthCalledWith(2, true))
  })
})
