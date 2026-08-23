import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ComposeCanvasCrosshairLayer } from './compose-canvas-crosshair'
import {
  resolveComposeCanvasCrosshair,
  type ComposeCanvasCrosshairInput,
} from './crosshair-model'

afterEach(cleanup)

const SURFACE = { width: 800, height: 600 }

function input(patch: Partial<ComposeCanvasCrosshairInput> = {}): ComposeCanvasCrosshairInput {
  return {
    show: true,
    pointerType: 'mouse',
    center: { x: 200, y: 160 },
    lines: true,
    box: true,
    boxRadius: 8,
    size: 15,
    ...patch,
  }
}

function draw(patch: Partial<ComposeCanvasCrosshairInput> = {}) {
  render(
    <svg>
      <ComposeCanvasCrosshairLayer
        crosshair={resolveComposeCanvasCrosshair(input(patch))}
        surfaceSize={SURFACE}
        testIdPrefix="probe"
      />
    </svg>,
  )
}

function lines() {
  return document.querySelectorAll('[data-probe-crosshair-line]')
}

describe('OpenSpec: canvas-kit / 共享十字光标组件', () => {
  it('两个形态布尔独立生效', () => {
    draw({ box: false })
    // 一副十字是四条线：两轴各两个方向。
    expect(lines()).toHaveLength(4)
    expect(screen.queryByTestId('probe-pickbox')).toBeNull()

    cleanup()
    draw({ lines: false })
    expect(lines()).toHaveLength(0)
    expect(screen.getByTestId('probe-pickbox')).toBeInTheDocument()
  })

  it('线在拾取框处断开', () => {
    draw()
    const [line] = lines()
    // 靠框那一端从半边长处起笔，框内没有线穿过。
    expect(Math.abs(Number(line?.getAttribute('x1')) - 200)).toBe(8)
  })

  it('没有拾取框时线从中心起笔', () => {
    draw({ box: false })
    const [line] = lines()
    expect(Number(line?.getAttribute('x1'))).toBe(200)
  })

  it('长度按视口较短边取百分比', () => {
    draw({ size: 10, box: false })
    const [line] = lines()
    // 800×600 的较短边是 600，10% = 60。
    expect(Math.abs(Number(line?.getAttribute('x2')) - 200)).toBe(60)
  })

  it('触摸不绘制', () => {
    expect(resolveComposeCanvasCrosshair(input({ pointerType: 'touch' }))).toBeNull()
  })

  it('指针离开图面不残留', () => {
    expect(resolveComposeCanvasCrosshair(input({ center: null }))).toBeNull()
  })

  it('宿主关闭时不绘制', () => {
    expect(resolveComposeCanvasCrosshair(input({ show: false }))).toBeNull()
  })

  it('两个形态布尔都为假时不绘制', () => {
    expect(resolveComposeCanvasCrosshair(input({ lines: false, box: false }))).toBeNull()
  })
})
