/** 拖放换算只需要矩形的四条边；不要求传入完整的 `DOMRect`。 @internal */
export interface ShelfRect {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

/**
 * 编排区的朝向。
 *
 * @remarks
 * 工具栏货架横排换行（`wrap`），物料面板的段纵排（`vertical`）——**编排区画的是它将来的样子**，
 * 因此朝向由被编排的东西决定，而不是两个对话框各挑一个。
 *
 * @internal
 */
export type ShelfOrientation = 'wrap' | 'vertical'

/**
 * 把一个落点换算成插入下标：返回「插在第几项之前」，等于项数即插到末尾。
 *
 * @remarks
 * 两种朝向写成**一个带参数的函数**而不是两个函数：它们的契约逐字相同——给一组矩形和一个点，
 * 回答插到第几个之前——差的只是拿哪条中线比。拆成两个的话，下一个改插入语义的人只会改到
 * 其中一处，而漏掉的那处的症状是「某一种对话框里落点差一位」。
 *
 * `wrap` 按**阅读顺序**比较：先要求点落在这一项所在行或更靠上（`point.y < rect.bottom`），
 * 再比横向中线。只比横向中线的话，换行之后第二行的项会与第一行的项混着比，落点会跳到行首。
 *
 * 指针与键盘走的是同一个下标——键盘那条不调用本函数，但它算出来的是同一个量，因此两条通道
 * 之后共用同一组写草稿的纯函数。
 *
 * @internal
 */
export function resolveShelfDropIndex(
  rects: readonly ShelfRect[],
  point: { readonly x: number; readonly y: number },
  orientation: ShelfOrientation,
): number {
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index]!
    if (orientation === 'vertical') {
      if (point.y < rect.top + (rect.bottom - rect.top) / 2) return index
      continue
    }
    if (point.y < rect.bottom && point.x < rect.left + (rect.right - rect.left) / 2) return index
  }
  return rects.length
}

/**
 * 一次重排落地成的最终下标：把「插在第几项之前」换算成「移动之后它排第几」。
 *
 * @remarks
 * 拖动期间被抓走的那一件**仍留在原位**（原位留影子是刻意的，见对话框的呈现），因此落点下标
 * 是在**含它自己**的那一列上算出来的。往后挪时它自己占掉的那一位要减回来，否则每次往后拖
 * 都少走一格——而这个偏差在往前拖时不出现，最容易被当成「偶尔不准」放过去。
 *
 * @internal
 */
export function resolveShelfReorderTarget(from: number, insertBefore: number): number {
  return insertBefore > from ? insertBefore - 1 : insertBefore
}
