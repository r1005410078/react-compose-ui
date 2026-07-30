import {
  ComposeEntityBorderLayer,
  ComposeEntityPaintLayer,
  ComposeRegistryEntityRenderer,
  composeEntitySceneStyle,
} from '@compose-ui/component-registry'
import type { ComposeAssetResolver } from '@compose-ui/assets'
import {
  getComposeHierarchy,
  getComposeLock,
  getComposeVisibility,
  type ComposeDocument,
  type ComposeEntity,
  type ComposePaint,
} from '@compose-ui/core'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import type { StageViewport } from '@compose-ui/stage-engine'
import type { PointerEvent as ReactPointerEvent } from 'react'

interface StageSceneLayerProps {
  readonly document: ComposeDocument
  readonly registry: ComposeEntityRegistry
  readonly assetResolver?: ComposeAssetResolver
  readonly viewport: StageViewport
  readonly paintPreview?: { readonly entityId: string; readonly paint: ComposePaint } | null
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
  paintPreview,
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
        style={composeEntitySceneStyle(entity)}
        onPointerDown={(event) => onEntityPointerDown(entity, event)}
      >
        <ComposeEntityPaintLayer
          assetResolver={assetResolver}
          entity={entity}
          interactive={Boolean(hierarchy)}
          paint={paintPreview?.entityId === entity.id ? paintPreview.paint : undefined}
        />
        <ComposeRegistryEntityRenderer
          assetResolver={assetResolver}
          entity={entity}
          mode="editor"
          registry={registry}
        />
        {hierarchy?.childIds.map(renderEntity)}
        <ComposeEntityBorderLayer entity={entity} />
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
