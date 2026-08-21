import { describe, expect, it } from 'vitest'
import {
  CAD_INITIAL_VIEWPORT,
  CAD_ZOOM_RANGE,
  cadPanViewport,
  cadScreenToWorld,
  cadWorldToScreen,
  cadZoomViewport,
} from './cad-viewport'

describe('CAD 视口换算', () => {
  it('世界与屏幕互为逆变换', () => {
    const viewport = { offset: { x: 120, y: -40 }, zoom: 2.5 }
    const world = { x: 37, y: -11 }
    expect(cadScreenToWorld(viewport, cadWorldToScreen(viewport, world))).toEqual(world)
  })

  it('平移只改变屏幕位置，不改变缩放', () => {
    const panned = cadPanViewport(CAD_INITIAL_VIEWPORT, { x: 30, y: -20 })
    expect(panned.zoom).toBe(1)
    expect(cadWorldToScreen(panned, { x: 0, y: 0 })).toEqual({ x: 30, y: -20 })
  })

  it('绕锚点缩放时锚点的屏幕位置不动', () => {
    const anchor = { x: 300, y: 200 }
    const zoomed = cadZoomViewport(CAD_INITIAL_VIEWPORT, 2, anchor)
    const world = cadScreenToWorld(CAD_INITIAL_VIEWPORT, anchor)
    expect(cadWorldToScreen(zoomed, world).x).toBeCloseTo(anchor.x, 10)
    expect(cadWorldToScreen(zoomed, world).y).toBeCloseTo(anchor.y, 10)
  })

  it('缩放被钳制后锚点仍然精确不动', () => {
    const anchor = { x: 128, y: 64 }
    // 倍率远超上限，zoom 会被钳到 max；offset 必须按钳制后的值反算。
    const zoomed = cadZoomViewport(CAD_INITIAL_VIEWPORT, 1e6, anchor)
    expect(zoomed.zoom).toBe(CAD_ZOOM_RANGE.max)
    const world = cadScreenToWorld(CAD_INITIAL_VIEWPORT, anchor)
    expect(cadWorldToScreen(zoomed, world).x).toBeCloseTo(anchor.x, 10)

    const tiny = cadZoomViewport(CAD_INITIAL_VIEWPORT, 1e-6, anchor)
    expect(tiny.zoom).toBe(CAD_ZOOM_RANGE.min)
    expect(cadWorldToScreen(tiny, world).y).toBeCloseTo(anchor.y, 10)
  })
})
