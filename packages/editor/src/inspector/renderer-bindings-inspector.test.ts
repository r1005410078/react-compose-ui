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
      propName: 'onClick',
      exportName: 'onAdd',
      idFactory: () => 'bind',
    })
    expect(bind && runtime.dispatch(bind).status).toBe('committed')
    expect(getComposeBindings(runtime.document.entities.button!)?.props.onClick).toEqual({
      scope: 'page',
      exportName: 'onAdd',
    })
    expect(runtime.document.entities.button?.components.Renderer?.props).toEqual({ label: 'Add' })

    runtime.undo()
    expect(getComposeBindings(runtime.document.entities.button!)).toBeUndefined()
    expect(runtime.document.entities.button?.components.Renderer?.props).toEqual({ label: 'Add' })
    runtime.redo()
    expect(getComposeBindings(runtime.document.entities.button!)?.props.onClick.exportName).toBe('onAdd')
  })
})
