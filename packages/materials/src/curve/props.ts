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
 * `strokeDashoffset` **不钳制符号**：负值把图案朝线的终点推，正是「让导线看起来在流动」要的
 * 那个方向。它是「流动」的唯一机制——不为它加命令或预设动画，因为自动算一个完整虚线周期要
 * 先有 dash pattern 的世界长度，而 `strokeDasharray` 眼下是由线宽推出的 picklist，正处在
 * 已立项的单位错配里；把周期算进命令语义等于把那个缺陷固化。
 *
 * @internal
 */
export const CURVE_RENDERER_PROP_SCHEMAS = Object.freeze({
  stroke: v.pipe(v.string(), v.minLength(1)),
  strokeWidth: v.pipe(v.number(), v.minValue(0)),
  strokeLinecap: v.picklist(['butt', 'round', 'square']),
  strokeDasharray: v.picklist(['none', '8 4', '1 4']),
  strokeDashoffset: v.number(),
  markerStart: v.picklist(['none', 'arrow']),
  markerEnd: v.picklist(['none', 'arrow']),
})
