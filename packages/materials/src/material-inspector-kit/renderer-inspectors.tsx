import * as v from 'valibot'
import {
  ComposePropertyPanel,
  ComposePropertyPanelBoundValue,
  type ComposePropertyPanelBindingConfig,
  type ComposePropertyPanelRenderer,
} from '@compose-ui/property-panel'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import {
  BUILTIN_COMMAND_TYPES,
  type EditorCommand,
  type JsonObject,
  type JsonValue,
} from '@compose-ui/core'
import type { ComposeRendererInspectorProps } from '@compose-ui/component-registry'
import { DEFAULT_IMAGE_PROPS } from '../image/defaults'
import { IMAGE_RENDERER_PROP_SCHEMAS } from '../image/props'
import { DEFAULT_SVG_PROPS } from '../svg/defaults'
import { SVG_RENDERER_PROP_SCHEMAS } from '../svg/props'
import {
  DEFAULT_TEXT_PROPS,
  DEFAULT_TEXT_TYPOGRAPHY_PROPS,
  defaultTextLineHeight,
} from '../text/defaults'
import { SHAPE_RENDERER_PROP_SCHEMAS } from '../shape/props'
import { TEXT_RENDERER_PROP_SCHEMAS } from '../text/props'
import { composeNodePropertySchema } from './node'

/** Inspector 命令 ID factory。 @internal */
export type InspectorIdFactory = () => string

