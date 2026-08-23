import * as v from 'valibot'

/**
 * Curve Renderer 的描边 Props Schema；Inspector 与绑定 Contract 共用。
 *
 * @remarks
 * 描边走 Renderer props 而不是 `Curve` Component：几何要被 core 与 stage-engine 读取，
 * 因此必须是文档级契约；描边只有渲染与 Inspector 读，走 props 可以白拿绑定与外观轨道。
 *
 * 端点 marker 同理走 props。**填充不在这里**——它要参与命中，因此复用
 * `Appearance.backgroundPaint`，读取只走 `getComposeCurveFill`。
 *
 * @internal
 */
export const CURVE_RENDERER_PROP_SCHEMAS = Object.freeze({
  stroke: v.pipe(v.string(), v.minLength(1)),
  strokeWidth: v.pipe(v.number(), v.minValue(0)),
  strokeLinecap: v.picklist(['butt', 'round', 'square']),
  strokeDasharray: v.picklist(['none', '8 4', '1 4']),
  markerStart: v.picklist(['none', 'arrow']),
  markerEnd: v.picklist(['none', 'arrow']),
})
