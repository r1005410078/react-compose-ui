import { findComposeAnimationTrack, findComposeKeyframeAt } from '@compose-ui/animation'
import { findComposeAnimation, getComposeFrame, getComposeLayoutItem } from '@compose-ui/core'
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
 *
 * Frame 的宽高不可动画：尺寸事实来源是 `Frame.size`，求解器会用它覆盖 LayoutItem 的
 * 推导结果，宽高关键帧写了也看不到效果。判掉之后自动记录会把场景缩放原样放行成
 * 基础文档编辑（transform 命令同步写 `Frame.size`），而不是改写成无效关键帧。
 */
export function isAnimationPathAvailable(
  document: ComposeDocument,
  entityId: string,
  path: readonly (string | number)[],
): boolean {
  const entity = document.entities[entityId]
  if (!entity) return false
  const layoutItem = getComposeLayoutItem(entity)
  const isFrame = getComposeFrame(entity) !== null
  if (isSamePath(path, OFFSET_PATH)) return layoutItem.positioning === 'absolute'
  if (isSamePath(path, WIDTH_PATH)) return !isFrame && layoutItem.width.mode === 'fixed'
  if (isSamePath(path, HEIGHT_PATH)) return !isFrame && layoutItem.height.mode === 'fixed'
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
  frameId: string,
  animationId: string,
  entityId: string,
  path: readonly (string | number)[],
  playheadMs: number,
): AnimationKeyState {
  if (!findComposeAnimation(document, frameId, animationId)) return 'unavailable'
  if (!isAnimationPathAvailable(document, entityId, path)) return 'unavailable'
  const entity = document.entities[entityId]
  if (!entity) return 'unavailable'
  const track = findComposeAnimationTrack(entity, animationId, path)
  if (!track || track.keyframes.length === 0) return 'none'
  return findComposeKeyframeAt(track, playheadMs) ? 'keyed' : 'animated'
}
