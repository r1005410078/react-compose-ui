/**
 * 宿主盒子的布局尺寸测量。
 *
 * @remarks
 * 独立成一个目录而不是留在 `compose-preview/` 里：它被 `fit` 的缩放与预览对话框的取景
 * 共用，职责单一且稳定——量一个元素的布局尺寸，不认识文档、目标或取景语义。
 *
 * @internal
 */
export { composeFitScale, useComposeHostBoxSize } from './use-host-box-size'
export type { ComposeHostBoxSize } from './use-host-box-size'