/** 创建 Inspector 使用的默认命令 ID。 @internal */
export function createDefaultInspectorId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `material-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function dispatchProps(
  context: ComposeRendererInspectorProps,
  props: JsonObject,
  idFactory: InspectorIdFactory,
) {
  const command: EditorCommand = {
    id: idFactory(),
    type: BUILTIN_COMMAND_TYPES.setRendererProps,
    payload: { entityId: context.entity.id, props },
    meta: {
      label: `Update ${context.entity.name}`,
      source: 'inspector',
      targetIds: [context.entity.id],
      mergeKey: `inspector:${context.entity.id}:renderer`,
    },
  }
  context.dispatch(command)
}

function createPropsBinding(
  context: ComposeRendererInspectorProps,
  visiblePropNames?: ReadonlySet<string>,
): ComposePropertyPanelBindingConfig | undefined {
  const port = context.propsBinding
  if (!port) return undefined
  const inlineProps = new Set(port.inspectorPropNames.filter(
    (propName) => !visiblePropNames || visiblePropNames.has(propName),
  ))
  return {
    value: Object.entries(port.fields).flatMap(([propName, state]) => (
      inlineProps.has(propName) && state.exportName
        ? [{
            target: { path: [propName], targetId: 'value' },
            variableId: state.exportName,
          }]
        : []
    )),
    variables: port.variables.map((variable) => ({ ...variable, scope: 'page' as const })),
    isTargetEnabled: ({ address }) => (
      address.targetId === 'value'
      && address.path.length === 1
      && typeof address.path[0] === 'string'
      && inlineProps.has(address.path[0])
    ),
    onChange: (next, change) => {
      const propName = change.target.path[0]
      if (typeof propName !== 'string' || !inlineProps.has(propName)) return
      const binding = next.find((item) => (
        item.target.targetId === 'value'
        && item.target.path.length === 1
        && item.target.path[0] === propName
      ))
      port.setField(propName, binding?.variableId ?? null)
    },
  }
}

function inspectorBaseProps(context: ComposeRendererInspectorProps) {
  return context.propsBinding?.baseProps ?? context.authoredProps
}

function title(
  zh: boolean,
  english: string,
  chinese: string,
) {
  return zh ? chinese : english
}

const TEXT_CONTENT_RENDERER: ComposePropertyPanelRenderer = {
  id: 'material-text-content',
  component: ({ binding, commit, label, readOnly, value }) => {
    const target = binding?.getTarget('value')
    const bound = Boolean(target?.binding)
    const effectiveValue = target?.effectiveValue ?? value
    if (target?.binding) return <ComposePropertyPanelBoundValue target={target} />
    return (
      <input
        aria-label={label}
        disabled={readOnly && !bound}
        readOnly={readOnly || bound}
        type="text"
        value={typeof effectiveValue === 'string' || typeof effectiveValue === 'number'
          ? String(effectiveValue)
          : ''}
        onChange={(event) => {
          if (!readOnly && !bound) commit(event.target.value, 'input')
        }}
      />
    )
  },
}

/** 创建 Text Renderer Props Inspector。 @internal */
export function createTextRendererInspector(idFactory: InspectorIdFactory) {
  return function TextRendererInspector(context: ComposeRendererInspectorProps) {
    const zh = (useComposeI18nContext()?.locale ?? 'zh-CN') === 'zh-CN'
    const fullSchema = v.object({
      text: v.pipe(
        TEXT_RENDERER_PROP_SCHEMAS.text,
        v.title(title(zh, 'Text', '文本')),
        v.metadata({ propertyPanel: { editor: TEXT_CONTENT_RENDERER.id } }),
      ),
      color: v.pipe(
        TEXT_RENDERER_PROP_SCHEMAS.color,
        v.title(title(zh, 'Text color', '文字颜色')),
        v.metadata({ propertyPanel: { editor: 'color' } }),
      ),
      fontSize: v.pipe(
        TEXT_RENDERER_PROP_SCHEMAS.fontSize,
        v.title(title(zh, 'Font size', '字号')),
      ),
      fontFamily: v.pipe(
        TEXT_RENDERER_PROP_SCHEMAS.fontFamily,
        v.title(title(zh, 'Font family', '字体')),
      ),
      fontWeight: v.pipe(
        TEXT_RENDERER_PROP_SCHEMAS.fontWeight,
        v.title(title(zh, 'Font weight', '字重')),
        v.metadata({ propertyPanel: { editor: TEXT_CONTENT_RENDERER.id } }),
      ),
      letterSpacing: v.pipe(
        TEXT_RENDERER_PROP_SCHEMAS.letterSpacing,
        v.title(title(zh, 'Letter spacing', '字间距')),
        v.metadata({ propertyPanel: { unit: 'px' } }),
      ),
      lineHeight: v.pipe(
        TEXT_RENDERER_PROP_SCHEMAS.lineHeight,
        v.title(title(zh, 'Line height', '行高')),
        v.metadata({ propertyPanel: { unit: 'px' } }),
      ),
    })
    const visiblePropNames = context.propCategory?.id === 'text'
      ? new Set(['text', 'color'])
      : context.propCategory?.id === 'typography'
        ? new Set(['fontSize', 'fontFamily', 'fontWeight', 'letterSpacing', 'lineHeight'])
        : undefined
    const schema = context.propCategory?.id === 'text'
      ? v.pick(fullSchema, ['text', 'color'])
      : context.propCategory?.id === 'typography'
        ? v.pick(fullSchema, [
            'fontSize',
            'fontFamily',
            'fontWeight',
            'letterSpacing',
            'lineHeight',
          ])
        : fullSchema
    const props = inspectorBaseProps(context)
    const defaultFontSize = DEFAULT_TEXT_PROPS.fontSize as number
    const fontSize = typeof props.fontSize === 'number' ? props.fontSize : defaultFontSize
    const value = {
      text: typeof props.text === 'string' || typeof props.text === 'number'
        ? props.text
        : DEFAULT_TEXT_PROPS.text as string,
      color: typeof props.color === 'string'
        ? props.color
        : DEFAULT_TEXT_PROPS.color as string,
      fontSize,
      fontFamily: typeof props.fontFamily === 'string'
        ? props.fontFamily
        : DEFAULT_TEXT_TYPOGRAPHY_PROPS.fontFamily,
      fontWeight: typeof props.fontWeight === 'string' || typeof props.fontWeight === 'number'
        ? props.fontWeight
        : DEFAULT_TEXT_TYPOGRAPHY_PROPS.fontWeight,
      letterSpacing: typeof props.letterSpacing === 'number'
        ? props.letterSpacing
        : DEFAULT_TEXT_TYPOGRAPHY_PROPS.letterSpacing,
      lineHeight: typeof props.lineHeight === 'number'
        ? props.lineHeight
        : defaultTextLineHeight(fontSize),
    }
    /*
     * 行高的默认值依赖字号，因此基线用默认字号推导，而不是当前字号：基线必须与
     * Definition 默认 props 完全一致，才能让重置回到新建 Text 的排版。
     */
    const defaultValue = {
      text: DEFAULT_TEXT_PROPS.text as string,
      color: DEFAULT_TEXT_PROPS.color as string,
      fontSize: defaultFontSize,
      ...DEFAULT_TEXT_TYPOGRAPHY_PROPS,
      lineHeight: defaultTextLineHeight(defaultFontSize),
    }
    return (
      <ComposePropertyPanel
        aria-label={title(zh, `${context.entity.name} content`, `${context.entity.name} 内容`)}
        binding={createPropsBinding(context, visiblePropNames)}
        defaultValue={defaultValue}
        readOnly={context.readOnly}
        renderers={[TEXT_CONTENT_RENDERER]}
        schema={schema}
        value={value}
        onValueChange={(next, change) => {
          const propName = change.path[0]
          if (change.path.length !== 1 || typeof propName !== 'string' || !(propName in next)) {
            return
          }
          dispatchProps(
            context,
            // 只落盘本次编辑的顶层字段；显示用的字体默认值不能被其他字段修改意外固化。
            { ...context.authoredProps, [propName]: change.value as JsonValue },
            idFactory,
          )
        }}
      />
    )
  }
}

/** 创建 Line / Arrow Renderer Props Inspector。 @internal */
export function createShapeRendererInspector(idFactory: InspectorIdFactory) {
  return function ShapeRendererInspector(context: ComposeRendererInspectorProps) {
    const zh = (useComposeI18nContext()?.locale ?? 'zh-CN') === 'zh-CN'
    const props = inspectorBaseProps(context)
    const circle = props.kind === 'circle'
    const fullSchema = v.object({
      stroke: v.pipe(
        SHAPE_RENDERER_PROP_SCHEMAS.stroke,
        v.title(title(zh, 'Stroke', '线条颜色')),
        v.metadata({ propertyPanel: { editor: 'color' } }),
      ),
      strokeWidth: v.pipe(
        SHAPE_RENDERER_PROP_SCHEMAS.strokeWidth,
        v.title(title(zh, 'Stroke width', '线条粗细')),
        v.metadata({ propertyPanel: { unit: 'px' } }),
      ),
      strokeLinecap: v.pipe(
        SHAPE_RENDERER_PROP_SCHEMAS.strokeLinecap,
        v.title(title(zh, 'Line cap', '端点形状')),
        v.metadata({ propertyPanel: { optionLabels: zh
          ? { butt: '平头', round: '圆头', square: '方头' }
          : { butt: 'Butt', round: 'Round', square: 'Square' } } }),
      ),
      strokeDasharray: v.pipe(
        SHAPE_RENDERER_PROP_SCHEMAS.strokeDasharray,
        v.title(title(zh, 'Line style', '线条样式')),
        v.metadata({ propertyPanel: { optionLabels: zh
          ? { none: '实线', '8 4': '虚线', '1 4': '点线' }
          : { none: 'Solid', '8 4': 'Dashed', '1 4': 'Dotted' } } }),
      ),
      markerStart: v.pipe(
        SHAPE_RENDERER_PROP_SCHEMAS.markerStart,
        v.title(title(zh, 'Start arrow', '起点箭头')),
        v.metadata({ propertyPanel: { optionLabels: zh
          ? { none: '无', arrow: '箭头' }
          : { none: 'None', arrow: 'Arrow' } } }),
      ),
      markerEnd: v.pipe(
        SHAPE_RENDERER_PROP_SCHEMAS.markerEnd,
        v.title(title(zh, 'End arrow', '终点箭头')),
        v.metadata({ propertyPanel: { optionLabels: zh
          ? { none: '无', arrow: '箭头' }
          : { none: 'None', arrow: 'Arrow' } } }),
      ),
    })
    const schema = circle
      ? v.pick(fullSchema, ['stroke', 'strokeWidth'])
      : fullSchema
    const value = {
      stroke: typeof props.stroke === 'string' ? props.stroke : '#d8e2f1',
      strokeWidth: typeof props.strokeWidth === 'number' && props.strokeWidth >= 0
        ? props.strokeWidth
        : 2,
      strokeLinecap: props.strokeLinecap === 'round' || props.strokeLinecap === 'square'
        ? props.strokeLinecap
        : 'butt' as const,
      strokeDasharray: props.strokeDasharray === '8 4' || props.strokeDasharray === '1 4'
        ? props.strokeDasharray
        : 'none' as const,
      markerStart: props.markerStart === 'arrow' ? 'arrow' as const : 'none' as const,
      markerEnd: props.markerEnd === 'arrow' || (props.kind === 'arrow' && props.markerEnd === undefined)
        ? 'arrow' as const
        : 'none' as const,
    }
    return (
      <ComposePropertyPanel
        aria-label={title(zh, `${context.entity.name} line`, `${context.entity.name} 线条`)}
        binding={createPropsBinding(context)}
        readOnly={context.readOnly}
        schema={schema}
        value={value}
        onValueChange={(next, change) => {
          const propName = change.path[0]
          if (change.path.length !== 1 || typeof propName !== 'string' || !(propName in next)) return
          dispatchProps(context, {
            ...context.authoredProps,
            [propName]: change.value as JsonValue,
          }, idFactory)
        }}
      />
    )
  }
}

/**
 * 创建 Page Slot Renderer Props Inspector。
 *
 * @remarks
 * `page` 使用 node 基础 editor；候选与拖入解析由宿主经 `nodeEditPort` 注入，物料不理解
 * 页面目录本身。
 * @internal
 */
export function createPageSlotRendererInspector(idFactory: InspectorIdFactory) {
  return function PageSlotRendererInspector(context: ComposeRendererInspectorProps) {
    const zh = (useComposeI18nContext()?.locale ?? 'zh-CN') === 'zh-CN'
    const schema = v.object({
      page: composeNodePropertySchema({ title: title(zh, 'Page', '页面') }),
    })
    const props = inspectorBaseProps(context)
    const value = { page: (props.page ?? null) as never }
    return (
      <ComposePropertyPanel
        aria-label={title(zh, `${context.entity.name} content`, `${context.entity.name} 内容`)}
        binding={createPropsBinding(context)}
        defaultValue={{ page: null as never }}
        nodeEditor={context.nodeEditPort}
        readOnly={context.readOnly}
        schema={schema}
        value={value}
        onValueChange={(next) => dispatchProps(
          context,
          // setRendererProps 是整体替换语义；schema 之外的宿主 props 必须原样保留。
          { ...context.authoredProps, ...next } as JsonObject,
          idFactory,
        )}
      />
    )
  }
}

/** 创建 Image Renderer Props Inspector。 @internal */
export function createImageRendererInspector(idFactory: InspectorIdFactory) {
  return function ImageRendererInspector(context: ComposeRendererInspectorProps) {
    const zh = (useComposeI18nContext()?.locale ?? 'zh-CN') === 'zh-CN'
    const schema = v.object({
      alt: v.pipe(
        IMAGE_RENDERER_PROP_SCHEMAS.alt,
        v.title(title(zh, 'Alternative text', '替代文本')),
      ),
      fit: v.pipe(
        IMAGE_RENDERER_PROP_SCHEMAS.fit,
        v.title(title(zh, 'Fit', '适配方式')),
      ),
    })
    const props = inspectorBaseProps(context)
    const value = {
      alt: typeof props.alt === 'string'
        ? props.alt
        : context.entity.name,
      fit: (
        typeof props.fit === 'string'
          ? props.fit
          : DEFAULT_IMAGE_PROPS.fit
      ) as 'contain' | 'cover' | 'fill' | 'none' | 'scale-down',
    }
    const defaultValue = {
      alt: DEFAULT_IMAGE_PROPS.alt as string,
      fit: DEFAULT_IMAGE_PROPS.fit as 'contain' | 'cover' | 'fill' | 'none' | 'scale-down',
    }
    return (
      <ComposePropertyPanel
        aria-label={title(zh, `${context.entity.name} content`, `${context.entity.name} 内容`)}
        binding={createPropsBinding(context)}
        defaultValue={defaultValue}
        readOnly={context.readOnly}
        schema={schema}
        value={value}
        onValueChange={(next) => dispatchProps(
          context,
          { ...context.authoredProps, ...next },
          idFactory,
        )}
      />
    )
  }
}

/** 创建 SVG Renderer Props Inspector。 @internal */
export function createSvgRendererInspector(idFactory: InspectorIdFactory) {
  return function SvgRendererInspector(context: ComposeRendererInspectorProps) {
    const zh = (useComposeI18nContext()?.locale ?? 'zh-CN') === 'zh-CN'
    const schema = v.object({
      alt: v.pipe(
        SVG_RENDERER_PROP_SCHEMAS.alt,
        v.title(title(zh, 'Alternative text', '替代文本')),
      ),
      fit: v.pipe(
        SVG_RENDERER_PROP_SCHEMAS.fit,
        v.title(title(zh, 'Fit', '适配方式')),
      ),
      overrideFill: v.pipe(
        SVG_RENDERER_PROP_SCHEMAS.overrideFill,
        v.title(title(zh, 'Override fill', '覆盖填充')),
      ),
      fillColor: v.pipe(
        SVG_RENDERER_PROP_SCHEMAS.fillColor,
        v.title(title(zh, 'Fill color', '填充颜色')),
        v.metadata({ propertyPanel: { editor: 'color' } }),
      ),
      overrideStroke: v.pipe(
        SVG_RENDERER_PROP_SCHEMAS.overrideStroke,
        v.title(title(zh, 'Override stroke', '覆盖描边')),
      ),
      strokeColor: v.pipe(
        SVG_RENDERER_PROP_SCHEMAS.strokeColor,
        v.title(title(zh, 'Stroke color', '描边颜色')),
        v.metadata({ propertyPanel: { editor: 'color' } }),
      ),
    })
    const props = inspectorBaseProps(context)
    const value = {
      alt: typeof props.alt === 'string' ? props.alt : context.entity.name,
      fit: (props.fit === 'cover' || props.fit === 'fill' ? props.fit : 'contain') as
        'contain' | 'cover' | 'fill',
      overrideFill: props.overrideFill === true,
      fillColor: typeof props.fillColor === 'string'
        ? props.fillColor
        : DEFAULT_SVG_PROPS.fillColor as string,
      overrideStroke: props.overrideStroke === true,
      strokeColor: typeof props.strokeColor === 'string'
        ? props.strokeColor
        : DEFAULT_SVG_PROPS.strokeColor as string,
    }
    const defaultValue = {
      alt: DEFAULT_SVG_PROPS.alt as string,
      fit: DEFAULT_SVG_PROPS.fit as 'contain' | 'cover' | 'fill',
      overrideFill: DEFAULT_SVG_PROPS.overrideFill as boolean,
      fillColor: DEFAULT_SVG_PROPS.fillColor as string,
      overrideStroke: DEFAULT_SVG_PROPS.overrideStroke as boolean,
      strokeColor: DEFAULT_SVG_PROPS.strokeColor as string,
    }
    return (
      <ComposePropertyPanel
        aria-label={title(zh, `${context.entity.name} content`, `${context.entity.name} 内容`)}
        binding={createPropsBinding(context)}
        defaultValue={defaultValue}
        readOnly={context.readOnly}
        schema={schema}
        value={value}
        onValueChange={(next) => dispatchProps(
          context,
          { ...context.authoredProps, ...next },
          idFactory,
        )}
      />
    )
  }
}
