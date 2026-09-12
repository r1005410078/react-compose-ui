/**
 * 组件实例的翻转（`flip` Renderer prop）。
 *
 * @remarks
 * 翻转作用于**呈现**而不是组件定义：定义是共享的，烘进去会波及每一个实例。它与既有的
 * `Transform.rotation` 组合就能表达任意轴的反射——绕角 θ 的反射等于先翻转再旋转 `2θ`，
 * 数学是封闭的，因此镜像不需要为它新增任何协议字段。
 */

/** 翻转的取值。 @internal */
export type ComponentInstanceFlip = 'none' | 'x' | 'y' | 'xy'

const VALUES: readonly ComponentInstanceFlip[] = ['none', 'x', 'y', 'xy']

/**
 * 从 Renderer props 读翻转，缺席即 `'none'`。
 *
 * @remarks
 * 缺席即默认这条回退让不含该 prop 的既有实例渲染逐像素不变，因此 `'none'` 不写成显式值——
 * 与 `contentFit` 缺席即 `'layout'`、`Curve.fillRule` 缺席即 `nonzero` 是同一条判断。
 *
 * @internal
 */
export function readComponentInstanceFlip(
  props: Readonly<Record<string, unknown>>,
): ComponentInstanceFlip {
  const value = props.flip
  return VALUES.includes(value as ComponentInstanceFlip)
    ? value as ComponentInstanceFlip
    : 'none'
}

/**
 * 翻转对应的两轴缩放比。
 *
 * @remarks
 * `-1` 而不是 `scaleX(-1)` 这类字符串：调用方还要与内容适配的比值相乘，两者必须落在同一个
 * 数上——各写一个 `transform` 再叠起来，后一个会把前一个的 `transform-origin` 一起继承走。
 *
 * @internal
 */
export function componentInstanceFlipScale(
  flip: ComponentInstanceFlip,
): { readonly x: number; readonly y: number } {
  return {
    x: flip === 'x' || flip === 'xy' ? -1 : 1,
    y: flip === 'y' || flip === 'xy' ? -1 : 1,
  }
}
