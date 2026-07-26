import { createComposeComponentRegistry } from '@compose-ui/component-registry'
import {
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  type ComposeDocument,
} from '@compose-ui/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComposePreview } from '../index'

afterEach(cleanup)

function document(): ComposeDocument {
  return {
    schemaVersion: 3,
    canvas: createDefaultCanvasSettings(),
    output: {
      ...createDefaultOutputSettings(),
      width: 1440,
      height: 900,
      backgroundColor: '#eef2ff',
    },
    rootIds: ['desktop', 'mobile'],
    nodes: {
      desktop: {
        id: 'desktop',
        kind: 'frame',
        name: 'Desktop',
        visible: true,
        locked: false,
        transform: { x: -500, y: 200, width: 800, height: 600, rotation: 0 },
        childIds: ['group', 'hidden', 'unknown'],
        style: {
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
        clipContent: true,
      },
      group: {
        id: 'group',
        kind: 'frame',
        name: 'Nested Frame',
        visible: true,
        locked: false,
        transform: { x: 100, y: 80, width: 300, height: 200, rotation: 15 },
        childIds: ['text'],
        clipContent: false,
        style: { backgroundColor: '#ddeeff', borderRadius: 6 },
      },
      text: {
        id: 'text',
        kind: 'component',
        name: 'Text',
        visible: true,
        locked: false,
        transform: { x: 20, y: 30, width: 120, height: 50, rotation: -5 },
        componentType: 'text',
        props: { text: 'Desktop text' },
        style: {
          backgroundColor: '#ffffff',
          borderColor: '#172033',
          borderWidth: 1,
          opacity: 0.8,
        },
      },
      hidden: {
        id: 'hidden',
        kind: 'component',
        name: 'Hidden',
        visible: false,
        locked: false,
        transform: { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
        componentType: 'text',
        props: { text: 'Hidden text' },
      },
      unknown: {
        id: 'unknown',
        kind: 'component',
        name: 'Unknown',
        visible: true,
        locked: false,
        transform: { x: 300, y: 100, width: 100, height: 40, rotation: 0 },
        componentType: 'missing',
        props: {},
      },
      mobile: {
        id: 'mobile',
        kind: 'frame',
        name: 'Mobile',
        visible: true,
        locked: false,
        transform: { x: 600, y: 200, width: 390, height: 844, rotation: 0 },
        childIds: ['mobile-text'],
        clipContent: true,
      },
      'mobile-text': {
        id: 'mobile-text',
        kind: 'component',
        name: 'Mobile Text',
        visible: true,
        locked: false,
        transform: { x: 10, y: 10, width: 100, height: 40, rotation: 0 },
        componentType: 'text',
        props: { text: 'Mobile text' },
      },
    },
  }
}

function registry() {
  return createComposeComponentRegistry([{
    type: 'text',
    label: '文本',
    defaultSize: { width: 120, height: 50 },
    createDefaultProps: () => ({ text: 'Text' }),
    renderer: ({ props, mode }) => <span>{mode}:{String(props.text)}</span>,
  }])
}

describe('ComposePreview', () => {
  it('OpenSpec: compose-preview / Preview 资源解析 / 预览资源组件', () => {
    const assetResolver = {
      resolve: vi.fn(),
    }
    const assetRegistry = createComposeComponentRegistry([{
      type: 'text',
      label: '文本',
      defaultSize: { width: 120, height: 50 },
      createDefaultProps: () => ({ text: 'Text' }),
      renderer: ({ assetResolver: received }) => (
        <span>{received === assetResolver ? 'resolver connected' : 'resolver missing'}</span>
      ),
    }])
    render(
      <ComposePreview
        assetResolver={assetResolver}
        document={document()}
        registry={assetRegistry}
        target={{ kind: 'frame', frameId: 'group' }}
      />,
    )

    expect(screen.getByText('resolver connected')).toBeInTheDocument()
  })

  it('OpenSpec: compose-preview / vNext 必填配置 / 保留标准 section 属性', () => {
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
    expect(preview).toHaveTextContent('preview:Desktop text')
    fireEvent.click(preview)
    expect(click).toHaveBeenCalledOnce()
  })

  it('OpenSpec: compose-preview / 文档驱动的 Frame Preview / 预览指定 Frame', () => {
    render(
      <ComposePreview
        document={document()}
        registry={registry()}
        target={{ kind: 'frame', frameId: 'desktop' }}
      />,
    )

    const preview = screen.getByRole('region', { name: 'Compose preview' })
    const frame = screen.getByTestId('compose-preview-frame')
    expect(frame).toHaveStyle({ width: '800px', height: '600px', overflow: 'hidden' })
    expect(frame).not.toHaveStyle({ left: '-500px', top: '200px' })
    expect(preview).toHaveTextContent('preview:Desktop text')
    expect(preview).not.toHaveTextContent('Hidden text')
    expect(preview).not.toHaveTextContent('Mobile text')
  })

  it('OpenSpec: compose-preview / 文档驱动的 Frame Preview / 应用嵌套变换', () => {
    render(
      <ComposePreview
        document={document()}
        registry={registry()}
        target={{ kind: 'frame', frameId: 'desktop' }}
      />,
    )

    expect(screen.getByTestId('compose-preview-node-group')).toHaveStyle({
      left: '100px',
      top: '80px',
      transform: 'rotate(15deg)',
    })
    expect(screen.getByTestId('compose-preview-node-text')).toHaveStyle({
      left: '20px',
      top: '30px',
      transform: 'rotate(-5deg)',
    })
    expect(screen.queryByLabelText('Stage 编辑覆盖层')).not.toBeInTheDocument()
  })

  it('OpenSpec: compose-preview / 文档驱动的 Frame Preview / 预览嵌套 Frame', () => {
    render(
      <ComposePreview
        document={document()}
        registry={registry()}
        target={{ kind: 'frame', frameId: 'group' }}
      />,
    )

    expect(screen.getByTestId('compose-preview-frame')).toHaveStyle({
      width: '300px',
      height: '200px',
      overflow: 'hidden',
    })
    expect(screen.getByText('preview:Desktop text')).toBeInTheDocument()
    expect(screen.queryByTestId('compose-preview-node-group')).not.toBeInTheDocument()
  })

  it('OpenSpec: compose-preview / 忽略画布编辑元数据 / 不渲染网格标尺辅助线或坐标轴', () => {
    const base = document()
    const input: ComposeDocument = {
      ...base,
      canvas: {
        ...base.canvas,
        grid: { ...base.canvas.grid, stepX: 16, stepY: 24 },
        guides: [{ id: 'preview-guide', axis: 'x', position: 48 }],
      },
    }
    render(
      <ComposePreview
        document={input}
        registry={registry()}
        target={{ kind: 'frame', frameId: 'desktop' }}
      />,
    )

    expect(screen.getByTestId('compose-preview-frame')).toBeInTheDocument()
    expect(screen.queryByTestId('stage-ruler-x')).not.toBeInTheDocument()
    expect(screen.queryByTestId('stage-canvas-guide-preview-guide')).not.toBeInTheDocument()
    expect(screen.queryByTestId('stage-origin-x')).not.toBeInTheDocument()
    expect(screen.queryByRole('scrollbar')).not.toBeInTheDocument()
  })

  it('OpenSpec: compose-preview / Preview 节点样式一致性 / 预览统一节点样式', () => {
    render(
      <ComposePreview
        document={document()}
        registry={registry()}
        target={{ kind: 'frame', frameId: 'desktop' }}
      />,
    )

    const frame = screen.getByTestId('compose-preview-frame')
    expect(frame).toHaveStyle({
      backgroundColor: '#fef3c7',
      borderRadius: '10px',
      opacity: '0.95',
    })
    expect(frame.style.boxShadow).toContain('inset 0 0 0 2px #92400e')
    expect(frame.style.boxShadow).toContain('1px 3px 5px 0px #000000')
    expect(screen.getByTestId('compose-preview-node-group')).toHaveStyle({
      backgroundColor: '#ddeeff',
      borderRadius: '6px',
      overflow: 'visible',
    })
    expect(screen.getByTestId('compose-preview-node-text')).toHaveStyle({
      backgroundColor: '#ffffff',
      opacity: '0.8',
    })
  })

  it('OpenSpec: compose-preview / 文档驱动的 Frame Preview / 未知或失败 Renderer', () => {
    render(
      <ComposePreview
        document={document()}
        registry={registry()}
        target={{ kind: 'frame', frameId: 'desktop' }}
      />,
    )
    expect(screen.getByRole('status', { name: /missing/ })).toBeInTheDocument()
    expect(screen.getByText('preview:Desktop text')).toBeInTheDocument()
  })

  it('OpenSpec: compose-preview / Preview 配置与兼容 / 拒绝无效 target 配置', () => {
    const view = render(
      <ComposePreview
        document={document()}
        registry={registry()}
        target={{ kind: 'frame', frameId: 'missing-frame' }}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('missing-frame')

    view.rerender(
      <ComposePreview
        document={document()}
        registry={registry()}
        target={{ kind: 'frame', frameId: 'text' }}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('text')
  })

  it('OpenSpec: compose-preview / 文档驱动的 Frame Preview / 预览完整文档', () => {
    render(<ComposePreview document={document()} registry={registry()} />)

    expect(screen.getByTestId('compose-preview-document')).toHaveStyle({
      width: '1440px',
      height: '900px',
      overflow: 'hidden',
      backgroundColor: '#eef2ff',
    })
    expect(screen.getByTestId('compose-preview-node-desktop')).toHaveStyle({
      left: '-500px',
      top: '200px',
    })
    expect(screen.getByText('preview:Mobile text')).toBeInTheDocument()
  })
})
