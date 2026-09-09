import type {
  ComposeEntityPreset,
  ComposeRendererPropContract,
  ComposeRendererDefinition,
} from '@compose-ui/component-registry'
import * as v from 'valibot'
import {
  COMPOSE_JUNCTION_PORT_ID,
  composeJunctionGeometry,
  composeJunctionSize,
} from '@compose-ui/core'
import type { ComposeAppearance, ComposeCurve, JsonObject } from '@compose-ui/core'
import type { ReactNode } from 'react'
import type { ComposeBasicMaterialOptions, ComposeCurveMaterialOptions } from '../types'
import {
  ComposeArrowMaterialIcon,
  ComposeCircleMaterialIcon,
  ComposeLineMaterialIcon,
  ComposeRectMaterialIcon,
} from '../material-icons'
import { mergeAppearance, mergeJson, rendererPresetComponents } from '../material-preset'
import {
  COMPOSE_WIRE_STROKE_WIDTH,
  composeRectangleGeometry,
  DEFAULT_ARROW_PROPS,
  DEFAULT_CIRCLE_GEOMETRY,
  DEFAULT_CURVE_APPEARANCE,
  DEFAULT_CURVE_GEOMETRY,
  DEFAULT_CURVE_PROPS,
  DEFAULT_CURVE_SIZE,
  DEFAULT_JUNCTION_APPEARANCE,
  DEFAULT_JUNCTION_PROPS,
  DEFAULT_WIRE_PROPS,
} from './defaults'
import {
  createCurveRendererInspector,
  createDefaultInspectorId,
  type InspectorIdFactory,
} from '../material-inspector-kit/renderer-inspectors'
import { CURVE_RENDERER_PROP_SCHEMAS } from './props'
import { CurveRenderer } from './renderer'

function valueContract(
  name: keyof typeof CURVE_RENDERER_PROP_SCHEMAS,
  label: string,
): ComposeRendererPropContract {
  return {
    name,
    kind: 'value',
    label,
    category: 'stroke',
    affectsMeasurement: false,
    validate: (value) => v.safeParse(CURVE_RENDERER_PROP_SCHEMAS[name], value).success
      ? true
      : `${label} 与 Curve Prop Contract 不兼容`,
  }
}

/**
 * 曲线的一个起点。
 *
 * @remarks
 * 四个 Preset 的差别只有默认几何与默认描边，Renderer 是同一个——「盒 + 方向」与「坐标」不得
 * 同时存在两种线的表示，用户看不出区别却会得到不同的编辑手感。
 */
function curvePreset(
  id: 'curve' | 'arrow' | 'circle' | 'rect' | 'wire' | 'junction',
  fallbackLabel: string,
  fallbackProps: JsonObject,
  geometry: (size: { readonly width: number; readonly height: number }) => ComposeCurve,
  icon: ReactNode,
  paletteHidden: 'toolbar' | 'always' | null,
  options: ComposeBasicMaterialOptions = {},
  extra: {
    readonly fallbackSize?: { readonly width: number; readonly height: number }
    readonly fallbackAppearance?: ComposeAppearance
    /** 额外的 Component；节点靠它带上自己的那一个端口。 */
    readonly components?: (size: { readonly width: number; readonly height: number }) => JsonObject
  } = {},
): ComposeEntityPreset {
  const size = options.defaultSize ?? extra.fallbackSize ?? DEFAULT_CURVE_SIZE
  const props = mergeJson(fallbackProps, options.defaultProps)
  const appearance = mergeAppearance(
    extra.fallbackAppearance ?? DEFAULT_CURVE_APPEARANCE,
    options.defaultAppearance,
  )
  return {
    id,
    label: options.label ?? fallbackLabel,
    defaultName: options.name ?? fallbackLabel,
    icon,
    ...(paletteHidden ? { paletteHidden } : {}),
    createComponents: () => ({
      ...rendererPresetComponents({ type: 'curve', props, size, appearance }),
      Curve: geometry(size) as unknown as JsonObject,
      ...(extra.components ? extra.components(size) : {}),
    }),
  }
}

/**
 * 创建曲线 Renderer 与它的四个 Preset。
 *
 * @remarks
 * Preset 在 `rendererPresetComponents` 之外补一个 `Curve` 承载几何。
 *
 * 曾经还补一个 `GeometryConstraints` 关掉 resize，理由是「盒缩放该不该等比缩放几何点还没
 * 定」。**现在定了**：盒自由，几何按 `viewBox` 与盒的比例呈现，因此手柄回来，走的是所有
 * Entity 共用的那一条缩放路径。
 *
 * `paletteHidden` 分两档。`'toolbar'` 是「工具栏已提供入口」，与物料本身无关：Arrow 与 Circle
 * 各有一条绘图命令，Curve 没有——这一档**按当前工作区的货架**求值，因此页面工作区（默认货架
 * 不含 `CIRCLE`）里圆的瓦片会出现。Wire 是 `'always'`：它有一条自己的理由——从 Palette 拖出来
 * 的导线**没有任何端口绑定**，而那条粗线正在宣称它是主回路，这与谁的货架上有没有按钮无关。
 *
 * @internal
 */
