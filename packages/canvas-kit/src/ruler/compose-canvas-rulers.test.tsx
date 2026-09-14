import { createRef } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComposeCanvasRulers, type ComposeCanvasRulersHandle } from './compose-canvas-rulers'

afterEach(() => { cleanup() })

function renderRulers(ref?: React.RefObject<ComposeCanvasRulersHandle | null>) {
  return render(
    <ComposeCanvasRulers
      bounds={null}
      horizontalTicks={[{ value: 0, screen: 10, major: true, label: '0' }]}
      labels={{ origin: '原点', horizontal: '水平标尺', vertical: '垂直标尺' }}
      ref={ref}
      screenBounds={null}
      testIdPrefix="canvas-ruler"
      themeKey="dark"
      verticalTicks={[{ value: 0, screen: 10, major: true, label: '0' }]}
      onCornerPointerDown={vi.fn()}
      onHorizontalPointerDown={vi.fn()}
      onVerticalPointerDown={vi.fn()}
    />,
  )
}

describe('OpenSpec: canvas-kit / 共享标尺组件 / 受控、Canvas 绘制、游标走命令式接口', () => {
  it('保留容器 test ID 与 ARIA', () => {
    renderRulers()

    expect(screen.getByTestId('canvas-ruler-x')).toHaveAttribute('aria-label', '水平标尺')
    expect(screen.getByTestId('canvas-ruler-y')).toHaveAttribute('aria-label', '垂直标尺')
    expect(screen.getByTestId('canvas-ruler-corner')).toHaveAttribute('aria-label', '原点')
  })

  it('画布是纯装饰层且不再输出逐刻度 DOM 节点', () => {
    renderRulers()
    const horizontal = screen.getByTestId('canvas-ruler-x')

    expect(horizontal.querySelector('canvas')).toHaveAttribute('aria-hidden', 'true')
    expect(horizontal.querySelectorAll('[data-world-value]')).toHaveLength(0)
  })
})

describe('OpenSpec: stage / 标尺指针游标线 / 指针离开时隐藏游标', () => {
  it('命令式接口接受位置与清除，且不触发重渲染', () => {
    const ref = createRef<ComposeCanvasRulersHandle>()
    renderRulers(ref)

    // 句柄存在即证明指针位置不经过 props/state；绘制结果由 painter 单测与黄金图覆盖。
    expect(ref.current).not.toBeNull()
    expect(() => {
      ref.current?.setCursor({ x: 12, y: 34 })
      ref.current?.setCursor(null)
    }).not.toThrow()
  })
})

describe('OpenSpec: canvas-kit / 共享标尺组件 / 调色板只在主题变化时重读', () => {
  /*
   * 夹具：jsdom 的 `getContext` 返回 null、容器尺寸恒为 0，两者任一都会让绘制在读调色板之前
   * 就早退，测不到这条路径——因此都要桩掉。上下文用 Proxy 一律给 no-op，painter 只调方法与
   * 设属性。
   */
  function stubCanvasEnvironment() {
    const context = new Proxy({}, { get: () => () => undefined }) as unknown as CanvasRenderingContext2D
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => context)
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400)
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(20)
    return () => { getContext.mockRestore(); width.mockRestore(); height.mockRestore() }
  }
  const flushFrames = () => act(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
  const ticks = (screen: number) => [{ value: 0, screen, major: true, label: '0' }]
  const props = (themeKey: string, screen: number) => ({
    bounds: null,
    horizontalTicks: ticks(screen),
    labels: { origin: '原点', horizontal: '水平标尺', vertical: '垂直标尺' },
    screenBounds: null,
    testIdPrefix: 'canvas-ruler',
    themeKey,
    verticalTicks: ticks(screen),
    onCornerPointerDown: vi.fn(),
    onHorizontalPointerDown: vi.fn(),
    onVerticalPointerDown: vi.fn(),
  })

  it('刻度变了不重读，主题变了才重读', async () => {
    const restore = stubCanvasEnvironment()
    const computed = vi.spyOn(window, 'getComputedStyle')
    try {
      const view = render(<ComposeCanvasRulers {...props('dark', 10)} />)
      await flushFrames()
      const afterMount = computed.mock.calls.length
      // 先证明夹具真的走到了读调色板那一步，否则下面的「没有增加」是一条永远绿的假断言。
      expect(afterMount).toBeGreaterThan(0)

      /*
       * 缩放与平移每一步都产出一组新的刻度。读调色板要触发整页样式计算——一张五千个实体的
       * 图纸上是每一步缩放 70–110ms 的长任务，两条标尺各付一次。
       */
      view.rerender(<ComposeCanvasRulers {...props('dark', 24)} />)
      await flushFrames()
      expect(computed.mock.calls.length).toBe(afterMount)

      view.rerender(<ComposeCanvasRulers {...props('light', 24)} />)
      await flushFrames()
      expect(computed.mock.calls.length).toBeGreaterThan(afterMount)
    }
    finally {
      computed.mockRestore()
      restore()
    }
  })
})
