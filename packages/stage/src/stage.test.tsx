import { createComponentRegistry } from '@compose-ui/component-registry'
import {
  createTransactionRuntime,
  type ComposeDocument,
  type TransactionRuntime,
} from '@compose-ui/core'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState, useSyncExternalStore } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as stagePackage from './index'

type Viewport = { x: number; y: number; zoom: number }
type Tool = 'select' | 'pan'

const api = stagePackage as unknown as {
  Stage(props: {
    document: ComposeDocument
    registry: ReturnType<typeof createComponentRegistry>
    dispatch: TransactionRuntime['dispatch']
    viewport: Viewport
    onViewportChange(viewport: Viewport): void
    tool: Tool
    selectedIds: readonly string[]
    onSelectedIdsChange(ids: readonly string[]): void
    activeFrameId: string | null
    onActiveFrameIdChange(id: string | null): void
    idFactory?: () => string
    'aria-label'?: string
  }): React.ReactNode
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
})

function fixture(): ComposeDocument {
  return {
    schemaVersion: 1,
    rootIds: ['frame', 'frame-negative'],
    nodes: {
      frame: {
        id: 'frame',
        kind: 'frame',
        name: 'Page',
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, width: 500, height: 400, rotation: 0 },
        style: {
          backgroundColor: '#ffeedd',
          borderColor: '#112233',
          borderWidth: 3,
          borderRadius: 8,
          opacity: 0.9,
          shadow: {
            color: '#000000',
            offsetX: 2,
            offsetY: 4,
            blur: 6,
            spread: 1,
          },
        },
        childIds: ['a', 'b', 'hidden', 'locked', 'unknown', 'styled-group'],
      },
      a: {
        id: 'a',
        kind: 'component',
        name: 'A',
        visible: true,
        locked: false,
        transform: { x: 20, y: 30, width: 100, height: 50, rotation: 0 },
        componentType: 'box',
        props: { text: 'A' },
        style: {
          backgroundColor: '#336699',
          borderColor: '#ffffff',
          borderWidth: 2,
          borderRadius: 12,
          opacity: 0.75,
        },
      },
      b: {
        id: 'b',
        kind: 'component',
        name: 'B',
        visible: true,
        locked: false,
        transform: { x: 180, y: 30, width: 100, height: 50, rotation: 0 },
        componentType: 'canvas',
        props: { text: 'B' },
      },
      hidden: {
        id: 'hidden',
        kind: 'component',
        name: 'Hidden',
        visible: false,
        locked: false,
        transform: { x: 20, y: 120, width: 80, height: 40, rotation: 0 },
        componentType: 'box',
        props: {},
      },
      locked: {
        id: 'locked',
        kind: 'component',
        name: 'Locked',
        visible: true,
        locked: true,
        transform: { x: 120, y: 120, width: 80, height: 40, rotation: 0 },
        componentType: 'box',
        props: { text: 'Locked' },
      },
      unknown: {
        id: 'unknown',
        kind: 'component',
        name: 'Unknown',
        visible: true,
        locked: false,
        transform: { x: 220, y: 120, width: 80, height: 40, rotation: 0 },
        componentType: 'host.missing',
        props: { preserved: true },
      },
      'styled-group': {
        id: 'styled-group',
        kind: 'group',
        name: 'Styled group',
        visible: true,
        locked: false,
        transform: { x: 340, y: 250, width: 80, height: 60, rotation: 0 },
        childIds: [],
        style: {
          backgroundColor: '#abcdef',
          borderRadius: 5,
        },
      },
      'frame-negative': {
        id: 'frame-negative',
        kind: 'frame',
        name: 'Negative',
        visible: true,
        locked: false,
        transform: { x: -600, y: -300, width: 320, height: 240, rotation: 0 },
        childIds: [],
      },
    },
  }
}

