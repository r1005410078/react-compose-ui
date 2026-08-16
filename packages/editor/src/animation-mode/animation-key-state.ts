import { findComposeAnimationTrack, findComposeKeyframeAt } from '@compose-ui/animation'
import { findComposeAnimation, getComposeLayoutItem } from '@compose-ui/core'
import type { ComposeDocument } from '@compose-ui/core'

/**
 * 菱形打点按钮的四种状态。
 *
 * @remarks
 * 前三态与 Rive 的 key 按钮一致：灰描边（未被动画）、蓝描边（有动画但播放头上无帧）、
 * 蓝实心（播放头上有帧）。`unavailable` 是本项目特有的第四态：属性在当前布局配置下
 * 不参与求解，打点只会产生一条永远看不到效果的轨道，所以禁用并说明原因。
 */
export type AnimationKeyState = 'none' | 'animated' | 'keyed' | 'unavailable'

function isSamePath(
  left: readonly (string | number)[],
  right: readonly (string | number)[],
) {
  return left.length === right.length && left.every((segment, index) => segment === right[index])
}

const OFFSET_PATH = ['LayoutItem', 'offset'] as const
const WIDTH_PATH = ['LayoutItem', 'width', 'value'] as const
const HEIGHT_PATH = ['LayoutItem', 'height', 'value'] as const

/**
 * 判定属性在 Entity 当前配置下是否可动画。
 *
 * @remarks
 * `LayoutItem.offset` 只在 `positioning: 'absolute'` 下参与求解；
 * `width/height.value` 只在对应轴 `mode: 'fixed'` 下生效。
 * 其余白名单路径（旋转、透明度、纯色背景）没有配置前提。
 */
export function isAnimationPathAvailable(
  document: ComposeDocument,
  entityId: string,
  path: readonly (string | number)[],
): boolean {
  const entity = document.entities[entityId]
  if (!entity) return false
  const layoutItem = getComposeLayoutItem(entity)
  if (isSamePath(path, OFFSET_PATH)) return layoutItem.positioning === 'absolute'
  if (isSamePath(path, WIDTH_PATH)) return layoutItem.width.mode === 'fixed'
  if (isSamePath(path, HEIGHT_PATH)) return layoutItem.height.mode === 'fixed'
  return true
}

/**
 * 求菱形按钮在当前播放头下的状态。
 *
 * @remarks
 * 可用性优先于轨道存在性：Flow 布局下即使已有位置轨道（比如布局后来被切换过），
 * 按钮也显示 `unavailable`——此时打点无效，先让用户看到原因。
 */
export function getAnimationKeyState(
  document: ComposeDocument,
  animationId: string,
  entityId: string,
  path: readonly (string | number)[],
  playheadMs: number,
): AnimationKeyState {
  if (!findComposeAnimation(document, animationId)) return 'unavailable'
  if (!isAnimationPathAvailable(document, entityId, path)) return 'unavailable'
  const entity = document.entities[entityId]
  if (!entity) return 'unavailable'
  const track = findComposeAnimationTrack(entity, animationId, path)
  if (!track || track.keyframes.length === 0) return 'none'
  return findComposeKeyframeAt(track, playheadMs) ? 'keyed' : 'animated'
}
