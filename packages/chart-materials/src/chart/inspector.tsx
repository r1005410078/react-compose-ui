import { useMemo } from 'react'
import * as v from 'valibot'
import { BUILTIN_COMMAND_TYPES, type JsonObject, type JsonValue } from '@compose-ui/core'
import type { ComposeRendererInspectorProps } from '@compose-ui/component-registry'
import {
  ComposePropertyPanel,
  type ComposePropertyPanelBindingConfig,
} from '@compose-ui/property-panel'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import { CHART_RENDERER_PROP_SCHEMAS, DEFAULT_CHART_PROPS } from './props'
import { resolveComposeChartModel } from './model'

function title(zh: boolean, en: string, cn: string) {
  return zh ? cn : en
}

/** 创建图表 Renderer Props Inspector。 @internal */
export function createChartRendererInspector(idFactory: () => string) {
  return function ChartRendererInspector(context: ComposeRendererInspectorProps) {
    const zh = (useComposeI18nContext()?.locale ?? 'zh-CN') === 'zh-CN'
    const schema = useMemo(() => v.object({
      kind: v.pipe(
        CHART_RENDERER_PROP_SCHEMAS.kind,
        v.title(title(zh, 'Chart type', '图表类型')),
        v.metadata({ propertyPanel: { optionLabels: zh
          ? { line: '折线图', bar: '柱状图', pie: '饼图' }
          : { line: 'Line', bar: 'Bar', pie: 'Pie' } } }),
      ),
      title: v.pipe(
        CHART_RENDERER_PROP_SCHEMAS.title,
        v.title(title(zh, 'Title', '标题')),
      ),
      categories: v.pipe(
        CHART_RENDERER_PROP_SCHEMAS.categories,
        v.title(title(zh, 'Categories', '类目')),
      ),
      series: v.pipe(
        CHART_RENDERER_PROP_SCHEMAS.series,
        v.title(title(zh, 'Series', '系列')),
      ),
      palette: v.pipe(
        CHART_RENDERER_PROP_SCHEMAS.palette,
        v.title(title(zh, 'Palette', '配色')),
      ),
      textColor: v.pipe(
        CHART_RENDERER_PROP_SCHEMAS.textColor,
        v.title(title(zh, 'Text color', '文字颜色')),
        v.metadata({ propertyPanel: { editor: 'color' } }),
      ),
      axisColor: v.pipe(
        CHART_RENDERER_PROP_SCHEMAS.axisColor,
        v.title(title(zh, 'Axis color', '坐标轴颜色')),
        v.metadata({ propertyPanel: { editor: 'color' } }),
      ),
      showLegend: v.pipe(
        CHART_RENDERER_PROP_SCHEMAS.showLegend,
        v.title(title(zh, 'Legend', '图例')),
      ),
    }), [zh])

    /*
     * 绑定入口：类目与系列是「数据从哪儿来」的两个问题，页面脚本喂进来的正是它们。
     * `propsBinding` 由 Editor 注入，缺席时整块面板照常工作——本包不依赖 editor。
     */
    const propsBinding = context.propsBinding
    /*
     * 每一个 prop 都声明了 `valueContract`，绑定入口因此也给全——只给其中三个会让「哪些能
     * 绑」变成一份记在 Inspector 里、契约上读不出来的暗知识。类目与系列是最常绑的两个
     * （「数据从哪儿来」），但配色随主题、类型随数据同样是正当用法。
     */
    const bindable = Object.keys(CHART_RENDERER_PROP_SCHEMAS)
    const binding = propsBinding ? ({
      value: bindable.flatMap((propName) => {
        const exportName = propsBinding.fields[propName]?.exportName
        return exportName
          ? [{ target: { path: [propName], targetId: 'value' }, variableId: exportName }]
          : []
      }),
      variables: propsBinding.variables.map((variable) => ({ ...variable, scope: 'page' as const })),
      isTargetEnabled: ({ address }) => (
        address.targetId === 'value'
        && address.path.length === 1
        && bindable.includes(address.path[0] as string)
      ),
      onChange: (next, change) => {
        const propName = change.target.path[0]
        if (typeof propName !== 'string' || !bindable.includes(propName)) return
        const selected = next.find((item) => item.target.path[0] === propName)
        propsBinding.setField(propName, selected?.variableId ?? null)
      },
    } satisfies ComposePropertyPanelBindingConfig) : undefined

    const model = resolveComposeChartModel(propsBinding?.baseProps ?? context.props)
    const value = {
      kind: model.kind,
      title: model.title,
      categories: [...model.categories],
      series: model.series.map((entry) => ({ name: entry.name, data: [...entry.data] })),
      palette: [...model.palette],
      textColor: model.textColor,
      axisColor: model.axisColor,
      showLegend: model.showLegend,
    }

    return (
      <ComposePropertyPanel
        aria-label={title(zh, `${context.entity.name} chart`, `${context.entity.name} 图表`)}
        binding={binding}
        defaultValue={{ ...DEFAULT_CHART_PROPS }}
        readOnly={context.readOnly}
        schema={schema}
        value={value}
        onValueChange={(next, change) => {
          const propName = change.path[0]
          if (change.path.length < 1 || typeof propName !== 'string') return
          /*
           * 只落盘本次编辑的顶层字段，其余保持作者写下的原值——`value` 是归一化之后的模型，
           * 整份写回去会把用户没碰过的字段一并固化成回退值。
           */
          context.dispatch({
            id: idFactory(),
            type: BUILTIN_COMMAND_TYPES.setRendererProps,
            payload: {
              entityId: context.entity.id,
              props: {
                ...context.authoredProps,
                [propName]: (next as JsonObject)[propName] as JsonValue,
              },
            },
            meta: {
              label: `Update ${context.entity.name} · ${propName}`,
              source: 'inspector',
              targetIds: [context.entity.id],
              mergeKey: `inspector:${context.entity.id}:${propName}`,
            },
          })
        }}
      />
    )
  }
}
