import {
  getComposeClip,
  getComposeHierarchy,
  getComposeTransform,
  resolveComposeAppearance,
  type ComposeEntity,
  type ComposeResolvedLayoutBox,
} from '@compose-ui/core'
import type { CSSProperties } from 'react'

/**
 * Stage 与 Preview 共享的 Entity appearance 样式（不含 Transform 几何与 overflow）。
 *
 * @remarks
 * 边框由独立顶层覆盖层渲染，因此 Entity 壳使用 `isolation` 把覆盖层限制在自身 stacking
 * context 内，避免高层级边框越过相邻 Entity。overflow 是 Stage 与 Preview 各自的运行时
 * 行为，不属于共享 appearance。
 *
 * @public
 */
export function composeEntityAppearanceStyle(entity: ComposeEntity): CSSProperties {
  const visual = resolveComposeAppearance(entity)
  const backgroundColor = visual.backgroundPaint.kind === 'solid'
    ? visual.backgroundPaint.color
    : 'transparent'
  const shadows: string[] = []
  if (visual.shadow) {
    shadows.push(
      `${visual.shadow.offsetX}px ${visual.shadow.offsetY}px ${visual.shadow.blur}px `
      + `${visual.shadow.spread}px ${visual.shadow.color}`,
    )
  }
  return {
    position: 'relative',
    // 纯色同时写入宿主盒子，维持 DOM Scene 的稳定视觉与命中盒契约；复杂 Paint 仍由共享图层绘制。
    backgroundColor,
    borderRadius: visual.borderRadius,
    opacity: visual.opacity,
    isolation: 'isolate',
    boxShadow: shadows.length > 0 ? shadows.join(', ') : 'none',
  }
}

/**
 * 组合共享 appearance 与旧版静态 overflow 的兼容入口。
 *
 * @remarks
 * 新的 Stage 与 Preview 消费方应使用 `composeEntityAppearanceStyle` 并自行应用运行时 overflow。
 *
 * @public
 */
export function composeEntityVisualStyle(entity: ComposeEntity): CSSProperties {
  const hierarchy = getComposeHierarchy(entity)
  const clip = getComposeClip(entity)
  return {
    ...composeEntityAppearanceStyle(entity),
    overflow: hierarchy
      ? (clip?.enabled ? 'hidden' : 'visible')
      : 'hidden',
  }
}

/**
 * 外观加 Transform 几何的完整场景样式；定位方式（absolute 等）由消费方决定。
 *
 * @public
 */
export function composeEntitySceneStyle(
  entity: ComposeEntity,
  box: ComposeResolvedLayoutBox,
): CSSProperties {
  const transform = getComposeTransform(entity)
  return {
    ...composeEntityAppearanceStyle(entity),
    // 共享外观层需要 relative 作为 Paint Layer 的 containing block；Stage Scene 的节点
    // 则必须脱离文档流，否则同级 Entity 会随前一个节点的高度向下排布。
    position: 'absolute',
    left: box.x,
    top: box.y,
    width: box.width,
    height: box.height,
    transform: `rotate(${transform.rotation}deg)`,
    transformOrigin: 'center',
  }
}
