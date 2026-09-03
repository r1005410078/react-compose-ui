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
import { CURVE_RENDERER_PROP_SCHEMAS } from '../curve/props'
import { readComponentInstanceAnimations } from '../component-instance/animation'
import { TEXT_RENDERER_PROP_SCHEMAS } from '../text/props'

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
      textAlign: v.pipe(
        TEXT_RENDERER_PROP_SCHEMAS.textAlign,
        v.title(title(zh, 'Horizontal alignment', '水平对齐')),
        v.metadata({ propertyPanel: { optionLabels: zh
          ? { left: '左', center: '居中', right: '右', justify: '两端对齐' }
          : { left: 'Left', center: 'Center', right: 'Right', justify: 'Justify' } } }),
      ),
      verticalAlign: v.pipe(
        TEXT_RENDERER_PROP_SCHEMAS.verticalAlign,
        v.title(title(zh, 'Vertical alignment', '垂直对齐')),
        v.metadata({ propertyPanel: { optionLabels: zh
          ? { top: '顶部', middle: '居中', bottom: '底部' }
          : { top: 'Top', middle: 'Middle', bottom: 'Bottom' } } }),
      ),
      textCase: v.pipe(
        TEXT_RENDERER_PROP_SCHEMAS.textCase,
        v.title(title(zh, 'Text case', '大小写')),
        v.metadata({ propertyPanel: { optionLabels: zh
          ? { original: '原样', uppercase: '大写', lowercase: '小写', capitalize: '首字母大写', 'small-caps': '小型大写' }
          : { original: 'Original', uppercase: 'Uppercase', lowercase: 'Lowercase', capitalize: 'Capitalize', 'small-caps': 'Small caps' } } }),
      ),
      textDecoration: v.pipe(
        TEXT_RENDERER_PROP_SCHEMAS.textDecoration,
        v.title(title(zh, 'Text decoration', '文字装饰')),
        v.metadata({ propertyPanel: { optionLabels: zh
          ? { none: '无', underline: '下划线', 'line-through': '删除线' }
          : { none: 'None', underline: 'Underline', 'line-through': 'Strikethrough' } } }),
      ),
    })
    const visiblePropNames = context.propCategory?.id === 'text'
      ? new Set(['text', 'color'])
      : context.propCategory?.id === 'typography'
        ? new Set([
            'fontSize', 'fontFamily', 'fontWeight', 'letterSpacing', 'lineHeight',
            'textAlign', 'verticalAlign', 'textCase', 'textDecoration',
          ])
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
            'textAlign',
            'verticalAlign',
            'textCase',
            'textDecoration',
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
      textAlign: props.textAlign === 'center' || props.textAlign === 'right' || props.textAlign === 'justify'
        ? props.textAlign
        : DEFAULT_TEXT_TYPOGRAPHY_PROPS.textAlign,
      verticalAlign: props.verticalAlign === 'top' || props.verticalAlign === 'bottom'
        ? props.verticalAlign
        // 缺失字段的旧文档仍按当前 renderer 的居中行为展示。
        : 'middle',
      textCase: props.textCase === 'uppercase'
        || props.textCase === 'lowercase'
        || props.textCase === 'capitalize'
        || props.textCase === 'small-caps'
        ? props.textCase
        : DEFAULT_TEXT_TYPOGRAPHY_PROPS.textCase,
      textDecoration: props.textDecoration === 'underline' || props.textDecoration === 'line-through'
        ? props.textDecoration
        : DEFAULT_TEXT_TYPOGRAPHY_PROPS.textDecoration,
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

