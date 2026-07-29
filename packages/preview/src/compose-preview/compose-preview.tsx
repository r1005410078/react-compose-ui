/**
 * 提供可独立嵌入的完整文档或指定 Container 预览。
 *
 * @packageDocumentation
 */

import { ComposeRegistryEntityRenderer } from '@compose-ui/component-registry'
import type { ComposeAssetResolver } from '@compose-ui/assets'
import {
  COMPOSE_UI_CORE_PACKAGE,
  getComposeClip,
  getComposeHierarchy,
  getComposeTransform,
  getComposeVisibility,
  resolveComposeAppearance,
} from '@compose-ui/core'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import type {
  ComposeDocument,
  ComposeEntity,
} from '@compose-ui/core'
import type { CSSProperties, HTMLAttributes } from 'react'

/**
 * ComposePreview 属性。
 *
 * @public
 */
export interface ComposePreviewProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** 文档模式的正式 JSON 文档。 */
  readonly document: ComposeDocument
  /** Stage 与 Preview 共享的实例级 Entity 注册表。 */
  readonly registry: ComposeEntityRegistry
  /** 资源型 Renderer 解析稳定引用时使用的运行时端口。 */
  readonly assetResolver?: ComposeAssetResolver
  /** 输出完整文档或某个根级/嵌套 Container；省略时输出完整文档。 */
  readonly target?: ComposePreviewTarget
}

/**
 * Preview 输出目标。
 *
 * @public
 */
export type ComposePreviewTarget =
  | { readonly kind: 'document' }
  | { readonly kind: 'container'; readonly entityId: string }

function visualStyle(entity: ComposeEntity): CSSProperties {
  const visual = resolveComposeAppearance(entity)
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
    backgroundColor: visual.backgroundColor,
    borderRadius: visual.borderRadius,
    opacity: visual.opacity,
    boxShadow: shadows.length > 0 ? shadows.join(', ') : 'none',
    overflow: hierarchy
      ? (clip?.enabled ? 'hidden' : 'visible')
      : 'hidden',
  }
}

function entityStyle(entity: ComposeEntity): CSSProperties {
  const transform = getComposeTransform(entity)
  return {
    ...visualStyle(entity),
    position: 'absolute' as const,
    left: transform.position.x,
    top: transform.position.y,
    width: transform.size.width,
    height: transform.size.height,
    transform: `rotate(${transform.rotation}deg)`,
    transformOrigin: 'center',
  }
}

function PreviewEntity({
  assetResolver,
  document,
  registry,
  entityId,
}: {
  assetResolver?: ComposeAssetResolver
  document: ComposeDocument
  registry: ComposeEntityRegistry
  entityId: string
}) {
  const entity = document.entities[entityId]
  if (!entity || !getComposeVisibility(entity).visible) return null
  const hierarchy = getComposeHierarchy(entity)
  return (
    <div data-testid={`compose-preview-entity-${entity.id}`} style={entityStyle(entity)}>
      <ComposeRegistryEntityRenderer
        assetResolver={assetResolver}
        entity={entity}
        mode="preview"
        registry={registry}
      />
      {hierarchy?.childIds.map((childId) => (
        <PreviewEntity
          assetResolver={assetResolver}
          document={document}
          entityId={childId}
          key={childId}
          registry={registry}
        />
      ))}
    </div>
  )
}

/**
 * 用普通 DOM 预览 ComposeDocument 输出。
 *
 * @public
 */
export function ComposePreview({
  document,
  registry,
  assetResolver,
  target = { kind: 'document' },
  ...props
}: ComposePreviewProps) {
  const content = target.kind === 'document'
    ? (
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
        {document.rootIds.map((entityId) => (
          <PreviewEntity
            assetResolver={assetResolver}
            document={document}
            entityId={entityId}
            key={entityId}
            registry={registry}
          />
        ))}
      </div>
    )
    : (() => {
        const entity = document.entities[target.entityId]
        const hierarchy = entity ? getComposeHierarchy(entity) : undefined
        const transform = entity ? getComposeTransform(entity) : undefined
        return entity && hierarchy && transform ? (
          <div
            data-testid="compose-preview-container"
            style={{
              ...visualStyle(entity),
              position: 'relative',
              width: transform.size.width,
              height: transform.size.height,
            }}
          >
            {getComposeVisibility(entity).visible
              ? (
                  <>
                    <ComposeRegistryEntityRenderer
                      assetResolver={assetResolver}
                      entity={entity}
                      mode="preview"
                      registry={registry}
                    />
                    {hierarchy.childIds.map((childId) => (
                      <PreviewEntity
                        assetResolver={assetResolver}
                        document={document}
                        entityId={childId}
                        key={childId}
                        registry={registry}
                      />
                    ))}
                  </>
                )
              : null}
          </div>
        ) : (
          <div role="alert">
            Preview Container {target.entityId} 不存在或不是 Container
          </div>
        )
      })()

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
