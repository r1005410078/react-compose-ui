import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { ChartRenderer } from './renderer'
import { DEFAULT_CHART_PROPS } from './props'

const instances: { setOption: ReturnType<typeof vi.fn>; resize: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }[] = []

vi.mock('./echarts-runtime', () => ({
  createComposeChartInstance: () => {
    const instance = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }
    instances.push(instance)
    return instance
  },
}))

/** jsdom 没有 ResizeObserver；这份替身让用例能主动触发一次尺寸回调。 */
let notify: (() => void) | null = null

beforeEach(() => {
  instances.length = 0
  notify = null
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { notify = callback }
    observe() { /* 只需要能被调用 */ }
    disconnect() { notify = null }
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function props(over: Record<string, unknown> = {}) {
  return { props: { ...DEFAULT_CHART_PROPS, ...over } } as unknown as
    ComponentProps<typeof ChartRenderer>
}

describe('OpenSpec: basic-materials / 第一方图表物料 / 盒子变了图跟着重绘', () => {
  it('跟随自身盒子而不是窗口', () => {
    /*
     * 判别性的那一半：画布缩放、Auto Layout 与属性面板改尺寸都会改变这个盒子而**窗口一动
     * 不动**。只监听 `window.resize` 的症状是图表画在旧尺寸上。
     */
    const view = render(<ChartRenderer {...props()} />)
    expect(instances).toHaveLength(1)
    expect(instances[0]!.resize).not.toHaveBeenCalled()

    notify?.()
    expect(instances[0]!.resize).toHaveBeenCalledTimes(1)

    // 派发窗口 resize 不该是这条路径的依据，也不该额外触发一次。
    window.dispatchEvent(new Event('resize'))
    expect(instances[0]!.resize).toHaveBeenCalledTimes(1)

    view.unmount()
    expect(instances[0]!.dispose).toHaveBeenCalledTimes(1)
  })

  it('实例只建一次，改 props 只重写 option', () => {
    // `init` 对同一个元素调用第二次会警告并交回另一个实例，两份实例画在同一块画布上。
    const view = render(<ChartRenderer {...props({ kind: 'bar' })} />)
    view.rerender(<ChartRenderer {...props({ kind: 'pie' })} />)
    expect(instances).toHaveLength(1)
    expect(instances[0]!.setOption).toHaveBeenCalledTimes(2)
  })
})
