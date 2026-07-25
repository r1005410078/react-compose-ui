/**
 * 提供可独立嵌入的 legacy 容器或指定 Frame 文档预览。
 *
 * @packageDocumentation
 */

import { RegistryComponent } from '@compose-ui/component-registry'
import {
  COMPOSE_UI_CORE_PACKAGE,
  resolveNodeStyle,
} from '@compose-ui/core'
import type { ComponentRegistry } from '@compose-ui/component-registry'
import type {
  ComposeDocument,
  ComposeNode,
} from '@compose-ui/core'
import type { CSSProperties, HTMLAttributes } from 'react'

/**
 * ComposePreview 属性。
 *
 * @public
 */
export interface ComposePreviewProps extends HTMLAttributes<HTMLElement> {
  /** 文档模式的正式 JSON 文档；必须与 registry、frameId 一起提供。 */
  readonly document?: ComposeDocument
  /** Stage 与 Preview 共享的实例级组件注册表。 */
  readonly registry?: ComponentRegistry
  /** 文档模式必须显式指定的 Frame ID。 */
  readonly frameId?: string
}

function visualStyle(node: ComposeNode): CSSProperties {
  const visual = resolveNodeStyle(node)
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
    backgroundColor: visual.backgroundColor,
    borderRadius: visual.borderRadius,
    opacity: visual.opacity,
    boxShadow: shadows.length > 0 ? shadows.join(', ') : 'none',
    overflow: node.kind === 'group' ? 'visible' : 'hidden',
  }
}

function nodeStyle(node: ComposeNode): CSSProperties {
  return {
    ...visualStyle(node),
    position: 'absolute' as const,
    left: node.transform.x,
    top: node.transform.y,
    width: node.transform.width,
    height: node.transform.height,
    transform: `rotate(${node.transform.rotation}deg)`,
    transformOrigin: 'center',
  }
}

function PreviewNode({
  document,
  registry,
  nodeId,
}: {
  document: ComposeDocument
  registry: ComponentRegistry
  nodeId: string
}) {
  const node = document.nodes[nodeId]
  if (!node?.visible) return null
  return (
    <div data-testid={`compose-preview-node-${node.id}`} style={nodeStyle(node)}>
      {node.kind === 'component'
        ? <RegistryComponent mode="preview" node={node} registry={registry} />
        : node.childIds.map((childId) => (
            <PreviewNode
              document={document}
              key={childId}
              nodeId={childId}
              registry={registry}
            />
          ))}
    </div>
  )
}

/**
 * 渲染 legacy children，或用普通 DOM 预览显式指定的 ComposeDocument Frame。
 *
 * @public
 */
export function ComposePreview({
  children = 'Compose Preview',
  document,
  registry,
  frameId,
  ...props
}: ComposePreviewProps) {
  const providedCount = Number(document !== undefined)
    + Number(registry !== undefined)
    + Number(frameId !== undefined)
  let content
  if (providedCount === 0) {
    content = children
  }
  else if (providedCount !== 3 || !document || !registry || !frameId) {
    const missing = [
      document ? null : 'document',
      registry ? null : 'registry',
      frameId ? null : 'frameId',
    ].filter(Boolean).join('、')
    content = <div role="alert">Preview 缺少配置：{missing}</div>
  }
  else {
    const frame = document.nodes[frameId]
    content = frame?.kind === 'frame' ? (
      <div
        data-testid="compose-preview-frame"
        style={{
          ...visualStyle(frame),
          position: 'relative',
          width: frame.transform.width,
          height: frame.transform.height,
        }}
      >
        {frame.visible
          ? frame.childIds.map((childId) => (
              <PreviewNode
                document={document}
                key={childId}
                nodeId={childId}
                registry={registry}
              />
            ))
          : null}
      </div>
    ) : (
      <div role="alert">Preview Frame {frameId} 不存在或不是 Frame</div>
    )
  }

  return (
    <section
      {...props}
      aria-label={props['aria-label'] ?? 'Compose preview'}
      data-compose-core={COMPOSE_UI_CORE_PACKAGE}
      data-compose-ui="preview"
    >
      {content}
    </section>
  )
}
