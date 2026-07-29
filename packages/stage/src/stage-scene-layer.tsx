import { ComposeRegistryEntityRenderer } from '@compose-ui/component-registry'
import type { ComposeAssetResolver } from '@compose-ui/assets'
import {
  getComposeClip,
  getComposeHierarchy,
  getComposeLock,
  getComposeTransform,
  getComposeVisibility,
  resolveComposeAppearance,
  type ComposeDocument,
  type ComposeEntity,
} from '@compose-ui/core'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import type { StageViewport } from '@compose-ui/stage-engine'
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from 'react'

function entityStyle(entity: ComposeEntity): CSSProperties {
  const transform = getComposeTransform(entity)
  const visual = resolveComposeAppearance(entity.components.Appearance)
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
    left: transform.position.x,
    top: transform.position.y,
    width: transform.size.width,
    height: transform.size.height,
    transform: `rotate(${transform.rotation}deg)`,
    transformOrigin: 'center',
    backgroundColor: visual.backgroundColor,
    borderRadius: visual.borderRadius,
    opacity: visual.opacity,
    boxShadow: shadows.length > 0 ? shadows.join(', ') : 'none',
    overflow: hierarchy
      ? (clip?.enabled ? 'hidden' : 'visible')
      : 'hidden',
  }
}

interface StageSceneLayerProps {
  readonly document: ComposeDocument
  readonly registry: ComposeEntityRegistry
  readonly assetResolver?: ComposeAssetResolver
  readonly viewport: StageViewport
  readonly onEntityPointerDown: (
    entity: ComposeEntity,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void
}

/** 只负责把 preview document 映射成可交互 DOM Scene。 */
export function StageSceneLayer({
  document,
  registry,
  assetResolver,
  viewport,
  onEntityPointerDown,
}: StageSceneLayerProps) {
  const renderEntity = (entityId: string) => {
    const entity = document.entities[entityId]
    if (!entity || !getComposeVisibility(entity).visible) return null
    const hierarchy = getComposeHierarchy(entity)
    const locked = getComposeLock(entity).locked
    return (
      <div
        className={`compose-stage__node${hierarchy ? ' is-container' : ' is-renderer'}${
          locked ? ' is-locked' : ''
        }`}
        data-entity-id={entity.id}
        data-testid={hierarchy ? 'stage-container' : `stage-entity-${entity.id}`}
        key={entity.id}
        style={entityStyle(entity)}
        onPointerDown={(event) => onEntityPointerDown(entity, event)}
      >
        <ComposeRegistryEntityRenderer
          assetResolver={assetResolver}
          entity={entity}
          mode="editor"
          registry={registry}
        />
        {hierarchy?.childIds.map(renderEntity)}
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
      {document.rootIds.map(renderEntity)}
    </div>
  )
}
