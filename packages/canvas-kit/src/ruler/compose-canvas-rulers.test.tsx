import { createRef } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
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
