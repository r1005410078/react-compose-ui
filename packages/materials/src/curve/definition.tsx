import type {
  ComposeEntityPreset,
  ComposeRendererPropContract,
  ComposeRendererDefinition,
} from '@compose-ui/component-registry'
import * as v from 'valibot'
import type { ComposeBasicMaterialOptions } from '../types'
import { ComposeLineMaterialIcon } from '../material-icons'
import { mergeAppearance, mergeJson, rendererPresetComponents } from '../material-preset'
import {
  DEFAULT_CURVE_APPEARANCE,
  DEFAULT_CURVE_GEOMETRY,
  DEFAULT_CURVE_PROPS,
  DEFAULT_CURVE_SIZE,
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
 * 创建曲线 Renderer 与 Preset。
 *
 * @remarks
 * Preset 在 `rendererPresetComponents` 之外补一个 `Curve` 承载几何。
 *
 * 曾经还补一个 `GeometryConstraints` 关掉 resize，理由是「盒缩放该不该等比缩放几何点还没
 * 定」。**现在定了**：盒自由，几何按 `viewBox` 与盒的比例呈现，因此手柄回来，走的是所有
 * Entity 共用的那一条缩放路径。
 *
 * @internal
 */
export function createCurveMaterial(
  options: ComposeBasicMaterialOptions = {},
  idFactory: InspectorIdFactory = createDefaultInspectorId,
): { renderer: ComposeRendererDefinition; preset: ComposeEntityPreset } {
  const size = options.defaultSize ?? DEFAULT_CURVE_SIZE
  const props = mergeJson(DEFAULT_CURVE_PROPS, options.defaultProps)
  const appearance = mergeAppearance(DEFAULT_CURVE_APPEARANCE, options.defaultAppearance)
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
      ],
      propCategories: [{ id: 'stroke', label: '描边', inspectorDefaultExpanded: true }],
      inspectorPropNames: ['stroke', 'strokeWidth', 'strokeLinecap', 'strokeDasharray'],
      inspector: createCurveRendererInspector(idFactory),
    },
    preset: {
      id: 'curve',
      label: options.label ?? 'Curve',
      defaultName: options.name ?? 'Curve',
      icon: <ComposeLineMaterialIcon />,
      createComponents: () => ({
        ...rendererPresetComponents({ type: 'curve', props, size, appearance }),
        Curve: {
          ...DEFAULT_CURVE_GEOMETRY,
          end: { x: size.width, y: size.height },
        },
      }),
    },
  }
}

const curve = createCurveMaterial()
/** 默认 Curve Renderer。 @public */
export const DEFAULT_COMPOSE_CURVE_RENDERER = curve.renderer
/** 默认 Curve Entity Preset。 @public */
export const DEFAULT_COMPOSE_CURVE_PRESET = curve.preset
