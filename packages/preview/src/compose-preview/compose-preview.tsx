/**
 * 提供可独立嵌入的完整文档或指定 Container 预览。
 *
 * @packageDocumentation
 */

import {
  ComposeEntityBorderLayer,
  ComposeEntityPaintLayer,
  ComposePaintLayer,
  ComposeRegistryEntityRenderer,
  composeEntitySceneStyle,
  composeEntityVisualStyle,
} from '@compose-ui/component-registry'
import type { ComposeAssetResolver } from '@compose-ui/assets'
import type { ComposePageDocumentLoader } from '@compose-ui/core'
import {
  COMPOSE_UI_CORE_PACKAGE,
  getComposeHierarchy,
  getComposeVisibility,
} from '@compose-ui/core'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import type {
  ComposeDocument,
  ComposeEntity,
  ComposeLayoutSnapshot,
  ComposeResolvedLayoutBox,
} from '@compose-ui/core'
import type { CSSProperties, HTMLAttributes } from 'react'
import type { ComposeLayoutRuntime } from '@compose-ui/layout-engine'
import { useComposePreviewLayout } from './use-layout-runtime'

/**
 * ComposePreview 属性。
 *
 * @public
 */
export interface ComposePreviewProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** 文档模式的正式 JSON 文档。 */
  readonly document: ComposeDocument
  /** 宿主可注入已求解快照；省略时 Preview 创建并拥有独立 LayoutRuntime。 */
  readonly layoutSnapshot?: ComposeLayoutSnapshot
  /** 宿主拥有的 Layout Runtime；Preview 挂接 measurement 但不会在卸载时释放它。 */
  readonly layoutRuntime?: ComposeLayoutRuntime
  /** Stage 与 Preview 共享的实例级 Entity 注册表。 */
  readonly registry: ComposeEntityRegistry
  /** 资源型 Renderer 解析稳定引用时使用的运行时端口。 */
  readonly assetResolver?: ComposeAssetResolver
  /**
   * 页面型物料使用的文档加载端口。
   *
   * @remarks
   * Preview 不实现页面加载或嵌套渲染，只把端口交给物料；未注入时相关实体呈现占位状态。
   */
  readonly pageLoader?: ComposePageDocumentLoader
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

function entityStyle(entity: ComposeEntity, box: ComposeResolvedLayoutBox): CSSProperties {
  return {
    ...composeEntitySceneStyle(entity, box),
    position: 'absolute' as const,
  }
}

function PreviewEntity({
  assetResolver,
  pageLoader,
  document,
  layoutSnapshot,
  registry,
  entityId,
}: {
  assetResolver?: ComposeAssetResolver
  pageLoader?: ComposePageDocumentLoader
  document: ComposeDocument
  layoutSnapshot: ComposeLayoutSnapshot
  registry: ComposeEntityRegistry
  entityId: string
}) {
  const entity = document.entities[entityId]
  if (!entity || !getComposeVisibility(entity).visible) return null
  const hierarchy = getComposeHierarchy(entity)
  const box = layoutSnapshot.boxes[entityId]
  if (!box) return null
  return (
    <div data-testid={`compose-preview-entity-${entity.id}`} style={entityStyle(entity, box)}>
      <ComposeEntityPaintLayer assetResolver={assetResolver} entity={entity} />
      <ComposeRegistryEntityRenderer
        assetResolver={assetResolver}
        entity={entity}
        mode="preview"
        pageDocumentPort={pageLoader}
        registry={registry}
      />
      {hierarchy?.childIds.map((childId) => (
        <PreviewEntity
          assetResolver={assetResolver}
          pageLoader={pageLoader}
          document={document}
          layoutSnapshot={layoutSnapshot}
          entityId={childId}
          key={childId}
          registry={registry}
        />
      ))}
      <ComposeEntityBorderLayer entity={entity} />
    </div>
  )
}

/**
 * 用普通 DOM 预览 ComposeDocument 输出。
 *
 * @public
 */
function ComposePreviewReady({
  document,
  layoutRuntime: _layoutRuntime,
  layoutSnapshot,
  registry,
  assetResolver,
  pageLoader,
  target = { kind: 'document' },
  ...props
}: ComposePreviewProps & { readonly layoutSnapshot: ComposeLayoutSnapshot }) {
  void _layoutRuntime
  const content = target.kind === 'document'
    ? (
      <div
        data-testid="compose-preview-document"
        style={{
          position: 'relative',
          width: document.output.width,
          height: document.output.height,
          overflow: 'hidden',
        }}
      >
        <ComposePaintLayer assetResolver={assetResolver} paint={document.output.backgroundPaint} testId="compose-preview-output-paint" />
        {document.rootIds.map((entityId) => (
          <PreviewEntity
            assetResolver={assetResolver}
            document={document}
            layoutSnapshot={layoutSnapshot}
            pageLoader={pageLoader}
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
        const box = entity ? layoutSnapshot.boxes[entity.id] : undefined
        return entity && hierarchy && box ? (
          <div
            data-testid="compose-preview-container"
            style={{
              ...composeEntityVisualStyle(entity),
              position: 'relative',
              width: box.width,
              height: box.height,
            }}
          >
            {getComposeVisibility(entity).visible
              ? (
                  <>
                    <ComposeEntityPaintLayer assetResolver={assetResolver} entity={entity} />
                    <ComposeRegistryEntityRenderer
                      assetResolver={assetResolver}
                      entity={entity}
                      mode="preview"
                      pageDocumentPort={pageLoader}
                      registry={registry}
                    />
                    {hierarchy.childIds.map((childId) => (
                      <PreviewEntity
                        assetResolver={assetResolver}
                        document={document}
                        layoutSnapshot={layoutSnapshot}
                        pageLoader={pageLoader}
                        entityId={childId}
                        key={childId}
                        registry={registry}
                      />
                    ))}
                    <ComposeEntityBorderLayer entity={entity} />
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
      {layoutSnapshot.diagnostics.length > 0 ? (
        <span
          data-testid="compose-preview-layout-diagnostics"
          role="status"
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clipPath: 'inset(50%)',
          }}
        >
          {layoutSnapshot.diagnostics.map(({ message }) => message).join('；')}
        </span>
      ) : null}
      {content}
    </section>
  )
}

function ManagedComposePreview(props: ComposePreviewProps) {
  const state = useComposePreviewLayout(
    props.document,
    props.registry,
    props.assetResolver,
    props.pageLoader,
    props.layoutRuntime,
  )
  if (state.status === 'loading') {
    return (
      <section aria-busy="true" aria-label={props['aria-label'] ?? 'Compose preview'} role="status">
        正在加载自动布局引擎…
      </section>
    )
  }
  if (state.status === 'error') {
    return (
      <section aria-label={props['aria-label'] ?? 'Compose preview'} role="alert">
        自动布局加载失败：{state.error.message}
      </section>
    )
  }
  return <ComposePreviewReady {...props} layoutSnapshot={state.snapshot} />
}

/** 用普通 DOM 预览 ComposeDocument v6 输出。 @public */
export function ComposePreview(props: ComposePreviewProps) {
  return props.layoutSnapshot
    ? <ComposePreviewReady {...props} layoutSnapshot={props.layoutSnapshot} />
    : <ManagedComposePreview {...props} />
}
