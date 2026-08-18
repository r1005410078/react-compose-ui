import {
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  type ComposeAnimation,
  type ComposeAnimations,
  type ComposeDocument,
  type ComposeEntity,
} from './document-types'
import { resolveOwningFrameId } from './frame'

/**
 * 归一化读取一个 Frame 的动画清单。
 *
 * @remarks
 * `Animations` Component 缺省表示"该 Frame 无动画"。所有调用方都必须走这里，而不是各自写
 * `?? []`——否则一旦字段语义变化就要在几十处同步。
 *
 * @public
 */
export function getFrameAnimations(
  entity: ComposeEntity | undefined,
): readonly ComposeAnimation[] {
  const component = entity?.components[COMPOSE_BUILTIN_COMPONENT_KEYS.animations]
  return component ? ((component as ComposeAnimations).items ?? []) : []
}

/**
 * 读取文档中某个 Frame 的动画清单。
 *
 * @public
 */
export function getComposeAnimations(
  document: ComposeDocument,
  frameId: string,
): readonly ComposeAnimation[] {
  return getFrameAnimations(document.entities[frameId])
}

/**
 * 在指定 Frame 内按 ID 查找动画；不存在时返回 `null`。
 *
 * @public
 */
export function findComposeAnimation(
  document: ComposeDocument,
  frameId: string,
  animationId: string,
): ComposeAnimation | null {
  return getComposeAnimations(document, frameId).find((item) => item.id === animationId) ?? null
}

/**
 * 查找驱动某个 Entity 的动画清单所在的 Frame。
 *
 * @remarks
 * 便捷组合：Entity 的轨道只能属于它最近的祖先 Frame，因此"这个 Entity 的动画在哪条清单里"
 * 与"它属于哪个作用域"是同一个问题。
 *
 * @public
 */
export function resolveAnimationHostFrameId(
  document: ComposeDocument,
  entityId: string,
): string | null {
  return resolveOwningFrameId(document, entityId)
}
