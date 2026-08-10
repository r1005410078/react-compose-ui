import * as v from 'valibot'

/** Shape Renderer 的顶层 Props Schema；Inspector 与绑定 Contract 共用。 @internal */
export const SHAPE_RENDERER_PROP_SCHEMAS = Object.freeze({
  stroke: v.pipe(v.string(), v.minLength(1)),
  strokeWidth: v.pipe(v.number(), v.minValue(0)),
  strokeLinecap: v.picklist(['butt', 'round', 'square']),
  strokeDasharray: v.picklist(['none', '8 4', '1 4']),
  markerStart: v.picklist(['none', 'arrow']),
  markerEnd: v.picklist(['none', 'arrow']),
})