function registry() {
  return createComponentRegistry([
    {
      type: 'box',
      label: '方块',
      defaultSize: { width: 100, height: 50 },
      createDefaultProps: () => ({ text: 'Box' }),
      renderer: ({ props }) => <span>{String(props.text ?? 'Box')}</span>,
    },
    {
      type: 'canvas',
      label: 'Canvas 图表',
      defaultSize: { width: 100, height: 50 },
      createDefaultProps: () => ({ text: 'Canvas' }),
      renderer: () => <canvas aria-label="宿主 Canvas" />,
    },
  ])
}

function Harness({
  runtime,
  initialSelection = [],
  initialViewport = { x: 0, y: 0, zoom: 1 },
  tool = 'select',
}: {
  runtime: TransactionRuntime
  initialSelection?: readonly string[]
  initialViewport?: Viewport
  tool?: Tool
}) {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getState, runtime.getState)
  const [viewport, setViewport] = useState(initialViewport)
  const [selectedIds, setSelectedIds] = useState(initialSelection)
  const [activeFrameId, setActiveFrameId] = useState<string | null>('frame')
  return (
    <>
      <api.Stage
        activeFrameId={activeFrameId}
        aria-label="测试 Stage"
        dispatch={runtime.dispatch}
        document={state.document}
        idFactory={() => 'generated'}
        registry={registry()}
        selectedIds={selectedIds}
        tool={tool}
        viewport={viewport}
        onActiveFrameIdChange={setActiveFrameId}
        onSelectedIdsChange={setSelectedIds}
        onViewportChange={setViewport}
      />
      <output aria-label="当前选择">{selectedIds.join(',')}</output>
      <output aria-label="当前视口">{JSON.stringify(viewport)}</output>
    </>
  )
}

function stageRuntime() {
  return createTransactionRuntime({
    document: fixture(),
    idFactory: (() => {
      let id = 0
      return () => `transaction-${id++}`
    })(),
    clock: () => 100,
  })
}

function viewportElement() {
  const element = screen.getByRole('application', { name: '测试 Stage' })
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    toJSON: () => ({}),
  })
  return element
}

