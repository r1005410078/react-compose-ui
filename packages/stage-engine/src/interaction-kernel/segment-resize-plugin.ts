import { getComposeLock, resolveComposeGeometryConstraints } from '@compose-ui/core'
import { snapResizePoint } from '../canvas-geometry'
import { resolveTargetFrameId } from '../frame-space'
import { screenToWorld, type StagePoint, type StageViewport } from '../geometry'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import { captureStageSpatialBaseline, type StageSpatialBaselineCheck } from './spatial-baseline'
import type {
  StageClaimResult,
  StageInteractionPlugin,
  StagePluginContext,
  StagePointerDownEvent,
  StageSession,
} from './kernel-types'

/** 两点图形端点拖拽的注册 id。 @public */
export const STAGE_SEGMENT_RESIZE_PLUGIN_ID = 'segment-resize'

const SEGMENT_RESIZE_PRIORITY = STAGE_GESTURE_PRIORITY
  .find(({ id }) => id === STAGE_SEGMENT_RESIZE_PLUGIN_ID)!.priority

interface SegmentSessionOptions {
  readonly pointerId: number
  readonly viewport: StageViewport
  readonly entityId: string
  readonly endpoint: 'start' | 'end'
  readonly grabOffset: StagePoint
  readonly startPoint: StagePoint
  readonly endPoint: StagePoint
  readonly baselineHolds: StageSpatialBaselineCheck
}

function createSegmentResizeSession(options: SegmentSessionOptions): StageSession {
  const { pointerId, viewport, entityId, endpoint, grabOffset, baselineHolds } = options
  let start = options.startPoint
  let end = options.endPoint

  return {
    pointerId,
    update(event, ctx) {
      if (event.type !== 'pointer.move' && event.type !== 'pointer.up') return
      // 变换会话使用 pointerdown 时的 viewport：宿主布局重测或受控 viewport 回传不得改变
      // 同一次 Pointer 手势的坐标基线。
      const world = screenToWorld(event.point, viewport)
      // 端点的命中区比端点本身大，直接用指针位置会让首次移动把端点"吸"到指针上。
      // grabOffset 保留按下当刻端点与指针的差值，拖动因此从原位平滑开始。
      const dragged = { x: world.x + grabOffset.x, y: world.y + grabOffset.y }
      const { context } = ctx
      const snapped = snapResizePoint({
        point: dragged,
        // 两点图形的端点可以沿两个轴自由移动；使用角手柄复用既有 smart/grid snap 规则。
        handle: 'se',
        candidates: ctx.index.snapCandidates(
          [entityId],
          resolveTargetFrameId(context.document, context.selectedIds, context.activeFrameId),
        ),
        canvas: context.document.canvas,
        zoom: viewport.zoom,
        disabled: event.modifiers.command,
      })
      if (endpoint === 'start') start = snapped.point
      else end = snapped.point
      ctx.publish({
        ...ctx.snapshot,
        phase: 'segment-resize',
        segmentPreview: { entityId, start, end },
        snapGuides: snapped.guides,
      })
    },
    commit(ctx) {
      // 端点几何写成什么命令由宿主决定：两点图形的文档表示（线段、箭头、连接线）不属于引擎。
      ctx.apply([{ type: 'segment.commit', entityId, start, end }])
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    cancel(ctx) {
      // 预览与吸附参考线只活在快照里，回到空闲即丢弃。
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    isCompatibleWith(next, nextIndex) {
      // 两个端点是按下当刻冻结的世界坐标，并发的文档或布局变化会让它们与真实几何脱节。
      if (!baselineHolds(next)) return false
      // 端点手柄只在单选该 Entity 时存在；选区一变手柄本身就不该再画出来。
      const selected = nextIndex.topLevelSelection(next.selectedIds)
      return selected.length === 1 && selected[0] === entityId
    },
  }
}

/**
 * 两点图形端点拖拽插件。
 *
 * @remarks
 * 接管条件除命中 `segment-endpoint` 外还要求：目标存在且可见、顶层选区恰好是它、未锁定、
 * 几何约束允许 resize、工具是 select 或 scale。任一条不满足都返回 `consumed`——端点手柄画在
 * 图形自身两端，放行会让这次按下退化成一次移动手势。
 *
 * @public
 */
export function createStageSegmentResizePlugin(): StageInteractionPlugin {
  return {
    id: STAGE_SEGMENT_RESIZE_PLUGIN_ID,
    priority: SEGMENT_RESIZE_PRIORITY,
    claim(event: StagePointerDownEvent, ctx: StagePluginContext): StageClaimResult {
      if (event.hit.kind !== 'segment-endpoint') return null
      const { context, index } = ctx
      const entity = context.document.entities[event.hit.entityId]
      const selected = index.topLevelSelection(context.selectedIds)
      const constraints = entity ? resolveComposeGeometryConstraints(entity) : null
      if (
        !entity
        || selected.length !== 1
        || selected[0] !== event.hit.entityId
        || !index.isVisible(entity.id)
        || getComposeLock(entity).locked
        || constraints?.resize === 'none'
        || (context.tool !== 'select' && context.tool !== 'scale')
      ) return 'consumed'

      const pointer = screenToWorld(event.point, context.viewport)
      const grabbed = event.hit.endpoint === 'start' ? event.hit.start : event.hit.end
      ctx.publish({
        ...ctx.idleSnapshot(),
        phase: 'segment-resize',
        segmentPreview: { entityId: entity.id, start: event.hit.start, end: event.hit.end },
      })
      ctx.apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
      return createSegmentResizeSession({
        pointerId: event.pointerId,
        viewport: context.viewport,
        entityId: entity.id,
        endpoint: event.hit.endpoint,
        grabOffset: { x: grabbed.x - pointer.x, y: grabbed.y - pointer.y },
        startPoint: event.hit.start,
        endPoint: event.hit.end,
        baselineHolds: captureStageSpatialBaseline(context),
      })
    },
  }
}
