import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  createCadCommandHandlers,
  createEmptyCadDocument,
  getCadInsert,
  getCadLine,
  validateCadDocument,
  type CadDocument,
} from '@compose-ui/cad'
import { createDocumentTransactionRuntime } from '@compose-ui/core'
import type { DocumentValidationIssueShape, EditorCommand } from '@compose-ui/core'
import { ComposeCadCanvas } from './compose-cad-canvas'

/**
 * 补齐 jsdom 缺的三样图面依赖。
 *
 * @remarks
 * `getBoundingClientRect` 恒为 0（坐标换算依赖它）、没有 `ResizeObserver`（网格依赖它）、
 * `SVGElement` 上没有 Pointer Capture 三件套（框选与平移依赖它）。少了第三样时按下与松手会
 * 抛出未捕获异常，测试仍会「通过」而错误只出现在 Vitest 的 Unhandled Errors 里。
 */
function stubSurfaceRect() {
  for (const name of ['setPointerCapture', 'releasePointerCapture'] as const) {
    Object.defineProperty(SVGElement.prototype, name, { configurable: true, value: () => {} })
  }
  Object.defineProperty(SVGElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: () => false,
  })
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

function setup(props: Partial<Parameters<typeof ComposeCadCanvas>[0]> = {}) {
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
      {...props}
    />,
  )
  const rerender = () => {
    view.rerender(
      <ComposeCadCanvas
        document={runtime.document}
        idFactory={() => `id-${++counter}`}
        onDispatch={dispatch}
        {...props}
      />,
    )
  }
  return { runtime, rerender }
}

describe('画布标尺', () => {
  it('OpenSpec: cad-document / CAD 画布网格与标尺 / 默认显示上左标尺与原点角', () => {
    setup()
    expect(screen.getByTestId('cad-ruler-x')).toHaveAttribute('aria-label', '水平标尺')
    expect(screen.getByTestId('cad-ruler-y')).toHaveAttribute('aria-label', '垂直标尺')
    expect(screen.getByTestId('cad-ruler-corner')).toHaveAttribute('aria-label', '世界原点')
  })

  it('OpenSpec: cad-document / CAD 画布网格与标尺 / 宿主可以关闭标尺', () => {
    setup({ showRulers: false })
    expect(screen.queryByTestId('cad-ruler-x')).toBeNull()
    expect(screen.queryByTestId('cad-ruler-corner')).toBeNull()
  })
})

describe('十字光标', () => {
  function lines() {
    return screen.getByTestId('cad-surface').querySelectorAll('[data-cad-crosshair-line]')
  }
  function pickbox() {
    return screen.queryByTestId('cad-pickbox')
  }
  function surfaceHidesCursor() {
    return screen.getByTestId('cad-surface').hasAttribute('data-crosshair')
  }

  it('OpenSpec: cad-document / CAD 十字光标 / 三种形态随等待的输入类型切换', () => {
    setup()
    // 空闲：线与框都在，系统光标被收走。
    hoverAt(200, 160)
    expect(lines()).toHaveLength(4)
    expect(pickbox()).not.toBeNull()
    expect(surfaceHidesCursor()).toBe(true)

    // 等待取点：只剩线。
    submit('L')
    hoverAt(200, 160)
    expect(lines()).toHaveLength(4)
    expect(pickbox()).toBeNull()

    // 等待选择对象：只剩框。
    submit('')
    clickAt(100, 100)
    clickAt(300, 100)
    submit('F')
    submit('E')
    hoverAt(200, 160)
    expect(lines()).toHaveLength(0)
    expect(pickbox()).not.toBeNull()
  })

  it('OpenSpec: cad-document / CAD 十字光标 / 拾取框半边长等于命中容差且线在框处断开', () => {
    setup({ pickRadius: 12 })
    hoverAt(200, 160)
    const box = pickbox()
    expect(box?.getAttribute('width')).toBe('24')
    expect(box?.getAttribute('x')).toBe('188')

    // 四条线都从框边起步，框内不留线段。
    const starts = [...lines()].map((line) => ({
      x: Number(line.getAttribute('x1')), y: Number(line.getAttribute('y1')),
    }))
    for (const start of starts) {
      expect(Math.max(Math.abs(start.x - 200), Math.abs(start.y - 160))).toBe(12)
    }
  })

  it('OpenSpec: cad-document / CAD 十字光标 / 触摸指针不绘制也不隐藏系统光标', () => {
    setup()
    fireEvent.pointerMove(screen.getByTestId('cad-surface'), {
      clientX: 200, clientY: 160, pointerId: 1, pointerType: 'touch',
    })
    expect(lines()).toHaveLength(0)
    expect(pickbox()).toBeNull()
    expect(surfaceHidesCursor()).toBe(false)
  })

  it('OpenSpec: cad-document / CAD 十字光标 / 宿主关闭时不绘制也不隐藏系统光标', () => {
    setup({ showCrosshair: false })
    hoverAt(200, 160)
    expect(lines()).toHaveLength(0)
    expect(pickbox()).toBeNull()
    expect(surfaceHidesCursor()).toBe(false)
  })

  it('OpenSpec: cad-document / CAD 指示点 / 手势进行中继续更新，且不被手势会话接管', () => {
    setup()
    const surface = screen.getByTestId('cad-surface')
    // 框选拖拽期间指示点仍随指针走。
    fireEvent.pointerDown(surface, { button: 0, clientX: 400, clientY: 300, pointerId: 1 })
    hoverAt(260, 210)
    expect(pickbox()?.getAttribute('x')).toBe('252')
    fireEvent.pointerUp(surface, { button: 0, clientX: 260, clientY: 210, pointerId: 1 })
    expect(pickbox()?.getAttribute('x')).toBe('252')
  })
})

