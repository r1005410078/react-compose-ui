import { describe, expect, it } from 'vitest'
import { createAxisLattice, createRulerTicks, latticeLinePosition } from '@compose-ui/core'
import { CAD_GRID, createCadGridStyle } from './cad-grid-style'

/** 从 `backgroundSize` 里取出四层的屏幕间距。 */
function spacings(style: ReturnType<typeof createCadGridStyle>) {
  return String(style.backgroundSize ?? '')
    .split(', ')
    .map((layer) => Number.parseFloat(layer))
}

describe('CAD 画布网格', () => {
  /**
   * @remarks
   * 旧实现在投影间距不足 8px 时直接返回空数组，网格整片消失——而缩小正是画总图最常用的区间，
   * 此时失去网格等于失去全部空间参照。
   */
  it('OpenSpec: cad-document / CAD 画布网格与标尺 / 缩小后抽稀为二次幂子集而不是消失', () => {
    const viewport = { offset: { x: 0, y: 0 }, zoom: 0.05 }
    const style = createCadGridStyle(CAD_GRID.step, CAD_GRID, viewport)

    expect(style.backgroundImage).toBeDefined()
    const [, , minorX] = spacings(style)
    // 10 世界单位 × 0.05 = 0.5px，远低于阈值；抽稀后必须回到可见间距。
    expect(minorX).toBeGreaterThanOrEqual(2)

    // stride 恒为二次幂，因此抽稀后的世界步长是原步长的整数倍，吸附刻度不受影响。
    const lattice = createAxisLattice({
      step: CAD_GRID.step, offset: 0, viewportOffset: 0, zoom: 0.05, minScreenSpacing: 2,
    })
    expect(Number.isInteger(Math.log2(lattice.stride))).toBe(true)
    expect(lattice.worldStep % CAD_GRID.step).toBe(0)
  })

  it('OpenSpec: cad-document / CAD 画布网格与标尺 / 不画网格时不产生背景', () => {
    expect(createCadGridStyle(null, CAD_GRID, { offset: { x: 0, y: 0 }, zoom: 1 })).toEqual({})
  })

  /**
   * @remarks
   * 标尺与网格出自同一点阵，因此刻度必然落在格线上。两者一旦分头取整，同一世界坐标就会在
   * 标尺与图面上差半个像素，而这种偏差只在特定缩放下出现，极难复现。
   */
  it.each([1, 2, 3])('OpenSpec: cad-document / CAD 画布网格与标尺 / 刻度与格线落在同一像素带（DPR %i）', (dpr) => {
    const viewport = { offset: { x: 37.5, y: -12.25 }, zoom: 1.375 }
    const lattice = createAxisLattice({
      step: CAD_GRID.step,
      offset: 0,
      viewportOffset: viewport.offset.x,
      zoom: viewport.zoom,
      minScreenSpacing: 2,
      devicePixelRatio: dpr,
    })
    const ticks = createRulerTicks({
      viewportOffset: viewport.offset.x,
      zoom: viewport.zoom,
      length: 800,
      step: CAD_GRID.step,
      offset: 0,
      primaryLineEvery: CAD_GRID.primaryLineEvery,
      devicePixelRatio: dpr,
    })
    for (const tick of ticks) {
      expect(tick.screen).toBeCloseTo(latticeLinePosition(lattice, tick.value), 6)
    }
  })
})
