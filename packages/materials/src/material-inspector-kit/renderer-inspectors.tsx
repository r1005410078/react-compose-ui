import * as v from 'valibot'
import { ComposePropertyPanel } from '@compose-ui/property-panel'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import {
  BUILTIN_COMMAND_TYPES,
  type EditorCommand,
  type JsonObject,
} from '@compose-ui/core'
import type { ComposeRendererInspectorProps } from '@compose-ui/component-registry'
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

function title(
  zh: boolean,
  english: string,
  chinese: string,
) {
  return zh ? chinese : english
}

/** 创建 Text Renderer 内容 Inspector。 @internal */
export function createTextRendererInspector(idFactory: InspectorIdFactory) {
  return function TextRendererInspector(context: ComposeRendererInspectorProps) {
    const zh = (useComposeI18nContext()?.locale ?? 'zh-CN') === 'zh-CN'
    const schema = v.object({
      text: v.pipe(v.string(), v.title(title(zh, 'Text', '文本'))),
      color: v.pipe(
        v.string(),
        v.minLength(1),
        v.title(title(zh, 'Text color', '文字颜色')),
        v.metadata({ propertyPanel: { editor: 'color' } }),
      ),
      fontSize: v.pipe(v.number(), v.minValue(1), v.title(title(zh, 'Font size', '字号'))),
    })
    const value = {
      text: typeof context.renderer.props.text === 'string'
        ? context.renderer.props.text
        : 'Text',
      color: typeof context.renderer.props.color === 'string'
        ? context.renderer.props.color
        : '#172033',
      fontSize: typeof context.renderer.props.fontSize === 'number'
        ? context.renderer.props.fontSize
        : 24,
    }
    return (
      <ComposePropertyPanel
        aria-label={title(zh, `${context.entity.name} content`, `${context.entity.name} 内容`)}
        readOnly={context.readOnly}
        schema={schema}
        value={value}
        onValueChange={(next) => dispatchProps(
          context,
          // setRendererProps 是整体替换语义；schema 之外的宿主 props 必须原样保留。
          { ...context.renderer.props, ...next },
          idFactory,
        )}
      />
    )
  }
}

/**
 * 创建 Page Slot Renderer 内容 Inspector。
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
    const value = { page: (context.renderer.props.page ?? null) as never }
    return (
      <ComposePropertyPanel
        aria-label={title(zh, `${context.entity.name} content`, `${context.entity.name} 内容`)}
        nodeEditor={context.nodeEditPort}
        readOnly={context.readOnly}
        schema={schema}
        value={value}
        onValueChange={(next) => dispatchProps(
          context,
          // setRendererProps 是整体替换语义；schema 之外的宿主 props 必须原样保留。
          { ...context.renderer.props, ...next } as JsonObject,
          idFactory,
        )}
      />
    )
  }
}

/** 创建 Image Renderer 内容 Inspector。 @internal */
export function createImageRendererInspector(idFactory: InspectorIdFactory) {
  return function ImageRendererInspector(context: ComposeRendererInspectorProps) {
    const zh = (useComposeI18nContext()?.locale ?? 'zh-CN') === 'zh-CN'
    const schema = v.object({
      alt: v.pipe(v.string(), v.title(title(zh, 'Alternative text', '替代文本'))),
      fit: v.pipe(
        v.picklist(['contain', 'cover', 'fill', 'none', 'scale-down']),
        v.title(title(zh, 'Fit', '适配方式')),
      ),
    })
    const value = {
      alt: typeof context.renderer.props.alt === 'string'
        ? context.renderer.props.alt
        : context.entity.name,
      fit: (
        typeof context.renderer.props.fit === 'string'
          ? context.renderer.props.fit
          : 'contain'
      ) as 'contain' | 'cover' | 'fill' | 'none' | 'scale-down',
    }
    return (
      <ComposePropertyPanel
        aria-label={title(zh, `${context.entity.name} content`, `${context.entity.name} 内容`)}
        readOnly={context.readOnly}
        schema={schema}
        value={value}
        onValueChange={(next) => dispatchProps(
          context,
          { ...context.renderer.props, ...next },
          idFactory,
        )}
      />
    )
  }
}

/** 创建 SVG Renderer 内容 Inspector。 @internal */
export function createSvgRendererInspector(idFactory: InspectorIdFactory) {
  return function SvgRendererInspector(context: ComposeRendererInspectorProps) {
    const zh = (useComposeI18nContext()?.locale ?? 'zh-CN') === 'zh-CN'
    const schema = v.object({
      alt: v.pipe(v.string(), v.title(title(zh, 'Alternative text', '替代文本'))),
      fit: v.pipe(
        v.picklist(['contain', 'cover', 'fill']),
        v.title(title(zh, 'Fit', '适配方式')),
      ),
      overrideFill: v.pipe(v.boolean(), v.title(title(zh, 'Override fill', '覆盖填充'))),
      fillColor: v.pipe(
        v.string(),
        v.title(title(zh, 'Fill color', '填充颜色')),
        v.metadata({ propertyPanel: { editor: 'color' } }),
      ),
      overrideStroke: v.pipe(v.boolean(), v.title(title(zh, 'Override stroke', '覆盖描边'))),
      strokeColor: v.pipe(
        v.string(),
        v.title(title(zh, 'Stroke color', '描边颜色')),
        v.metadata({ propertyPanel: { editor: 'color' } }),
      ),
    })
    const props = context.renderer.props
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
        readOnly={context.readOnly}
        schema={schema}
        value={value}
        onValueChange={(next) => dispatchProps(
          context,
          { ...context.renderer.props, ...next },
          idFactory,
        )}
      />
    )
  }
}
