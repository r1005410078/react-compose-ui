import { describe, expect, it } from 'vitest'
import { fitViewportToRect } from './viewport-fit'

const SURFACE = { width: 1000, height: 800 }

describe('fitViewportToRect', () => {
  it('把目标矩形居中并留出四周空白', () => {
    const viewport = fitViewportToRect({ x: 0, y: 0, width: 1000, height: 800 }, SURFACE)!
    expect(viewport.zoom).toBeCloseTo(0.85)
    // 居中：矩形中心落在可视区域中心。
    expect(viewport.x + 500 * viewport.zoom).toBeCloseTo(500)
    expect(viewport.y + 400 * viewport.zoom).toBeCloseTo(400)
  })

  it('按更紧的一轴决定缩放', () => {
    // 宽高比不同的目标必须整体可见，因此取两轴比例的较小者。
    const viewport = fitViewportToRect({ x: 0, y: 0, width: 2000, height: 400 }, SURFACE)!
    expect(viewport.zoom).toBeCloseTo(0.425)
  })

  it('把非原点矩形平移到可视区域中心', () => {
    const viewport = fitViewportToRect({ x: 400, y: 300, width: 200, height: 100 }, SURFACE)!
    expect(viewport.x + 500 * viewport.zoom).toBeCloseTo(500)
    expect(viewport.y + 350 * viewport.zoom).toBeCloseTo(400)
  })

  it('缩放钳制在 Stage 的上下限内', () => {
    expect(fitViewportToRect({ x: 0, y: 0, width: 10, height: 10 }, SURFACE)!.zoom).toBe(8)
    expect(fitViewportToRect({ x: 0, y: 0, width: 1e6, height: 1e6 }, SURFACE)!.zoom).toBe(0.1)
  })

  it('目标或可视区域无效时不产生视口', () => {
    expect(fitViewportToRect(null, SURFACE)).toBeNull()
    expect(fitViewportToRect({ x: 0, y: 0, width: 0, height: 100 }, SURFACE)).toBeNull()
    expect(fitViewportToRect({ x: 0, y: 0, width: 100, height: -1 }, SURFACE)).toBeNull()
    expect(fitViewportToRect({ x: 0, y: 0, width: 100, height: 100 }, { width: 0, height: 0 }))
      .toBeNull()
  })
})
