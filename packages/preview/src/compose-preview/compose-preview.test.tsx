import { createComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  type ComposeDocument,
  type ComposeEntity,
} from '@compose-ui/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComposePreview } from '../index'

afterEach(cleanup)

function entity(
  id: string,
  components: ComposeEntity['components'],
  name = id,
): ComposeEntity {
  return {
    id,
    name,
    components: {
      Composition: {
        presetId: null,
        baseComponentKeys: Object.keys(components),
        capabilityIds: [],
      },
      Transform: {
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        rotation: 0,
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      ...components,
    },
  }
}

function document(): ComposeDocument {
  const entities: Record<string, ComposeEntity> = {
    desktop: entity('desktop', {
      Transform: {
        position: { x: -500, y: 200 },
        size: { width: 800, height: 600 },
        rotation: 0,
      },
      Hierarchy: { childIds: ['group', 'hidden', 'unknown'] },
      Clip: { enabled: true },
      Appearance: {
        backgroundColor: '#fef3c7',
        borderColor: '#92400e',
        borderWidth: 2,
        borderRadius: 10,
        opacity: 0.95,
        shadow: {
          color: '#000000',
          offsetX: 1,
          offsetY: 3,
          blur: 5,
          spread: 0,
        },
      },
      Renderer: { type: 'surface', props: { text: 'Desktop surface' } },
    }, 'Desktop'),
    group: entity('group', {
      Transform: {
        position: { x: 100, y: 80 },
        size: { width: 300, height: 200 },
        rotation: 15,
      },
      Hierarchy: { childIds: ['text'] },
      Clip: { enabled: false },
      Appearance: { backgroundColor: '#ddeeff', borderRadius: 6 },
    }, 'Nested Container'),
    text: entity('text', {
      Transform: {
        position: { x: 20, y: 30 },
        size: { width: 120, height: 50 },
        rotation: -5,
      },
      Appearance: {
        backgroundColor: '#ffffff',
        borderColor: '#172033',
        borderWidth: 1,
        opacity: 0.8,
      },
      Renderer: { type: 'text', props: { text: 'Desktop text' } },
    }, 'Text'),
    hidden: entity('hidden', {
      Visibility: { visible: false },
      Renderer: { type: 'text', props: { text: 'Hidden text' } },
    }, 'Hidden'),
    unknown: entity('unknown', {
      Renderer: { type: 'missing', props: {} },
    }, 'Unknown'),
    mobile: entity('mobile', {
      Transform: {
        position: { x: 600, y: 200 },
        size: { width: 390, height: 844 },
        rotation: 0,
      },
      Hierarchy: { childIds: ['mobile-text'] },
      Clip: { enabled: true },
    }, 'Mobile'),
    'mobile-text': entity('mobile-text', {
      Renderer: { type: 'text', props: { text: 'Mobile text' } },
    }, 'Mobile Text'),
  }
  return {
    schemaVersion: 4,
    canvas: createDefaultCanvasSettings(),
    output: {
      ...createDefaultOutputSettings(),
      width: 1440,
      height: 900,
      backgroundColor: '#eef2ff',
    },
    rootIds: ['desktop', 'mobile'],
    entities,
  }
}

function registry() {
  return createComposeEntityRegistry({
    renderers: [
      {
        type: 'text',
        label: '文本',
        renderer: ({ props, mode }) => <span>{mode}:{String(props.text)}</span>,
      },
      {
        type: 'surface',
        label: '表面',
        renderer: ({ props, mode }) => <span>{mode}:{String(props.text)}</span>,
      },
    ],
  })
}

describe('ComposePreview', () => {
  it('OpenSpec: replace-nodes-with-ecs-entities / Renderer 与 Hierarchy 可组合', () => {
    render(
      <ComposePreview
        document={document()}
        registry={registry()}
        target={{ kind: 'container', entityId: 'desktop' }}
      />,
    )

    expect(screen.getByText('preview:Desktop surface')).toBeInTheDocument()
    expect(screen.getByText('preview:Desktop text')).toBeInTheDocument()
  })

  it('OpenSpec: replace-nodes-with-ecs-entities / Preview 资源解析', () => {
    const assetResolver = { resolve: vi.fn() }
    const assetRegistry = createComposeEntityRegistry({
      renderers: [{
        type: 'text',
        label: '文本',
        renderer: ({ assetResolver: received }) => (
          <span>{received === assetResolver ? 'resolver connected' : 'resolver missing'}</span>
        ),
      }],
    })
    render(
      <ComposePreview
        assetResolver={assetResolver}
        document={document()}
        registry={assetRegistry}
        target={{ kind: 'container', entityId: 'group' }}
      />,
    )

    expect(screen.getByText('resolver connected')).toBeInTheDocument()
  })

  it('保留标准 section 属性', () => {
    const click = vi.fn()
    render(
      <ComposePreview
        aria-label="Document preview"
        className="host-preview"
        document={document()}
        onClick={click}
        registry={registry()}
      />,
    )

    const preview = screen.getByRole('region', { name: 'Document preview' })
    expect(preview).toHaveClass('host-preview')
    fireEvent.click(preview)
    expect(click).toHaveBeenCalledOnce()
  })

  it('预览指定 Container 并应用嵌套局部变换', () => {
    render(
      <ComposePreview
        document={document()}
        registry={registry()}
        target={{ kind: 'container', entityId: 'desktop' }}
      />,
    )

    const container = screen.getByTestId('compose-preview-container')
    expect(container).toHaveStyle({ width: '800px', height: '600px', overflow: 'hidden' })
    expect(container).not.toHaveStyle({ left: '-500px', top: '200px' })
    expect(screen.getByTestId('compose-preview-entity-group')).toHaveStyle({
      left: '100px',
      top: '80px',
      transform: 'rotate(15deg)',
      overflow: 'visible',
    })
    expect(screen.getByTestId('compose-preview-entity-text')).toHaveStyle({
      left: '20px',
      top: '30px',
      transform: 'rotate(-5deg)',
    })
    expect(screen.queryByText('Hidden text')).not.toBeInTheDocument()
    expect(screen.queryByText('Mobile text')).not.toBeInTheDocument()
  })

  it('按 Appearance 与 Clip 渲染外观', () => {
    render(
      <ComposePreview
        document={document()}
        registry={registry()}
        target={{ kind: 'container', entityId: 'desktop' }}
      />,
    )

    const container = screen.getByTestId('compose-preview-container')
    expect(container).toHaveStyle({
      backgroundColor: '#fef3c7',
      borderRadius: '10px',
      opacity: '0.95',
    })
    expect(container.style.boxShadow).toContain('inset 0 0 0 2px #92400e')
    expect(container.style.boxShadow).toContain('1px 3px 5px 0px #000000')
  })

  it('未知 Renderer 降级且不影响其他 Entity', () => {
    render(
      <ComposePreview
        document={document()}
        registry={registry()}
        target={{ kind: 'container', entityId: 'desktop' }}
      />,
    )
    expect(screen.getByRole('status', { name: /missing/ })).toBeInTheDocument()
    expect(screen.getByText('preview:Desktop text')).toBeInTheDocument()
  })

  it('拒绝不存在或没有 Hierarchy 的 target', () => {
    const view = render(
      <ComposePreview
        document={document()}
        registry={registry()}
        target={{ kind: 'container', entityId: 'missing-container' }}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('missing-container')

    view.rerender(
      <ComposePreview
        document={document()}
        registry={registry()}
        target={{ kind: 'container', entityId: 'text' }}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('text')
  })

  it('预览完整文档并忽略画布编辑元数据', () => {
    render(<ComposePreview document={document()} registry={registry()} />)

    expect(screen.getByTestId('compose-preview-document')).toHaveStyle({
      width: '1440px',
      height: '900px',
      overflow: 'hidden',
      backgroundColor: '#eef2ff',
    })
    expect(screen.getByTestId('compose-preview-entity-desktop')).toHaveStyle({
      left: '-500px',
      top: '200px',
    })
    expect(screen.getByText('preview:Mobile text')).toBeInTheDocument()
    expect(screen.queryByTestId('stage-ruler-x')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Stage 编辑覆盖层')).not.toBeInTheDocument()
  })
})
