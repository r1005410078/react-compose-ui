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

function halos() {
  return document.querySelectorAll('[data-probe-crosshair-halo]')
}

function endpoints(list: NodeListOf<Element>) {
  return Array.from(list, (line) =>
    ['x1', 'y1', 'x2', 'y2'].map((name) => line.getAttribute(name)).join(','))
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

describe('OpenSpec: canvas-kit / 十字光标样式', () => {
  it('缺席即渐隐', () => {
    draw({ box: false })
    expect(resolveComposeCanvasCrosshair(input())?.style).toBe('fade')
    expect(lines()).toHaveLength(4)
    expect(halos()).toHaveLength(0)
    // 每条臂各自一份用户空间渐变，描边指向它。
    const gradients = document.querySelectorAll('linearGradient')
    expect(gradients).toHaveLength(4)
    gradients.forEach((gradient) => {
      expect(gradient.getAttribute('gradientUnits')).toBe('userSpaceOnUse')
    })
    lines().forEach((line) => {
      expect((line as SVGLineElement).style.stroke).toMatch(/^url\(/)
    })
    // 远端仍可见：最后一个色标的不透明度不为 0。
    const stops = Array.from(gradients[0]!.querySelectorAll('stop'))
    expect(Number(stops[stops.length - 1]?.getAttribute('stop-opacity'))).toBeGreaterThan(0)
  })

  /*
   * 这条钉的是**渐隐在图面内真的看得见**，而不是某一组具体的数。
   *
   * 判据来自几何：`reach` 是图面短边乘臂长百分比，而臂从光标最远只走到图面边缘，因此臂长
   * 取 100 时竖直臂的可见部分最多到 offset 0.5。衰减若排在那之后，就整个发生在图面之外——
   * 上一版把满不透明段设成 55% 正是这个错，绘图工作区里渐隐与晕圈逐像素难分。
   */
  it('衰减落在图面可见的那半段里，且落点附近不让步', () => {
    draw({ box: false })
    const stops = Array.from(document.querySelectorAll('linearGradient')[0]!.querySelectorAll('stop'))
      .map((stop) => ({
        offset: Number(stop.getAttribute('offset')),
        opacity: Number(stop.getAttribute('stop-opacity')),
      }))
    const opacityAt = (offset: number) => {
      const upper = stops.findIndex((stop) => stop.offset >= offset)
      const before = stops[upper - 1]
      const after = stops[upper]!
      if (!before) return after.opacity
      const t = (offset - before.offset) / (after.offset - before.offset)
      return before.opacity + (after.opacity - before.opacity) * t
    }
    // 落点附近仍是实线：可读性不让步。
    expect(opacityAt(0.1)).toBe(1)
    // 竖直臂在图面内最远只到 0.5，那里必须已经明显淡下去，否则渐隐发生在图面之外。
    expect(opacityAt(0.5)).toBeLessThanOrEqual(0.5)
    // 末端淡出，但不到 0。
    const last = stops[stops.length - 1]!
    expect(last.offset).toBe(1)
    expect(last.opacity).toBeLessThan(0.2)
    expect(last.opacity).toBeGreaterThan(0)
  })

  it('晕圈在主线之下', () => {
    draw({ style: 'halo' })
    expect(lines()).toHaveLength(4)
    expect(halos()).toHaveLength(4)
    // 晕圈线在文档序上先于每一条十字线：后画的压在先画的上面。
    const all = Array.from(document.querySelectorAll('line'))
    const haloIndexes = all.flatMap((line, index) =>
      line.hasAttribute('data-probe-crosshair-halo') ? [index] : [])
    const firstLine = all.findIndex((line) => line.hasAttribute('data-probe-crosshair-line'))
    expect(Math.max(...haloIndexes)).toBeLessThan(firstLine)
    // 拾取框同样带晕圈；十字线不再用渐变。
    expect(document.querySelectorAll('rect.compose-canvas__crosshair-halo')).toHaveLength(1)
    expect(document.querySelectorAll('linearGradient')).toHaveLength(0)
  })

  it('样式不改几何', () => {
    draw({ style: 'fade' })
    const fade = endpoints(lines())
    cleanup()
    draw({ style: 'halo' })
    expect(endpoints(lines())).toEqual(fade)
    expect(endpoints(halos())).toEqual(fade)
  })
})
