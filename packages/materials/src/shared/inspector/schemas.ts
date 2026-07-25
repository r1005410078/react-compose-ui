import * as v from 'valibot'

const shadowSchema = v.nullable(v.object({
  color: v.pipe(v.string(), v.title('Shadow color')),
  offsetX: v.pipe(v.number(), v.title('Shadow X')),
  offsetY: v.pipe(v.number(), v.title('Shadow Y')),
  blur: v.pipe(v.number(), v.minValue(0), v.title('Shadow blur')),
  spread: v.pipe(v.number(), v.title('Shadow spread')),
}))

/** Frame、Group 与 Component 共用的容器属性 Schema。 @internal */
export const containerSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.title('Name')),
  x: v.pipe(v.number(), v.title('X')),
  y: v.pipe(v.number(), v.title('Y')),
  width: v.pipe(v.number(), v.minValue(0.000001), v.title('Width')),
  height: v.pipe(v.number(), v.minValue(0.000001), v.title('Height')),
  rotation: v.pipe(v.number(), v.title('Rotation')),
  backgroundColor: v.pipe(v.string(), v.minLength(1), v.title('Background')),
  borderColor: v.pipe(v.string(), v.minLength(1), v.title('Border color')),
  borderWidth: v.pipe(v.number(), v.minValue(0), v.title('Border width')),
  borderRadius: v.pipe(v.number(), v.minValue(0), v.title('Border radius')),
  opacity: v.pipe(v.number(), v.minValue(0), v.maxValue(1), v.title('Opacity')),
  shadow: v.pipe(shadowSchema, v.title('Shadow')),
})

/** Text 在通用容器字段上增加文字 props 的 Schema。 @internal */
export const textSchema = v.object({
  ...containerSchema.entries,
  text: v.pipe(v.string(), v.title('Text')),
  color: v.pipe(v.string(), v.minLength(1), v.title('Text color')),
  fontSize: v.pipe(v.number(), v.minValue(1), v.title('Font size')),
})

/** 通用 Container Inspector 表单值。 @internal */
export type ContainerValue = v.InferInput<typeof containerSchema>

/** Text Inspector 表单值。 @internal */
export type TextValue = v.InferInput<typeof textSchema>
