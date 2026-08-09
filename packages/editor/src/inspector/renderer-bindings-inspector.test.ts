import {
  createDefaultCanvasSettings,
  createDefaultComposeLayoutItem,
  createDefaultOutputSettings,
  createTransactionRuntime,
  getComposeBindings,
  type ComposeDocument,
  type ComposeEntity,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { createRendererBindingCommand } from './renderer-binding-command'

const entity: ComposeEntity = {
  id: 'button',
  name: 'Button',
  components: {
    Composition: { presetId: null, baseComponentKeys: [], capabilityIds: [] },
    Transform: { rotation: 0 },
    LayoutItem: createDefaultComposeLayoutItem(120, 40),
    Visibility: { visible: true },
    Lock: { locked: false },
    Renderer: { type: 'button', props: { label: 'Add' } },
  },
}

const document: ComposeDocument = {
  schemaVersion: 6,
  canvas: createDefaultCanvasSettings(),
  output: createDefaultOutputSettings(),
  rootIds: [entity.id],
  entities: { [entity.id]: entity },
}

describe('OpenSpec: editor-workspace-layout / 文档绑定事务', () => {
  it('只修改 Bindings，且 undo/redo 不改 authored Props', () => {
    const runtime = createTransactionRuntime({ document })
    const bind = createRendererBindingCommand({
      entity: runtime.document.entities.button!,
      target: { kind: 'field', propName: 'onClick' },
      exportName: 'onAdd',
      idFactory: () => 'bind',
    })
    expect(bind && runtime.dispatch(bind).status).toBe('committed')
    expect(getComposeBindings(runtime.document.entities.button!)?.rendererProps.fields.onClick).toEqual({
      scope: 'page',
      exportName: 'onAdd',
    })
    expect(runtime.document.entities.button?.components.Renderer?.props).toEqual({ label: 'Add' })

    runtime.undo()
    expect(getComposeBindings(runtime.document.entities.button!)).toBeUndefined()
    expect(runtime.document.entities.button?.components.Renderer?.props).toEqual({ label: 'Add' })
    runtime.redo()
    expect(getComposeBindings(runtime.document.entities.button!)
      ?.rendererProps.fields.onClick.exportName).toBe('onAdd')
  })

  it('OpenSpec: editor-workspace-layout / Props 绑定与属性分类合并 / 多字段独立撤销', () => {
    const runtime = createTransactionRuntime({ document })
    const clickBinding = createRendererBindingCommand({
      entity: runtime.document.entities.button!,
      target: { kind: 'field', propName: 'onClick' },
      exportName: 'onAdd',
      idFactory: () => 'bind-click',
    })
    expect(clickBinding && runtime.dispatch(clickBinding).status).toBe('committed')
    const fieldBinding = createRendererBindingCommand({
      entity: runtime.document.entities.button!,
      target: { kind: 'field', propName: 'label' },
      exportName: 'label',
      idFactory: () => 'bind-field',
    })
    expect(fieldBinding && runtime.dispatch(fieldBinding).status).toBe('committed')
    expect(getComposeBindings(runtime.document.entities.button!)?.rendererProps).toEqual({
      fields: {
        onClick: { scope: 'page', exportName: 'onAdd' },
        label: { scope: 'page', exportName: 'label' },
      },
    })
    runtime.undo()
    expect(getComposeBindings(runtime.document.entities.button!)?.rendererProps).toEqual({
      fields: { onClick: { scope: 'page', exportName: 'onAdd' } },
    })
  })
})
