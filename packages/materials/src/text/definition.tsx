import type {
  ComposeEntityPreset,
  ComposeRendererPropContract,
  ComposeRendererDefinition,
} from '@compose-ui/component-registry'
import type { ComposeAppearance, JsonObject } from '@compose-ui/core'
import * as v from 'valibot'
import type { ComposeBasicMaterialOptions } from '../types'
import { mergeAppearance, mergeJson, rendererPresetComponents } from '../material-preset'
import {
  createDefaultInspectorId,
  createTextRendererInspector,
  type InspectorIdFactory,
} from '../material-inspector-kit/renderer-inspectors'
import {
  DEFAULT_TEXT_APPEARANCE,
  DEFAULT_TEXT_PROPS,
  DEFAULT_TEXT_SIZE,
} from './defaults'
import { TextRenderer } from './renderer'
import { TEXT_RENDERER_MEASUREMENT } from './measurement'
import { TEXT_RENDERER_PROP_SCHEMAS } from './props'

function valueContract(
  name: keyof typeof TEXT_RENDERER_PROP_SCHEMAS,
  label: string,
  category: 'text' | 'typography',
  affectsMeasurement = true,
): ComposeRendererPropContract {
  return {
    name,
    kind: 'value',
    label,
    category,
    affectsMeasurement,
    validate: (value) => v.safeParse(TEXT_RENDERER_PROP_SCHEMAS[name], value).success
      ? true
      : `${label} 与 Text Prop Contract 不兼容`,
  }
}

function textPresetComponents(input: {
  readonly props: JsonObject
  readonly size: { readonly width: number; readonly height: number }
  readonly appearance: ComposeAppearance
}) {
  const components = rendererPresetComponents({
    type: 'text',
    props: input.props,
    size: input.size,
    appearance: input.appearance,
  })
  return {
    ...components,
    LayoutItem: {
      ...components.LayoutItem,
      width: { ...components.LayoutItem.width, mode: 'hug' as const },
      height: { ...components.LayoutItem.height, mode: 'hug' as const },
    },
  }
}

/** 创建 Text Renderer 与 Entity Preset。 @internal */
export function createTextMaterial(
  options: ComposeBasicMaterialOptions = {},
  idFactory: InspectorIdFactory = createDefaultInspectorId,
): { renderer: ComposeRendererDefinition; preset: ComposeEntityPreset } {
  const size = options.defaultSize ?? DEFAULT_TEXT_SIZE
  const props = mergeJson(DEFAULT_TEXT_PROPS, options.defaultProps)
  const appearance = mergeAppearance(DEFAULT_TEXT_APPEARANCE, options.defaultAppearance)
  return {
    renderer: {
      type: 'text',
      label: options.label ?? 'Text',
      renderer: TextRenderer,
      // 声明后 Stage 无需识别物料类型即可提供画布内编辑；stage 不依赖 materials。
      editableTextPropName: 'text',
      propContracts: [
        valueContract('text', 'Text', 'text'),
        valueContract('color', 'Text color', 'text', false),
        valueContract('fontSize', 'Font size', 'typography'),
        valueContract('fontFamily', 'Font family', 'typography'),
        valueContract('fontWeight', 'Font weight', 'typography'),
        valueContract('letterSpacing', 'Letter spacing', 'typography'),
        valueContract('lineHeight', 'Line height', 'typography'),
        valueContract('textAlign', 'Text align', 'typography', false),
        valueContract('verticalAlign', 'Vertical align', 'typography', false),
        valueContract('textCase', 'Text case', 'typography'),
        valueContract('textDecoration', 'Text decoration', 'typography', false),
      ],
      propCategories: [
        { id: 'text', label: '文本' },
        { id: 'typography', label: '排版' },
      ],
      inspectorPropNames: [
        'text',
        'color',
        'fontSize',
        'fontFamily',
        'fontWeight',
        'letterSpacing',
        'lineHeight',
        'textAlign',
        'verticalAlign',
        'textCase',
        'textDecoration',
      ],
      inspector: createTextRendererInspector(idFactory),
      measurement: TEXT_RENDERER_MEASUREMENT,
    },
    preset: {
      id: 'text',
      label: options.label ?? 'Text',
      defaultName: options.name ?? 'Text',
      icon: <span aria-hidden="true">T</span>,
      // Stage 工具栏已提供文本绘制工具，Palette 不再重复同一个入口。
      paletteHidden: true,
      createComponents: () => textPresetComponents({
        props,
        size,
        appearance,
      }),
    },
  }
}

const text = createTextMaterial()
/** 默认 Text Renderer。 @public */
export const DEFAULT_COMPOSE_TEXT_RENDERER = text.renderer
/** 默认 Text Entity Preset。 @public */
export const DEFAULT_COMPOSE_TEXT_PRESET = text.preset
