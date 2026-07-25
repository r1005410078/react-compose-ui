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
    shadowX: title('shadowX', 'Shadow X', '阴影 X'),
    shadowY: title('shadowY', 'Shadow Y', '阴影 Y'),
    shadowBlur: title('shadowBlur', 'Shadow blur', '阴影模糊'),
    shadowSpread: title('shadowSpread', 'Shadow spread', '阴影扩散'),
    name: title('name', 'Name', '名称'),
    x: title('x', 'X', 'X'),
    y: title('y', 'Y', 'Y'),
    width: title('width', 'Width', '宽度'),
    height: title('height', 'Height', '高度'),
    rotation: title('rotation', 'Rotation', '旋转'),
    backgroundColor: title('backgroundColor', 'Background', '背景'),
    borderColor: title('borderColor', 'Border color', '边框颜色'),
    borderWidth: title('borderWidth', 'Border width', '边框宽度'),
    borderRadius: title('borderRadius', 'Border radius', '圆角'),
    opacity: title('opacity', 'Opacity', '不透明度'),
    shadow: title('shadow', 'Shadow', '阴影'),
    text: title('text', 'Text', '文本'),
    color: title('color', 'Text color', '文字颜色'),
    fontSize: title('fontSize', 'Font size', '字号'),
  }
}

/** 按共享语言创建 Frame、Group 与 Component 共用的容器属性 Schema。 @internal */
export function createContainerSchema(
  locale: ComposeLocale,
  formatMessage?: FormatMessage,
) {
  const titles = createTitles(locale, formatMessage)
  const shadowSchema = v.nullable(v.object({
    color: v.pipe(v.string(), v.title(titles.shadowColor)),
    offsetX: v.pipe(v.number(), v.title(titles.shadowX)),
    offsetY: v.pipe(v.number(), v.title(titles.shadowY)),
    blur: v.pipe(v.number(), v.minValue(0), v.title(titles.shadowBlur)),
    spread: v.pipe(v.number(), v.title(titles.shadowSpread)),
  }))
  return v.object({
    name: v.pipe(v.string(), v.minLength(1), v.title(titles.name)),
    x: v.pipe(v.number(), v.title(titles.x)),
    y: v.pipe(v.number(), v.title(titles.y)),
    width: v.pipe(v.number(), v.minValue(0.000001), v.title(titles.width)),
    height: v.pipe(v.number(), v.minValue(0.000001), v.title(titles.height)),
    rotation: v.pipe(v.number(), v.title(titles.rotation)),
    backgroundColor: v.pipe(v.string(), v.minLength(1), v.title(titles.backgroundColor)),
    borderColor: v.pipe(v.string(), v.minLength(1), v.title(titles.borderColor)),
    borderWidth: v.pipe(v.number(), v.minValue(0), v.title(titles.borderWidth)),
    borderRadius: v.pipe(v.number(), v.minValue(0), v.title(titles.borderRadius)),
    opacity: v.pipe(v.number(), v.minValue(0), v.maxValue(1), v.title(titles.opacity)),
    shadow: v.pipe(shadowSchema, v.title(titles.shadow)),
  })
}

/** Frame、Group 与 Component 共用的英文兼容 Schema。 @internal */
export const containerSchema = createContainerSchema('en-US')

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
    color: v.pipe(v.string(), v.minLength(1), v.title(titles.color)),
    fontSize: v.pipe(v.number(), v.minValue(1), v.title(titles.fontSize)),
  })
}

/** Text 的英文兼容 Schema。 @internal */
export const textSchema = createTextSchema('en-US')

/** 通用 Container Inspector 表单值。 @internal */
export type ContainerValue = v.InferInput<typeof containerSchema>

/** Text Inspector 表单值。 @internal */
export type TextValue = v.InferInput<typeof textSchema>