describe('Stage', () => {
  it('OpenSpec: stage / DOM 与 SVG 分层 Stage / 渲染 Stage 分层', () => {
    render(<Harness runtime={stageRuntime()} />)

    expect(screen.getByTestId('stage-scene-layer')).toHaveStyle({
      transform: 'translate(0px, 0px) scale(1)',
    })
    expect(screen.getByRole('img', { name: 'Stage 编辑覆盖层' })).toBeInTheDocument()
    expect(screen.getAllByTestId('stage-frame')).toHaveLength(2)
  })

  it('OpenSpec: stage / Stage 统一节点样式 / 渲染通用节点样式', () => {
    render(<Harness runtime={stageRuntime()} />)

    expect(screen.getAllByTestId('stage-frame')[0]).toHaveStyle({
      backgroundColor: '#ffeedd',
      borderRadius: '8px',
      opacity: '0.9',
    })
    expect(screen.getAllByTestId('stage-frame')[0]?.style.boxShadow).toContain(
      'inset 0 0 0 3px #112233',
    )
    expect(screen.getAllByTestId('stage-frame')[0]?.style.boxShadow).toContain(
      '2px 4px 6px 1px #000000',
    )
    expect(screen.getByTestId('stage-node-a')).toHaveStyle({
      backgroundColor: '#336699',
      borderRadius: '12px',
      opacity: '0.75',
    })
    expect(screen.getByTestId('stage-node-styled-group')).toHaveStyle({
      backgroundColor: '#abcdef',
      borderRadius: '5px',
      overflow: 'visible',
    })
  })

  it('OpenSpec: stage / DOM 与 SVG 分层 Stage / 渲染组件内部 Canvas', () => {
    render(<Harness runtime={stageRuntime()} />)
    expect(screen.getByLabelText('宿主 Canvas')).toBeInstanceOf(HTMLCanvasElement)
  })

  it('OpenSpec: stage / DOM 与 SVG 分层 Stage / 显示未知或失败组件', () => {
    render(<Harness runtime={stageRuntime()} />)
    expect(screen.getByRole('status', { name: /host\.missing/ })).toBeInTheDocument()
    expect(screen.getByTestId('stage-node-unknown')).toHaveAttribute('data-node-id', 'unknown')
  })

  it('OpenSpec: stage / 多 Frame 与输出边界 / 显示多个 Frame', () => {
    render(<Harness runtime={stageRuntime()} />)
    expect(document.querySelector('[data-node-id="frame-negative"]')).toHaveStyle({
      left: '-600px',
      top: '-300px',
    })
  })

  it('OpenSpec: stage / 多 Frame 与输出边界 / 隐藏和锁定节点', () => {
    const runtime = stageRuntime()
    render(<Harness initialSelection={['locked']} runtime={runtime} />)

    expect(screen.queryByTestId('stage-node-hidden')).not.toBeInTheDocument()
    expect(screen.getByTestId('stage-node-locked')).toBeInTheDocument()
    fireEvent.keyDown(viewportElement(), { key: 'Delete' })
    expect(runtime.document.nodes.locked).toBeDefined()
    expect(runtime.entries).toHaveLength(1)
  })

  it('OpenSpec: stage / 受控无限视口 / 平移无限视口', () => {
    const runtime = stageRuntime()
    render(<Harness runtime={runtime} tool="pan" />)
    const viewport = viewportElement()
    fireEvent.pointerDown(viewport, { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(viewport, { clientX: 160, clientY: 140, pointerId: 1 })
    fireEvent.pointerUp(viewport, { clientX: 160, clientY: 140, pointerId: 1 })

    expect(screen.getByLabelText('当前视口')).toHaveTextContent(
      '{"x":60,"y":40,"zoom":1}',
    )
    expect(runtime.entries).toHaveLength(1)
  })

  it('OpenSpec: stage / 受控无限视口 / 以游标为锚缩放', () => {
    const runtime = stageRuntime()
    render(<Harness runtime={runtime} />)
    fireEvent.wheel(viewportElement(), {
      clientX: 200,
      clientY: 100,
      ctrlKey: true,
      deltaY: -100,
    })

    expect(screen.getByLabelText('当前视口')).not.toHaveTextContent('"zoom":1}')
    expect(runtime.entries).toHaveLength(1)
  })

  it('OpenSpec: stage / 选择与框选 / 点击与 Shift 多选', () => {
    render(<Harness runtime={stageRuntime()} />)
    fireEvent.pointerDown(screen.getByTestId('stage-node-a'), {
      button: 0,
      clientX: 30,
      clientY: 40,
      pointerId: 1,
    })
    fireEvent.pointerUp(viewportElement(), { clientX: 30, clientY: 40, pointerId: 1 })
    fireEvent.pointerDown(screen.getByTestId('stage-node-b'), {
      button: 0,
      clientX: 190,
      clientY: 40,
      pointerId: 2,
      shiftKey: true,
    })
    fireEvent.pointerUp(viewportElement(), { clientX: 190, clientY: 40, pointerId: 2 })

    expect(screen.getByLabelText('当前选择')).toHaveTextContent('a,b')
    expect(screen.getByTestId('stage-selection-bounds')).toBeInTheDocument()
  })

  it('OpenSpec: stage / 选择与框选 / 框选节点', () => {
    render(<Harness runtime={stageRuntime()} />)
    const viewport = viewportElement()
    fireEvent.pointerDown(viewport, { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(viewport, { clientX: 290, clientY: 100, pointerId: 1 })
    expect(screen.getByTestId('stage-marquee')).toBeInTheDocument()
    fireEvent.pointerUp(viewport, { clientX: 290, clientY: 100, pointerId: 1 })

    expect(screen.getByLabelText('当前选择')).toHaveTextContent('a,b')
  })

  it('OpenSpec: stage / 选择与框选 / 点击空白清选', () => {
    render(<Harness initialSelection={['a']} runtime={stageRuntime()} />)
    const viewport = viewportElement()
    fireEvent.pointerDown(viewport, { button: 0, clientX: 700, clientY: 500, pointerId: 1 })
    fireEvent.pointerUp(viewport, { clientX: 700, clientY: 500, pointerId: 1 })
    expect(screen.getByLabelText('当前选择')).toBeEmptyDOMElement()
  })

  it('OpenSpec: stage / 直接移动缩放与旋转 / 移动单选或多选', () => {
    const runtime = stageRuntime()
    render(<Harness initialSelection={['a']} runtime={runtime} />)
    const viewport = viewportElement()
    fireEvent.pointerDown(screen.getByTestId('stage-node-a'), {
      button: 0,
      clientX: 30,
      clientY: 40,
      pointerId: 1,
    })
    fireEvent.pointerMove(viewport, { clientX: 85, clientY: 40, pointerId: 1 })
    expect(runtime.entries).toHaveLength(1)
    expect(screen.getByTestId('stage-snap-guide-x')).toBeInTheDocument()
    fireEvent.pointerUp(viewport, { clientX: 85, clientY: 40, pointerId: 1 })

    expect(runtime.entries).toHaveLength(2)
    expect(runtime.document.nodes.a.transform.x).toBe(80)
  })

  it('OpenSpec: stage / 屏幕距离吸附 / 临时关闭吸附', () => {
    const runtime = stageRuntime()
    render(<Harness initialSelection={['a']} runtime={runtime} />)
    const viewport = viewportElement()
    fireEvent.pointerDown(screen.getByTestId('stage-node-a'), {
      button: 0,
      clientX: 30,
      clientY: 40,
      pointerId: 1,
    })
    fireEvent.pointerMove(viewport, {
      clientX: 85,
      clientY: 40,
      pointerId: 1,
      ctrlKey: true,
    })
    expect(screen.queryByTestId('stage-snap-guide-x')).not.toBeInTheDocument()
    fireEvent.pointerUp(viewport, {
      clientX: 85,
      clientY: 40,
      pointerId: 1,
      ctrlKey: true,
    })
    expect(runtime.document.nodes.a.transform.x).toBe(75)
  })

  it('OpenSpec: stage / 直接移动缩放与旋转 / 八向缩放 - 单事务', () => {
    const runtime = stageRuntime()
    render(<Harness initialSelection={['a']} runtime={runtime} />)
    const viewport = viewportElement()
    const handle = screen.getByTestId('stage-resize-se')
    fireEvent.pointerDown(handle, { clientX: 120, clientY: 80, pointerId: 1 })
    fireEvent.pointerMove(viewport, {
      clientX: 170,
      clientY: 105,
      pointerId: 1,
      shiftKey: true,
    })
    expect(runtime.entries).toHaveLength(1)
    fireEvent.pointerUp(viewport, {
      clientX: 170,
      clientY: 105,
      pointerId: 1,
      shiftKey: true,
    })
    expect(runtime.entries).toHaveLength(2)
    expect(runtime.document.nodes.a.transform).toMatchObject({ width: 150, height: 75 })
  })

  it('OpenSpec: stage / 直接移动缩放与旋转 / 旋转选择 - 单事务', () => {
    const runtime = stageRuntime()
    render(<Harness initialSelection={['a']} runtime={runtime} />)
    const viewport = viewportElement()
    fireEvent.pointerDown(screen.getByTestId('stage-rotation-handle'), {
      clientX: 70,
      clientY: 0,
      pointerId: 1,
    })
    fireEvent.pointerMove(viewport, {
      clientX: 130,
      clientY: 55,
      pointerId: 1,
      shiftKey: true,
    })
    fireEvent.pointerUp(viewport, {
      clientX: 130,
      clientY: 55,
      pointerId: 1,
      shiftKey: true,
    })
    expect(runtime.entries).toHaveLength(2)
    expect(runtime.document.nodes.a.transform.rotation % 15).toBe(0)
  })

  it('OpenSpec: stage / Pointer 手势原子性与取消 / 高频 Pointer 移动', () => {
    const runtime = stageRuntime()
    render(<Harness initialSelection={['a']} runtime={runtime} />)
    const viewport = viewportElement()
    fireEvent.pointerDown(screen.getByTestId('stage-node-a'), {
      clientX: 30,
      clientY: 40,
      pointerId: 1,
    })
    fireEvent.pointerMove(viewport, { clientX: 40, clientY: 40, pointerId: 1 })
    fireEvent.pointerMove(viewport, { clientX: 50, clientY: 40, pointerId: 1 })
    fireEvent.pointerMove(viewport, { clientX: 60, clientY: 40, pointerId: 1 })
    expect(runtime.entries).toHaveLength(1)
    fireEvent.pointerUp(viewport, { clientX: 60, clientY: 40, pointerId: 1 })
    expect(runtime.entries).toHaveLength(2)
  })

  it('OpenSpec: stage / Pointer 手势原子性与取消 / 取消进行中的手势', () => {
    const runtime = stageRuntime()
    render(<Harness initialSelection={['a']} runtime={runtime} />)
    const viewport = viewportElement()
    const capture = vi.fn()
    Object.defineProperty(viewport, 'setPointerCapture', { value: capture })
    fireEvent.pointerDown(screen.getByTestId('stage-node-a'), {
      clientX: 30,
      clientY: 40,
      pointerId: 1,
    })
    expect(capture).toHaveBeenCalledWith(1)
    fireEvent.pointerMove(viewport, { clientX: 80, clientY: 40, pointerId: 1 })
    fireEvent.lostPointerCapture(viewport, { pointerId: 1 })

    expect(runtime.entries).toHaveLength(1)
    expect(runtime.document.nodes.a.transform.x).toBe(20)
    expect(screen.queryByTestId('stage-snap-guide-x')).not.toBeInTheDocument()
  })

  it('OpenSpec: stage / Stage 键盘命令 / 键盘微调并合并重复', () => {
    const runtime = stageRuntime()
    render(<Harness initialSelection={['a']} runtime={runtime} />)
    const viewport = viewportElement()
    fireEvent.keyDown(viewport, { key: 'ArrowRight' })
    fireEvent.keyDown(viewport, { key: 'ArrowRight', shiftKey: true })

    expect(runtime.document.nodes.a.transform.x).toBe(31)
    expect(runtime.entries).toHaveLength(2)
    act(() => runtime.undo())
    expect(runtime.document.nodes.a.transform.x).toBe(20)
  })

  it('OpenSpec: stage / Stage 键盘命令 / 键盘复制与分组', () => {
    const duplicateRuntime = stageRuntime()
    const duplicateView = render(
      <Harness initialSelection={['a']} runtime={duplicateRuntime} />,
    )
    fireEvent.keyDown(viewportElement(), { key: 'd', ctrlKey: true })
    expect(duplicateRuntime.document.nodes.generated).toMatchObject({
      kind: 'component',
      name: 'A 副本',
    })
    duplicateView.unmount()

    const groupRuntime = stageRuntime()
    render(<Harness initialSelection={['a', 'b']} runtime={groupRuntime} />)
    fireEvent.keyDown(viewportElement(), { key: 'g', ctrlKey: true })
    expect(groupRuntime.document.nodes.generated).toMatchObject({
      kind: 'group',
      childIds: ['a', 'b'],
    })
    fireEvent.keyDown(viewportElement(), {
      key: 'g',
      ctrlKey: true,
      shiftKey: true,
    })
    expect(groupRuntime.document.nodes.generated).toBeUndefined()
  })

  it('OpenSpec: stage / Stage 键盘命令 / 不拦截文本输入', () => {
    const runtime = stageRuntime()
    render(
      <>
        <Harness initialSelection={['a']} runtime={runtime} />
        <input aria-label="文本输入" />
      </>,
    )
    fireEvent.keyDown(screen.getByRole('textbox', { name: '文本输入' }), {
      key: 'Delete',
    })
    expect(runtime.document.nodes.a).toBeDefined()
    expect(runtime.entries).toHaveLength(1)
  })
})
