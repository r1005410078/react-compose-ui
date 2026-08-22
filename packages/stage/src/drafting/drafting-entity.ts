import {
  BUILTIN_COMMAND_TYPES,
  createComposeLineCurve,
  getComposeHierarchy,
  getComposeLock,
  getComposeVisibility,
  normalizeComposeCurveGeometry,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
  type EditorCommand,
  type JsonValue,
} from '@compose-ui/core'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  applyMatrix,
  getEntityWorldMatrix,
  invertMatrix,
  type StagePoint,
  type StageSceneIndex,
} from '@compose-ui/stage-engine'
import type { StageDraftingSegment } from '@compose-ui/stage-engine'

/** 绘图落地一段线所需的最小上下文。 @internal */
export interface StageDraftingCommitContext {
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly index: StageSceneIndex
  readonly registry: ComposeEntityRegistry
  readonly idFactory: () => string
  readonly activeFrameId?: string | null
}

function usableParent(document: ComposeDocument, entityId: string | null): ComposeEntity | null {
  if (!entityId) return null
  const candidate = document.entities[entityId]
  if (!candidate) return null
  return getComposeHierarchy(candidate)
    && !getComposeLock(candidate).locked
    && getComposeVisibility(candidate).visible
    ? candidate
    : null
}

/**
 * 把一段世界坐标的线变成一条 `entity.create` 命令。
 *
 * @remarks
 * **引擎不创建 Entity**，因此这一步在宿主完成：Preset 与 ID 都在这里定。几何写进 `Curve`
 * 与 `LayoutItem` 时走 `normalizeComposeCurveGeometry`——与 `entity.curve.set` 漏斗同一个
 * 换算，否则新建的线与之后编辑出来的线会遵守两套盒对齐规则。
 *
 * 落点父级取线段中点所在的容器；不在任何容器里时落进激活场景，与「根层落点按类型分流」
 * 一致——曲线不是容器，不走升格。
 *
 * @returns 可派发的命令；Preset 缺失时返回 null。
 * @internal
 */
export function createStageDraftingCurveCommand(
  context: StageDraftingCommitContext,
  segment: StageDraftingSegment,
): EditorCommand | null {
  const seed = context.registry.createSeed('curve')
  if (!seed.ok) return null

  const midpoint: StagePoint = {
    x: (segment.start.x + segment.end.x) / 2,
    y: (segment.start.y + segment.end.y) / 2,
  }
  const parent = usableParent(context.document, context.index.containerAtPoint(midpoint))
    ?? usableParent(context.document, context.activeFrameId ?? null)
  const inverse = parent
    ? invertMatrix(getEntityWorldMatrix(context.document, context.layoutSnapshot, parent.id))
    : null
  const toParent = (point: StagePoint) => (inverse ? applyMatrix(inverse, point) : point)
  const normalized = normalizeComposeCurveGeometry(
    createComposeLineCurve(toParent(segment.start), toParent(segment.end)),
  )

  const entityId = context.idFactory()
  const layoutItem = seed.seed.components.LayoutItem as Record<string, unknown>
  const entity: ComposeEntity = {
    ...seed.seed,
    id: entityId,
    components: {
      ...seed.seed.components,
      Curve: normalized.curve,
      LayoutItem: {
        ...layoutItem,
        offset: normalized.offset,
        width: { ...(layoutItem.width as object), value: normalized.size.width },
        height: { ...(layoutItem.height as object), value: normalized.size.height },
      },
    },
  }

  return {
    id: context.idFactory(),
    type: BUILTIN_COMMAND_TYPES.createEntity,
    payload: {
      entity: entity as unknown as JsonValue,
      parentId: parent ? parent.id : null,
    },
    meta: { label: entity.name, source: 'stage', targetIds: [entityId] },
  }
}
