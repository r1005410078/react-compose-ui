import type { ComposeAnimation, ComposeDocument } from './document-types'

/**
 * 归一化读取文档的动画清单。
 *
 * @remarks
 * `ComposeDocument.animations` 是可选字段，缺省表示"无动画"。所有调用方都必须走这里，
 * 而不是各自写 `?? []`——否则一旦字段语义变化就要在几十处同步。
 *
 * @public
 */
export function getComposeAnimations(
  document: ComposeDocument,
): readonly ComposeAnimation[] {
  return document.animations ?? []
}

/**
 * 按 ID 查找动画；不存在时返回 `null`。
 *
 * @public
 */
export function findComposeAnimation(
  document: ComposeDocument,
  animationId: string,
): ComposeAnimation | null {
  return getComposeAnimations(document).find((item) => item.id === animationId) ?? null
}
