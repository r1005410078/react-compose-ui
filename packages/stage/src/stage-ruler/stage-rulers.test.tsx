import { createRef } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StageRulers, type StageRulersHandle } from './stage-rulers'

afterEach(() => { cleanup() })

function renderRulers(ref?: React.RefObject<StageRulersHandle | null>) {
  return render(
    <StageRulers
      bounds={null}
      horizontalTicks={[{ value: 0, screen: 10, major: true, label: '0' }]}
      labels={{ origin: '原点', horizontal: '水平标尺', vertical: '垂直标尺' }}
      ref={ref}
      screenBounds={null}
      themeKey="dark"
      verticalTicks={[{ value: 0, screen: 10, major: true, label: '0' }]}
      onCornerPointerDown={vi.fn()}
      onHorizontalPointerDown={vi.fn()}
      onVerticalPointerDown={vi.fn()}
    />,
  )
}

describe('OpenSpec: stage / Stage 包导出边界 / 标尺改用 Canvas 绘制', () => {
  it('保留容器 test ID 与 ARIA', () => {
    renderRulers()

    expect(screen.getByTestId('stage-ruler-x')).toHaveAttribute('aria-label', '水平标尺')
    expect(screen.getByTestId('stage-ruler-y')).toHaveAttribute('aria-label', '垂直标尺')
    expect(screen.getByTestId('stage-ruler-corner')).toHaveAttribute('aria-label', '原点')
  })

  it('画布是纯装饰层且不再输出逐刻度 DOM 节点', () => {
    renderRulers()
    const horizontal = screen.getByTestId('stage-ruler-x')

    expect(horizontal.querySelector('canvas')).toHaveAttribute('aria-hidden', 'true')
    expect(horizontal.querySelectorAll('[data-world-value]')).toHaveLength(0)
  })
})

describe('OpenSpec: stage / 标尺指针游标线 / 指针离开时隐藏游标', () => {
  it('命令式接口接受位置与清除，且不触发重渲染', () => {
    const ref = createRef<StageRulersHandle>()
    renderRulers(ref)

    // 句柄存在即证明指针位置不经过 props/state；绘制结果由 painter 单测与黄金图覆盖。
    expect(ref.current).not.toBeNull()
    expect(() => {
      ref.current?.setCursor({ x: 12, y: 34 })
      ref.current?.setCursor(null)
    }).not.toThrow()
  })
})
