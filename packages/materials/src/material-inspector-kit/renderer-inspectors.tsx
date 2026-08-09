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
import { IMAGE_RENDERER_PROP_SCHEMAS } from '../image/props'
import { SVG_RENDERER_PROP_SCHEMAS } from '../svg/props'
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
    const fontSize = typeof props.fontSize === 'number' ? props.fontSize : 24
    const value = {
      text: typeof props.text === 'string' || typeof props.text === 'number'
        ? props.text
        : 'Text',
      color: typeof props.color === 'string'
        ? props.color
        : '#172033',
      fontSize,
      fontFamily: typeof props.fontFamily === 'string' ? props.fontFamily : 'sans-serif',
      fontWeight: typeof props.fontWeight === 'string' || typeof props.fontWeight === 'number'
        ? props.fontWeight
        : 400,
      letterSpacing: typeof props.letterSpacing === 'number' ? props.letterSpacing : 0,
      lineHeight: typeof props.lineHeight === 'number'
        ? props.lineHeight
        : Math.round(fontSize * 120) / 100,
    }
    return (
      <ComposePropertyPanel
        aria-label={title(zh, `${context.entity.name} content`, `${context.entity.name} 内容`)}
        binding={createPropsBinding(context, visiblePropNames)}
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
          : 'contain'
      ) as 'contain' | 'cover' | 'fill' | 'none' | 'scale-down',
    }
    return (
      <ComposePropertyPanel
        aria-label={title(zh, `${context.entity.name} content`, `${context.entity.name} 内容`)}
        binding={createPropsBinding(context)}
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
      fillColor: typeof props.fillColor === 'string' ? props.fillColor : '#ffffff',
      overrideStroke: props.overrideStroke === true,
      strokeColor: typeof props.strokeColor === 'string' ? props.strokeColor : '#ffffff',
    }
    return (
      <ComposePropertyPanel
        aria-label={title(zh, `${context.entity.name} content`, `${context.entity.name} 内容`)}
        binding={createPropsBinding(context)}
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
