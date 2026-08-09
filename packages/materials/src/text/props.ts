import * as v from 'valibot'

/** Text Renderer 对外公开的顶层 Props Schema；Inspector 与绑定 Contract 共用。 @internal */
export const TEXT_RENDERER_PROP_SCHEMAS = Object.freeze({
  text: v.union([v.string(), v.number()]),
  color: v.pipe(v.string(), v.minLength(1)),
  fontSize: v.pipe(v.number(), v.minValue(1)),
  fontFamily: v.pipe(v.string(), v.minLength(1)),
  fontWeight: v.union([v.string(), v.number()]),
  letterSpacing: v.number(),
  lineHeight: v.pipe(v.number(), v.minValue(0)),
})
