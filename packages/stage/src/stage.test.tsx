import { createComponentRegistry } from '@compose-ui/component-registry'
import {
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  createTransactionRuntime,
  type ComposeDocument,
  type TransactionRuntime,
} from '@compose-ui/core'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ComposeUIProvider } from '@compose-ui/ui-context'
import { StrictMode, useState, useSyncExternalStore } from 'react'
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
    onToolChange?(tool: Tool): void
    selectedIds: readonly string[]
    onSelectedIdsChange(ids: readonly string[]): void
    outputSelected?: boolean
    onOutputSelect?(): void
    onSurfaceSizeChange?(size: { width: number; height: number }): void
    shortcuts?: Readonly<Record<string, readonly {
      code: string
      primary?: boolean
      control?: boolean
      shift?: boolean
      alt?: boolean
    }[]>>
    locale?: 'zh-CN' | 'en-US'
    idFactory?: () => string
    'aria-label'?: string
  }): React.ReactNode
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
})

function installControllableAnimationFrames() {
  let nextId = 1
  const callbacks = new Map<number, FrameRequestCallback>()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextId++
    callbacks.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    callbacks.delete(id)
  })
  return {
    flush() {
      const pending = [...callbacks.entries()]
      callbacks.clear()
      pending.forEach(([, callback]) => callback(0))
    },
    takeCallbacks() {
      const pending = [...callbacks.values()]
      callbacks.clear()
      return pending
    },
  }
}