describe('指针反馈', () => {
  function pendingPreview() {
    return screen.queryAllByTestId('cad-surface')[0]
      ?.querySelectorAll('[data-cad-preview="pending"]') ?? []
  }
  function hovered() {
    return screen.getByTestId('cad-surface').querySelectorAll('[data-hovered]')
  }

  it('OpenSpec: cad-document / CAD 指针反馈 / 橡皮筋跟随指针并在命令结束后消失', () => {
    setup()
    submit('L')
    // 还没取到第一点：没有参照点，橡皮筋无从画起。
    hoverAt(200, 200)
    expect(pendingPreview()).toHaveLength(0)

    clickAt(100, 100)
    hoverAt(300, 240)
    const [band] = pendingPreview()
    expect(band).toBeDefined()
    expect(band?.getAttribute('x1')).toBe('100')
    expect(band?.getAttribute('x2')).toBe('300')

    submit('F')
    expect(pendingPreview()).toHaveLength(0)
  })

  it('OpenSpec: cad-document / CAD 指针反馈 / 正交把橡皮筋约束成水平或垂直', () => {
    setup()
    fireEvent.keyDown(screen.getByTestId('cad-canvas'), { key: 'F8' })
    submit('L')
    clickAt(100, 100)
    // 斜向移动，水平分量更大 -> 落点应当被压回同一条水平线。
    hoverAt(300, 140)
    const [band] = pendingPreview()
    expect(band?.getAttribute('y1')).toBe(band?.getAttribute('y2'))
  })

  it('OpenSpec: cad-document / CAD 指针反馈 / 悬停高亮只在按下会产生选择时出现', () => {
    const { rerender } = setup()
    submit('L')
    clickAt(100, 100)
    clickAt(300, 100)
    submit('F')
    rerender()

    hoverAt(200, 100)
    expect(hovered()).toHaveLength(1)

    // 命令正在吃点时，一次按下是给命令的一个点而不是选择，此时高亮会撒谎。
    submit('L')
    hoverAt(200, 100)
    expect(hovered()).toHaveLength(0)

    submit('')
    hoverAt(2000, 2000)
    expect(hovered()).toHaveLength(0)
  })

  it('OpenSpec: cad-document / CAD 指针反馈 / 坐标读数跟随指针并在离开后隐藏', () => {
    setup()
    hoverAt(120, 80)
    expect(screen.getByTestId('cad-pointer-readout')).toHaveTextContent('120, 80')
    fireEvent.pointerLeave(screen.getByTestId('cad-surface'))
    expect(screen.queryByTestId('cad-pointer-readout')).toBeNull()
  })
})

