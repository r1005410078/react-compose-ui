import type {
  ComposeEntityPreset,
  ComposeRendererPropContract,
  ComposeRendererDefinition,
} from '@compose-ui/component-registry'
import * as v from 'valibot'
import type { ComposeCurve, JsonObject } from '@compose-ui/core'
import type { ReactNode } from 'react'
import type { ComposeBasicMaterialOptions, ComposeCurveMaterialOptions } from '../types'
import {
  ComposeArrowMaterialIcon,
  ComposeCircleMaterialIcon,
  ComposeLineMaterialIcon,
} from '../material-icons'
import { mergeAppearance, mergeJson, rendererPresetComponents } from '../material-preset'
import {
  DEFAULT_ARROW_PROPS,
  DEFAULT_CIRCLE_GEOMETRY,
  DEFAULT_CURVE_APPEARANCE,
  DEFAULT_CURVE_GEOMETRY,
  DEFAULT_CURVE_PROPS,
  DEFAULT_CURVE_SIZE,
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
  id: 'curve' | 'arrow' | 'circle' | 'wire',
  fallbackLabel: string,
  fallbackProps: JsonObject,
  geometry: (size: { readonly width: number; readonly height: number }) => ComposeCurve,
  icon: ReactNode,
  paletteHidden: boolean,
  options: ComposeBasicMaterialOptions = {},
): ComposeEntityPreset {
  const size = options.defaultSize ?? DEFAULT_CURVE_SIZE
  const props = mergeJson(fallbackProps, options.defaultProps)
  const appearance = mergeAppearance(DEFAULT_CURVE_APPEARANCE, options.defaultAppearance)
  return {
    id,
    label: options.label ?? fallbackLabel,
    defaultName: options.name ?? fallbackLabel,
    icon,
    ...(paletteHidden ? { paletteHidden: true } : {}),
    createComponents: () => ({
      ...rendererPresetComponents({ type: 'curve', props, size, appearance }),
      Curve: geometry(size) as unknown as JsonObject,
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
 * `paletteHidden` 的判据是「工具栏是否已提供入口」，与物料本身无关：Arrow、Circle 与 Wire 各有
 * 一条绘图命令，Curve 没有。Wire 还有一条自己的理由——从 Palette 拖出来的导线**没有任何端口
 * 绑定**，而那条粗线正在宣称它是主回路。
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
        false,
        options.curve,
      ),
      curvePreset(
        'arrow',
        'Arrow',
        DEFAULT_ARROW_PROPS,
        (size) => ({ ...DEFAULT_CURVE_GEOMETRY, end: { x: size.width, y: size.height } }),
        <ComposeArrowMaterialIcon />,
        true,
        options.arrow,
      ),
      curvePreset(
        'circle',
        'Circle',
        DEFAULT_CURVE_PROPS,
        () => DEFAULT_CIRCLE_GEOMETRY,
        <ComposeCircleMaterialIcon />,
        true,
        options.circle,
      ),
      curvePreset(
        'wire',
        'Wire',
        DEFAULT_WIRE_PROPS,
        (size) => ({ ...DEFAULT_CURVE_GEOMETRY, end: { x: size.width, y: size.height } }),
        <ComposeLineMaterialIcon />,
        true,
        options.wire,
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
/** 默认 Wire Entity Preset。 @public */
export const DEFAULT_COMPOSE_WIRE_PRESET = curve.presets[3]
