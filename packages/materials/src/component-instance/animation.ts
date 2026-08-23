import { applyComposeAnimationAtTime } from '@compose-ui/animation'
import {
  findComposeAnimation,
  getComposeAnimations,
  type ComposeAnimation,
  type ComposeDocument,
} from '@compose-ui/core'

/** 实例播放头相关的 Renderer Prop 名；Inspector 与契约共用同一份，避免字面量漂移。 */
export const COMPONENT_INSTANCE_ANIMATION_PROP = 'animation'
/** 实例播放头毫秒的 Renderer Prop 名。 */
export const COMPONENT_INSTANCE_ANIMATION_TIME_PROP = 'animationTime'

/**
 * 读实例选中的动画 id。
 *
 * @remarks
 * 缺席、`null` 与空串都表示**还没配**，一律回到 `null`；类型不符按缺席处理，与其余
 * Renderer Prop 的读取方式一致。
 *
 * @internal
 */
export function readComponentInstanceAnimationId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** 读播放头毫秒；非有限数值一律回到 0。 @internal */
export function readComponentInstanceAnimationTime(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * 在组件根 Frame 的清单里查一条动画。
 *
 * @remarks
 * **不回退到清单的第一条**：位置性回退在只有一条动画时看起来永远正确，等到有第二条才错，
 * 而那时没人记得这里有个回退。项目里「任何新建路径都不得回退到 `rootIds[0]`」是同一条判断。
 *
 * @internal
 */
export function findComponentInstanceAnimation(
  document: ComposeDocument,
  animationId: string,
): ComposeAnimation | null {
  const rootId = componentRootId(document)
  return rootId ? findComposeAnimation(document, rootId, animationId) : null
}

/** 组件文档的单根 id；不是单根就没有「组件根 Frame」可言。 */
function componentRootId(document: ComposeDocument): string | null {
  const rootId = document.rootIds[0]
  return rootId && document.rootIds.length === 1 ? rootId : null
}

/**
 * 从实例保存的 `resolvedSnapshot` 里读组件根 Frame 的动画清单，供 Inspector 构建下拉。
 *
 * @remarks
 * Inspector 拿到的是 authored JSON，可能是任何形状（快照失效、组件被删、手工改过的文档），
 * 因此这里逐层守卫而不是断言，读不出来就当作「这个组件没有动画」。
 *
 * @internal
 */
export function readComponentInstanceAnimations(value: unknown): readonly ComposeAnimation[] {
  if (value === null || typeof value !== 'object') return []
  const document = (value as { readonly document?: unknown }).document
  if (document === null || typeof document !== 'object') return []
  const candidate = document as ComposeDocument
  if (!Array.isArray(candidate.rootIds) || candidate.entities === undefined) return []
  const rootId = componentRootId(candidate)
  if (!rootId) return []
  const items = getComposeAnimations(candidate, rootId)
  return Array.isArray(items) ? items.filter((item) => typeof item?.id === 'string') : []
}

/**
 * 按实例播放头对嵌套文档采样一次。
 *
 * @remarks
 * 采样只作用于**呈现**：结果喂给实例自己的嵌套 Layout Runtime，不回写文档、实例覆盖或任何
 * 持久化位置。实例渲染器本来就不派发命令，因此这里不需要额外的保护。
 *
 * 三种情况返回**原文档引用**而不是一份等值副本：没选动画（还没配）、选中的 id 不在清单里
 * （配错了）、以及采样器本身没有命中任何轨道。引用相等是嵌套 Runtime 不做多余重解的依据——
 * `layoutDocument` 一变就会触发一次 Yoga 求解。
 *
 * 播放头钳到 `[0, durationMs]`：组件作者缩短时长之后，原本绑在旧终点的实例落在新终点上，
 * 语义仍然是「走到底」。
 *
 * 清单条目的 `autoplay` 与 `playbackMode` 在实例里被**忽略**：实例内不持有时钟，本函数是
 * `(document, id, timeMs) → document` 的纯函数。需要连续播放时由宿主页面脚本驱动被绑定的
 * 那个数值。
 *
 * @internal
 */
export function sampleComponentInstanceDocument(
  document: ComposeDocument,
  animationIdInput: unknown,
  animationTimeInput: unknown,
): ComposeDocument {
  const animationId = readComponentInstanceAnimationId(animationIdInput)
  if (animationId === null) return document
  const animation = findComponentInstanceAnimation(document, animationId)
  if (!animation) return document
  const duration = Number.isFinite(animation.durationMs) && animation.durationMs > 0
    ? animation.durationMs
    : 0
  const timeMs = Math.min(duration, Math.max(0, readComponentInstanceAnimationTime(animationTimeInput)))
  return applyComposeAnimationAtTime(document, animationId, timeMs)
}
