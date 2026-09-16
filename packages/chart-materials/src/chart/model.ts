import { COMPOSE_CHART_KINDS } from './props'
import { DEFAULT_CHART_PALETTE, DEFAULT_CHART_PROPS } from './props'

/** 一条系列：名称 + 一列数值。 @internal */
export interface ComposeChartSeries {
  readonly name: string
  readonly data: readonly number[]
}

/** 从 Renderer props 读出来的、已经归一化的图表模型。 @internal */
export interface ComposeChartModel {
  readonly kind: (typeof COMPOSE_CHART_KINDS)[number]
  readonly title: string
  readonly categories: readonly string[]
  readonly series: readonly ComposeChartSeries[]
  readonly palette: readonly string[]
  readonly textColor: string
  readonly axisColor: string
  readonly showLegend: boolean
}

function strings(value: unknown, fallback: readonly string[]): readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value as readonly string[]
    : fallback
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

/**
 * 把 Renderer props 归一化成图表模型。
 *
 * @remarks
 * 绑定与手改都可能送进任何形状的值，因此每一项各自回退，**不整体拒绝**：一个类目写错不该
 * 让整张图消失。
 *
 * @internal
 */
export function resolveComposeChartModel(
  props: Readonly<Record<string, unknown>>,
): ComposeChartModel {
  const rawSeries = Array.isArray(props.series) ? props.series : DEFAULT_CHART_PROPS.series
  const series = rawSeries.flatMap((item): ComposeChartSeries[] => {
    if (item === null || typeof item !== 'object') return []
    const entry = item as Record<string, unknown>
    const data = Array.isArray(entry.data)
      ? entry.data.filter((value): value is number => typeof value === 'number')
      : []
    return [{ name: typeof entry.name === 'string' ? entry.name : '', data }]
  })
  return {
    kind: COMPOSE_CHART_KINDS.includes(props.kind as never)
      ? props.kind as ComposeChartModel['kind']
      : DEFAULT_CHART_PROPS.kind,
    title: typeof props.title === 'string' ? props.title : '',
    categories: strings(props.categories, DEFAULT_CHART_PROPS.categories),
    series: series.length > 0 ? series : DEFAULT_CHART_PROPS.series,
    palette: strings(props.palette, DEFAULT_CHART_PALETTE),
    textColor: text(props.textColor, DEFAULT_CHART_PROPS.textColor),
    axisColor: text(props.axisColor, DEFAULT_CHART_PROPS.axisColor),
    showLegend: props.showLegend === true,
  }
}

/**
 * 把模型翻译成 echarts option。
 *
 * @remarks
 * **纯函数、不认识 echarts 的类型**：图表运行时不出现在本包的公共 API 里，而这个函数也因此
 * 单测得动——判别性的那一条（三种 kind 各自产出什么 series 类型）不需要挂一块画布。
 *
 * 饼图**取第一条系列、以类目作扇区名**：让它另立一套 `{name, value}[]` 数据形状会让「把柱图
 * 改成饼图」丢掉数据，而那正是用户最常做的一次尝试。代价写在明处——饼图的多系列无处安放。
 *
 * `animation: false`：编辑器里每一次属性改动都会重画，动画会让图表一直在动。
 *
 * @internal
 */
export function composeChartOption(model: ComposeChartModel): Record<string, unknown> {
  const axisLabel = { color: model.axisColor }
  const common = {
    animation: false,
    backgroundColor: 'transparent',
    color: [...model.palette],
    title: model.title.length > 0
      ? { text: model.title, left: 12, top: 8, textStyle: { color: model.textColor, fontSize: 14 } }
      : undefined,
    legend: model.showLegend
      ? { bottom: 4, textStyle: { color: model.textColor } }
      : undefined,
    tooltip: { trigger: model.kind === 'pie' ? 'item' : 'axis' },
  }
  if (model.kind === 'pie') {
    const first = model.series[0]
    return {
      ...common,
      series: [{
        type: 'pie',
        name: first?.name ?? '',
        radius: ['52%', '72%'],
        label: { color: model.textColor },
        data: (first?.data ?? []).map((value, index) => ({
          value,
          name: model.categories[index] ?? String(index + 1),
        })),
      }],
    }
  }
  return {
    ...common,
    grid: { left: 44, right: 16, top: model.title.length > 0 ? 44 : 20, bottom: model.showLegend ? 36 : 28 },
    xAxis: { type: 'category', data: [...model.categories], axisLabel },
    yAxis: { type: 'value', axisLabel },
    series: model.series.map((entry) => ({
      type: model.kind,
      name: entry.name,
      data: [...entry.data],
    })),
  }
}
