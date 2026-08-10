import type {
  ComposeEntityPreset,
  ComposeRendererPropContract,
  ComposeRendererDefinition,
} from '@compose-ui/component-registry'
import * as v from 'valibot'
import type { JsonObject } from '@compose-ui/core'
import type { ComposeBasicMaterialOptions, ComposeShapeMaterialOptions } from '../types'
import { mergeAppearance, mergeJson, rendererPresetComponents } from '../material-preset'
import {
  DEFAULT_ARROW_PROPS,
  DEFAULT_CIRCLE_PROPS,
  DEFAULT_LINE_PROPS,
  DEFAULT_SHAPE_APPEARANCE,
  DEFAULT_SHAPE_SIZE,
} from './defaults'
import {
  createDefaultInspectorId,
  createShapeRendererInspector,
  type InspectorIdFactory,
} from '../material-inspector-kit/renderer-inspectors'
import { SHAPE_RENDERER_PROP_SCHEMAS } from './props'
import { ShapeRenderer } from './renderer'

function valueContract(
  name: keyof typeof SHAPE_RENDERER_PROP_SCHEMAS,
  label: string,
): ComposeRendererPropContract {
  return {
    name,
    kind: 'value',
    label,
    category: 'shape',
    affectsMeasurement: false,
    validate: (value) => v.safeParse(SHAPE_RENDERER_PROP_SCHEMAS[name], value).success
      ? true
      : `${label} 与 Shape Prop Contract 不兼容`,
  }
}

function shapePreset(
  id: 'line' | 'arrow' | 'circle',
  fallbackLabel: string,
  fallbackName: string,
  fallbackProps: JsonObject,
  icon: string,
  options: ComposeBasicMaterialOptions = {},
): ComposeEntityPreset {
  const size = options.defaultSize ?? DEFAULT_SHAPE_SIZE
  const props = mergeJson(fallbackProps, options.defaultProps)
  const appearance = mergeAppearance(DEFAULT_SHAPE_APPEARANCE, options.defaultAppearance)
  return {
    id,
    label: options.label ?? fallbackLabel,
    defaultName: options.name ?? fallbackName,
    icon: <span aria-hidden="true">{icon}</span>,
    createComponents: () => rendererPresetComponents({
      type: 'shape',
      props,
      size,
      appearance,
    }),
  }
}

/** 创建 Line、Arrow 与 Circle 共用的 Shape renderer 和绘图 Presets。 @internal */
export function createShapeMaterial(
  options: ComposeShapeMaterialOptions = {},
  idFactory: InspectorIdFactory = createDefaultInspectorId,
): {
  renderer: ComposeRendererDefinition
  presets: readonly [ComposeEntityPreset, ComposeEntityPreset, ComposeEntityPreset]
} {
  return {
    renderer: {
      type: 'shape',
      label: 'Shape',
      renderer: ShapeRenderer,
      propContracts: [
        valueContract('stroke', 'Stroke'),
        valueContract('strokeWidth', 'Stroke width'),
        valueContract('strokeLinecap', 'Line cap'),
        valueContract('strokeDasharray', 'Line style'),
        valueContract('markerStart', 'Start arrow'),
        valueContract('markerEnd', 'End arrow'),
      ],
      propCategories: [{ id: 'shape', label: '线条', inspectorDefaultExpanded: true }],
      inspectorPropNames: [
        'stroke',
        'strokeWidth',
        'strokeLinecap',
        'strokeDasharray',
        'markerStart',
        'markerEnd',
      ],
      inspector: createShapeRendererInspector(idFactory),
    },
    presets: [
      shapePreset('line', 'Line', 'Line', DEFAULT_LINE_PROPS, '╱', options.line),
      shapePreset('arrow', 'Arrow', 'Arrow', DEFAULT_ARROW_PROPS, '➜', options.arrow),
      shapePreset('circle', 'Circle', 'Circle', DEFAULT_CIRCLE_PROPS, '○', options.circle),
    ],
  }
}

const shape = createShapeMaterial()
/** 默认 Shape Renderer。 @public */
export const DEFAULT_COMPOSE_SHAPE_RENDERER = shape.renderer
/** 默认 Line Entity Preset。 @public */
export const DEFAULT_COMPOSE_LINE_PRESET = shape.presets[0]
/** 默认 Arrow Entity Preset。 @public */
export const DEFAULT_COMPOSE_ARROW_PRESET = shape.presets[1]
/** 默认 Circle Entity Preset。 @public */
export const DEFAULT_COMPOSE_CIRCLE_PRESET = shape.presets[2]
