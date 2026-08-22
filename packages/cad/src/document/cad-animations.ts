import type { ComposeAnimation } from '@compose-ui/core'
import type { CadDocument } from './cad-document-types'

/**
 * 归一化读取图纸的动画清单。
 *
 * @remarks
 * 所有调用方都走这里而不是各自写 `?? []`：外部写入的文档可能缺这个字段，而一旦语义变化就要
 * 在几十处同步。与页面文档的 `getFrameAnimations` 是同一种做法，差别只在 CAD 的清单落在
 * 文档级——一份图纸就是一个时间线作用域。
 *
 * @public
 */
export function getCadAnimations(document: CadDocument): readonly ComposeAnimation[] {
  return document.animations ?? []
}

/** 按 id 查找动画；不存在时为 `null`。 @public */
export function findCadAnimation(
  document: CadDocument,
  animationId: string,
): ComposeAnimation | null {
  return getCadAnimations(document).find((item) => item.id === animationId) ?? null
}
