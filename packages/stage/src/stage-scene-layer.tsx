import { RegistryComponent } from '@compose-ui/component-registry'
import { resolveNodeStyle } from '@compose-ui/core'
import type { ComponentRegistry } from '@compose-ui/component-registry'
import type { ComposeDocument, ComposeNode } from '@compose-ui/core'
import type { StageViewport } from '@compose-ui/stage-engine'
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from 'react'

function nodeStyle(node: ComposeNode): CSSProperties {
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
    left: node.transform.x,
    top: node.transform.y,
    width: node.transform.width,
    height: node.transform.height,
    transform: `rotate(${node.transform.rotation}deg)`,
    transformOrigin: 'center',
    backgroundColor: visual.backgroundColor,
    borderRadius: visual.borderRadius,
    opacity: visual.opacity,
    boxShadow: shadows.length > 0 ? shadows.join(', ') : 'none',
    overflow: node.kind === 'frame' && !node.clipContent ? 'visible' : 'hidden',
  }
}

interface StageSceneLayerProps {
  readonly document: ComposeDocument
  readonly registry: ComponentRegistry
  readonly viewport: StageViewport
  readonly onNodePointerDown: (
    node: ComposeNode,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void
}

/** 只负责把 preview document 映射成可交互 DOM Scene。 */
export function StageSceneLayer({
  document,
  registry,
  viewport,
  onNodePointerDown,
}: StageSceneLayerProps) {
  const renderNode = (nodeId: string) => {
    const node = document.nodes[nodeId]
    if (!node?.visible) return null
    return (
      <div
        className={`compose-stage__node is-${node.kind}${node.locked ? ' is-locked' : ''}`}
        data-node-id={node.id}
        data-testid={node.kind === 'frame' ? 'stage-frame' : `stage-node-${node.id}`}
        key={node.id}
        style={nodeStyle(node)}
        onPointerDown={(event) => onNodePointerDown(node, event)}
      >
        {node.kind === 'component'
          ? <RegistryComponent mode="editor" node={node} registry={registry} />
          : node.childIds.map(renderNode)}
      </div>
    )
  }

  return (
    <div
      className="compose-stage__scene"
      data-testid="stage-scene-layer"
      style={{
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      }}
    >
      {document.rootIds.map(renderNode)}
    </div>
  )
}
