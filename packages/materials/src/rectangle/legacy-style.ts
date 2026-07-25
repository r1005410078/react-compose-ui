import {
  resolveNodeStyle,
  type ComposeComponentNode,
  type NodeStyle,
  type ResolvedNodeStyle,
} from '@compose-ui/core'

/** 将旧 Rectangle 视觉 props 解析为标准节点样式，但不修改原 props。 @internal */
export function resolveLegacyRectangleStyle(
  node: ComposeComponentNode,
  standard: NodeStyle,
): ResolvedNodeStyle {
  if (node.style !== undefined) return resolveNodeStyle(node)
  return resolveNodeStyle({
    kind: 'component',
    style: {
      ...standard,
      backgroundColor: typeof node.props.color === 'string'
        ? node.props.color
        : standard.backgroundColor,
      borderRadius: typeof node.props.cornerRadius === 'number'
        ? node.props.cornerRadius
        : standard.borderRadius,
      opacity: typeof node.props.opacity === 'number'
        ? node.props.opacity
        : standard.opacity,
    },
  })
}
