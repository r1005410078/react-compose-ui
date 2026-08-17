import { findComposeAnimationTrack } from '@compose-ui/animation'
import type { ComposeKeyframeInterpolation } from '@compose-ui/animation'
import type { ComposeDocument } from '@compose-ui/core'
import { decodeAnimationKeyframeId } from './animation-document-adapter'
import type { AnimationPropertyLabelPort } from './animation-document-adapter'

/**
 * 时间线当前选中关键帧在文档中的缓动上下文。
 *
 * @remarks
 * 只承载缓动编辑需要的事实：定位、当前插值，以及用于展示的对象/属性名与出向区间。
 * 值与时间的编辑仍属于关键帧属性面板，不在这里重复一套。
 */
export interface AnimationKeyframeEasing {
  readonly entityId: string
  readonly path: readonly (string | number)[]
  readonly keyframeId: string
  readonly interpolation: ComposeKeyframeInterpolation
  readonly timeMs: number
  /** 出向段终点；末帧没有下一帧时为 `null`，此时插值暂不参与求值。 */
  readonly nextTimeMs: number | null
  readonly entityName: string
  readonly propertyLabel: string
}

/**
 * 由面板选中的关键帧 ID 解析出缓动编辑上下文。
 *
 * @remarks
 * 面板 ID 是本包 adapter 编出来的复合地址；解不出、Entity 或轨道已被删除时一律返回
 * `null`，宿主据此不渲染缓动区，而不是渲染一个指向不存在关键帧的编辑器。
 */
export function resolveAnimationKeyframeEasing(
  document: ComposeDocument | undefined,
  animationId: string | null,
  panelKeyframeId: string | null,
  propertyLabel?: AnimationPropertyLabelPort,
): AnimationKeyframeEasing | null {
  if (!document || !animationId || !panelKeyframeId) return null
  const ref = decodeAnimationKeyframeId(panelKeyframeId)
  if (!ref) return null
  const entity = document.entities[ref.entityId]
  if (!entity) return null
  const track = findComposeAnimationTrack(entity, animationId, ref.path)
  if (!track) return null
  const index = track.keyframes.findIndex((keyframe) => keyframe.id === ref.keyframeId)
  if (index < 0) return null
  const keyframe = track.keyframes[index]!
  const next = track.keyframes[index + 1]
  return {
    entityId: ref.entityId,
    path: ref.path,
    keyframeId: ref.keyframeId,
    interpolation: keyframe.interpolation,
    timeMs: keyframe.timeMs,
    nextTimeMs: next?.timeMs ?? null,
    entityName: entity.name,
    propertyLabel: propertyLabel?.(ref.path)?.label ?? ref.path.map(String).join('.'),
  }
}
