import { describe, expect, it } from 'vitest'
import { composeChartOption, resolveComposeChartModel } from './model'
import { DEFAULT_CHART_PROPS } from './props'

const filled = {
  ...DEFAULT_CHART_PROPS,
  categories: ['甲', '乙', '丙'],
  series: [{ name: '功率', data: [1, 2, 3] }, { name: '电量', data: [4, 5, 6] }],
}

function seriesOf(option: Record<string, unknown>) {
  return option.series as { type: string; name: string; data: unknown[] }[]
}

describe('OpenSpec: basic-materials / 第一方图表物料', () => {
  it('三种 kind 产出对应的系列类型', () => {
    for (const kind of ['line', 'bar'] as const) {
      const option = composeChartOption(resolveComposeChartModel({ ...filled, kind }))
      expect(seriesOf(option).map((entry) => entry.type), kind).toEqual([kind, kind])
    }
    const pie = composeChartOption(resolveComposeChartModel({ ...filled, kind: 'pie' }))
    expect(seriesOf(pie).map((entry) => entry.type)).toEqual(['pie'])
  })

  it('饼图取第一条系列，类目作扇区名', () => {
    /*
     * 判别性的那一半：让饼图另立一套 `{name, value}[]` 数据形状会让「把柱图改成饼图」丢掉
     * 数据，而那正是用户最常做的一次尝试。代价写在明处——多系列在饼图上无处安放，只读第一条。
     */
    const option = composeChartOption(resolveComposeChartModel({ ...filled, kind: 'pie' }))
    expect(seriesOf(option)[0]).toMatchObject({
      name: '功率',
      data: [
        { name: '甲', value: 1 },
        { name: '乙', value: 2 },
        { name: '丙', value: 3 },
      ],
    })
  })

  it('改 kind 不丢类目与系列', () => {
    const asBar = resolveComposeChartModel({ ...filled, kind: 'bar' })
    const asPie = resolveComposeChartModel({ ...filled, kind: 'pie' })
    expect(asPie.categories).toEqual(asBar.categories)
    expect(asPie.series).toEqual(asBar.series)
  })

  it('饼图不画坐标轴，折线柱状画', () => {
    // 只断 series 类型时，「饼图也带一对坐标轴」同样绿——而那会在图上画出两条没有意义的轴。
    expect(composeChartOption(resolveComposeChartModel({ ...filled, kind: 'pie' })).xAxis)
      .toBeUndefined()
    expect(composeChartOption(resolveComposeChartModel({ ...filled, kind: 'line' })).xAxis)
      .toBeDefined()
  })

  it('单项写坏只回退那一项，不整张图消失', () => {
    // 绑定与手改都可能送进任何形状的值；一个类目写错不该让整张图不见。
    const model = resolveComposeChartModel({
      ...filled,
      categories: 'not-an-array',
      textColor: 42,
    })
    expect(model.categories).toEqual(DEFAULT_CHART_PROPS.categories)
    expect(model.textColor).toBe(DEFAULT_CHART_PROPS.textColor)
    expect(model.series).toEqual(filled.series)
  })

  it('编辑器里不放动画', () => {
    // 每一次属性改动都会重画，动画会让图表一直在动。
    expect(composeChartOption(resolveComposeChartModel(filled)).animation).toBe(false)
  })
})
