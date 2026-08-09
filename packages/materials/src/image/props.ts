import * as v from 'valibot'

/** Image Renderer 对外公开的顶层 Props Schema；Inspector 与绑定 Contract 共用。 @internal */
export const IMAGE_RENDERER_PROP_SCHEMAS = Object.freeze({
  asset: v.nullable(v.object({
    providerId: v.pipe(v.string(), v.minLength(1)),
    assetKey: v.pipe(v.string(), v.minLength(1)),
    scope: v.picklist(['persistent', 'session']),
  })),
  alt: v.string(),
  fit: v.picklist(['contain', 'cover', 'fill', 'none', 'scale-down']),
})
