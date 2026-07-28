import {
  resolveNodeStyle,
  type ComposeFrameNode,
  type ComposeNode,
  type NodeStyle,
  type NodeTransform,
  type ResolvedNodeStyle,
} from '@compose-ui/core'
import type { ContainerValue, FrameValue } from './schemas'

/** 将 Frame 转换为专用 Inspector 表单值。 @internal */
export function createContainerValue(
  node: ComposeFrameNode,
  style?: ResolvedNodeStyle,
): FrameValue
/** 将文档节点转换为通用 Inspector 表单值。 @internal */
export function createContainerValue(
  node: ComposeNode,
  style?: ResolvedNodeStyle,
): ContainerValue
export function createContainerValue(
  node: ComposeNode,
  style: ResolvedNodeStyle = resolveNodeStyle(node),
): ContainerValue | FrameValue {
  return {
    name: node.name,
    position: { x: node.transform.x, y: node.transform.y },
    size: { width: node.transform.width, height: node.transform.height },
    rotation: node.transform.rotation,
    visible: node.visible,
    ...(node.kind === 'frame' ? { clipContent: node.clipContent } : {}),
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    borderWidth: style.borderWidth,
    borderRadius: style.borderRadius,
    opacity: style.opacity,
    shadow: style.shadow ? {
      color: style.shadow.color,
      offset: { x: style.shadow.offsetX, y: style.shadow.offsetY },
      blur: style.shadow.blur,
      spread: style.shadow.spread,
    } : null,
  }
}

/** 从表单值提取标准节点 style。 @internal */
export function createStyleValue(value: ContainerValue | FrameValue): NodeStyle {
  return {
    backgroundColor: value.backgroundColor,
    borderColor: value.borderColor,
    borderWidth: value.borderWidth,
    borderRadius: value.borderRadius,
    opacity: value.opacity,
    shadow: value.shadow ? {
      color: value.shadow.color,
      offsetX: value.shadow.offset.x,
      offsetY: value.shadow.offset.y,
      blur: value.shadow.blur,
      spread: value.shadow.spread,
    } : null,
  }
}

/** 从表单值提取节点几何。 @internal */
export function createTransformValue(value: ContainerValue | FrameValue): NodeTransform {
  return {
    x: value.position.x,
    y: value.position.y,
    width: value.size.width,
    height: value.size.height,
    rotation: value.rotation,
  }
}

/** 比较两个 JSON 可序列化表单片段。 @internal */
export function isEqualValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}
