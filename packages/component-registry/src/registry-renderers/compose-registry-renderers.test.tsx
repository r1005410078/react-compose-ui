import { cleanup, render, screen } from '@testing-library/react'
import type { ComposeEntity } from '@compose-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComposeEntityRegistry } from '../registry'
import {
  ComposeRegistryComponentInspector,
  ComposeRegistryEntityRenderer,
} from './compose-registry-renderers'

function entity(rendererType = 'text'): ComposeEntity {
  return {
    id: 'entity-a',
    name: '文本',
    components: {
      Composition: {
        presetId: null,
        baseComponentKeys: ['Transform', 'Visibility', 'Lock', 'Renderer'],
        capabilityIds: [],
      },
      Transform: {
        position: { x: 0, y: 0 },
        size: { width: 100, height: 50 },
        rotation: 0,
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      Renderer: { type: rendererType, props: { text: 'Hello' } },
    },
  }
}

afterEach(cleanup)

describe('Entity Registry React boundaries', () => {
  it('OpenSpec: Renderer 查询 / Stage 与 Preview 共享 Entity Renderer', () => {
    const renderer = vi.fn(({ props, mode }) => (
      <span>{mode}:{String(props.text)}</span>
    ))
    const registry = createComposeEntityRegistry({
      renderers: [{ type: 'text', label: '文本', renderer }],
    })
    const view = render(
      <ComposeRegistryEntityRenderer entity={entity()} mode="editor" registry={registry} />,
    )
    expect(screen.getByText('editor:Hello')).toBeInTheDocument()
    view.rerender(
      <ComposeRegistryEntityRenderer entity={entity()} mode="preview" registry={registry} />,
    )
    expect(screen.getByText('preview:Hello')).toBeInTheDocument()
    expect(renderer).toHaveBeenCalledWith(expect.objectContaining({
      entity: expect.objectContaining({ id: 'entity-a' }),
      renderer: { type: 'text', props: { text: 'Hello' } },
    }), undefined)
  })

  it('OpenSpec: 缺失 Registry 降级 / 保留未知 Renderer 和 Component', () => {
    const registry = createComposeEntityRegistry()
    const { rerender } = render(
      <ComposeRegistryEntityRenderer
        entity={entity('host.unknown')}
        mode="editor"
        registry={registry}
      />,
    )
    expect(screen.getByRole('status', { name: /host\.unknown/ })).toBeInTheDocument()

    rerender(
      <ComposeRegistryComponentInspector
        componentKey="HostCapability"
        dispatch={vi.fn()}
        entity={{
          ...entity(),
          components: { ...entity().components, HostCapability: { enabled: true } },
        }}
        readOnly={false}
        registry={registry}
      />,
    )
    expect(screen.getByRole('status', { name: /HostCapability/ })).toBeInTheDocument()
  })
})