export function createCurveMaterial(
  options: ComposeCurveMaterialOptions = {},
  idFactory: InspectorIdFactory = createDefaultInspectorId,
): {
  renderer: ComposeRendererDefinition
  presets: readonly [
    ComposeEntityPreset,
    ComposeEntityPreset,
    ComposeEntityPreset,
    ComposeEntityPreset,
    ComposeEntityPreset,
    ComposeEntityPreset,
  ]
} {
  return {
    renderer: {
      type: 'curve',
      label: 'Curve',
      renderer: CurveRenderer,
      propContracts: [
        valueContract('stroke', 'Stroke'),
        valueContract('strokeWidth', 'Stroke width'),
        valueContract('strokeLinecap', 'Line cap'),
        valueContract('strokeDasharray', 'Line style'),
        valueContract('strokeDashoffset', 'Dash offset'),
        valueContract('markerStart', 'Start arrow'),
        valueContract('markerEnd', 'End arrow'),
      ],
      propCategories: [{ id: 'stroke', label: '描边', inspectorDefaultExpanded: true }],
      inspectorPropNames: [
        'stroke',
        'strokeWidth',
        'strokeLinecap',
        'strokeDasharray',
        'strokeDashoffset',
        'markerStart',
        'markerEnd',
      ],
      inspector: createCurveRendererInspector(idFactory),
    },
    presets: [
      curvePreset(
        'curve',
        'Curve',
        DEFAULT_CURVE_PROPS,
        (size) => ({ ...DEFAULT_CURVE_GEOMETRY, end: { x: size.width, y: size.height } }),
        <ComposeLineMaterialIcon />,
        null,
        options.curve,
      ),
      curvePreset(
        'arrow',
        'Arrow',
        DEFAULT_ARROW_PROPS,
        (size) => ({ ...DEFAULT_CURVE_GEOMETRY, end: { x: size.width, y: size.height } }),
        <ComposeArrowMaterialIcon />,
        'toolbar',
        options.arrow,
      ),
      curvePreset(
        'circle',
        'Circle',
        DEFAULT_CURVE_PROPS,
        () => DEFAULT_CIRCLE_GEOMETRY,
        <ComposeCircleMaterialIcon />,
        'toolbar',
        options.circle,
      ),
      /*
       * 矩形**不 paletteHidden**，这是对上面那条「工具栏已提供入口就不上面板」的一处有意
       * 偏离：物料面板是新手唯一的发现面，而矩形是最先被找的那一个。`R` 与它落地的是同一个
       * Preset，因此两条入口产出的东西逐字段相同——「同一个词指两件东西」正是这次要修的。
       *
       * 它与其他曲线一样**默认空心**：接线图上矩形绝大多数是设备外框与分区框，套在符号
       * 外面，默认填色会把里面的符号整片盖住。空心的代价是盒内部不命中，由两处承担——
       * 选中之后边缘的缩放命中带整条让到盒外（描边连同它的容差归移动），以及盒内双击进
       * 几何编辑。
       */
      curvePreset(
        'rect',
        'Rectangle',
        DEFAULT_CURVE_PROPS,
        composeRectangleGeometry,
        <ComposeRectMaterialIcon />,
        null,
        options.rect,
      ),
      curvePreset(
        'wire',
        'Wire',
        DEFAULT_WIRE_PROPS,
        (size) => ({ ...DEFAULT_CURVE_GEOMETRY, end: { x: size.width, y: size.height } }),
        <ComposeLineMaterialIcon />,
        'always',
        options.wire,
      ),
      /*
       * 节点是曲线的**第五个起点**：一个填实的整圆，外加它自己的那一个端口。接线时三条支路
       * 都绑到这个端口上，因此既有的「端点绑端口」协议一个字节不改——求解、失效判定、
       * `port` 最高捕捉优先级与 Inspector 全部白拿。
       *
       * `paletteHidden`：从物料面板拖出来的节点不连着任何导线，而一个不表达任何连接的实心点
       * 读不出意图。
       */
      curvePreset(
        'junction',
        'Junction',
        DEFAULT_JUNCTION_PROPS,
        composeJunctionGeometry,
        <ComposeCircleMaterialIcon />,
        'always',
        options.junction,
        {
          fallbackSize: composeJunctionSize(COMPOSE_WIRE_STROKE_WIDTH),
          fallbackAppearance: DEFAULT_JUNCTION_APPEARANCE,
          components: (size) => ({
            Ports: {
              items: [{
                id: COMPOSE_JUNCTION_PORT_ID,
                position: { x: size.width / 2, y: size.height / 2 },
              }],
            },
          }),
        },
      ),
    ],
  }
}

const curve = createCurveMaterial()
/** 默认 Curve Renderer。 @public */
export const DEFAULT_COMPOSE_CURVE_RENDERER = curve.renderer
/** 默认 Curve Entity Preset。 @public */
export const DEFAULT_COMPOSE_CURVE_PRESET = curve.presets[0]
/** 默认 Arrow Entity Preset。 @public */
export const DEFAULT_COMPOSE_ARROW_PRESET = curve.presets[1]
/** 默认 Circle Entity Preset。 @public */
export const DEFAULT_COMPOSE_CIRCLE_PRESET = curve.presets[2]
/** 默认 Rect Entity Preset。 @public */
export const DEFAULT_COMPOSE_RECT_PRESET = curve.presets[3]
/** 默认 Wire Entity Preset。 @public */
export const DEFAULT_COMPOSE_WIRE_PRESET = curve.presets[4]
/** 默认 Junction Entity Preset。 @public */
export const DEFAULT_COMPOSE_JUNCTION_PRESET = curve.presets[5]
