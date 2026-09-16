/**
 * 折线、柱状与饼图的第一方 Compose 物料。
 *
 * @remarks
 * 本包**不在** `@compose-ui/materials` 里：图表自带一个第三方图表运行时，放进基础物料包会让
 * 只画方块与文字的宿主也装上它。这与 `@compose-ui/dxf`、`@compose-ui/svg-import` 各自独立
 * 成包是同一条判断。
 *
 * 图表运行时**不出现在本包的公共 API 类型里**——换掉它不该是一次破坏性变更。
 *
 * @packageDocumentation
 */
import { createComposeChartMaterial } from './chart'
import type { ComposeChartMaterialOptions } from './chart'
import './chart/styles.css'

export {
  COMPOSE_CHART_KINDS,
  COMPOSE_CHART_RENDERER_TYPE,
  createComposeChartMaterial,
  type ComposeChartMaterialOptions,
} from './chart'

/**
 * 创建可直接注册进 Registry 的图表 Renderer 与 Preset。
 *
 * @example
 * ```ts
 * const registry = createComposeEntityRegistry({
 *   renderers: [...basic.renderers, chart.renderer],
 *   presets: [...basic.presets, ...chart.presets],
 * })
 * ```
 * @public
 */
export function createComposeChartMaterials(options: ComposeChartMaterialOptions = {}) {
  const { renderer, presets } = createComposeChartMaterial(options)
  return { renderers: [renderer], presets }
}
