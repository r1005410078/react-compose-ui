import { describe, expect, it } from 'vitest'
import { createAxisLattice, latticeLineBand, latticeLinePosition } from './axis-lattice'

/*
 * 标尺与画布网格必须由同一点阵产出。这些测试锁定「构造性对齐」：只要两侧用同一个
 * lattice 与同一个落点函数，就不可能出现旧实现里恒定 0.5px 的错位。
 */
describe('OpenSpec: stage / 自适应网格标尺与世界原点 / 刻度线与网格线落在同一像素列', () => {
  const base = { step: 8, offset: 0, viewportOffset: 304, zoom: 1, devicePixelRatio: 1 }

  it('标尺点阵是网格点阵的子集', () => {
    for (const zoom of [1, 0.75, 0.5, 0.25, 0.125, 1.1, 2.3]) {
      const grid = createAxisLattice({ ...base, zoom, minScreenSpacing: 2 })
      const ruler = createAxisLattice({ ...base, zoom, minScreenSpacing: 8 })
      // 两侧 stride 均为二次幂且共用 step/offset，标尺的世界刻度必然落在网格刻度上。
      expect(ruler.worldStep % grid.worldStep).toBe(0)
      expect(ruler.screenOffset).toBeCloseTo(grid.screenOffset, 9)
    }
  })

  it('同一世界坐标在两侧得到相同落点', () => {
    const grid = createAxisLattice({ ...base, minScreenSpacing: 2 })
    const ruler = createAxisLattice({ ...base, minScreenSpacing: 8 })
    const world = 64
    expect(latticeLinePosition(ruler, world)).toBeCloseTo(latticeLinePosition(grid, world), 9)
  })

  it('落点以世界坐标为左边界覆盖一个 CSS 像素', () => {
    const lattice = createAxisLattice({ ...base, minScreenSpacing: 2 })
    const band = latticeLineBand(lattice, 0)
    // 旧实现的 SVG stroke 以坐标为中心覆盖 [pos-0.5, pos+0.5)，与 CSS gradient 差半像素。
    expect(band.width).toBe(1)
    expect(band.start).toBe(latticeLinePosition(lattice, 0))
  })

  it('设备像素比放大时保持整像素宽度', () => {
    const lattice = createAxisLattice({ ...base, minScreenSpacing: 2, devicePixelRatio: 2 })
    const band = latticeLineBand(lattice, 0)
    expect(band.width).toBe(1)
    expect(Number.isInteger(band.start * 2)).toBe(true)
  })

  it('缩放过密时按二次幂 stride 抽稀', () => {
    const dense = createAxisLattice({ ...base, zoom: 0.1, minScreenSpacing: 2 })
    expect(dense.stride).toBe(4)
    expect(dense.worldStep).toBe(32)
  })
})
