import {
  ComposeEntityBorderLayer,
  ComposeEntityPaintLayer,
  ComposeRegistryEntityRenderer,
  composeEntityOverflowStyle,
  composeEntitySceneStyle,
} from '@compose-ui/component-registry'
import type { ComposeAssetResolver } from '@compose-ui/assets'
import {
  getComposeFrame,
  getComposeHierarchy,
  getComposeLock,
  getComposeRenderer,
  getComposeVisibility,
  resolveComposeOverflow,
  type ComposeDocument,
  type ComposeEntity,
  type ComposePaint,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import type { ComposePageScriptScope, ComposeScriptModuleLoader } from '@compose-ui/script-runtime'
import type { StageViewport } from '@compose-ui/stage-engine'
import {
  useLayoutEffect,
  useMemo,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react'

function StageOverflowIndicator({
  horizontal,
  vertical,
}: {
  readonly horizontal: boolean
  readonly vertical: boolean
}) {
  if (!horizontal && !vertical) return null
  return (
    <div
      aria-hidden="true"
      className="compose-stage__overflow-indicators"
      style={{ pointerEvents: 'none' }}
    >
      {horizontal ? (
        <span className="compose-stage__overflow-indicator is-horizontal" data-testid="stage-overflow-indicator-x">
          <span />
        </span>
      ) : null}
      {vertical ? (
        <span className="compose-stage__overflow-indicator is-vertical" data-testid="stage-overflow-indicator-y">
          <span />
        </span>
      ) : null}
    </div>
  )
}

interface StageSceneLayerProps {
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly registry: ComposeEntityRegistry
  readonly assetResolver?: ComposeAssetResolver
  /** 页面型物料使用的文档加载端口；类型来自 core，Stage 不实现加载。 */
  readonly scriptScope?: ComposePageScriptScope
  readonly scriptModuleLoader?: ComposeScriptModuleLoader
  readonly viewport: StageViewport
  readonly paintPreview?: { readonly entityId: string; readonly paint: ComposePaint } | null
  /**
   * 额外跳过渲染的 Entity；其后代由递归自然剪掉。
   *
   * 由宿主从 core 的 WidgetSwitcher 隐藏派生得到，与 SceneIndex 共用同一个集合引用，
   * 保证「看得见」与「点得到」始终一致。
   */
  readonly hiddenEntityIds?: ReadonlySet<string>
  /** 正在画布内原地编辑文字的 Entity；只有它的 Renderer 收到编辑态。 */
  readonly textEditingEntityId?: string | null
  /**
   * 进入编辑时 Entity 的 authored 纯文本，用于给编辑目标播种初始内容。
   *
   * 它不是实时值：编辑期间的文本由 DOM 持有，Renderer 不得在编辑中用它回写内容，
   * 否则 Auto width 引起的重排会把用户刚敲的字覆盖掉。
   */
  readonly textEditingValue?: string | null
  /** 报告编辑中的纯文本；Stage 据此更新运行时覆盖，不派发文档命令。 */
  readonly onTextEditingChange?: (value: string) => void
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
  scriptScope,
  scriptModuleLoader,
  viewport,
  paintPreview,
  hiddenEntityIds,
  textEditingEntityId = null,
  textEditingValue = null,
  onTextEditingChange,
  onEntityPointerDown,
}: StageSceneLayerProps) {
  // Stage 每次渲染都会重建 pointer 回调。用 ref 转发可让内容子树的记忆化只依赖场景事实，
  // 不被回调身份击穿。回调只在 commit 之后的 DOM 事件里读取，因此在 layout effect 中更新。
  const pointerDownRef = useRef(onEntityPointerDown)
  useLayoutEffect(() => {
    pointerDownRef.current = onEntityPointerDown
  }, [onEntityPointerDown])
  // 编辑态只在会话进出时变化，因此可以直接进入 memo 依赖：编辑中的文本不经过这里，
  // 它由编辑目标的 contentEditable DOM 自己持有，不会每敲一个字符就重建整棵场景。
  const textEditing = useMemo(
    () => textEditingEntityId === null || !onTextEditingChange
      ? null
      : {
          entityId: textEditingEntityId,
          value: textEditingValue ?? '',
          onChange: onTextEditingChange,
        },
    [onTextEditingChange, textEditingEntityId, textEditingValue],
  )

  // 平移与缩放只改变根节点 transform，场景内容本身不变。这里把内容子树与 viewport 解耦，
  // 否则每个平移帧都要为全部 Entity 重建 element 并做 fiber diff，大场景下直接掉帧。
  const content = useMemo(() => {
    const renderEntity = (entityId: string) => {
      const entity = document.entities[entityId]
      if (!entity || !getComposeVisibility(entity).visible) return null
      if (hiddenEntityIds?.has(entityId)) return null
      const hierarchy = getComposeHierarchy(entity)
      const renderer = getComposeRenderer(entity)
      const isSegment = renderer?.type === 'shape'
        && (renderer.props.kind === 'line' || renderer.props.kind === 'arrow')
      const box = layoutSnapshot.boxes[entityId]
      if (!box) return null
      const locked = getComposeLock(entity).locked
      // 指示器仍读领域 overflow；盒样式与 Preview/NestedEntity 共用 composeEntityOverflowStyle。
      const overflow = resolveComposeOverflow(entity)
      return (
        <div
          className={`compose-stage__node${hierarchy ? ' is-container' : ' is-renderer'}${
            locked ? ' is-locked' : ''
          }${isSegment ? ' is-segment' : ''}`}
          data-entity-id={entity.id}
          data-testid={getComposeFrame(entity)
            ? `stage-frame-${entity.id}`
            : hierarchy ? 'stage-container' : `stage-entity-${entity.id}`}
          key={entity.id}
          style={{
            ...composeEntitySceneStyle(entity, box),
            ...composeEntityOverflowStyle(entity),
          }}
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
            entity={entity}
            mode="editor"
            registry={registry}
            scriptModuleLoader={scriptModuleLoader}
            scriptScope={scriptScope}
            textEditing={textEditing?.entityId === entity.id ? textEditing : undefined}
          />
          {hierarchy?.childIds.map(renderEntity)}
          {hierarchy ? (
            <StageOverflowIndicator
              horizontal={overflow.horizontal === 'scroll'}
              vertical={overflow.vertical === 'scroll'}
            />
          ) : null}
          <ComposeEntityBorderLayer entity={entity} />
        </div>
      )
    }
    return document.rootIds.map(renderEntity)
  }, [
    assetResolver,
    document,
    hiddenEntityIds,
    layoutSnapshot,
      paintPreview,
    registry,
    scriptModuleLoader,
    scriptScope,
    textEditing,
  ])

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
