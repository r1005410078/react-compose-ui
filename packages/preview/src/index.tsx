/**
 * 提供可独立嵌入的 legacy 容器、完整文档或指定 Frame 预览。
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
  /** 文档模式的正式 JSON 文档；必须与 registry 一起提供。 */
  readonly document?: ComposeDocument
  /** Stage 与 Preview 共享的实例级组件注册表。 */
  readonly registry?: ComponentRegistry
  /** 输出完整文档或某个根级/嵌套 Frame；省略时输出完整文档。 */
  readonly target?: ComposePreviewTarget
}

/**
 * Preview 输出目标。
 *
 * @public
 */
export type ComposePreviewTarget =
  | { readonly kind: 'document' }
  | { readonly kind: 'frame'; readonly frameId: string }

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
    overflow: node.kind === 'frame' && !node.clipContent ? 'visible' : 'hidden',
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
 * 渲染 legacy children，或用普通 DOM 预览 ComposeDocument 输出。
 *
 * @public
 */
export function ComposePreview({
  children = 'Compose Preview',
  document,
  registry,
  target = { kind: 'document' },
  ...props
}: ComposePreviewProps) {
  const providedCount = Number(document !== undefined)
    + Number(registry !== undefined)
  let content
  if (providedCount === 0) {
    content = children
  }
  else if (providedCount !== 2 || !document || !registry) {
    const missing = [
      document ? null : 'document',
      registry ? null : 'registry',
    ].filter(Boolean).join('、')
    content = <div role="alert">Preview 缺少配置：{missing}</div>
  }
  else if (target.kind === 'document') {
    content = (
      <div
        data-testid="compose-preview-document"
        style={{
          position: 'relative',
          width: document.output.width,
          height: document.output.height,
          overflow: 'hidden',
          backgroundColor: document.output.backgroundColor,
        }}
      >
        {document.rootIds.map((nodeId) => (
          <PreviewNode
            document={document}
            key={nodeId}
            nodeId={nodeId}
            registry={registry}
          />
        ))}
      </div>
    )
  }
  else {
    const frame = document.nodes[target.frameId]
    content = frame?.kind === 'frame' ? (
      <div
        data-testid="compose-preview-frame"
        style={{
          ...visualStyle(frame),
          position: 'relative',
          width: frame.transform.width,
          height: frame.transform.height,
          overflow: 'hidden',
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
      <div role="alert">
        Preview Frame {target.frameId} 不存在或不是 Frame
      </div>
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