function fixture(): ComposeDocument {
  return {
    schemaVersion: 3,
    canvas: createDefaultCanvasSettings(),
    output: createDefaultOutputSettings(),
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
        clipContent: true,
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
        kind: 'frame',
        name: 'Styled frame',
        visible: true,
        locked: false,
        transform: { x: 340, y: 250, width: 80, height: 60, rotation: 0 },
        childIds: [],
        clipContent: false,
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
        clipContent: true,
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
  onSurfaceSizeChange,
  idFactory = () => 'generated',
  shortcuts,
  locale,
}: {
  runtime: TransactionRuntime
  initialSelection?: readonly string[]
  initialViewport?: Viewport
  tool?: Tool
  onSurfaceSizeChange?: (size: { width: number; height: number }) => void
  idFactory?: () => string
  shortcuts?: Readonly<Record<string, readonly {
    code: string
    primary?: boolean
    control?: boolean
    shift?: boolean
    alt?: boolean
  }[]>>
  locale?: 'zh-CN' | 'en-US'
}) {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getState, runtime.getState)
  const [viewport, setViewport] = useState(initialViewport)
  const [selectedIds, setSelectedIds] = useState(initialSelection)
  const [outputSelected, setOutputSelected] = useState(false)
  const [currentTool, setCurrentTool] = useState(tool)
  return (
    <>
      <api.Stage
        aria-label="测试 Stage"
        dispatch={runtime.dispatch}
        document={state.document}
        idFactory={idFactory}
        locale={locale}
        registry={registry()}
        selectedIds={selectedIds}
        outputSelected={outputSelected}
        shortcuts={shortcuts}
        tool={currentTool}
        viewport={viewport}
        onSelectedIdsChange={setSelectedIds}
        onOutputSelect={() => setOutputSelected(true)}
        onSurfaceSizeChange={onSurfaceSizeChange}
        onToolChange={setCurrentTool}
        onViewportChange={setViewport}
      />
      <output aria-label="当前选择">{selectedIds.join(',')}</output>
      <output aria-label="输出区域选择">{String(outputSelected)}</output>
      <output aria-label="当前工具">{currentTool}</output>
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
  it('OpenSpec: stage / Stage 包导出边界 / 使用新的破坏性导入边界', () => {
    expect(stagePackage).not.toHaveProperty('createStageInteractionController')
    expect(stagePackage).not.toHaveProperty('createGroupCommand')
    expect(stagePackage).not.toHaveProperty('worldToScreen')
  })

  it('OpenSpec: stage / Surface 生命周期 / StrictMode 重放私有 controller', () => {
    expect(() => render(
      <StrictMode>
        <Harness runtime={stageRuntime()} />
      </StrictMode>,
    )).not.toThrow()

    expect(screen.getByRole('application', { name: '测试 Stage' })).toBeInTheDocument()
  })

  it('OpenSpec: stage / DOM 与 SVG 分层 Stage / 渲染 Stage 分层', () => {
    render(<Harness runtime={stageRuntime()} />)

    expect(screen.getByTestId('stage-scene-layer')).toHaveStyle({
      transform: 'translate(0px, 0px) scale(1)',
    })
    expect(screen.getByRole('img', { name: 'Stage 编辑覆盖层' })).toBeInTheDocument()
    expect(screen.getAllByTestId('stage-frame')).toHaveLength(3)
    expect(screen.getByTestId('stage-output-boundary')).toHaveAttribute('fill', 'transparent')
    expect(screen.getByTestId('stage-output-edge-bottom')).not.toHaveClass('is-x')
    expect(screen.getByTestId('stage-output-edge-bottom')).toHaveClass(
      'compose-stage__output-edge',
    )
    expect(screen.getByTestId('stage-output-edge-bottom')).toHaveAttribute('y1', '720')
    expect(screen.getByTestId('stage-output-edge-right')).not.toHaveClass('is-y')
    expect(screen.getByTestId('stage-output-edge-right')).toHaveClass(
      'compose-stage__output-edge',
    )
    expect(screen.getByTestId('stage-output-edge-right')).toHaveAttribute('x1', '1280')
    const xAxis = screen.getByTestId('stage-origin-x')
    const yAxis = screen.getByTestId('stage-origin-y')
    const origin = screen.getByTestId('stage-world-origin')
    const worldOverlay = xAxis.parentElement
    expect(worldOverlay).not.toBeNull()
    expect(xAxis).toHaveAttribute('x1', '0')
    expect(xAxis).toHaveAttribute('x2', '100%')
    expect(yAxis).toHaveAttribute('y1', '0')
    expect(yAxis).toHaveAttribute('y2', '100%')
    expect([...worldOverlay!.children].indexOf(origin)).toBeGreaterThan(
      [...worldOverlay!.children].indexOf(yAxis),
    )
    expect(origin).toHaveAttribute('transform', 'translate(-8 -8)')
    expect(screen.getByTestId('stage-world-origin-silhouette')).toHaveAttribute(
      'd',
      'M6 0v4.42A4 4 0 0 0 4.42 6H0v4h4.42A4 4 0 0 0 6 11.58V16h4v-4.42A4 4 0 0 0 11.58 10H16V6h-4.42A4 4 0 0 0 10 4.42V0Z',
    )
    expect(screen.getByTestId('stage-world-origin-silhouette')).toHaveAttribute('fill', '#fff')
    expect(screen.getByTestId('stage-world-origin-silhouette')).toHaveAttribute(
      'fill-opacity',
      '0.706',
    )
    expect(screen.getByTestId('stage-world-origin-position')).toHaveAttribute(
      'd',
      'M7 1v3a4 4 0 0 1 2 0V1Zm1 4a3 3 0 0 0 0 6 3 3 0 0 0 0-6ZM1 7v2h3a4 4 0 0 1 0-2H1Zm11 0a4 4 0 0 1 0 2h3V7Zm-5 8h2v-3a4 4 0 0 1-2 0Z',
    )
    expect(screen.getByTestId('stage-world-origin-position')).toHaveAttribute('fill', '#ff5f5f')
    expect(screen.queryByTestId('stage-world-origin-outline')).not.toBeInTheDocument()
    expect(screen.queryByTestId('stage-world-origin-halo')).not.toBeInTheDocument()
    expect(screen.queryByTestId('stage-output-center-x')).not.toBeInTheDocument()
  })

  it('OpenSpec: stage / 多 Frame 与输出边界 / 世界原点标记随视口移动且保持固定尺寸', () => {
    render(
      <Harness
        initialViewport={{ x: 100, y: 80, zoom: 0.25 }}
        runtime={stageRuntime()}
      />,
    )

    expect(screen.getByTestId('stage-world-origin')).toHaveAttribute(
      'transform',
      'translate(92 72)',
    )
  })

  it('OpenSpec: stage / 多 Frame 与输出边界 / 点击透明输出区域请求检查 Canvas', () => {
    render(<Harness initialSelection={['a']} runtime={stageRuntime()} />)
    const output = screen.getByTestId('stage-output-boundary')

    fireEvent.pointerDown(output, {
      button: 0,
      buttons: 1,
      clientX: 300,
      clientY: 200,
      pointerId: 39,
    })
    fireEvent.pointerUp(viewportElement(), {
      buttons: 0,
      clientX: 300,
      clientY: 200,
      pointerId: 39,
    })

    expect(screen.getByRole('status', { name: '当前选择' })).toBeEmptyDOMElement()
    expect(screen.getByRole('status', { name: '输出区域选择' })).toHaveTextContent('true')
    expect(output).toHaveClass('is-selected')
    expect(screen.getByTestId('stage-output-edge-bottom').parentElement).toHaveClass(
      'is-selected',
    )
    expect(screen.queryByTestId('stage-selection-bounds')).not.toBeInTheDocument()
  })

  it('OpenSpec: stage / 受控无限视口 / 使用真实 surface 尺寸', () => {
    let resizeCallback: ResizeObserverCallback | null = null
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }

      observe() {}

      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    const onSurfaceSizeChange = vi.fn()
    render(
      <Harness
        onSurfaceSizeChange={onSurfaceSizeChange}
        runtime={stageRuntime()}
      />,
    )
    const surface = screen.getByTestId('stage-surface')
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      x: 24,
      y: 24,
      left: 24,
      top: 24,
      right: 790,
      bottom: 590,
      width: 766,
      height: 566,
      toJSON: () => ({}),
    })

    act(() => {
      resizeCallback?.([], {} as ResizeObserver)
    })

    expect(onSurfaceSizeChange).toHaveBeenLastCalledWith({ width: 766, height: 566 })
  })

  // OpenSpec: stage / 自适应网格标尺与世界原点 / 标记选择尺寸
  it('OpenSpec: stage / 自适应网格标尺与世界原点 / 显示世界原点交叉', () => {
    render(<Harness initialSelection={['a', 'b']} runtime={stageRuntime()} />)

    expect(screen.getByTestId('stage-ruler-x')).toBeInTheDocument()
    expect(screen.getByTestId('stage-ruler-y')).toBeInTheDocument()
    expect(screen.getByTestId('stage-origin-x')).toHaveAttribute('y1', '0')
    expect(screen.getByTestId('stage-origin-y')).toHaveAttribute('x1', '0')
    expect(screen.getByTestId('stage-ruler-selection-x')).toHaveTextContent('260')
    expect(screen.getByTestId('stage-ruler-selection-y')).toHaveTextContent('50')
  })

  it('OpenSpec: stage / 自适应网格标尺与世界原点 / 低于 100% 仍显示真实细网格', () => {
    render(
      <Harness
        initialViewport={{ x: 100, y: 80, zoom: 0.75 }}
        runtime={stageRuntime()}
      />,
    )

    const grid = screen.getByTestId('stage-grid')
    expect(grid.style.backgroundSize).toBe(
      '48px 100%, 100% 48px, 6px 100%, 100% 6px',
    )
    expect(grid.style.backgroundPosition).toBe(
      '4px 0px, 0px 32px, 4px 0px, 0px 2px',
    )
  })

  // OpenSpec: stage / 可拖拽全局辅助线 / 移动删除或取消辅助线
  it('OpenSpec: stage / 可拖拽全局辅助线 / 从标尺创建辅助线', () => {
    const runtime = stageRuntime()
    render(<Harness runtime={runtime} />)
    const viewport = viewportElement()
    const ruler = screen.getByTestId('stage-ruler-x')

    fireEvent.pointerDown(ruler, {
      button: 0,
      clientX: 35,
      clientY: 10,
      pointerId: 1,
    })
    fireEvent.pointerMove(viewport, {
      buttons: 1,
      clientX: 51,
      clientY: 120,
      pointerId: 1,
    })
    expect(runtime.entries).toHaveLength(1)
    fireEvent.pointerUp(viewport, { clientX: 51, clientY: 120, pointerId: 1 })
    expect(runtime.entries).toHaveLength(2)
    expect(runtime.document.canvas.guides).toEqual([
      { id: 'generated', axis: 'x', position: 48 },
    ])

    fireEvent.pointerDown(screen.getByTestId('stage-canvas-guide-generated'), {
      button: 0,
      clientX: 48,
      clientY: 120,
      pointerId: 2,
    })
    fireEvent.pointerUp(viewport, { clientX: 72, clientY: 140, pointerId: 2 })
    expect(runtime.document.canvas.guides[0]?.position).toBe(72)
    expect(runtime.entries).toHaveLength(3)

    fireEvent.pointerDown(screen.getByTestId('stage-canvas-guide-generated'), {
      button: 0,
      clientX: 72,
      clientY: 140,
      pointerId: 3,
    })
    fireEvent.pointerUp(viewport, { clientX: 72, clientY: -2, pointerId: 3 })
    expect(runtime.document.canvas.guides).toEqual([])
    expect(runtime.entries).toHaveLength(4)

    fireEvent.pointerDown(ruler, {
      button: 0,
      clientX: 80,
      clientY: 10,
      pointerId: 4,
    })
    fireEvent.keyDown(viewport, { key: 'Escape' })
    expect(runtime.entries).toHaveLength(4)
  })

  it('OpenSpec: stage / 可拖拽全局辅助线 / 从交叉角创建双轴辅助线', () => {
    const runtime = stageRuntime()
    let id = 0
    render(<Harness idFactory={() => `generated-${id++}`} runtime={runtime} />)
    const viewport = viewportElement()

    fireEvent.pointerDown(screen.getByTestId('stage-ruler-corner'), {
      button: 0,
      clientX: 12,
      clientY: 12,
      pointerId: 5,
    })
    fireEvent.pointerMove(viewport, {
      buttons: 1,
      clientX: 88,
      clientY: 104,
      pointerId: 5,
    })
    expect(runtime.entries).toHaveLength(1)
    fireEvent.pointerUp(viewport, { clientX: 88, clientY: 104, pointerId: 5 })

    expect(runtime.document.canvas.guides).toEqual([
      { id: 'generated-0', axis: 'x', position: 88 },
      { id: 'generated-1', axis: 'y', position: 104 },
    ])
    expect(runtime.entries).toHaveLength(2)
    act(() => runtime.undo())
    expect(runtime.document.canvas.guides).toEqual([])
  })

  // OpenSpec: stage / 无限画布滚动条 / 拖动滚动条平移
  it('OpenSpec: stage / 无限画布滚动条 / 键盘操作可访问滚动条', () => {
    const runtime = stageRuntime()
    render(<Harness runtime={runtime} />)
    const horizontal = screen.getByRole('scrollbar', { name: '水平画布滚动条' })
    const before = screen.getByLabelText('当前视口').textContent

    fireEvent.keyDown(horizontal, { key: 'PageDown' })

    expect(screen.getByLabelText('当前视口').textContent).not.toBe(before)
    expect(runtime.entries).toHaveLength(1)
    expect(horizontal).toHaveAttribute('aria-valuemin')
    expect(horizontal).toHaveAttribute('aria-valuemax')
    expect(horizontal).toHaveAttribute('aria-valuenow')
    expect(horizontal).toHaveAttribute(
      'aria-controls',
      screen.getByTestId('stage-surface').id,
    )

    const thumb = horizontal.querySelector<HTMLElement>('.compose-stage__scrollbar-thumb')
    expect(thumb).not.toBeNull()
    const beforeDrag = screen.getByLabelText('当前视口').textContent
    fireEvent.pointerDown(thumb!, { clientX: 10, pointerId: 6 })
    fireEvent.pointerMove(thumb!, { clientX: 60, pointerId: 6 })
    fireEvent.pointerUp(thumb!, { clientX: 60, pointerId: 6 })

    expect(screen.getByLabelText('当前视口').textContent).not.toBe(beforeDrag)
    expect(runtime.entries).toHaveLength(1)
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
    expect(document.querySelector('[data-node-id="styled-group"]')).toHaveStyle({
      backgroundColor: '#abcdef',
      borderRadius: '5px',
      overflow: 'visible',
    })
  })

  it('OpenSpec: stage / 多 Frame 与输出边界 / 渲染嵌套 Frame 裁剪', () => {
    const runtime = stageRuntime()
    render(<Harness runtime={runtime} />)
    const nested = document.querySelector('[data-node-id="styled-group"]')
    expect(nested).toHaveStyle({ overflow: 'visible', transform: 'rotate(0deg)' })

    act(() => {
      runtime.dispatch({
        id: 'clip-frame',
        type: 'transaction.batch',
        payload: {
          commands: [
            {
              id: 'set-clip',
              type: 'frame.clip-content.set',
              payload: { frameId: 'styled-group', clipContent: true },
            },
            {
              id: 'rotate-frame',
              type: 'node.transform.set',
              payload: {
                updates: [{
                  nodeId: 'styled-group',
                  transform: {
                    ...runtime.document.nodes['styled-group']!.transform,
                    rotation: 18,
                  },
                }],
              },
            },
          ],
        },
      })
    })

    expect(document.querySelector('[data-node-id="styled-group"]')).toHaveStyle({
      overflow: 'hidden',
      transform: 'rotate(18deg)',
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
    fireEvent.pointerMove(viewport, {
      buttons: 1,
      clientX: 160,
      clientY: 140,
      pointerId: 1,
    })
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
    fireEvent.pointerMove(viewport, {
      buttons: 1,
      clientX: 290,
      clientY: 100,
      pointerId: 1,
    })
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
    fireEvent.pointerMove(viewport, {
      buttons: 1,
      clientX: 85,
      clientY: 40,
      pointerId: 1,
    })
    expect(runtime.entries).toHaveLength(1)
    expect(screen.getByTestId('stage-snap-guide-x')).toBeInTheDocument()
    fireEvent.pointerUp(viewport, { clientX: 85, clientY: 40, pointerId: 1 })

    expect(runtime.entries).toHaveLength(2)
    expect(runtime.document.nodes.a.transform.x).toBe(80)
  })

  it('OpenSpec: stage / 屏幕距离吸附 / 临时关闭全部吸附', () => {
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
      buttons: 1,
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

  it('OpenSpec: stage / 直接移动缩放与旋转 / 八向缩放并吸附活动边', () => {
    const runtime = stageRuntime()
    render(<Harness initialSelection={['a']} runtime={runtime} />)
    const viewport = viewportElement()
    const handle = screen.getByTestId('stage-resize-se')
    fireEvent.pointerDown(handle, { clientX: 120, clientY: 80, pointerId: 1 })
    fireEvent.pointerMove(viewport, {
      buttons: 1,
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
    expect(runtime.document.nodes.a.transform).toMatchObject({ width: 148, height: 74 })
  })

  it('OpenSpec: stage / Frame resize / 拖动边界不缩放内部节点', () => {
    const runtime = stageRuntime()
    const childBefore = { ...runtime.document.nodes.a.transform }
    render(<Harness initialSelection={['frame']} runtime={runtime} />)
    const viewport = viewportElement()

    fireEvent.pointerDown(screen.getByTestId('stage-resize-se'), {
      clientX: 500,
      clientY: 400,
      pointerId: 1,
      ctrlKey: true,
    })
    fireEvent.pointerUp(viewport, {
      clientX: 600,
      clientY: 500,
      pointerId: 1,
      ctrlKey: true,
    })

    expect(runtime.document.nodes.frame.transform).toMatchObject({
      width: 600,
      height: 500,
    })
    expect(runtime.document.nodes.a.transform).toEqual(childBefore)
    expect(runtime.entries).toHaveLength(2)
  })

  it('OpenSpec: stage / 直接移动缩放与旋转 / 旋转选择', () => {
    const runtime = stageRuntime()
    render(<Harness initialSelection={['a']} runtime={runtime} />)
    const viewport = viewportElement()
    fireEvent.pointerDown(screen.getByTestId('stage-rotation-handle'), {
      clientX: 70,
      clientY: 0,
      pointerId: 1,
    })
    fireEvent.pointerMove(viewport, {
      buttons: 1,
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
    fireEvent.pointerMove(viewport, {
      buttons: 1,
      clientX: 40,
      clientY: 40,
      pointerId: 1,
    })
    fireEvent.pointerMove(viewport, {
      buttons: 1,
      clientX: 50,
      clientY: 40,
      pointerId: 1,
    })
    fireEvent.pointerMove(viewport, {
      buttons: 1,
      clientX: 60,
      clientY: 40,
      pointerId: 1,
    })
    expect(runtime.entries).toHaveLength(1)
    fireEvent.pointerUp(viewport, { clientX: 60, clientY: 40, pointerId: 1 })
    expect(runtime.entries).toHaveLength(2)
  })

  it('OpenSpec: stage / Pointer 手势原子性与取消 / 下一帧前快速松手使用最终点', () => {
    const animationFrames = installControllableAnimationFrames()
    const runtime = stageRuntime()
    render(<Harness initialSelection={['a']} runtime={runtime} />)
    const viewport = viewportElement()

    fireEvent.pointerDown(screen.getByTestId('stage-node-a'), {
      buttons: 1,
      clientX: 30,
      clientY: 40,
      pointerId: 71,
    })
    fireEvent.pointerMove(viewport, {
      buttons: 1,
      clientX: 50,
      clientY: 40,
      pointerId: 71,
    })
    fireEvent.pointerMove(viewport, {
      buttons: 1,
      clientX: 90,
      clientY: 40,
      pointerId: 71,
    })
    const lateCallbacks = animationFrames.takeCallbacks()

    fireEvent.pointerUp(viewport, {
      buttons: 0,
      clientX: 110,
      clientY: 40,
      pointerId: 71,
    })
    expect(runtime.document.nodes.a.transform.x).toBe(100)
    expect(runtime.entries).toHaveLength(2)

    lateCallbacks.forEach((callback) => callback(0))
    animationFrames.flush()
    expect(runtime.document.nodes.a.transform.x).toBe(100)
    expect(runtime.entries).toHaveLength(2)
  })

  it('OpenSpec: stage / Pointer 手势原子性与取消 / 忽略冒泡、不同 Pointer 与迟到 lost capture', () => {
    const runtime = stageRuntime()
    render(<Harness initialSelection={['a']} runtime={runtime} />)
    const viewport = viewportElement()
    Object.defineProperties(viewport, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    })

    fireEvent.pointerDown(screen.getByTestId('stage-node-a'), {
      buttons: 1,
      clientX: 30,
      clientY: 40,
      pointerId: 72,
    })
    fireEvent.pointerUp(viewport, {
      buttons: 0,
      clientX: 70,
      clientY: 40,
      pointerId: 72,
    })
    expect(runtime.document.nodes.a.transform.x).toBe(60)

    fireEvent.pointerDown(screen.getByTestId('stage-node-a'), {
      buttons: 1,
      clientX: 70,
      clientY: 40,
      pointerId: 72,
    })
    fireEvent.lostPointerCapture(screen.getByTestId('stage-node-a'), {
      buttons: 1,
      pointerId: 72,
    })
    fireEvent.lostPointerCapture(viewport, {
      buttons: 1,
      pointerId: 999,
    })
    fireEvent.lostPointerCapture(viewport, {
      buttons: 0,
      pointerId: 72,
    })
    fireEvent.pointerMove(window, {
      buttons: 1,
      clientX: 110,
      clientY: 40,
      pointerId: 72,
    })
    fireEvent.pointerUp(window, {
      buttons: 0,
      clientX: 110,
      clientY: 40,
      pointerId: 72,
    })

    expect(runtime.document.nodes.a.transform.x).toBe(100)
    expect(runtime.entries).toHaveLength(3)
  })

  it('OpenSpec: stage / Pointer 手势原子性与取消 / buttons 为零的 lost capture 完成最终点', () => {
    const runtime = stageRuntime()
    render(<Harness initialSelection={['a']} runtime={runtime} />)
    const viewport = viewportElement()

    fireEvent.pointerDown(screen.getByTestId('stage-node-a'), {
      buttons: 1,
      clientX: 30,
      clientY: 40,
      pointerId: 73,
    })
    fireEvent.lostPointerCapture(viewport, {
      buttons: 0,
      clientX: 90,
      clientY: 40,
      pointerId: 73,
    })

    expect(runtime.document.nodes.a.transform.x).toBe(80)
    expect(runtime.entries).toHaveLength(2)
  })

  it('OpenSpec: stage / Pointer 手势原子性与取消 / pointercancel 与 blur 均零提交', () => {
    const firstRuntime = stageRuntime()
    const firstView = render(
      <Harness initialSelection={['a']} runtime={firstRuntime} />,
    )
    let viewport = viewportElement()
    fireEvent.pointerDown(screen.getByTestId('stage-node-a'), {
      buttons: 1,
      clientX: 30,
      clientY: 40,
      pointerId: 74,
    })
    fireEvent.pointerMove(viewport, {
      buttons: 1,
      clientX: 90,
      clientY: 40,
      pointerId: 74,
    })
    fireEvent.pointerCancel(viewport, { buttons: 0, pointerId: 74 })
    expect(firstRuntime.document.nodes.a.transform.x).toBe(20)
    expect(firstRuntime.entries).toHaveLength(1)
    firstView.unmount()

    const secondRuntime = stageRuntime()
    render(<Harness initialSelection={['a']} runtime={secondRuntime} />)
    viewport = viewportElement()
    fireEvent.pointerDown(screen.getByTestId('stage-node-a'), {
      buttons: 1,
      clientX: 30,
      clientY: 40,
      pointerId: 75,
    })
    fireEvent.pointerMove(viewport, {
      buttons: 1,
      clientX: 90,
      clientY: 40,
      pointerId: 75,
    })
    fireEvent.blur(window)
    expect(secondRuntime.document.nodes.a.transform.x).toBe(20)
    expect(secondRuntime.entries).toHaveLength(1)
  })

  it('OpenSpec: stage / Surface 输入适配 / surface 重测时冻结 pointerdown 原点', () => {
    let resizeCallback: ResizeObserverCallback | null = null
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }

      observe() {}

      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    const runtime = stageRuntime()
    render(<Harness initialSelection={['a']} runtime={runtime} />)
    viewportElement()
    const surface = screen.getByTestId('stage-surface')
    const rect = vi.spyOn(surface, 'getBoundingClientRect')
    rect.mockReturnValue({
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

    fireEvent.pointerDown(screen.getByTestId('stage-node-a'), {
      buttons: 1,
      clientX: 30,
      clientY: 40,
      ctrlKey: true,
      pointerId: 76,
    })
    rect.mockReturnValue({
      x: 100,
      y: 50,
      left: 100,
      top: 50,
      right: 1060,
      bottom: 770,
      width: 960,
      height: 720,
      toJSON: () => ({}),
    })
    act(() => resizeCallback?.([], {} as ResizeObserver))
    fireEvent.pointerUp(window, {
      buttons: 0,
      clientX: 70,
      clientY: 40,
      ctrlKey: true,
      pointerId: 76,
    })

    expect(runtime.document.nodes.a.transform.x).toBe(60)
    expect(runtime.entries).toHaveLength(2)
  })

  it('OpenSpec: stage / Surface 输入适配 / capture 失败时继续路由活动 Pointer', () => {
    const runtime = stageRuntime()
    render(<Harness initialSelection={['a']} runtime={runtime} />)
    const viewport = viewportElement()
    Object.defineProperty(viewport, 'setPointerCapture', {
      value: () => {
        throw new DOMException('Pointer is not active', 'NotFoundError')
      },
    })

    fireEvent.pointerDown(screen.getByTestId('stage-node-a'), {
      clientX: 30,
      clientY: 40,
      pointerId: 91,
    })
    fireEvent.pointerMove(window, {
      buttons: 1,
      clientX: 70,
      clientY: 40,
      pointerId: 91,
    })
    fireEvent.pointerUp(window, {
      buttons: 0,
      clientX: 70,
      clientY: 40,
      pointerId: 91,
    })

    expect(runtime.document.nodes.a.transform.x).toBe(60)
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
    fireEvent.pointerMove(viewport, {
      buttons: 1,
      clientX: 80,
      clientY: 40,
      pointerId: 1,
    })
    fireEvent.lostPointerCapture(viewport, { buttons: 1, pointerId: 1 })

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
      kind: 'frame',
      childIds: ['a', 'b'],
      clipContent: false,
    })
    fireEvent.keyDown(viewportElement(), {
      key: 'g',
      ctrlKey: true,
      shiftKey: true,
    })
    expect(groupRuntime.document.nodes.generated).toBeUndefined()
  })

  // OpenSpec: stage / 分组与重设父节点 / 根级分组和取消分组
  it('OpenSpec: editor-preferences / 可配置单次快捷键 / 使用组合快捷键', () => {
    const runtime = stageRuntime()
    act(() => {
      runtime.dispatch({
        id: 'move-root-targets',
        type: 'node.move',
        payload: { nodeIds: ['a', 'b'], parentId: null, index: 2 },
      })
    })
    render(<Harness initialSelection={['a', 'b']} runtime={runtime} />)
    const viewport = viewportElement()

    fireEvent.keyDown(viewport, { code: 'KeyG', key: 'g', ctrlKey: true })
    expect(runtime.document.rootIds).toContain('generated')
    expect(runtime.document.nodes.generated).toMatchObject({
      kind: 'frame',
      clipContent: false,
      childIds: ['a', 'b'],
    })
    expect(screen.getByLabelText('当前选择')).toHaveTextContent('generated')

    fireEvent.keyDown(viewport, {
      code: 'KeyG',
      key: 'G',
      ctrlKey: true,
      shiftKey: true,
    })
    expect(runtime.document.nodes.generated).toBeUndefined()
    expect(runtime.document.rootIds).toEqual(['frame', 'frame-negative', 'a', 'b'])
    expect(screen.getByLabelText('当前选择')).toHaveTextContent('a,b')
  })

  it('OpenSpec: stage / 可配置 Stage 快捷键 / 执行默认 Stage 快捷键', () => {
    const runtime = stageRuntime()
    render(<Harness initialSelection={['a']} runtime={runtime} />)
    const viewport = viewportElement()

    fireEvent.keyDown(viewport, { code: 'KeyH', key: 'h' })
    expect(screen.getByLabelText('当前工具')).toHaveTextContent('pan')
    fireEvent.keyDown(viewport, { code: 'KeyV', key: 'v' })
    expect(screen.getByLabelText('当前工具')).toHaveTextContent('select')
    fireEvent.keyDown(viewport, { code: 'KeyF', key: 'f' })
    expect(screen.getByLabelText('当前视口')).not.toHaveTextContent('"zoom":1')
    fireEvent.keyDown(viewport, {
      code: 'Equal',
      key: '=',
      ctrlKey: true,
    })
    expect(runtime.entries).toHaveLength(1)

    fireEvent.keyDown(viewport, {
      code: 'KeyG',
      key: 'G',
      shiftKey: true,
    })
    expect(runtime.document.canvas.grid.snapEnabled).toBe(false)
    expect(runtime.entries).toHaveLength(2)
  })

  it('OpenSpec: editor-preferences / 可配置单次快捷键 / 使用选择推导的 Frame 快捷键', () => {
    const nestedRuntime = stageRuntime()
    const nested = render(<Harness initialSelection={['a']} runtime={nestedRuntime} />)
    const viewport = viewportElement()
    fireEvent.keyDown(viewport, { code: 'KeyF', key: 'F', shiftKey: true })
    expect(screen.getByLabelText('当前视口')).not.toHaveTextContent(
      JSON.stringify({ x: 0, y: 0, zoom: 1 }),
    )
    nested.unmount()

    const rootRuntime = stageRuntime()
    act(() => {
      rootRuntime.dispatch({
        id: 'move-a-root',
        type: 'node.move',
        payload: { nodeIds: ['a'], parentId: null, index: 2 },
      })
    })
    render(<Harness initialSelection={['a']} runtime={rootRuntime} />)
    fireEvent.keyDown(viewportElement(), { code: 'KeyF', key: 'F', shiftKey: true })
    expect(screen.getByLabelText('当前视口')).toHaveTextContent(
      JSON.stringify({ x: 0, y: 0, zoom: 1 }),
    )
  })

  it('OpenSpec: stage / 可配置 Stage 快捷键 / 忽略可编辑与组合输入', () => {
    const runtime = stageRuntime()
    render(<Harness initialSelection={['a']} runtime={runtime} />)
    const input = document.createElement('input')
    input.setAttribute('aria-label', '文本输入')
    viewportElement().append(input)

    fireEvent.keyDown(input, {
      key: 'Delete',
    })
    fireEvent.keyDown(input, { code: 'KeyH', key: 'h' })
    fireEvent.keyDown(viewportElement(), {
      code: 'KeyH',
      isComposing: true,
      key: 'h',
    })
    expect(runtime.document.nodes.a).toBeDefined()
    expect(runtime.entries).toHaveLength(1)
    expect(screen.getByLabelText('当前工具')).toHaveTextContent('select')
  })

  it('OpenSpec: stage / 临时平移生命周期 / 从任意命中区域临时平移', () => {
    const runtime = stageRuntime()
    render(<Harness runtime={runtime} />)
    const viewport = viewportElement()

    fireEvent.keyDown(viewport, { code: 'Space', key: ' ' })
    fireEvent.pointerDown(screen.getByTestId('stage-node-a'), {
      button: 0,
      clientX: 30,
      clientY: 40,
      pointerId: 31,
    })
    fireEvent.pointerMove(viewport, {
      buttons: 1,
      clientX: 90,
      clientY: 80,
      pointerId: 31,
    })
    fireEvent.pointerUp(viewport, { clientX: 90, clientY: 80, pointerId: 31 })

    expect(screen.getByLabelText('当前视口')).toHaveTextContent(
      '{"x":60,"y":40,"zoom":1}',
    )
    expect(screen.getByLabelText('当前选择')).toBeEmptyDOMElement()
    expect(runtime.document.nodes.a.transform.x).toBe(20)
    expect(runtime.entries).toHaveLength(1)
  })

  it('OpenSpec: stage / 临时平移生命周期 / 清理中断的临时平移', () => {
    const runtime = stageRuntime()
    render(<Harness runtime={runtime} />)
    const viewport = viewportElement()

    fireEvent.keyDown(viewport, { code: 'Space', key: ' ' })
    fireEvent.blur(window)
    fireEvent.pointerDown(screen.getByTestId('stage-node-a'), {
      button: 0,
      clientX: 30,
      clientY: 40,
      pointerId: 32,
    })
    fireEvent.pointerUp(viewport, { clientX: 30, clientY: 40, pointerId: 32 })

    expect(screen.getByLabelText('当前选择')).toHaveTextContent('a')
    expect(screen.getByLabelText('当前视口')).toHaveTextContent(
      '{"x":0,"y":0,"zoom":1}',
    )
  })

  it('OpenSpec: stage / 可配置 Stage 快捷键 / 执行自定义临时平移键', () => {
    const runtime = stageRuntime()
    const defaults = {
      'stage.temporaryPan': [{ code: 'KeyP' }],
    }
    render(<Harness runtime={runtime} shortcuts={defaults} />)
    const viewport = viewportElement()

    fireEvent.keyDown(viewport, { code: 'Space', key: ' ' })
    fireEvent.pointerDown(viewport, {
      button: 0,
      clientX: 500,
      clientY: 420,
      pointerId: 30,
    })
    fireEvent.pointerMove(viewport, {
      buttons: 1,
      clientX: 540,
      clientY: 450,
      pointerId: 30,
    })
    fireEvent.pointerUp(viewport, { clientX: 540, clientY: 450, pointerId: 30 })
    fireEvent.keyUp(viewport, { code: 'Space', key: ' ' })
    expect(screen.getByLabelText('当前视口')).toHaveTextContent(
      '{"x":0,"y":0,"zoom":1}',
    )

    fireEvent.keyDown(viewport, { code: 'KeyP', key: 'p' })
    fireEvent.pointerDown(screen.getAllByTestId('stage-frame')[0]!, {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 33,
    })
    fireEvent.pointerMove(viewport, {
      buttons: 1,
      clientX: 42,
      clientY: 26,
      pointerId: 33,
    })
    fireEvent.pointerUp(viewport, { clientX: 42, clientY: 26, pointerId: 33 })

    expect(screen.getByLabelText('当前视口')).toHaveTextContent(
      '{"x":32,"y":16,"zoom":1}',
    )
    expect(screen.getByLabelText('当前选择')).toBeEmptyDOMElement()
    expect(runtime.entries).toHaveLength(1)
  })

  it('OpenSpec: stage / Stage 内建本地化 / 使用英文 Stage chrome', () => {
    render(<Harness locale="en-US" runtime={stageRuntime()} />)

    expect(screen.getByLabelText('Ruler origin')).toBeInTheDocument()
    expect(screen.getByLabelText('Horizontal ruler')).toBeInTheDocument()
    expect(screen.getByLabelText('Vertical ruler')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Stage editing overlay' })).toBeInTheDocument()
    expect(screen.getByRole('scrollbar', { name: 'Horizontal canvas scrollbar' }))
      .toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('OpenSpec: ui-context / 共享 UI Context 包 / 独立组件保持兼容 - Stage 消费 Context', () => {
    render(
      <ComposeUIProvider
        locale="en-US"
        messages={{ 'stage.rulerOrigin': 'Coordinate origin' }}
        theme="light"
      >
        <Harness runtime={stageRuntime()} />
      </ComposeUIProvider>,
    )

    expect(screen.getByLabelText('Coordinate origin')).toBeInTheDocument()
    expect(viewportElement().closest('.compose-stage'))
      .toHaveAttribute('data-compose-theme', 'light')
  })
})
