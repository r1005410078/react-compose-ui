import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
// `use` 改名导入：裸名会被 ESLint 的 rules-of-hooks 当成 React 的 `use` Hook。
import { init, use as registerEcharts } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

/**
 * echarts 的按需注册。
 *
 * @remarks
 * 集中在**一处**：漏注册一项的症状是一张空白图而不是报错，散在各处必然漏。清单与
 * `composeChartOption` 用到的东西一一对应——加一种图或加一个组件时两边一起改。
 *
 * 本模块是这个包里唯一 `import` echarts 的地方，因此「图表运行时不出现在公共 API 的类型里」
 * 这条边界只要看这一个文件就能核对。
 */
registerEcharts([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
])

/** 一个已挂载的图表实例；只暴露本包用得到的三件事。 @internal */
export interface ComposeChartInstance {
  setOption(option: Record<string, unknown>): void
  resize(): void
  dispose(): void
}

/** 在宿主元素上建一个图表实例。 @internal */
export function createComposeChartInstance(host: HTMLElement): ComposeChartInstance {
  const chart = init(host)
  return {
    // `notMerge` 必须为真：改 kind 之后旧 series 会被合并保留，屏幕上是柱和饼叠在一起。
    setOption: (option) => chart.setOption(option, true),
    resize: () => chart.resize(),
    dispose: () => chart.dispose(),
  }
}
