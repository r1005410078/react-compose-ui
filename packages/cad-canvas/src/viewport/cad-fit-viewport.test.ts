import { describe, expect, it } from 'vitest'
import { CAD_INITIAL_VIEWPORT, CAD_ZOOM_RANGE, cadFitViewport } from './cad-viewport'

const SIZE = { width: 1000, height: 500 }

describe('OpenSpec: cad-document / CAD 画布打开时按内容取景', () => {
  it('远离原点的内容被移到图面中心', () => {
    const viewport = cadFitViewport(
      { minX: 5000, minY: 5000, maxX: 5400, maxY: 5200 },
      SIZE,
      CAD_INITIAL_VIEWPORT,
    )!
    // 内容中心 (5200,5100) 应当落在图面中心。
    expect(5200 * viewport.zoom + viewport.offset.x).toBeCloseTo(SIZE.width / 2)
    expect(5100 * viewport.zoom + viewport.offset.y).toBeCloseTo(SIZE.height / 2)
  })

  it('缩放取两轴中较小的那个，因此内容整体可见', () => {
    // 400×200 的内容放进 1000×500，纵向更紧：500*0.84/200 = 2.1 < 1000*0.84/400 = 2.1。
    const wide = cadFitViewport({ minX: 0, minY: 0, maxX: 800, maxY: 100 }, SIZE, CAD_INITIAL_VIEWPORT)!
    expect(800 * wide.zoom).toBeLessThanOrEqual(SIZE.width)
    expect(100 * wide.zoom).toBeLessThanOrEqual(SIZE.height)

    const tall = cadFitViewport({ minX: 0, minY: 0, maxX: 100, maxY: 800 }, SIZE, CAD_INITIAL_VIEWPORT)!
    expect(100 * tall.zoom).toBeLessThanOrEqual(SIZE.width)
    expect(800 * tall.zoom).toBeLessThanOrEqual(SIZE.height)
  })

  it('跨度为零时保持当前缩放，只居中', () => {
    // 按跨度算缩放会得到无穷大。
    const viewport = cadFitViewport({ minX: 7, minY: 7, maxX: 7, maxY: 7 }, SIZE, { offset: { x: 0, y: 0 }, zoom: 3 })!
    expect(viewport.zoom).toBe(3)
    expect(7 * 3 + viewport.offset.x).toBeCloseTo(SIZE.width / 2)
  })

  it('缩放被钳制在可读区间内', () => {
    const tiny = cadFitViewport({ minX: 0, minY: 0, maxX: 1e-6, maxY: 1e-6 }, SIZE, CAD_INITIAL_VIEWPORT)!
    expect(tiny.zoom).toBeLessThanOrEqual(CAD_ZOOM_RANGE.max)
    const huge = cadFitViewport({ minX: 0, minY: 0, maxX: 1e9, maxY: 1e9 }, SIZE, CAD_INITIAL_VIEWPORT)!
    expect(huge.zoom).toBeGreaterThanOrEqual(CAD_ZOOM_RANGE.min)
  })

  it('图面还没量到时返回 null', () => {
    // 兜底尺寸下取景会把内容摆到图面之外，症状与「根本没取景」一模一样。
    expect(cadFitViewport({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, { width: 0, height: 0 }, CAD_INITIAL_VIEWPORT))
      .toBeNull()
  })
})
