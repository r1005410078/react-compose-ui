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
    ...node.transform,
    ...(node.kind === 'frame' ? { clipContent: node.clipContent } : {}),
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    borderWidth: style.borderWidth,
    borderRadius: style.borderRadius,
    opacity: style.opacity,
    shadow: style.shadow ? { ...style.shadow } : null,
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
    shadow: value.shadow ? { ...value.shadow } : null,
  }
}

/** 从表单值提取节点几何。 @internal */
export function createTransformValue(value: ContainerValue | FrameValue): NodeTransform {
  return {
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height,
    rotation: value.rotation,
  }
}

/** 比较两个 JSON 可序列化表单片段。 @internal */
export function isEqualValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}
