import { cleanup, render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import type { ComposeEntity } from '@compose-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComposeEntityRegistry } from '../registry'
import type {
  ComposeComponentInspectorProps,
  ComposeEntityRegistry,
} from '../registry'
import * as registryRenderers from './compose-registry-renderers'
import {
  ComposeRegistryComponentInspector,
  ComposeRegistryMissingComponentInspectorHeaderActions,
  ComposeRegistryEntityRenderer,
} from './compose-registry-renderers'
import { ComposeEntityBorderLayer } from './compose-entity-border-layer'
import { ComposeEntityPaintLayer } from './compose-entity-paint-layer'

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
  it('OpenSpec: component-registry / 缺失 Component Inspector 协议 / 缺失入口继承只读上下文', () => {
    const actions = vi.fn(({ componentKey, readOnly }) => (
      <button disabled={readOnly} type="button">添加 {componentKey}</button>
    ))
    const registry = createComposeEntityRegistry({
      components: [{
        key: 'HostLayout',
        label: '宿主布局',
        createDefault: () => ({ enabled: true }),
        missingInspector: {
          isVisible: () => true,
          actions,
        },
      }],
    })

    render(
      <ComposeRegistryMissingComponentInspectorHeaderActions
        componentKey="HostLayout"
        dispatch={vi.fn()}
        entity={entity()}
        readOnly
        registry={registry}
      />,
    )

    expect(screen.getByRole('button', { name: '添加 HostLayout' })).toBeDisabled()
    expect(actions).toHaveBeenCalledWith(expect.objectContaining({
      componentKey: 'HostLayout',
      entity: expect.objectContaining({ id: 'entity-a' }),
      readOnly: true,
    }), undefined)
  })

  it('OpenSpec: component-registry / Component Inspector 标题栏 actions / 解析 Component 标题栏 actions', () => {
    const HeaderActionsAdapter = (
      registryRenderers as unknown as {
        readonly ComposeRegistryComponentInspectorHeaderActions?: ComponentType<{
          readonly componentKey: string
          readonly dispatch: ComposeComponentInspectorProps['dispatch']
          readonly entity: ComposeEntity
          readonly readOnly: boolean
          readonly registry: ComposeEntityRegistry
        }>
      }
    ).ComposeRegistryComponentInspectorHeaderActions
    expect(HeaderActionsAdapter).toBeDefined()
    if (!HeaderActionsAdapter) return

    const actions = vi.fn(({ componentKey, readOnly, value }: ComposeComponentInspectorProps) => (
      <button disabled={readOnly} type="button">
        {componentKey}:{String(value.enabled)}
      </button>
    ))
    const registry = createComposeEntityRegistry({
      components: [{
        key: 'HostLayout',
        label: '宿主布局',
        createDefault: () => ({ enabled: true }),
        inspectorHeaderActions: actions,
      }],
    })
    const target = {
      ...entity(),
      components: {
        ...entity().components,
        HostLayout: { enabled: true },
      },
    }
    render(
      <HeaderActionsAdapter
        componentKey="HostLayout"
        dispatch={vi.fn()}
        entity={target}
        readOnly
        registry={registry}
      />,
    )

    expect(screen.getByRole('button', { name: 'HostLayout:true' })).toBeDisabled()
    expect(actions).toHaveBeenCalledWith(expect.objectContaining({
      componentKey: 'HostLayout',
      entity: expect.objectContaining({ id: 'entity-a' }),
      readOnly: true,
      value: { enabled: true },
    }), undefined)
  })

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

  it('OpenSpec: stage-paint-tools / Stage 与 Preview 共用受控 SVG Paint Layer', () => {
    const painted: ComposeEntity = {
      ...entity(),
      components: {
        ...entity().components,
        Appearance: {
          backgroundPaint: {
            kind: 'linear-gradient',
            start: { x: 0, y: 0.5 },
            end: { x: 1, y: 0.5 },
            stops: [
              { id: 'start', position: 0, color: '#ff0000' },
              { id: 'end', position: 1, color: '#0000ff80' },
            ],
          },
        },
      },
    }
    const { container } = render(<ComposeEntityPaintLayer entity={painted} />)

    expect(container.querySelector('[data-compose-paint="linear-gradient"]')).toBeInTheDocument()
    const layer = container.querySelector('[data-compose-paint="linear-gradient"]')
    expect(layer?.querySelectorAll('stop')).toHaveLength(2)
    expect(layer?.querySelector('stop:last-child')).toHaveAttribute('stop-color', '#0000ff80')
  })

  it('OpenSpec: stage-paint-tools / 编辑 Stage 可让透明 Paint 层承接组合空白区域命中', () => {
    const { container } = render(<ComposeEntityPaintLayer entity={entity()} interactive />)

    expect(container.querySelector('[data-compose-paint="solid"]')).toHaveStyle({
      pointerEvents: 'auto',
    })
  })

  it('OpenSpec: 共享渲染语义 / 边框由独立顶层覆盖层渲染', () => {
    const bordered: ComposeEntity = {
      ...entity(),
      components: {
        ...entity().components,
        Appearance: {
          backgroundPaint: { kind: 'solid', color: '#2463eb' },
          borderColor: '#ef4444',
          borderWidth: 9,
          borderRadius: 12,
        },
      },
    }
    const { container } = render(<ComposeEntityBorderLayer entity={bordered} />)
    const border = container.querySelector<HTMLElement>('[data-compose-entity-border]')

    expect(border).not.toBeNull()
    expect(border?.style.border).toBe('9px solid rgb(239, 68, 68)')
    expect(border?.style.borderRadius).toBe('inherit')
    expect(border?.style.boxSizing).toBe('border-box')
    expect(border?.style.pointerEvents).toBe('none')
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
