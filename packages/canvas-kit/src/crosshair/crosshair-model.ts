/**
 * 十字光标的一次绘制。
 *
 * @remarks
 * 形态由调用方按「当前等待的输入类型」给出，组件只负责画。
 *
 * @public
 */
export interface ComposeCanvasCrosshair {
  /** 光标中心的**屏幕**位置，相对图面左上角。 */
  readonly center: { readonly x: number; readonly y: number }
  /** 画十字线。 */
  readonly lines: boolean
  /** 画拾取框。 */
  readonly box: boolean
  /** 拾取框的半边长（CSS 像素）。 */
  readonly boxRadius: number
  /** 十字线单侧长度占视口较短边的百分比（1–100）。 */
  readonly size: number
}

/** {@link resolveComposeCanvasCrosshair} 的输入。 @public */
export interface ComposeCanvasCrosshairInput {
  /** 宿主是否允许绘制十字光标。 */
  readonly show: boolean
  /**
   * 产生这次指示的指针类型。
   *
   * @remarks
   * 触摸屏上没有光标可言，因此 `touch` 既不画也不隐藏系统光标。
   */
  readonly pointerType: string
  /** 光标中心；指针不在图面上时为 `null`。 */
  readonly center: { readonly x: number; readonly y: number } | null
  readonly lines: boolean
  readonly box: boolean
  readonly boxRadius: number
  readonly size: number
}

/**
 * 求解这一帧要不要画十字光标，以及画成什么形态。
 *
 * @remarks
 * 本函数是「是否在画」的**唯一**判据。调用方 MUST 用同一个返回值做两件事：传给
 * {@link ComposeCanvasCrosshairLayer}，以及决定要不要给图面容器挂上隐藏系统光标的标记。
 *
 * 两处各判一次必然漂移，而漂移的样子是**画了十字线但系统箭头还在**——屏幕上两个光标，
 * 用户会以为十字光标失效了。触摸豁免因此也留在这里：「不画」与「不隐藏系统光标」必须
 * 同时成立。
 *
 * 形态由两个布尔给出而不是命令提示：`accepts` 属于命令协议，本包不依赖它。由提示推出这两个
 * 布尔的那一步留在各自的画布包里——两块画布的推导规则本来就不同（CAD 空闲时线与框都画，
 * 页面画布空闲什么都不画），把它搬进来等于把差异变成包内的 `if`。
 *
 * @public
 */
export function resolveComposeCanvasCrosshair(
  input: ComposeCanvasCrosshairInput,
): ComposeCanvasCrosshair | null {
  const { show, pointerType, center, lines, box, boxRadius, size } = input
  if (!show || pointerType === 'touch' || !center) return null
  if (!lines && !box) return null
  return { center, lines, box, boxRadius, size }
}
