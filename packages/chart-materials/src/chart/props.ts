import * as v from 'valibot'

/**
 * 图表的三元 `kind`。
 *
 * @remarks
 * 三种图只差底层的系列类型，标题、类目、系列、配色、图例这些逐字相同。另立三个 Renderer
 * 会让绑定契约、Inspector、校验与渲染各多两支逐字相同的实现——这是 `Curve` 的 `kind` 四元
 * 联合那条判断的第二次应用。
 *
 * @internal
 */
export const COMPOSE_CHART_KINDS = ['line', 'bar', 'pie'] as const

/**
 * 配色表里一项的 Schema。
 *
 * @remarks
 * 单独拎出来是为了让 Inspector 能在**它**身上挂 `editor: 'color'`：属性面板的编辑器是按
 * **每个节点自己**的 schema 元数据解析的，挂在数组上只描述数组这一个节点，条目仍然是裸
 * 字符串、落到默认的文本输入。颜色编辑器也不能凭类型认领字符串——那样每个文本字段都会
 * 变成颜色选择器。
 *
 * @internal
 */
export const CHART_PALETTE_ITEM_SCHEMA = v.pipe(v.string(), v.minLength(1))

/** 图表 Renderer 对外公开的顶层 Props Schema；Inspector 与绑定 Contract 共用。 @internal */
export const CHART_RENDERER_PROP_SCHEMAS = Object.freeze({
  kind: v.picklist(COMPOSE_CHART_KINDS),
  title: v.string(),
  categories: v.array(v.string()),
  series: v.array(v.object({
    name: v.string(),
    data: v.array(v.number()),
  })),
  palette: v.array(CHART_PALETTE_ITEM_SCHEMA),
  textColor: v.pipe(v.string(), v.minLength(1)),
  axisColor: v.pipe(v.string(), v.minLength(1)),
  showLegend: v.boolean(),
})

/** 图表默认尺寸。图表填满给它的盒，没有「内容有多大」这个问题，因此不声明测量。 @internal */
export const DEFAULT_CHART_SIZE = Object.freeze({ width: 420, height: 260 })

/**
 * 默认配色。
 *
 * @remarks
 * **不内置按行业或语义划分的色表**——与「不内置电压等级色表」同一条：色表因项目而异，内置
 * 一份等于替宿主做了一个多半要改的决定。这几个只是一组与深色画布对比度够的中性色，而且
 * 写在 props 里，用户改得动。
 *
 * @internal
 */
export const DEFAULT_CHART_PALETTE = Object.freeze([
  '#5794f2', '#2ee6a8', '#ffa940', '#ff6b6b', '#a78bfa', '#38bdf8',
])

/** 图表默认 props。 @internal */
export const DEFAULT_CHART_PROPS = Object.freeze({
  kind: 'bar' as const,
  title: '',
  categories: ['一月', '二月', '三月', '四月'],
  series: [{ name: '数值', data: [18, 28, 22, 36] }],
  palette: [...DEFAULT_CHART_PALETTE],
  textColor: '#dce8fa',
  axisColor: '#91a0b6',
  showLegend: false,
})
