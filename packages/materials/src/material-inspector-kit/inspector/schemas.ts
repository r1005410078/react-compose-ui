import * as v from 'valibot'
import type { ComposeLocale } from '@compose-ui/ui-context'

type FormatMessage = (
  id: string,
  fallback: string,
  variables?: Readonly<Record<string, string | number>>,
) => string

function createTitles(
  locale: ComposeLocale,
  formatMessage: FormatMessage = (_id, fallback) => fallback,
) {
  const zh = locale === 'zh-CN'
  const title = (id: string, en: string, chinese: string) =>
    formatMessage(`materials.field.${id}`, zh ? chinese : en)
  return {
    shadowColor: title('shadowColor', 'Shadow color', '阴影颜色'),
    shadowOffset: title('shadowOffset', 'Shadow offset', '阴影偏移'),
    shadowBlur: title('shadowBlur', 'Shadow blur', '阴影模糊'),
    shadowSpread: title('shadowSpread', 'Shadow spread', '阴影扩散'),
    name: title('name', 'Name', '名称'),
    position: title('position', 'Position', '位置'),
    size: title('size', 'Size', '尺寸'),
    rotation: title('rotation', 'Rotation', '旋转'),
    visible: title('visible', 'Visibility', '可见性'),
    clipContent: title('clipContent', 'Clip content', '裁剪内容'),
    backgroundColor: title('backgroundColor', 'Background', '背景'),
    borderColor: title('borderColor', 'Border color', '边框颜色'),
    borderWidth: title('borderWidth', 'Border width', '边框宽度'),
    borderRadius: title('borderRadius', 'Border radius', '圆角'),
    opacity: title('opacity', 'Opacity', '不透明度'),
    shadow: title('shadow', 'Shadow', '阴影'),
    text: title('text', 'Text', '文本'),
    color: title('color', 'Text color', '文字颜色'),
    fontSize: title('fontSize', 'Font size', '字号'),
    alt: title('alt', 'Alternative text', '替代文本'),
    fit: title('fit', 'Fit', '适配方式'),
    overrideFill: title('overrideFill', 'Override fill', '覆盖填充'),
    fillColor: title('fillColor', 'Fill color', '填充颜色'),
    overrideStroke: title('overrideStroke', 'Override stroke', '覆盖描边'),
    strokeColor: title('strokeColor', 'Stroke color', '描边颜色'),
  }
}

/** 按共享语言创建 Frame 与 Component 共用的视觉和变换 Schema。 @internal */
export function createContainerSchema(
  locale: ComposeLocale,
  formatMessage?: FormatMessage,
) {
  const titles = createTitles(locale, formatMessage)
  const shadowSchema = v.nullable(v.object({
    color: v.pipe(
      v.string(),
      v.title(titles.shadowColor),
      v.metadata({ propertyPanel: { editor: 'color' } }),
    ),
    offset: v.pipe(
      v.object({ x: v.number(), y: v.number() }),
      v.title(titles.shadowOffset),
      v.metadata({ propertyPanel: { editor: 'vector2' } }),
    ),
    blur: v.pipe(v.number(), v.minValue(0), v.title(titles.shadowBlur)),
    spread: v.pipe(v.number(), v.title(titles.shadowSpread)),
  }))
  return v.object({
    name: v.pipe(v.string(), v.minLength(1), v.title(titles.name)),
    position: v.pipe(
      v.object({ x: v.number(), y: v.number() }),
      v.title(titles.position),
      v.metadata({ propertyPanel: { editor: 'vector2' } }),
    ),
    size: v.pipe(
      v.object({
        width: v.pipe(v.number(), v.minValue(0.000001)),
        height: v.pipe(v.number(), v.minValue(0.000001)),
      }),
      v.title(titles.size),
      v.metadata({ propertyPanel: { editor: 'size' } }),
    ),
    rotation: v.pipe(
      v.number(),
      v.title(titles.rotation),
      v.metadata({ propertyPanel: { editor: 'angle' } }),
    ),
    visible: v.pipe(
      v.boolean(),
      v.title(titles.visible),
      v.metadata({ propertyPanel: { editor: 'visibility' } }),
    ),
    backgroundColor: v.pipe(
      v.string(),
      v.minLength(1),
      v.title(titles.backgroundColor),
      v.metadata({ propertyPanel: { editor: 'color' } }),
    ),
    borderColor: v.pipe(
      v.string(),
      v.minLength(1),
      v.title(titles.borderColor),
      v.metadata({ propertyPanel: { editor: 'color' } }),
    ),
    borderWidth: v.pipe(
      v.number(),
      v.minValue(0),
      v.title(titles.borderWidth),
      v.metadata({ propertyPanel: { editor: 'stroke-width' } }),
    ),
    borderRadius: v.pipe(
      v.number(),
      v.minValue(0),
      v.title(titles.borderRadius),
      v.metadata({ propertyPanel: { editor: 'corner-radius' } }),
    ),
    opacity: v.pipe(
      v.number(),
      v.minValue(0),
      v.maxValue(1),
      v.title(titles.opacity),
      v.metadata({ propertyPanel: { editor: 'opacity' } }),
    ),
    shadow: v.pipe(shadowSchema, v.title(titles.shadow)),
  })
}

