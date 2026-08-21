import { describe, expect, it } from 'vitest'
import { fitViewportTo, zoomViewportByIntent } from './stage-viewport-actions'

const SURFACE = { width: 800, height: 600 }
const VIEWPORT = { x: 0, y: 0, zoom: 1 }

describe('OpenSpec: stage / 视口适配与缩放只有一份实现', () => {
  it('适配后目标居中且按较紧的一轴等比缩放', () => {
    // 宽向比例 800/400 = 2，高向 600/400 = 1.5，取较小者再乘 0.85 余量。
    const result = fitViewportTo({ x: 100, y: 100, width: 400, height: 400 }, SURFACE)

    expect(result).not.toBeNull()
    expect(result!.zoom).toBeCloseTo(1.275, 6)
    const scaled = 400 * result!.zoom
    expect(result!.x).toBeCloseTo((800 - scaled) / 2 - 100 * result!.zoom, 6)
    expect(result!.y).toBeCloseTo((600 - scaled) / 2 - 100 * result!.zoom, 6)
  })

  it('极小目标不会放大到超过上限', () => {
    const result = fitViewportTo({ x: 0, y: 0, width: 1, height: 1 }, SURFACE)
    expect(result!.zoom).toBe(8)
  })

  it('极大目标不会缩小到低于下限', () => {
    const result = fitViewportTo({ x: 0, y: 0, width: 100_000, height: 100_000 }, SURFACE)
    expect(result!.zoom).toBe(0.1)
  })

  it('空目标与非正尺寸不改变视口', () => {
    expect(fitViewportTo(null, SURFACE)).toBeNull()
    expect(fitViewportTo({ x: 0, y: 0, width: 0, height: 10 }, SURFACE)).toBeNull()
    expect(fitViewportTo({ x: 0, y: 0, width: 10, height: -5 }, SURFACE)).toBeNull()
  })

  it('放大与缩小互为逆运算，重置回到 100%', () => {
    const zoomedIn = zoomViewportByIntent(VIEWPORT, SURFACE, 'in')
    expect(zoomedIn.zoom).toBeCloseTo(1.2, 6)

    const roundTrip = zoomViewportByIntent(zoomedIn, SURFACE, 'out')
    expect(roundTrip.zoom).toBeCloseTo(1, 6)

    expect(zoomViewportByIntent(zoomedIn, SURFACE, 'reset').zoom).toBe(1)
  })

  it('缩放锚定 surface 中心，中心点的世界坐标保持不变', () => {
    const before = { x: 40, y: -30, zoom: 1.5 }
    const after = zoomViewportByIntent(before, SURFACE, 'in')
    const worldAt = (viewport: typeof before) => ({
      x: (SURFACE.width / 2 - viewport.x) / viewport.zoom,
      y: (SURFACE.height / 2 - viewport.y) / viewport.zoom,
    })

    expect(worldAt(after).x).toBeCloseTo(worldAt(before).x, 6)
    expect(worldAt(after).y).toBeCloseTo(worldAt(before).y, 6)
  })
})
