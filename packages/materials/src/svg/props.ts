import * as v from 'valibot'

/** SVG Renderer 对外公开的顶层 Props Schema；Inspector 与绑定 Contract 共用。 @internal */
export const SVG_RENDERER_PROP_SCHEMAS = Object.freeze({
  asset: v.nullable(v.object({
    providerId: v.pipe(v.string(), v.minLength(1)),
    assetKey: v.pipe(v.string(), v.minLength(1)),
    scope: v.picklist(['persistent', 'session']),
  })),
  alt: v.string(),
  fit: v.picklist(['contain', 'cover', 'fill']),
  overrideFill: v.boolean(),
  fillColor: v.string(),
  overrideStroke: v.boolean(),
  strokeColor: v.string(),
})