describe('命令行焦点', () => {
  /**
   * @remarks
   * AutoCAD 里命令行是常驻的键盘落点：点完图面直接敲 `F↵` 就结束，光标从不需要挪回去。
   * SVG 图面不可聚焦，一次点击会把焦点甩到 `body`——此后关键字与坐标全部落空，用户看到的是
   * 「点了两下然后回车没反应」。
   *
   * 这里只覆盖挂载聚焦与按下后收回；「浏览器在 `mousedown` 上把焦点甩掉」是真实浏览器行为，
   * jsdom 不模拟，由端到端用例守。
   */
  it('OpenSpec: cad-document / CAD 命令行焦点 / 挂载即聚焦，图面按下后收回', () => {
    setup()
    const input = screen.getByTestId('cad-command-input')
    expect(document.activeElement).toBe(input)

    input.blur()
    expect(document.activeElement).not.toBe(input)

    fireEvent.pointerDown(screen.getByTestId('cad-surface'), {
      button: 0, buttons: 1, clientX: 120, clientY: 120, pointerId: 1,
    })
    expect(document.activeElement).toBe(input)
  })
})

function hoverAt(x: number, y: number) {
  fireEvent.pointerMove(screen.getByTestId('cad-surface'), { clientX: x, clientY: y, pointerId: 1 })
}

function marker() {
  return screen.queryByTestId('cad-snap-marker')
}

function clickAt(x: number, y: number, options: { readonly shiftKey?: boolean } = {}) {
  const surface = screen.getByTestId('cad-surface')
  fireEvent.pointerDown(surface, { button: 0, clientX: x, clientY: y, pointerId: 1, ...options })
  fireEvent.pointerUp(surface, { button: 0, clientX: x, clientY: y, pointerId: 1, ...options })
}

/** 从一点拖到另一点：左→右是窗口，右→左是交叉。 */
function dragAt(from: readonly [number, number], to: readonly [number, number]) {
  const surface = screen.getByTestId('cad-surface')
  fireEvent.pointerDown(surface, { button: 0, clientX: from[0], clientY: from[1], pointerId: 1 })
  fireEvent.pointerMove(surface, { clientX: to[0], clientY: to[1], pointerId: 1 })
  fireEvent.pointerUp(surface, { button: 0, clientX: to[0], clientY: to[1], pointerId: 1 })
}

