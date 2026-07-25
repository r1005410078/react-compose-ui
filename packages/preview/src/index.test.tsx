import { createComponentRegistry } from '@compose-ui/component-registry'
import {
  createDefaultCanvasSettings,
  type ComposeDocument,
} from '@compose-ui/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComposePreview } from './index'

afterEach(cleanup)

function document(): ComposeDocument {
  return {
    schemaVersion: 2,
    canvas: createDefaultCanvasSettings(),
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
      },
      group: {
        id: 'group',
        kind: 'group',
        name: 'Group',
        visible: true,
        locked: false,
        transform: { x: 100, y: 80, width: 300, height: 200, rotation: 15 },
        childIds: ['text'],
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
  return createComponentRegistry([{
    type: 'text',
    label: '文本',
    defaultSize: { width: 120, height: 50 },
    createDefaultProps: () => ({ text: 'Text' }),
    renderer: ({ props, mode }) => <span>{mode}:{String(props.text)}</span>,
  }])
}

describe('ComposePreview', () => {
  it('OpenSpec: compose-preview / Preview 配置与兼容 / 保留 legacy children', () => {
    const click = vi.fn()
    render(
      <ComposePreview aria-label="Legacy Preview" className="legacy" onClick={click}>
        Legacy content
      </ComposePreview>,
    )

    const preview = screen.getByRole('region', { name: 'Legacy Preview' })
    expect(preview).toHaveClass('legacy')
    expect(preview).toHaveTextContent('Legacy content')
    fireEvent.click(preview)
    expect(click).toHaveBeenCalledOnce()
  })

  it('OpenSpec: compose-preview / 文档驱动的 Frame Preview / 预览指定 Frame', () => {
    render(<ComposePreview document={document()} frameId="desktop" registry={registry()} />)

    const preview = screen.getByRole('region', { name: 'Compose preview' })
    const frame = screen.getByTestId('compose-preview-frame')
    expect(frame).toHaveStyle({ width: '800px', height: '600px', overflow: 'hidden' })
    expect(frame).not.toHaveStyle({ left: '-500px', top: '200px' })
    expect(preview).toHaveTextContent('preview:Desktop text')
    expect(preview).not.toHaveTextContent('Hidden text')
    expect(preview).not.toHaveTextContent('Mobile text')
  })

  it('OpenSpec: compose-preview / 文档驱动的 Frame Preview / 应用嵌套变换', () => {
    render(<ComposePreview document={document()} frameId="desktop" registry={registry()} />)

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
    render(<ComposePreview document={input} frameId="desktop" registry={registry()} />)

    expect(screen.getByTestId('compose-preview-frame')).toBeInTheDocument()
    expect(screen.queryByTestId('stage-ruler-x')).not.toBeInTheDocument()
    expect(screen.queryByTestId('stage-canvas-guide-preview-guide')).not.toBeInTheDocument()
    expect(screen.queryByTestId('stage-origin-x')).not.toBeInTheDocument()
    expect(screen.queryByRole('scrollbar')).not.toBeInTheDocument()
  })

  it('OpenSpec: compose-preview / Preview 节点样式一致性 / 预览统一节点样式', () => {
    render(<ComposePreview document={document()} frameId="desktop" registry={registry()} />)

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
    render(<ComposePreview document={document()} frameId="desktop" registry={registry()} />)
    expect(screen.getByRole('status', { name: /missing/ })).toBeInTheDocument()
    expect(screen.getByText('preview:Desktop text')).toBeInTheDocument()
  })

  it('OpenSpec: compose-preview / Preview 配置与兼容 / 拒绝不完整文档配置', () => {
    render(<ComposePreview document={document()}>Legacy must not render</ComposePreview>)
    expect(screen.getByRole('alert')).toHaveTextContent(/registry.*frameId/)
    expect(screen.queryByText('Legacy must not render')).not.toBeInTheDocument()
  })

  it('OpenSpec: compose-preview / Preview 配置与兼容 / 拒绝未知 Frame', () => {
    const view = render(
      <ComposePreview document={document()} frameId="missing-frame" registry={registry()} />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('missing-frame')

    view.rerender(
      <ComposePreview document={document()} frameId="text" registry={registry()} />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('text')
  })
})
