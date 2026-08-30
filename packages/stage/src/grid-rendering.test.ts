import { describe, expect, it } from 'vitest'
import { COMPOSE_LATTICE_MIN_FULL_SPACING } from '@compose-ui/stage-engine'
import {
  createVisibleGridAxis,
  createVisualGridStyle,
} from './grid-rendering'

const GRID = {
  stepX: 8,
  stepY: 8,
  offsetX: 0,
  offsetY: 0,
  primaryLineEvery: 4,
  snapEnabled: true,
} as const

/** 5% 到 400%，跨过每一次 stride 翻倍。 */
const ZOOMS = [
  0.05, 0.07, 0.08, 0.1, 0.125, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5,
  0.6, 0.75, 0.9, 1, 1.5, 2, 3, 4,
]

/** 从 `backgroundSize` 里读出 X 轴各层的屏幕间距，由粗到细。 */
function xStepsOf(style: { backgroundSize: string }) {
  return style.backgroundSize
    .split(', ')
    .filter((size) => size.endsWith('100%'))
    .map((size) => Number.parseFloat(size))
}

/** 从 `backgroundImage` 里读出各层的墨浓度百分比，与 `xStepsOf` 同序。 */
function xAlphasOf(style: { backgroundImage: string }) {
  return style.backgroundImage
    .split('), linear-gradient')
    .filter((layer) => layer.includes('90deg'))
    .map((layer) => Number.parseFloat(/ink[^)]*\)\s([\d.]+)%/.exec(layer)?.[1] ?? '0'))
}

describe('画布网格抽稀', () => {
  it.each([
    // 判别点：抽稀之后细档间距恒落在 [4, 8)，因此**满不透明度**的线（骨架档）恒 >= 8px。
    { zoom: 4, stride: 1, worldStep: 8, screenStep: 32 },
    { zoom: 1, stride: 1, worldStep: 8, screenStep: 8 },
    { zoom: 0.75, stride: 1, worldStep: 8, screenStep: 6 },
    { zoom: 0.25, stride: 2, worldStep: 16, screenStep: 4 },
    { zoom: 0.1, stride: 8, worldStep: 64, screenStep: 6.4 },
  ])(
    '缩放 $zoom 时细档按二次幂 stride 抽稀',
    ({ zoom, stride, worldStep, screenStep }) => {
      expect(createVisibleGridAxis({
        step: 8,
        offset: 0,
        viewportOffset: 0,
        zoom,
      })).toEqual({ stride, worldStep, screenStep, screenOffset: 0 })
    },
  )

  it('平移不改变世界点阵，首线按设备像素取整', () => {
    const axis = createVisibleGridAxis({
      step: 8,
      offset: -3,
      viewportOffset: -10,
      zoom: 0.25,
    })

    // screenOffset 按设备像素取整：mod(-3 × 0.25 - 10, 4) = 1.25，dpr 1 下落到整像素 1。
    expect(axis).toEqual({ stride: 2, worldStep: 16, screenStep: 4, screenOffset: 1 })
    for (const index of [-3, -1, 0, 2, 5]) {
      const worldLine = -3 + index * axis.worldStep
      expect((worldLine - -3) / 8).toBe(index * axis.stride)
    }
  })

  it('按设备像素比取整首线位置，使网格与标尺落到同一像素', () => {
    const base = { step: 8, offset: -3, viewportOffset: -10, zoom: 0.25 }

    expect(createVisibleGridAxis({ ...base, devicePixelRatio: 2 }).screenOffset).toBe(1.5)
    expect(createVisibleGridAxis({ ...base, devicePixelRatio: 4 }).screenOffset).toBe(1.25)
  })

  it('只按二次幂抽稀为原网格子集', () => {
    const detail = createVisibleGridAxis({
      step: 8,
      offset: 5,
      viewportOffset: 17,
      zoom: 0.1,
    })

    expect(Number.isInteger(Math.log2(detail.stride))).toBe(true)
    expect(Number.isInteger(detail.worldStep / 8)).toBe(true)
    expect(detail.screenOffset).toBeGreaterThanOrEqual(0)
    expect(detail.screenOffset).toBeLessThan(detail.screenStep)
  })

  it.each(ZOOMS)('缩放 %f 时满不透明度的线之间恒不小于 8px', (zoom) => {
    const detail = createVisibleGridAxis({ step: 8, offset: 0, viewportOffset: 0, zoom })
    // 细档只在 [4, 8) 这一档里淡出，骨架档是它的两倍——这就是「满值间距 >= 8」的构造。
    const fullValueStep = detail.screenStep < COMPOSE_LATTICE_MIN_FULL_SPACING
      ? detail.screenStep * 2
      : detail.screenStep
    expect(fullValueStep).toBeGreaterThanOrEqual(COMPOSE_LATTICE_MIN_FULL_SPACING)
  })
})