/** 创建 Curve Renderer 描边 Inspector。 @internal */
export function createCurveRendererInspector(idFactory: InspectorIdFactory) {
  return function CurveRendererInspector(context: ComposeRendererInspectorProps) {
    const zh = (useComposeI18nContext()?.locale ?? 'zh-CN') === 'zh-CN'
    const props = inspectorBaseProps(context)
    const schema = v.object({
      stroke: v.pipe(
        CURVE_RENDERER_PROP_SCHEMAS.stroke,
        v.title(title(zh, 'Stroke', '线条颜色')),
        v.metadata({ propertyPanel: { editor: 'color' } }),
      ),
      strokeWidth: v.pipe(
        CURVE_RENDERER_PROP_SCHEMAS.strokeWidth,
        v.title(title(zh, 'Stroke width', '线条粗细')),
        v.metadata({ propertyPanel: { unit: 'px' } }),
      ),
      strokeLinecap: v.pipe(
        CURVE_RENDERER_PROP_SCHEMAS.strokeLinecap,
        v.title(title(zh, 'Line cap', '端点形状')),
        v.metadata({ propertyPanel: { optionLabels: zh
          ? { butt: '平头', round: '圆头', square: '方头' }
          : { butt: 'Butt', round: 'Round', square: 'Square' } } }),
      ),
      strokeDasharray: v.pipe(
        CURVE_RENDERER_PROP_SCHEMAS.strokeDasharray,
        v.title(title(zh, 'Line style', '线条样式')),
        v.metadata({ propertyPanel: { optionLabels: zh
          ? { none: '实线', '8 4': '虚线', '1 4': '点线' }
          : { none: 'Solid', '8 4': 'Dashed', '1 4': 'Dotted' } } }),
      ),
      strokeDashoffset: v.pipe(
        CURVE_RENDERER_PROP_SCHEMAS.strokeDashoffset,
        v.title(title(zh, 'Dash offset', '虚线偏移')),
      ),
      markerStart: v.pipe(
        CURVE_RENDERER_PROP_SCHEMAS.markerStart,
        v.title(title(zh, 'Start arrow', '起点箭头')),
        v.metadata({ propertyPanel: { optionLabels: zh
          ? { none: '无', arrow: '箭头' }
          : { none: 'None', arrow: 'Arrow' } } }),
      ),
      markerEnd: v.pipe(
        CURVE_RENDERER_PROP_SCHEMAS.markerEnd,
        v.title(title(zh, 'End arrow', '终点箭头')),
        v.metadata({ propertyPanel: { optionLabels: zh
          ? { none: '无', arrow: '箭头' }
          : { none: 'None', arrow: 'Arrow' } } }),
      ),
    })
    const value = {
      stroke: typeof props.stroke === 'string' ? props.stroke : '#d8e2f1',
      strokeWidth: typeof props.strokeWidth === 'number' && props.strokeWidth >= 0
        ? props.strokeWidth
        : 2,
      markerStart: props.markerStart === 'arrow' ? 'arrow' as const : 'none' as const,
      markerEnd: props.markerEnd === 'arrow' ? 'arrow' as const : 'none' as const,
      strokeLinecap: props.strokeLinecap === 'butt'
        ? 'butt' as const
        : props.strokeLinecap === 'square' ? 'square' as const : 'round' as const,
      strokeDasharray: props.strokeDasharray === '8 4'
        ? '8 4' as const
        : props.strokeDasharray === '1 4' ? '1 4' as const : 'none' as const,
      // 缺席即 0：偏移 0 就是不偏移，面板显示 0 与渲染不写该属性说的是同一件事。
      strokeDashoffset: typeof props.strokeDashoffset === 'number'
        && Number.isFinite(props.strokeDashoffset)
        ? props.strokeDashoffset
        : 0,
    }
    return (
      <ComposePropertyPanel
        aria-label={title(zh, `${context.entity.name} stroke`, `${context.entity.name} 描边`)}
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

/**
 * 创建组件实例的动画 Inspector：选一条动画，给一个播放头。
 *
 * @remarks
 * 下拉的选项来自实例保存的 `resolvedSnapshot`，因此 schema 每次渲染现建——组件换了、
 * 动画增删了，选项跟着变。这与其余物料的静态 schema 不同，是数据本身决定的。
 *
 * **失效 id 保留在下拉里并标注**：`animation` 指向清单中已不存在的动画时，把当前值作为一个
 * 额外条目留下，而不是静默回落到「未选择」。「还没配」与「配错了」必须可区分——静默清空会
 * 让「组件作者临时改错了一个 id」在用户那边表现成「我的配置被吃掉了」。
 *
 * 两条 Prop 都进 `inspectorPropNames`，因此各自带一个绑定入口：逐实例绑到不同的页面导出，
 * 正是同一个组件的多个实例各走各的播放头的实现方式。
 *
 * @internal
 */
export function createComponentInstanceAnimationInspector(idFactory: InspectorIdFactory) {
  const UNSET = ''
  return function ComponentInstanceAnimationInspector(context: ComposeRendererInspectorProps) {
    const zh = (useComposeI18nContext()?.locale ?? 'zh-CN') === 'zh-CN'
    const props = inspectorBaseProps(context)
    /*
     * 自定义 Inspector 按 `propCategory` 每个分类渲染一次：不过滤的话同一批字段在
     * 「动画」与「内容」两个分组里各画一遍，屏幕上出现两个一模一样的下拉。
     */
    const category = context.propCategory?.id
    const showAnimation = category === undefined || category === 'animation'
    const showContent = category === undefined || category === 'content'
    const animations = readComponentInstanceAnimations(props.resolvedSnapshot)
    const selected = typeof props.animation === 'string' && props.animation.length > 0
      ? props.animation
      : UNSET
    const stale = selected !== UNSET && !animations.some((item) => item.id === selected)
    const optionIds = [UNSET, ...animations.map((item) => item.id), ...(stale ? [selected] : [])]
    const optionLabels: Record<string, string> = {
      [UNSET]: title(zh, 'None', '未选择'),
      ...Object.fromEntries(animations.map((item) => [item.id, item.name || item.id])),
      ...(stale
        ? { [selected]: title(zh, `Missing: ${selected}`, `已失效：${selected}`) }
        : {}),
    }
    const fullSchema = v.object({
      animation: v.pipe(
        v.picklist(optionIds),
        v.title(title(zh, 'Animation', '动画')),
        v.metadata({ propertyPanel: { optionLabels } }),
      ),
      animationTime: v.pipe(
        v.number(),
        v.title(title(zh, 'Playhead', '播放头')),
        v.metadata({ propertyPanel: { unit: 'ms' } }),
      ),
      contentFit: v.pipe(
        v.picklist(['layout', 'scale']),
        v.title(title(zh, 'Content fit', '内容适配')),
        v.metadata({
          propertyPanel: {
            optionLabels: {
              layout: title(zh, 'Reflow', '重排布局'),
              scale: title(zh, 'Scale', '整体缩放'),
            },
          },
        }),
      ),
    })
    const schema = category === 'content'
      ? v.pick(fullSchema, ['contentFit'])
      : category === 'animation'
        ? v.pick(fullSchema, ['animation', 'animationTime'])
        : fullSchema
    const value = {
      animation: selected,
      animationTime: typeof props.animationTime === 'number' && Number.isFinite(props.animationTime)
        ? props.animationTime
        : 0,
      // 缺席即 'layout'：默认值不写成显式值，与 fillRule 缺席即 nonzero 同一条判断。
      contentFit: props.contentFit === 'scale' ? 'scale' as const : 'layout' as const,
    }
    const panelLabel = category === 'content'
      ? title(zh, `${context.entity.name} content`, `${context.entity.name} 内容`)
      : title(zh, `${context.entity.name} animation`, `${context.entity.name} 动画`)
    const visiblePropNames = new Set([
      ...(showAnimation ? ['animation', 'animationTime'] : []),
      ...(showContent ? ['contentFit'] : []),
    ])
    return (
      <ComposePropertyPanel
        aria-label={panelLabel}
        binding={createPropsBinding(context, visiblePropNames)}
        readOnly={context.readOnly}
        schema={schema}
        value={value}
        onValueChange={(next, change) => {
          const propName = change.path[0]
          if (change.path.length !== 1 || typeof propName !== 'string' || !(propName in next)) return
          // 面板里「未选择」是空串，文档里是 null——空串不是一个动画 id。
          // 内容适配同理：'layout' 是默认值，不写成显式值，写 null 表示回到默认。
          const written = (propName === 'animation' && change.value === UNSET)
            || (propName === 'contentFit' && change.value === 'layout')
            ? null
            : change.value as JsonValue
          dispatchProps(context, {
            ...context.authoredProps,
            [propName]: written,
          }, idFactory)
        }}
      />
    )
  }
}
