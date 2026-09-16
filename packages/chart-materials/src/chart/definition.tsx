import * as v from 'valibot'
import type {
  ComposeEntityPreset,
  ComposeRendererDefinition,
  ComposeRendererPropContract,
} from '@compose-ui/component-registry'
import { ChartRenderer } from './renderer'
import { createChartRendererInspector } from './inspector'
import {
  CHART_RENDERER_PROP_SCHEMAS,
  COMPOSE_CHART_KINDS,
  DEFAULT_CHART_PROPS,
  DEFAULT_CHART_SIZE,
} from './props'
import { ComposeChartMaterialIcon } from './icons'

/** 图表 Renderer 的协议 id。三个 Preset 共用它。 @public */
export const COMPOSE_CHART_RENDERER_TYPE = 'chart'

function valueContract(
  name: keyof typeof CHART_RENDERER_PROP_SCHEMAS,
  label: string,
): ComposeRendererPropContract {
  return {
    name,
    kind: 'value',
    label,
    category: 'chart',
    // 图表填满给它的盒，改数据不改变尺寸，因此没有一项影响测量。
    affectsMeasurement: false,
    validate: (value) => v.safeParse(CHART_RENDERER_PROP_SCHEMAS[name], value).success
      ? true
      : `${label} 与 Chart Prop Contract 不兼容`,
  }
}

const PRESET_LABELS: Record<(typeof COMPOSE_CHART_KINDS)[number], string> = {
  line: '折线图',
  bar: '柱状图',
  pie: '饼图',
}

/** 创建图表物料的可选项。 @public */
export interface ComposeChartMaterialOptions {
  /** 覆盖默认 props；按字段浅合并。 */
  readonly defaultProps?: Readonly<Record<string, unknown>>
  /** 覆盖默认尺寸。 */
  readonly defaultSize?: { readonly width: number; readonly height: number }
}

/**
 * 创建图表 Renderer 与三个 Entity Preset。
 *
 * @remarks
 * **一个 Renderer、三个 Preset**：三种图只差底层的系列类型，另立三个 Renderer 会让绑定契约、
 * Inspector、校验与渲染各多两支逐字相同的实现。而物料面板要出三格——用户找的是「饼图」，
 * 不是「图表，然后去属性面板改类型」；Preset 与 Renderer 多对一是既有形状（`rect` 与
 * `rectangle` 都是 `curve` 的 Preset）。
 *
 * @public
 */
export function createComposeChartMaterial(options: ComposeChartMaterialOptions = {}): {
  renderer: ComposeRendererDefinition
  presets: readonly ComposeEntityPreset[]
} {
  const size = options.defaultSize ?? DEFAULT_CHART_SIZE
  let commandIndex = 0
  const idFactory = () => `chart-inspector-${commandIndex++}`
  const propNames = Object.keys(CHART_RENDERER_PROP_SCHEMAS) as (
    keyof typeof CHART_RENDERER_PROP_SCHEMAS
  )[]
  return {
    renderer: {
      type: COMPOSE_CHART_RENDERER_TYPE,
      label: 'Chart',
      renderer: ChartRenderer,
      propContracts: propNames.map((name) => valueContract(name, name)),
      propCategories: [{ id: 'chart', label: '图表' }],
      inspectorPropNames: propNames,
      inspector: createChartRendererInspector(idFactory),
      // 不声明 measurement：图表填满给它的盒，没有「内容有多大」这个问题。
    },
    presets: COMPOSE_CHART_KINDS.map((kind) => ({
      id: `chart-${kind}`,
      label: PRESET_LABELS[kind],
      defaultName: PRESET_LABELS[kind],
      icon: <ComposeChartMaterialIcon kind={kind} />,
      createComponents: () => ({
        Transform: { rotation: 0 },
        LayoutItem: {
          positioning: 'absolute',
          offset: { x: 0, y: 0 },
          width: { mode: 'fixed', value: size.width, min: 1, max: null },
          height: { mode: 'fixed', value: size.height, min: 1, max: null },
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          alignSelf: 'auto',
        },
        Visibility: { visible: true },
        Lock: { locked: false },
        Appearance: {
          backgroundPaint: { kind: 'solid', color: 'transparent' },
          borderColor: 'transparent',
          borderWidth: 0,
          borderRadius: 0,
          opacity: 1,
          shadow: null,
        },
        Renderer: {
          type: COMPOSE_CHART_RENDERER_TYPE,
          props: structuredClone({ ...DEFAULT_CHART_PROPS, ...options.defaultProps, kind }),
        },
      }),
    })),
  }
}
