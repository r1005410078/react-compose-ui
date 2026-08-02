import {
  ComposeEntityBorderLayer,
  ComposeEntityPaintLayer,
  ComposeRegistryEntityRenderer,
  composeEntitySceneStyle,
} from '@compose-ui/component-registry'
import type { ComposeAssetResolver } from '@compose-ui/assets'
import type { ComposePageDocumentLoader } from '@compose-ui/core'
import {
  getComposeHierarchy,
  getComposeLock,
  getComposeVisibility,
  type ComposeDocument,
  type ComposeEntity,
  type ComposePaint,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import type { StageViewport } from '@compose-ui/stage-engine'
import {
  useLayoutEffect,
  useMemo,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react'

interface StageSceneLayerProps {
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly registry: ComposeEntityRegistry
  readonly assetResolver?: ComposeAssetResolver
  /** 页面型物料使用的文档加载端口；类型来自 core，Stage 不实现加载。 */
  readonly pageLoader?: ComposePageDocumentLoader
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
  layoutSnapshot,
  registry,
  assetResolver,
  pageLoader,
  viewport,
  paintPreview,
  onEntityPointerDown,
}: StageSceneLayerProps) {
  // Stage 每次渲染都会重建 pointer 回调。用 ref 转发可让内容子树的记忆化只依赖场景事实，
  // 不被回调身份击穿。回调只在 commit 之后的 DOM 事件里读取，因此在 layout effect 中更新。
  const pointerDownRef = useRef(onEntityPointerDown)
  useLayoutEffect(() => {
    pointerDownRef.current = onEntityPointerDown
  }, [onEntityPointerDown])

  // 平移与缩放只改变根节点 transform，场景内容本身不变。这里把内容子树与 viewport 解耦，
  // 否则每个平移帧都要为全部 Entity 重建 element 并做 fiber diff，大场景下直接掉帧。
  const content = useMemo(() => {
    const renderEntity = (entityId: string) => {
      const entity = document.entities[entityId]
      if (!entity || !getComposeVisibility(entity).visible) return null
      const hierarchy = getComposeHierarchy(entity)
      const box = layoutSnapshot.boxes[entityId]
      if (!box) return null
      const locked = getComposeLock(entity).locked
      return (
        <div
          className={`compose-stage__node${hierarchy ? ' is-container' : ' is-renderer'}${
            locked ? ' is-locked' : ''
          }`}
          data-entity-id={entity.id}
          data-testid={hierarchy ? 'stage-container' : `stage-entity-${entity.id}`}
          key={entity.id}
          style={composeEntitySceneStyle(entity, box)}
          onPointerDown={(event) => pointerDownRef.current(entity, event)}
        >
          <ComposeEntityPaintLayer
            assetResolver={assetResolver}
            entity={entity}
            interactive={Boolean(hierarchy)}
            paint={paintPreview?.entityId === entity.id ? paintPreview.paint : undefined}
          />
          <ComposeRegistryEntityRenderer
            assetResolver={assetResolver}
            pageDocumentPort={pageLoader}
            entity={entity}
            mode="editor"
            registry={registry}
          />
          {hierarchy?.childIds.map(renderEntity)}
          <ComposeEntityBorderLayer entity={entity} />
        </div>
      )
    }
    return document.rootIds.map(renderEntity)
  }, [assetResolver, document, layoutSnapshot, pageLoader, paintPreview, registry])

  return (
    <div
      className="compose-stage__scene"
      data-testid="stage-scene-layer"
      style={{
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      }}
    >
      {content}
    </div>
  )
}
