import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type {
  ComposeEntity,
  EditorCommand,
  JsonObject,
} from '@compose-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTextRendererInspector } from './renderer-inspectors'

function entity(components: Readonly<Record<string, JsonObject>> = {}): ComposeEntity {
  return {
    id: 'entity-a',
    name: 'Title',
    components: {
      Composition: {
        presetId: null,
        baseComponentKeys: ['Transform', 'Visibility', 'Lock'],
        capabilityIds: [],
      },
      Transform: {
        position: { x: 10, y: 20 },
        size: { width: 180, height: 40 },
        rotation: 0,
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      ...components,
    },
  }
}

afterEach(cleanup)

describe('Text Renderer Inspector', () => {
  it('OpenSpec: 基础物料 / 编辑 Text 内容保留 schema 之外的 props', () => {
    const dispatch = vi.fn()
    const Inspector = createTextRendererInspector(() => 'command-id')
    const withExtra = entity({
      Renderer: {
        type: 'text',
        props: { text: 'Hello', color: '#172033', fontSize: 24, hostTag: 'kpi' },
      },
    })
    render(
      <Inspector
        dispatch={dispatch}
        entity={withExtra}
        readOnly={false}
        renderer={{ type: 'text', props: withExtra.components.Renderer!.props as JsonObject }}
      />,
    )
    const text = screen.getByRole('textbox', { name: '文本' })
    fireEvent.change(text, { target: { value: 'World' } })
    fireEvent.blur(text)
    const command = dispatch.mock.lastCall?.[0] as EditorCommand
    expect(command.payload).toMatchObject({
      entityId: 'entity-a',
      props: expect.objectContaining({ text: 'World', hostTag: 'kpi' }),
    })
  })
})
