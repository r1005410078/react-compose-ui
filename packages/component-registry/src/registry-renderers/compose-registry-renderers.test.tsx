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

  it('OpenSpec: Renderer 隔离 / 数据修复后错误边界自动恢复', () => {
    const registry = createComposeEntityRegistry({
      renderers: [{
        type: 'text',
        label: '文本',
        renderer: ({ props }) => {
          if (props.text === 'boom') throw new Error('bad props')
          return <span>ok:{String(props.text)}</span>
        },
      }],
    })
    const broken: ComposeEntity = {
      ...entity(),
      components: {
        ...entity().components,
        Renderer: { type: 'text', props: { text: 'boom' } },
      },
    }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const view = render(
        <ComposeRegistryEntityRenderer entity={broken} mode="editor" registry={registry} />,
      )
      expect(screen.getByRole('status', { name: /text/ })).toBeInTheDocument()

      view.rerender(
        <ComposeRegistryEntityRenderer entity={entity()} mode="editor" registry={registry} />,
      )
      expect(screen.getByText('ok:Hello')).toBeInTheDocument()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    }
    finally {
      consoleError.mockRestore()
    }
  })
})
