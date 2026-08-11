import type { ComposeCanvasSettings } from '@compose-ui/core'
import { createAxisLattice, type StageViewport } from '@compose-ui/stage-engine'

/** 1px 网格线至少保留 1px 空隙才不会退化为整片填色。 */
const MIN_VISIBLE_GRID_SPACING = 2

interface VisualGridStyle {
  readonly backgroundImage: string
  readonly backgroundSize: string
  readonly backgroundPosition: string
}

interface VisibleGridAxis {
  readonly stride: number
  readonly worldStep: number
  readonly screenStep: number
  readonly screenOffset: number
}

function finiteCssNumber(value: number) {
  const normalized = Object.is(value, -0) ? 0 : value
  return String(Math.round(normalized * 1_000_000) / 1_000_000)
}

/**
 * 计算一条网格轴的可见点阵。
 *
 * @remarks
 * 委托给 stage-engine 的共享 lattice：标尺与网格必须由同一点阵和同一取整规则产出，
 * 否则同一世界坐标会落到不同像素。
 */
export function createVisibleGridAxis(options: {
  readonly step: number
  readonly offset: number
  readonly viewportOffset: number
  readonly zoom: number
  readonly devicePixelRatio?: number
}): VisibleGridAxis {
  const lattice = createAxisLattice({
    ...options,
    minScreenSpacing: MIN_VISIBLE_GRID_SPACING,
  })
  return {
    stride: lattice.stride,
    worldStep: lattice.worldStep,
    screenStep: lattice.screenStep,
    screenOffset: lattice.screenOffset,
  }
}

export function createVisualGridStyle(
  grid: ComposeCanvasSettings['grid'],
  viewport: StageViewport,
  devicePixelRatio = 1,
): VisualGridStyle {
  const primaryX = createVisibleGridAxis({
    step: grid.stepX * grid.primaryLineEvery,
    offset: grid.offsetX,
    viewportOffset: viewport.x,
    zoom: viewport.zoom,
    devicePixelRatio,
  })
  const primaryY = createVisibleGridAxis({
    step: grid.stepY * grid.primaryLineEvery,
    offset: grid.offsetY,
    viewportOffset: viewport.y,
    zoom: viewport.zoom,
    devicePixelRatio,
  })
  const minorX = createVisibleGridAxis({
    step: grid.stepX,
    offset: grid.offsetX,
    viewportOffset: viewport.x,
    zoom: viewport.zoom,
    devicePixelRatio,
  })
  const minorY = createVisibleGridAxis({
    step: grid.stepY,
    offset: grid.offsetY,
    viewportOffset: viewport.y,
    zoom: viewport.zoom,
    devicePixelRatio,
  })
  const primaryColor = 'var(--compose-stage-grid-primary, rgb(151 166 185 / 34%))'
  const minorColor = 'var(--compose-stage-grid-minor, rgb(120 137 158 / 18%))'

  // CSS 多背景的首层位于最上方，因此主线必须先于细线写入。
  return {
    backgroundImage: [
      `linear-gradient(90deg, ${primaryColor} 1px, transparent 1px)`,
      `linear-gradient(${primaryColor} 1px, transparent 1px)`,
      `linear-gradient(90deg, ${minorColor} 1px, transparent 1px)`,
      `linear-gradient(${minorColor} 1px, transparent 1px)`,
    ].join(', '),
    backgroundSize: [
      `${finiteCssNumber(primaryX.screenStep)}px 100%`,
      `100% ${finiteCssNumber(primaryY.screenStep)}px`,
      `${finiteCssNumber(minorX.screenStep)}px 100%`,
      `100% ${finiteCssNumber(minorY.screenStep)}px`,
    ].join(', '),
    backgroundPosition: [
      `${finiteCssNumber(primaryX.screenOffset)}px 0`,
      `0 ${finiteCssNumber(primaryY.screenOffset)}px`,
      `${finiteCssNumber(minorX.screenOffset)}px 0`,
      `0 ${finiteCssNumber(minorY.screenOffset)}px`,
    ].join(', '),
  }
}
