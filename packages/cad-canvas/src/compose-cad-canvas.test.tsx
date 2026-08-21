import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  createCadCommandHandlers,
  createEmptyCadDocument,
  getCadLine,
  validateCadDocument,
  type CadDocument,
} from '@compose-ui/cad'
import { createDocumentTransactionRuntime } from '@compose-ui/core'
import type { DocumentValidationIssueShape, EditorCommand } from '@compose-ui/core'
import { ComposeCadCanvas } from './compose-cad-canvas'

/**
 * 让画布拿到确定的 surface 尺寸。
 *
 * @remarks
 * jsdom 下 `getBoundingClientRect` 恒为 0，且没有 `ResizeObserver`——坐标换算依赖前者，
 * 网格依赖后者，两个都要补。
 */
function stubSurfaceRect() {
  Object.defineProperty(SVGElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0 }),
  })
  class ResizeObserverFixture {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe() {
      this.callback([{ contentRect: { width: 800, height: 600 } } as ResizeObserverEntry], this)
    }
    disconnect() {}
    unobserve() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverFixture)
}

function setup() {
  stubSurfaceRect()
  let counter = 0
  const runtime = createDocumentTransactionRuntime<CadDocument, DocumentValidationIssueShape>({
    document: createEmptyCadDocument(),
    validate: validateCadDocument,
    handlers: createCadCommandHandlers(),
  })
  const dispatch = (command: EditorCommand) => { runtime.dispatch(command) }
  const view = render(
    <ComposeCadCanvas
      document={runtime.document}
      idFactory={() => `id-${++counter}`}
      onDispatch={dispatch}
    />,
  )
  const rerender = () => {
    view.rerender(
      <ComposeCadCanvas
        document={runtime.document}
        idFactory={() => `id-${++counter}`}
        onDispatch={dispatch}
      />,
    )
  }
  return { runtime, rerender }
}

function hoverAt(x: number, y: number) {
  fireEvent.pointerMove(screen.getByTestId('cad-surface'), { clientX: x, clientY: y, pointerId: 1 })
}

function marker() {
  return screen.queryByTestId('cad-snap-marker')
}

function clickAt(x: number, y: number) {
  const surface = screen.getByTestId('cad-surface')
  fireEvent.pointerDown(surface, { button: 0, clientX: x, clientY: y, pointerId: 1 })
}