describe('画布网格层级', () => {
  it.each(ZOOMS)('缩放 %f 时每个大格所含小格数恒定', (zoom) => {
    const style = createVisualGridStyle(GRID, { x: 0, y: 0, zoom })
    const [coarse, mid] = xStepsOf(style)
    // 细档间距要从点阵拿而不是从图层列表的末项拿：细档淡到 0 时那一层被丢掉，
    // 末项就变成了骨架档，比值会读成 2。
    const detail = createVisibleGridAxis({
      step: GRID.stepX,
      offset: GRID.offsetX,
      viewportOffset: 0,
      zoom,
    }).screenStep

    // 判别点必须扫一遍缩放：主网格此前是第二次独立抽稀，两条 stride 各走各的，比例会漂到
    // 4 格、2 格，5% 时主线与细线完全重合——单点断言正好错过漂移。
    expect(mid! / detail).toBeCloseTo(GRID.primaryLineEvery, 6)
    expect(coarse! / detail).toBeCloseTo(GRID.primaryLineEvery ** 2, 6)
  })

  it.each(ZOOMS)('缩放 %f 时两级主网格都以满不透明度绘制', (zoom) => {
    const style = createVisualGridStyle(GRID, { x: 0, y: 0, zoom })
    const alphas = xAlphasOf(style)
    // 主网格间距恒为细档的 4 与 16 倍，而细档恒在 4–8px，因此永远不会过密、永远不需要淡入。
    // 一条淡了一半的主线既不是主线也不是细线。
    expect(alphas[0]).toBeCloseTo(13.157_894, 3)
    expect(alphas[1]).toBeCloseTo(11.627_906, 3)
  })

  it.each(ZOOMS)('缩放 %f 时骨架线的合成不透明度恒定', (zoom) => {
    const style = createVisualGridStyle(GRID, { x: 0, y: 0, zoom })
    const alphas = xAlphasOf(style)
    const detail = alphas[alphas.length - 1]! / 100
    const skeleton = (alphas.length === 4 ? alphas[2]! : 0) / 100

    // 这是唯一能挡住「每隔一根线深一档」的断言：骨架档补足的量必须让它那批线的合成值恒等于
    // 细档满值，缩放连续变化时全程不变。
    expect(detail + skeleton * (1 - detail)).toBeCloseTo(0.14, 6)
  })

  it('放大时细档满值且骨架档不画', () => {
    for (const zoom of [1, 1.5, 2, 4]) {
      const style = createVisualGridStyle(GRID, { x: 0, y: 0, zoom })
      // 边界条件：这次改的是缩小的那一段。骨架档不画，因此 X/Y 各只剩三层。
      expect(xStepsOf(style)).toHaveLength(3)
      expect(xAlphasOf(style)[2]).toBeCloseTo(14, 6)
    }
  })

  it('X 与 Y 各自独立，粗格写在最上层', () => {
    const style = createVisualGridStyle({ ...GRID, stepY: 10 }, { x: 0, y: 0, zoom: 0.25 })

    // stepX 8 在 0.25 下抽到 stride 2（世界 16、屏幕 4），间距正好落在淡入起点上，细档因此
    // 淡到 0 而被丢掉，X 只剩三层；stepY 10 抽到 stride 2（世界 20、屏幕 5），细档还在。
    expect(style.backgroundSize).toBe(
      '64px 100%, 16px 100%, 100% 80px, 100% 20px, 8px 100%, 100% 10px, 100% 5px',
    )
  })
})

describe('画布网格线宽与色阶', () => {
  it.each([1, 2, 3])('设备像素比为 %i 时线宽恒为一个设备像素', (dpr) => {
    const style = createVisualGridStyle(GRID, { x: 0, y: 0, zoom: 1 }, dpr)
    const band = Number.parseFloat(/\s([\d.]+)px, transparent/.exec(style.backgroundImage)?.[1] ?? '0')

    // `1px` 在 2× 屏上是两个物理像素、3× 屏上是三个——屏幕越好线越粗。
    // CSS 数值保留六位小数，1/3 因此是 0.333333——用五位比较，别把取整误差断成缺陷。
    expect(band * dpr).toBeCloseTo(1, 5)
  })

  it.each([1, 2])('设备像素比为 %i 时墨量不变', (dpr) => {
    const style = createVisualGridStyle(GRID, { x: 0, y: 0, zoom: 1 }, dpr)
    const alphas = xAlphasOf(style)

    // 墨量 = 浓度 × 宽度。宽度除以 dpr，浓度就要乘回 dpr，否则「变细」会被读成「变淡」。
    expect((alphas[alphas.length - 1]! / 100) / dpr).toBeCloseTo(0.14, 6)
  })

  it('层级只由一支墨的不透明度表达', () => {
    const style = createVisualGridStyle(GRID, { x: 0, y: 0, zoom: 1 })

    // 此前是四组互不相干的 hex+alpha，量下来深色的主线比细线强 1.53 倍、浅色只有 1.30 倍。
    expect(style.backgroundImage).not.toContain('--compose-stage-grid-minor')
    expect(style.backgroundImage).not.toContain('--compose-stage-grid-primary')
    expect(style.backgroundImage.split('--compose-stage-grid-ink')).toHaveLength(7)
  })
})
