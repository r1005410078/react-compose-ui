import { createAxisLattice, type ComposeCanvasViewport } from '@compose-ui/core'
import type { CSSProperties } from 'react'

/**
 * 1px 网格线至少保留 1px 空隙才不会退化为整片填色。
 *
 * @remarks
 * 这是**抽稀阈值**而不是显示下限：间距不够时按二次幂 stride 换到更稀的一级，而不是把网格
 * 整片藏掉。缩小正是画总图最常用的区间，此时失去网格等于失去全部空间参照。
 */
const MIN_VISIBLE_GRID_SPACING = 2

/** CAD 网格的显示设置；是会话级视图状态，不写进 `CadDocument`。 */
export interface CadGridSettings {
  /** 世界单位的格距。 */
  readonly step: number
  /** 每多少格画一条主线。 */
  readonly primaryLineEvery: number
}

/** CAD 网格默认设置：每 5 格一条主线，与常见图纸一致。 @public */
export const CAD_GRID: CadGridSettings = { step: 10, primaryLineEvery: 5 }

function finiteCssNumber(value: number) {
  const normalized = Object.is(value, -0) ? 0 : value
  return String(Math.round(normalized * 1_000_000) / 1_000_000)
}

/**
 * 求 CAD 图面网格的背景样式。
 *
 * @remarks
 * 与页面画布同一条路子：CSS 多层 gradient 而不是每条线一个 SVG 节点。除了零 DOM 开销，更重要
 * 的是**两个画布共用同一个点阵与同一套设备像素取整规则**，因此同一世界坐标在两处落到同一
 * 像素；标尺刻度也出自这个点阵，所以刻度必然落在格线上。
 *
 * CAD 两轴同步长、无偏移：图纸没有画布设置，格距是会话状态。
 *
 * @param step - 世界单位的格距；`null` 表示不画网格。
 * @public
 */
export function createCadGridStyle(
  step: number | null,
  grid: Pick<CadGridSettings, 'primaryLineEvery'>,
  viewport: ComposeCanvasViewport,
  devicePixelRatio = 1,
): CSSProperties {
  if (step === null || !(step > 0)) return {}
  const axis = (worldStep: number, viewportOffset: number) => createAxisLattice({
    step: worldStep,
    offset: 0,
    viewportOffset,
    zoom: viewport.zoom,
    minScreenSpacing: MIN_VISIBLE_GRID_SPACING,
    devicePixelRatio,
  })
  const primaryStep = step * grid.primaryLineEvery
  const primaryX = axis(primaryStep, viewport.offset.x)
  const primaryY = axis(primaryStep, viewport.offset.y)
  const minorX = axis(step, viewport.offset.x)
  const minorY = axis(step, viewport.offset.y)
  const primaryColor = 'var(--compose-cad-grid-primary, rgb(151 166 185 / 34%))'
  const minorColor = 'var(--compose-cad-grid-minor, rgb(120 137 158 / 18%))'

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