/** 在命令行键入一行并回车；空字符串等于直接确认。 */
function submit(text: string) {
  const input = screen.getByTestId('cad-command-input')
  fireEvent.change(input, { target: { value: text } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

function cancel() {
  fireEvent.keyDown(screen.getByTestId('cad-command-input'), { key: 'Escape' })
}

function lines(document: CadDocument) {
  return document.rootIds.map((id) => getCadLine(document.entities[id]!)!)
}

// 仓库的共享 setup 只装了 jest-dom 匹配器，没有开自动 cleanup；同一文件内多次 render 会让
// testId 查询命中上一次的 DOM。
afterEach(cleanup)

describe('CAD 画布与命令行', () => {
  it('OpenSpec: cad-document / CAD 直线命令 / 两点画出一条直线', () => {
    const { runtime, rerender } = setup()

    submit('L')
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('指定第一点')

    clickAt(10, 20)
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('指定下一点')
    clickAt(110, 20)
    // 命令进行中即有预览。
    expect(document.querySelectorAll('[data-cad-preview]')).toHaveLength(1)

    submit('')
    expect(lines(runtime.document)).toEqual([{ start: { x: 10, y: 20 }, end: { x: 110, y: 20 } }])

    rerender()
    expect(document.querySelectorAll('[data-cad-entity]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-cad-preview]')).toHaveLength(0)

    // 一次撤销回到命令开始之前。
    runtime.undo()
    expect(runtime.document.rootIds).toEqual([])
  })

  it('空闲时点击图面不做任何事', () => {
    const { runtime } = setup()
    clickAt(10, 20)
    clickAt(110, 20)
    expect(runtime.document.rootIds).toEqual([])
    expect(runtime.canUndo).toBe(false)
  })

  it('未知命令给出提示且不开始会话', () => {
    setup()
    submit('NOPE')
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('未知命令')
    clickAt(10, 20)
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('未知命令')
  })

  it('OpenSpec: cad-document / CAD 直线命令 / 取消不写入文档', () => {
    const { runtime } = setup()
    submit('LINE')
    clickAt(10, 20)
    clickAt(110, 20)

    cancel()
    expect(runtime.document.rootIds).toEqual([])
    expect(document.querySelectorAll('[data-cad-preview]')).toHaveLength(0)
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('已取消')
  })

  it('命令行显示关键字，且拒绝不结束会话', () => {
    const { runtime } = setup()
    submit('L')
    clickAt(0, 0)
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('放弃(U)')
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('结束(F)')

    submit('ZZZ')
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('需要一个点')

    // 会话仍然活着：继续取点即可完成。
    clickAt(50, 50)
    submit('F')
    expect(lines(runtime.document)).toEqual([{ start: { x: 0, y: 0 }, end: { x: 50, y: 50 } }])
  })

  it('滚轮缩放围绕光标，图元跟着改变屏幕位置', () => {
    const { runtime, rerender } = setup()
    submit('L')
    clickAt(100, 100)
    clickAt(200, 100)
    submit('')
    rerender()

    const surface = screen.getByTestId('cad-surface')
    const before = document.querySelector('[data-cad-entity]')!.getAttribute('x2')
    fireEvent.wheel(surface, { deltaY: -100, clientX: 0, clientY: 0 })
    expect(document.querySelector('[data-cad-entity]')!.getAttribute('x2')).not.toBe(before)
    expect(runtime.document.rootIds).toHaveLength(1)
  })

  it('OpenSpec: cad-document / CAD 坐标语法 / 键入坐标画线', () => {
    const { runtime } = setup()
    submit('L')
    submit('0,0')
    // 相对与极坐标以上一点为参照。
    submit('@100,0')
    submit('100<90')
    submit('F')
    expect(lines(runtime.document)).toEqual([
      { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
      { start: { x: 100, y: 0 }, end: { x: 100, y: -100 } },
    ])
  })

  it('OpenSpec: cad-document / CAD 坐标语法 / 缺少上一点时拒绝相对写法', () => {
    const { runtime } = setup()
    submit('L')
    submit('@10,20')
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('需要一个参照点')
    // 会话仍停在第一步，随后正常取点。
    submit('0,0')
    submit('10,10')
    submit('F')
    expect(lines(runtime.document)).toHaveLength(1)
  })

  it('OpenSpec: cad-document / CAD 点输入管线 / 键入坐标不被吸附改写', () => {
    const { runtime } = setup()
    submit('L')
    // 网格默认开启（步长 10），但键入的坐标是精确值。
    submit('3,7')
    submit('103,47')
    submit('F')
    expect(lines(runtime.document)).toEqual([{ start: { x: 3, y: 7 }, end: { x: 103, y: 47 } }])
  })

  it('OpenSpec: cad-document / 正交模式 / F8 切换并约束取点', () => {
    const { runtime } = setup()
    expect(screen.getByTestId('cad-ortho-state')).toHaveTextContent('正交 关')
    fireEvent.keyDown(screen.getByTestId('cad-canvas'), { key: 'F8' })
    expect(screen.getByTestId('cad-ortho-state')).toHaveTextContent('正交 开')

    submit('L')
    clickAt(0, 0)
    // 水平位移更大 → 钳到与上一点等高；随后网格取整。
    clickAt(103, 47)
    submit('F')
    expect(lines(runtime.document)).toEqual([{ start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }])
  })

  it('指针取点按网格吸附，F7 关闭后不再吸附', () => {
    const { runtime } = setup()
    submit('L')
    clickAt(103, 47)
    clickAt(206, 91)
    submit('F')
    expect(lines(runtime.document)).toEqual([{ start: { x: 100, y: 50 }, end: { x: 210, y: 90 } }])

    fireEvent.keyDown(screen.getByTestId('cad-canvas'), { key: 'F7' })
    submit('L')
    clickAt(103, 47)
    clickAt(206, 91)
    submit('F')
    expect(lines(runtime.document)[1]).toEqual({ start: { x: 103, y: 47 }, end: { x: 206, y: 91 } })
  })

  it('放弃顶点后参照点跟着回退', () => {
    const { runtime } = setup()
    submit('L')
    submit('0,0')
    submit('100,0')
    // 退回第一点，随后的相对坐标以 (0,0) 为参照而不是 (100,0)。
    submit('U')
    submit('@0,50')
    submit('F')
    expect(lines(runtime.document)).toEqual([{ start: { x: 0, y: 0 }, end: { x: 0, y: 50 } }])
  })

  it('只接受关键字的步骤不把文本当坐标', () => {
    // LINE 的每一步都接受点，因此这里断言的是「接受点时才尝试解析」这条判定存在：
    // 第一步不接受关键字，打 U 会被解析为非坐标后交给会话，由会话拒绝。
    setup()
    submit('L')
    submit('U')
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('需要一个点')
  })

  it('OpenSpec: cad-document / CAD 捕捉标记 / 标记随指针移动更新', () => {
    const { rerender } = setup()
    // 先画一条 (0,0)-(100,0) 的线。
    submit('L')
    submit('0,0')
    submit('100,0')
    submit('F')
    rerender()

    // 空闲时不求解捕捉，也不渲染标记。
    hoverAt(2, 2)
    expect(marker()).toBeNull()

    submit('L')
    hoverAt(2, 2)
    expect(marker()).toHaveAttribute('data-snap-mode', 'endpoint')

    hoverAt(50, 3)
    expect(marker()).toHaveAttribute('data-snap-mode', 'midpoint')

    // 移出捕捉半径后标记消失。
    hoverAt(50, 400)
    expect(marker()).toBeNull()
  })

  it('OpenSpec: cad-document / CAD 对象捕捉 / 捕捉压过网格，端点精确相接', () => {
    const { runtime, rerender } = setup()
    submit('L')
    submit('0,0')
    submit('103,47')
    submit('F')
    rerender()

    // 网格开启（步长 10），但捕捉到 (103,47) 这个端点，不被取整。
    submit('L')
    hoverAt(104, 48)
    clickAt(104, 48)
    submit('200,200')
    submit('F')
    expect(lines(runtime.document)[1]?.start).toEqual({ x: 103, y: 47 })
  })

  it('OpenSpec: cad-document / CAD 捕捉标记 / 关闭对象捕捉', () => {
    const { runtime, rerender } = setup()
    submit('L')
    submit('0,0')
    submit('103,47')
    submit('F')
    rerender()

    expect(screen.getByTestId('cad-snap-state')).toHaveTextContent('对象捕捉 开')
    fireEvent.keyDown(screen.getByTestId('cad-canvas'), { key: 'F3' })
    expect(screen.getByTestId('cad-snap-state')).toHaveTextContent('对象捕捉 关')

    submit('L')
    hoverAt(104, 48)
    expect(marker()).toBeNull()
    clickAt(104, 48)
    submit('200,200')
    submit('F')
    // 回到网格吸附。
    expect(lines(runtime.document)[1]?.start).toEqual({ x: 100, y: 50 })
  })

  it('隐藏图层上的图元不渲染', () => {
    stubSurfaceRect()
    const base = createEmptyCadDocument()
    const hidden: CadDocument = {
      ...base,
      layers: [{ ...base.layers[0]!, visible: false }],
      rootIds: ['l1'],
      entities: {
        l1: {
          id: 'l1',
          name: 'Line',
          components: {
            CadPlacement: { layerId: '0' },
            CadLine: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
          },
        },
      },
    }
    render(<ComposeCadCanvas document={hidden} onDispatch={vi.fn()} />)
    expect(document.querySelectorAll('[data-cad-entity]')).toHaveLength(0)
  })
})