function selectedIds() {
  return [...document.querySelectorAll('[data-cad-entity][data-selected]')]
    .map((node) => node.getAttribute('data-cad-entity'))
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

describe('CAD 选择集与手势仲裁', () => {
  /** 画两条水平线：y=20 与 y=60，各从 x=10 到 x=110。 */
  function drawTwoLines(rerender: () => void) {
    submit('L')
    clickAt(10, 20)
    clickAt(110, 20)
    submit('')
    submit('L')
    clickAt(10, 60)
    clickAt(110, 60)
    submit('')
    rerender()
  }

  it('OpenSpec: cad-document / CAD 选择集语义 / 点选累积', () => {
    const { rerender } = setup()
    drawTwoLines(rerender)

    clickAt(50, 20)
    rerender()
    expect(selectedIds()).toHaveLength(1)

    clickAt(50, 60)
    rerender()
    expect(selectedIds()).toHaveLength(2)
    expect(screen.getByTestId('cad-selection-count')).toHaveTextContent('2')
  })

  it('OpenSpec: cad-document / CAD 选择集语义 / Shift 点选移出', () => {
    const { rerender } = setup()
    drawTwoLines(rerender)
    clickAt(50, 20)
    rerender()

    clickAt(50, 20, { shiftKey: true })
    rerender()

    expect(selectedIds()).toEqual([])
    expect(screen.queryByTestId('cad-selection-count')).toBeNull()
  })

  it('OpenSpec: cad-document / CAD 选择集语义 / 单击空白清空', () => {
    const { runtime, rerender } = setup()
    drawTwoLines(rerender)
    const before = runtime.document
    clickAt(50, 20)
    rerender()

    clickAt(400, 400)
    rerender()

    expect(selectedIds()).toEqual([])
    // 清空选择不是文档改动。
    expect(runtime.document).toBe(before)
  })

  it('OpenSpec: cad-document / CAD 选择集语义 / Escape 的两级语义', () => {
    const { rerender } = setup()
    drawTwoLines(rerender)
    clickAt(50, 20)
    rerender()

    // 有活动命令时 Esc 取消命令，选择集不动。
    submit('L')
    cancel()
    rerender()
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('已取消')
    expect(selectedIds()).toHaveLength(1)

    // 没有活动命令时 Esc 清空选择集。
    cancel()
    rerender()
    expect(selectedIds()).toEqual([])
  })

  it('OpenSpec: cad-document / CAD 指针手势仲裁 / 命令取点压过点选', () => {
    const { rerender } = setup()
    drawTwoLines(rerender)

    submit('L')
    clickAt(50, 20)
    rerender()

    // 命令正等待取点，落在既有线上的这一次按下是一个顶点，不改变选择集。
    expect(selectedIds()).toEqual([])
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('指定下一点')
  })

  it('OpenSpec: cad-document / CAD 框选的窗口与交叉模式 / 窗口只选完全包含的', () => {
    const { rerender } = setup()
    drawTwoLines(rerender)

    // 左→右且只框住 y=20 那条的一部分：窗口模式选不中它。
    dragAt([0, 0], [60, 40])
    rerender()
    expect(selectedIds()).toEqual([])

    // 完整框住两条。
    dragAt([0, 0], [200, 200])
    rerender()
    expect(selectedIds()).toHaveLength(2)
  })

  it('OpenSpec: cad-document / CAD 框选的窗口与交叉模式 / 交叉选相交的', () => {
    const { rerender } = setup()
    drawTwoLines(rerender)

    // 右→左：只碰到 y=20 那条的中段即可选中它。
    dragAt([60, 40], [40, 0])
    rerender()

    expect(selectedIds()).toHaveLength(1)
  })

  it('OpenSpec: cad-document / CAD 框选的窗口与交叉模式 / 选框的视觉区分', () => {
    const { rerender } = setup()
    drawTwoLines(rerender)
    const surface = screen.getByTestId('cad-surface')

    fireEvent.pointerDown(surface, { button: 0, clientX: 0, clientY: 0, pointerId: 1 })
    fireEvent.pointerMove(surface, { clientX: 80, clientY: 80, pointerId: 1 })
    expect(screen.getByTestId('cad-marquee')).toHaveAttribute('data-marquee-mode', 'window')

    fireEvent.pointerMove(surface, { clientX: -80, clientY: 80, pointerId: 1 })
    expect(screen.getByTestId('cad-marquee')).toHaveAttribute('data-marquee-mode', 'crossing')

    fireEvent.pointerUp(surface, { button: 0, clientX: -80, clientY: 80, pointerId: 1 })
    expect(screen.queryByTestId('cad-marquee')).toBeNull()
  })

  it('OpenSpec: cad-document / CAD ERASE 命令与先选后执行 / 先选后执行', () => {
    const { runtime, rerender } = setup()
    drawTwoLines(rerender)
    dragAt([0, 0], [200, 200])
    rerender()
    expect(selectedIds()).toHaveLength(2)

    submit('E')
    rerender()

    expect(runtime.document.rootIds).toEqual([])
    // 一次撤销把两条线一起恢复。
    runtime.undo()
    expect(runtime.document.rootIds).toHaveLength(2)
  })

  it('OpenSpec: cad-document / CAD ERASE 命令与先选后执行 / 先执行后选', () => {
    const { runtime, rerender } = setup()
    drawTwoLines(rerender)

    submit('E')
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('选择对象')

    clickAt(50, 20)
    clickAt(50, 60)
    submit('')
    rerender()

    expect(runtime.document.rootIds).toEqual([])
  })

  it('OpenSpec: cad-document / CAD ERASE 命令与先选后执行 / 没有选中任何对象时取消', () => {
    const { runtime, rerender } = setup()
    drawTwoLines(rerender)
    const before = runtime.document

    submit('E')
    submit('')
    rerender()

    expect(runtime.document).toBe(before)
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('已取消')
  })

  it('删除后被删的 id 不留在选择集里', () => {
    const { runtime, rerender } = setup()
    drawTwoLines(rerender)
    clickAt(50, 20)
    rerender()

    submit('E')
    rerender()

    expect(runtime.document.rootIds).toHaveLength(1)
    expect(screen.queryByTestId('cad-selection-count')).toBeNull()
    expect(selectedIds()).toEqual([])
  })

  it('OpenSpec: cad-document / CAD 指针手势仲裁 / 中键平移走兜底路径', () => {
    const { rerender } = setup()
    drawTwoLines(rerender)
    const surface = screen.getByTestId('cad-surface')

    // 中键落在一条线上：不选中它，改为平移视图。
    fireEvent.pointerDown(surface, { button: 1, clientX: 50, clientY: 20, pointerId: 2 })
    fireEvent.pointerMove(surface, { clientX: 90, clientY: 20, pointerId: 2 })
    fireEvent.pointerUp(surface, { button: 1, clientX: 90, clientY: 20, pointerId: 2 })
    rerender()

    expect(selectedIds()).toEqual([])
    // 视图右移 40，图元跟着走。
    const first = document.querySelector('[data-cad-entity]')
    expect(first).toHaveAttribute('x1', '50')
  })
})

describe('CAD 块定义与插入', () => {
  /** 画一个方角：(10,20)→(110,20)→(110,120)。 */
  function drawCorner(rerender: () => void) {
    submit('L')
    clickAt(10, 20)
    clickAt(110, 20)
    clickAt(110, 120)
    submit('')
    rerender()
  }

  it('OpenSpec: cad-document / CAD BLOCK 与 INSERT 命令 / 先选后执行建块', () => {
    const { runtime, rerender } = setup()
    drawCorner(rerender)
    dragAt([0, 0], [200, 200])
    rerender()
    expect(selectedIds()).toHaveLength(2)

    submit('B')
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('输入块名')
    submit('CORNER')
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('指定插入基点')
    clickAt(10, 20)
    rerender()

    // 两条线被一个实例取代，块内几何按基点换算成局部坐标。
    expect(runtime.document.rootIds).toHaveLength(1)
    expect(Object.keys(runtime.document.blocks)).toHaveLength(1)
    // 画面上仍是两段——实例被展开渲染，不是一张贴图。
    expect(document.querySelectorAll('[data-cad-entity]')).toHaveLength(2)

    runtime.undo()
    expect(runtime.document.rootIds).toHaveLength(2)
    expect(runtime.document.blocks).toEqual({})
  })

  it('OpenSpec: cad-document / CAD BLOCK 与 INSERT 命令 / 插入点捕捉到既有几何', () => {
    const { runtime, rerender } = setup()
    drawCorner(rerender)
    dragAt([0, 0], [200, 200])
    rerender()
    submit('B')
    submit('CORNER')
    clickAt(10, 20)
    rerender()

    // 再画一条端点**不在网格上**的线，用它当捕捉目标——端点在网格上时，捕捉与网格给出同一个
    // 答案，用例就证明不了是哪一个在起作用。
    submit('L')
    submit('143,87')
    submit('243,87')
    submit('F')
    rerender()

    submit('I')
    submit('CORNER')
    hoverAt(145, 89)
    expect(screen.getByTestId('cad-snap-marker')).toHaveAttribute('data-snap-mode', 'endpoint')
    clickAt(145, 89)
    rerender()

    const inserts = runtime.document.rootIds
      .map((id) => getCadInsert(runtime.document.entities[id]!))
      .filter(Boolean)
    expect(inserts).toHaveLength(2)
    // 落在精确端点 (143,87) 上，而不是被网格取整到 (140,90)。
    expect(inserts[1]!.position).toEqual({ x: 143, y: 87 })
  })

  it('OpenSpec: cad-document / 块实例参与命中、框选与捕捉 / 点选块实例得到实例', () => {
    const { runtime, rerender } = setup()
    drawCorner(rerender)
    dragAt([0, 0], [200, 200])
    rerender()
    submit('B')
    submit('CORNER')
    clickAt(10, 20)
    rerender()

    clickAt(60, 20)
    rerender()

    // 选中的是实例：两段都进入选中态，因为它们同属一个 owner。
    expect(selectedIds()).toEqual([runtime.document.rootIds[0], runtime.document.rootIds[0]])
    expect(screen.getByTestId('cad-selection-count')).toHaveTextContent('1')
  })

  it('OpenSpec: cad-document / CAD BLOCK 与 INSERT 命令 / 未知块名被拒绝', () => {
    const { runtime, rerender } = setup()
    drawCorner(rerender)
    const before = runtime.document

    submit('I')
    submit('NOPE')
    rerender()

    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('未知块名')
    expect(runtime.document).toBe(before)
  })
})
