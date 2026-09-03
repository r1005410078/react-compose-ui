/**
 * 组件实例的内容适配（`contentFit` Renderer prop）。
 *
 * @remarks
 * `'layout'`（默认）与 `'scale'` 是**互斥的两支**：前者把盒尺寸写进嵌套根、让 Auto Layout
 * 重排；后者保持嵌套文档尺寸不变、在外层按比值整体缩放。两支不得同时改一份尺寸数据——
 * 同时做会让「这个实例多大」在两处读出不同答案，症状是拖一次角手柄图形跳两次。
 */

/** 内容适配的取值。 @internal */
export type ComponentInstanceContentFit = 'layout' | 'scale'

/**
 * 从 Renderer props 读内容适配，缺席即 `'layout'`。
 *
 * @remarks
 * 缺席即默认这条回退让不含该 prop 的既有文档渲染逐像素不变，因此 `'layout'` 不写成显式值
 * （与 `Curve.fillRule` 缺席即 `nonzero` 是同一条判断）。editor 的 controller 按同一条判据
 * 分流 resize 的写入路径；那个包不依赖本包，判断在两侧各写一份是包边界造成的。
 *
 * @internal
 */
export function readComponentInstanceContentFit(
  props: Readonly<Record<string, unknown>>,
): ComponentInstanceContentFit {
  return props.contentFit === 'scale' ? 'scale' : 'layout'
}

/**
 * `'scale'` 下内容的两轴缩放比。
 *
 * @remarks
 * 两轴**各自**取比值，不强行等比后留白：曲线按 `viewBox` 跟随自己的盒时就是两轴各算各的，
 * 符号被拉扁时它的每一条线也该跟着扁。想等比的用户按住 `Shift`，那是既有的 resize 约束。
 *
 * 盒或根尺寸未知（首帧还没量到、jsdom 没有布局）与非正数时回退 1：画一帧未缩放的内容
 * 严格好过按一个错误的比值画。
 *
 * @internal
 */
export function componentInstanceContentScale(
  hostBox: { readonly width: number; readonly height: number } | null,
  rootSize: { readonly width: number; readonly height: number } | null,
): { readonly x: number; readonly y: number } {
  if (!hostBox || !rootSize) return { x: 1, y: 1 }
  const x = hostBox.width > 0 && rootSize.width > 0 ? hostBox.width / rootSize.width : 1
  const y = hostBox.height > 0 && rootSize.height > 0 ? hostBox.height / rootSize.height : 1
  return { x, y }
}
