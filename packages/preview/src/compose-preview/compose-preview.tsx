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
  composeEntityAppearanceStyle,
  composeEntityOverflowStyle,
  composeEntitySceneStyle,
  useComposePageScriptScope,
} from '@compose-ui/component-registry'
import type { ComposeAssetResolver } from '@compose-ui/assets'
import type { ComposePageDocumentLoader, ComposePageFile } from '@compose-ui/core'
import {
  COMPOSE_UI_CORE_PACKAGE,
  getComposeHierarchy,
  getComposeLayout,
  getComposeLayoutItem,
  getComposeVisibility,
  resolveComposeRenderedChildIds,
  resolveComposeAppearance,
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
import type {
  ComposePageScriptScope,
  ComposeScriptModuleLoader,
} from '@compose-ui/script-runtime'
import { useComposeAnimationPlayback } from '../playback/use-animation-playback'
import { useComposePreviewLayout } from './use-layout-runtime'

/**
 * ComposePreview 属性。
 *
 * @public
 */
export interface ComposePreviewProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** 文档模式的正式 JSON 文档。 */
  readonly document?: ComposeDocument
  /** 聚合页面模式；提供后 Preview 为该实例加载并运行 setup。 */
  readonly page?: ComposePageFile
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
  /** 已由宿主创建的页面作用域；独立 document 模式也可显式注入。 */
  readonly scriptScope?: ComposePageScriptScope
  /** 页面及嵌套 Page Slot 使用的可替换脚本模块 Loader。 */
  readonly scriptModuleLoader?: ComposeScriptModuleLoader
  /** 输出完整文档或某个根级/嵌套 Container；省略时输出完整文档。 */
  readonly target?: ComposePreviewTarget
  /**
   * 宿主接管的动画播放头毫秒（如预览对话框的手动播放会话）。
   *
   * @remarks
   * 存在时优先于文档动画的脚本播放控制绑定；Preview 始终负责采样，宿主不要再传
   * 预先采样过的文档。宿主自带 `layoutSnapshot` 时动画采样整体停用（快照属于基础
   * 文档，采样几何与其错配）。
   */
  readonly animationTimeMs?: number
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
    ...composeEntityOverflowStyle(entity),
    position: 'absolute' as const,
  }
}

function previewContentExtentStyle(
  entity: ComposeEntity,
  document: ComposeDocument,
  layoutSnapshot: ComposeLayoutSnapshot,
  box: ComposeResolvedLayoutBox,
): CSSProperties {
  const hierarchy = getComposeHierarchy(entity)
  const layout = getComposeLayout(entity)
  const borderWidth = resolveComposeAppearance(entity).borderWidth
  let width = box.width
  let height = box.height
  hierarchy?.childIds.forEach((childId) => {
    const child = document.entities[childId]
    const childBox = layoutSnapshot.boxes[childId]
    if (!child || !childBox) return
    const margin = getComposeLayoutItem(child).margin
    width = Math.max(
      width,
      childBox.x + childBox.width + margin.right + (layout?.padding.right ?? 0) + borderWidth,
    )
    height = Math.max(
      height,
      childBox.y + childBox.height + margin.bottom + (layout?.padding.bottom ?? 0) + borderWidth,
    )
  })
  return {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    pointerEvents: 'none',
  }
}

function PreviewContentExtent({
  box,
  document,
  entity,
  layoutSnapshot,
}: {
  readonly box: ComposeResolvedLayoutBox
  readonly document: ComposeDocument
  readonly entity: ComposeEntity
  readonly layoutSnapshot: ComposeLayoutSnapshot
}) {
  return (
    <div
      aria-hidden="true"
      data-testid={`compose-preview-content-extent-${entity.id}`}
      style={previewContentExtentStyle(entity, document, layoutSnapshot, box)}
    />
  )
}

function PreviewEntity({
  assetResolver,
  pageLoader,
  document,
  layoutSnapshot,
  registry,
  entityId,
  scriptScope,
  scriptModuleLoader,
}: {
  assetResolver?: ComposeAssetResolver
  pageLoader?: ComposePageDocumentLoader
  document: ComposeDocument
  layoutSnapshot: ComposeLayoutSnapshot
  registry: ComposeEntityRegistry
  entityId: string
  scriptScope?: ComposePageScriptScope
  scriptModuleLoader?: ComposeScriptModuleLoader
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
        scriptModuleLoader={scriptModuleLoader}
        scriptScope={scriptScope}
      />
      {(hierarchy ? resolveComposeRenderedChildIds(document, entity.id) : []).map((childId) => (
        <PreviewEntity
          assetResolver={assetResolver}
          pageLoader={pageLoader}
          document={document}
          layoutSnapshot={layoutSnapshot}
          entityId={childId}
          key={childId}
          registry={registry}
          scriptModuleLoader={scriptModuleLoader}
          scriptScope={scriptScope}
        />
      ))}
      {hierarchy ? (
        <PreviewContentExtent
          box={box}
          document={document}
          entity={entity}
          layoutSnapshot={layoutSnapshot}
        />
      ) : null}
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
  page: _page,
  scriptScope,
  scriptModuleLoader,
  target = { kind: 'document' },
  ...props
}: ComposePreviewProps & {
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
}) {
  void _layoutRuntime
  void _page
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
            scriptModuleLoader={scriptModuleLoader}
            scriptScope={scriptScope}
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
              ...composeEntityAppearanceStyle(entity),
              ...composeEntityOverflowStyle(entity),
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
                      scriptModuleLoader={scriptModuleLoader}
                      scriptScope={scriptScope}
                    />
                    {resolveComposeRenderedChildIds(document, entity.id).map((childId) => (
                      <PreviewEntity
                        assetResolver={assetResolver}
                        document={document}
                        layoutSnapshot={layoutSnapshot}
                        pageLoader={pageLoader}
                        entityId={childId}
                        key={childId}
                        registry={registry}
                        scriptModuleLoader={scriptModuleLoader}
                        scriptScope={scriptScope}
                      />
                    ))}
                    <PreviewContentExtent
                      box={box}
                      document={document}
                      entity={entity}
                      layoutSnapshot={layoutSnapshot}
                    />
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

function ManagedComposePreview(props: ComposePreviewProps & { readonly document: ComposeDocument }) {
  const state = useComposePreviewLayout(
    props.document,
    props.registry,
    props.assetResolver,
    props.pageLoader,
    props.layoutRuntime,
    props.scriptScope,
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
  const ownedScope = useComposePageScriptScope({
    page: props.page,
    assetResolver: props.assetResolver,
    scriptModuleLoader: props.scriptModuleLoader,
  })
  const document = props.document ?? props.page?.document
  const scriptScope = props.scriptScope ?? ownedScope
  // 动画采样只在 Preview 自管布局时启用：宿主快照属于基础文档，与采样几何错配。
  const animatedDocument = useComposeAnimationPlayback({
    document,
    scope: scriptScope,
    enabled: props.layoutSnapshot == null,
    ...(props.animationTimeMs !== undefined ? { timeMsOverride: props.animationTimeMs } : {}),
  })
  if (!document) return <section role="alert">Preview 缺少 ComposeDocument 或页面</section>
  const resolvedProps = {
    ...props,
    document: animatedDocument ?? document,
    scriptScope,
  }
  return resolvedProps.layoutSnapshot
    ? <ComposePreviewReady {...resolvedProps} layoutSnapshot={resolvedProps.layoutSnapshot} />
    : <ManagedComposePreview {...resolvedProps} />
}

