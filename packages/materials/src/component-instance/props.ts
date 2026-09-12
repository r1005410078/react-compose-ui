import * as v from 'valibot'

/**
 * 组件实例的可绑定 Renderer Prop Schema。
 *
 * @remarks
 * `animation` 在这里只校验「是不是字符串或 null」，**不校验它在不在清单里**——清单属于
 * 快照，而 Prop Contract 的 `validate` 只看得见一个值。id 是否失效由 Inspector 呈现，
 * 由采样入口决定不采样；两处都不把它当成绑定错误。
 *
 * @internal
 */
export const COMPONENT_INSTANCE_RENDERER_PROP_SCHEMAS = {
  animation: v.nullable(v.string()),
  animationTime: v.pipe(v.number(), v.finite()),
  // 缺席即 'layout'（默认值不写成显式值）；null 表示「回到默认」，与 animation 的空态同形。
  contentFit: v.nullable(v.picklist(['layout', 'scale'])),
  // 缺席即 'none'；null 表示「回到默认」，与 contentFit 的空态同形。
  flip: v.nullable(v.picklist(['none', 'x', 'y', 'xy'])),
} as const
