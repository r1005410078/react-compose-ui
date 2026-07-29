import {
  getComposeClip,
  getComposeHierarchy,
  getComposeTransform,
  resolveComposeAppearance,
  type ComposeEntity,
} from '@compose-ui/core'
import type { CSSProperties } from 'react'

/**
 * Stage 与 Preview 共享的 Entity 外观样式（不含 Transform 几何）。
 *
 * @remarks
 * 边框以 inset box-shadow 实现，避免 border 参与盒模型改变内容尺寸；Container 的
 * overflow 由 Clip 控制，非 Container 恒为 hidden。两个消费方必须使用同一实现，
 * 保证编辑所见与预览输出一致。
 *
 * @public
 */
export function composeEntityVisualStyle(entity: ComposeEntity): CSSProperties {
  const visual = resolveComposeAppearance(entity)
  const backgroundColor = visual.backgroundPaint.kind === 'solid'
    ? visual.backgroundPaint.color
    : 'transparent'
  const hierarchy = getComposeHierarchy(entity)
  const clip = getComposeClip(entity)
  const shadows: string[] = []
  if (visual.borderWidth > 0) {
    shadows.push(`inset 0 0 0 ${visual.borderWidth}px ${visual.borderColor}`)
  }
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
    boxShadow: shadows.length > 0 ? shadows.join(', ') : 'none',
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
export function composeEntitySceneStyle(entity: ComposeEntity): CSSProperties {
  const transform = getComposeTransform(entity)
  return {
    ...composeEntityVisualStyle(entity),
    // 共享外观层需要 relative 作为 Paint Layer 的 containing block；Stage Scene 的节点
    // 则必须脱离文档流，否则同级 Entity 会随前一个节点的高度向下排布。
    position: 'absolute',
    left: transform.position.x,
    top: transform.position.y,
    width: transform.size.width,
    height: transform.size.height,
    transform: `rotate(${transform.rotation}deg)`,
    transformOrigin: 'center',
  }
}
