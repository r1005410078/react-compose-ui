import type { ComposeCanvasSettings } from '@compose-ui/core'
import type { StageViewport } from '@compose-ui/stage-engine'

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

function positiveModulo(value: number, modulus: number) {
  const remainder = value % modulus
  return remainder < 0 ? remainder + modulus : remainder
}

export function createVisibleGridAxis(options: {
  readonly step: number
  readonly offset: number
  readonly viewportOffset: number
  readonly zoom: number
}): VisibleGridAxis {
  const { step, offset, viewportOffset, zoom } = options
  if (
    !Number.isFinite(step)
    || step <= 0
    || !Number.isFinite(offset)
    || !Number.isFinite(viewportOffset)
    || !Number.isFinite(zoom)
    || zoom <= 0
  ) {
    throw new RangeError('Grid rendering requires finite coordinates and positive step/zoom')
  }

  let stride = 1
  // 1px 网格线至少保留 1px 空隙才不会退化为整片填色；二次幂 stride
  // 让抽稀后的线始终落在原网格上，并减少连续缩放时的格点跳变。
  while (step * zoom * stride < MIN_VISIBLE_GRID_SPACING) stride *= 2
  const worldStep = step * stride
  const screenStep = worldStep * zoom
  const screenOffset = positiveModulo(
    offset * zoom + viewportOffset,
    screenStep,
  )
  return {
    stride,
    worldStep,
    screenStep,
    screenOffset,
  }
}

export function createVisualGridStyle(
  grid: ComposeCanvasSettings['grid'],
  viewport: StageViewport,
): VisualGridStyle {
  const primaryX = createVisibleGridAxis({
    step: grid.stepX * grid.primaryLineEvery,
    offset: grid.offsetX,
    viewportOffset: viewport.x,
    zoom: viewport.zoom,
  })
  const primaryY = createVisibleGridAxis({
    step: grid.stepY * grid.primaryLineEvery,
    offset: grid.offsetY,
    viewportOffset: viewport.y,
    zoom: viewport.zoom,
  })
  const minorX = createVisibleGridAxis({
    step: grid.stepX,
    offset: grid.offsetX,
    viewportOffset: viewport.x,
    zoom: viewport.zoom,
  })
  const minorY = createVisibleGridAxis({
    step: grid.stepY,
    offset: grid.offsetY,
    viewportOffset: viewport.y,
    zoom: viewport.zoom,
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