/** Frame 与 Component 共用的英文兼容 Schema。 @internal */
export const containerSchema = createContainerSchema('en-US')

/** 按共享语言创建 Frame 专用属性 Schema。 @internal */
export function createFrameSchema(
  locale: ComposeLocale,
  formatMessage?: FormatMessage,
) {
  const container = createContainerSchema(locale, formatMessage)
  const titles = createTitles(locale, formatMessage)
  return v.object({
    ...container.entries,
    clipContent: v.pipe(v.boolean(), v.title(titles.clipContent)),
  })
}

/** 按共享语言创建 Text Inspector Schema。 @internal */
export function createTextSchema(
  locale: ComposeLocale,
  formatMessage?: FormatMessage,
) {
  const container = createContainerSchema(locale, formatMessage)
  const titles = createTitles(locale, formatMessage)
  return v.object({
    ...container.entries,
    text: v.pipe(v.string(), v.title(titles.text)),
    color: v.pipe(
      v.string(),
      v.minLength(1),
      v.title(titles.color),
      v.metadata({ propertyPanel: { editor: 'color' } }),
    ),
    fontSize: v.pipe(v.number(), v.minValue(1), v.title(titles.fontSize)),
  })
}

/** Text 的英文兼容 Schema。 @internal */
export const textSchema = createTextSchema('en-US')

/** 按共享语言创建 Image Inspector Schema。 @internal */
export function createImageSchema(
  locale: ComposeLocale,
  formatMessage?: FormatMessage,
) {
  const container = createContainerSchema(locale, formatMessage)
  const titles = createTitles(locale, formatMessage)
  return v.object({
    ...container.entries,
    alt: v.pipe(v.string(), v.title(titles.alt)),
    fit: v.pipe(
      v.picklist(['contain', 'cover', 'fill', 'none', 'scale-down']),
      v.title(titles.fit),
    ),
  })
}

/** 按共享语言创建 SVG Inspector Schema。 @internal */
export function createSvgSchema(
  locale: ComposeLocale,
  formatMessage?: FormatMessage,
) {
  const image = createImageSchema(locale, formatMessage)
  const titles = createTitles(locale, formatMessage)
  return v.object({
    ...image.entries,
    overrideFill: v.pipe(v.boolean(), v.title(titles.overrideFill)),
    fillColor: v.pipe(
      v.string(),
      v.minLength(1),
      v.title(titles.fillColor),
      v.metadata({ propertyPanel: { editor: 'color' } }),
    ),
    overrideStroke: v.pipe(v.boolean(), v.title(titles.overrideStroke)),
    strokeColor: v.pipe(
      v.string(),
      v.minLength(1),
      v.title(titles.strokeColor),
      v.metadata({ propertyPanel: { editor: 'color' } }),
    ),
  })
}

/** 通用 Container Inspector 表单值。 @internal */
export type ContainerValue = v.InferInput<typeof containerSchema>
/** Frame Inspector 表单值。 @internal */
export type FrameValue = v.InferInput<ReturnType<typeof createFrameSchema>>

/** Text Inspector 表单值。 @internal */
export type TextValue = v.InferInput<typeof textSchema>
/** Image Inspector 表单值。 @internal */
export type ImageValue = v.InferInput<ReturnType<typeof createImageSchema>>
/** SVG Inspector 表单值。 @internal */
export type SvgValue = v.InferInput<ReturnType<typeof createSvgSchema>>
