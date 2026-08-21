import {
  listFrameWorldGuides,
  resolveTargetFrameId,
  toFrameGuidePosition,
} from '../frame-space'
import { snapValueToGrid } from '../canvas-geometry'
import { screenToWorld, type StagePoint, type StageViewport } from '../geometry'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import { captureStageSpatialBaseline, type StageSpatialBaselineCheck } from './spatial-baseline'
import type { JsonValue } from '@compose-ui/core'
import type {
  StageInteractionContext,
  StageInteractionEffect,
  StagePreviewGuide,
} from '../interaction-controller'
import type {
  StageClaimResult,
  StageInteractionPlugin,
  StagePluginContext,
  StagePointerDownEvent,
  StageSession,
} from './kernel-types'

/** 从标尺拖出辅助线的注册 id。 @public */
export const STAGE_GUIDE_CREATE_PLUGIN_ID = 'guide-create'

/** 拖动既有辅助线的注册 id。 @public */
export const STAGE_GUIDE_MOVE_PLUGIN_ID = 'guide-move'

const priorityOf = (id: string) =>
  STAGE_GESTURE_PRIORITY.find((entry) => entry.id === id)!.priority

/**
 * 辅助线拖回「自己那条标尺」即视为删除。
 *
 * @remarks
 * 横线（axis `y`）属于顶部标尺，落点 y 为负表示已经退回标尺区域；竖线（axis `x`）属于左侧
 * 标尺，看 x。surface 坐标以标尺内边缘为原点，因此负值就等价于「在标尺里」。
 */
function isInsideOwningRuler(axis: 'x' | 'y', point: StagePoint): boolean {
  return axis === 'y' ? point.y < 0 : point.x < 0
}

/** 按网格把辅助线位置吸附到该轴的步长上。 */
function snapGuidePosition(
  context: StageInteractionContext,
  axis: 'x' | 'y',
  world: StagePoint,
  disabled: boolean,
): number {
  const { grid } = context.document.canvas
  return snapValueToGrid(
    axis === 'x' ? world.x : world.y,
    axis === 'x' ? grid.stepX : grid.stepY,
    axis === 'x' ? grid.offsetX : grid.offsetY,
    grid.snapEnabled && !disabled,
  )
}

/** 解析当前活动 Frame 及其世界原点；缺一不可，否则辅助线无处落盘。 */
function resolveGuideFrame(context: StageInteractionContext, ctx: StagePluginContext) {
  const frameId = resolveTargetFrameId(context.document, context.selectedIds, context.activeFrameId)
  const frameOrigin = frameId ? ctx.index.getFrameOrigin(frameId) : null
  return frameId && frameOrigin ? { frameId, frameOrigin } : null
}

function createGuideCreateSession(
  pointerId: number,
  viewport: StageViewport,
  initialGuides: readonly StagePreviewGuide[],
  startPoint: StagePoint,
  baselineHolds: StageSpatialBaselineCheck,
): StageSession {
  let guides = initialGuides
  let point = startPoint

  return {
    pointerId,
    update(event, ctx) {
      if (event.type !== 'pointer.move' && event.type !== 'pointer.up') return
      point = event.point
      const world = screenToWorld(event.point, viewport)
      guides = guides.map((guide) => ({
        ...guide,
        position: snapGuidePosition(ctx.context, guide.axis, world, event.modifiers.command),
      }))
      ctx.publish({
        ...ctx.snapshot,
        phase: 'guide-create',
        guidePreview: guides,
        guideDelete: guides.every((guide) => isInsideOwningRuler(guide.axis, point)),
      })
    },
    commit(ctx) {
      // axis 'y' 的横线来自顶部标尺，落点仍在标尺内（y < 0）就放弃创建；竖线同理看 x。
      const created = guides.filter((guide) => guide.axis === 'y' ? point.y >= 0 : point.x >= 0)
      const frame = resolveGuideFrame(ctx.context, ctx)
      if (created.length > 0 && frame) {
        // 手势全程在世界坐标里进行，落盘前换算回该 Frame 的局部坐标。
        const commands = created.map((guide) => ({
          id: ctx.context.idFactory(),
          type: 'frame.guide.create',
          payload: {
            frameId: frame.frameId,
            guide: {
              id: guide.id,
              axis: guide.axis,
              position: toFrameGuidePosition(guide.axis, guide.position, frame.frameOrigin),
            } as unknown as JsonValue,
          },
        }))
        const effect: StageInteractionEffect = {
          type: 'command.dispatch',
          // 一次拖出两条（标尺角）合并成一条 batch，撤销才是一步。
          command: created.length === 1
            ? {
                ...commands[0]!,
                meta: {
                  label: ctx.context.labels?.createGuide ?? 'Create guide',
                  source: 'stage',
                },
              }
            : {
                id: ctx.context.idFactory(),
                type: 'transaction.batch',
                payload: { commands: commands as unknown as JsonValue },
                meta: {
                  label: ctx.context.labels?.createGuides ?? 'Create guides',
                  source: 'stage',
                },
              },
        }
        ctx.apply([effect])
      }
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    cancel(ctx) {
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    // 辅助线落盘要解析活动 Frame 与它的世界原点，两者都随文档与布局变化；工具切换同理
    // 意味着用户已经离开这次手势。
    isCompatibleWith: baselineHolds,
  }
}

/**
 * 从标尺拖出辅助线的插件。
 *
 * @remarks
 * 顶部（水平）标尺拖出的是横线，横线由 `world.y` 定位，因此 `guide.axis` 是 `y`；左侧标尺
 * 同理拖出 axis `x` 的竖线。**标尺自身的 axis 与辅助线的 axis 互为反向**，不能直接沿用。
 * 标尺角同时拖出两条。
 *
 * @public
 */
export function createStageGuideCreatePlugin(): StageInteractionPlugin {
  return {
    id: STAGE_GUIDE_CREATE_PLUGIN_ID,
    priority: priorityOf(STAGE_GUIDE_CREATE_PLUGIN_ID),
    claim(event: StagePointerDownEvent, ctx: StagePluginContext): StageClaimResult {
      if (event.hit.kind !== 'ruler' && event.hit.kind !== 'ruler-corner') return null
      const { context } = ctx
      const axes: readonly ('x' | 'y')[] = event.hit.kind === 'ruler-corner'
        ? ['x', 'y']
        : [event.hit.axis === 'x' ? 'y' : 'x']
      const world = screenToWorld(event.point, context.viewport)
      const guides = axes.map((axis) => ({
        id: context.idFactory(),
        axis,
        position: snapGuidePosition(context, axis, world, event.modifiers.command),
      }))
      ctx.publish({ ...ctx.idleSnapshot(), phase: 'guide-create', guidePreview: guides })
      ctx.apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
      return createGuideCreateSession(
        event.pointerId,
        context.viewport,
        guides,
        event.point,
        captureStageSpatialBaseline(context),
      )
    },
  }
}

function createGuideMoveSession(
  pointerId: number,
  viewport: StageViewport,
  guideId: string,
  axis: 'x' | 'y',
  initialPosition: number,
  startPoint: StagePoint,
  baselineHolds: StageSpatialBaselineCheck,
): StageSession {
  let position = initialPosition
  let point = startPoint

  return {
    pointerId,
    update(event, ctx) {
      if (event.type !== 'pointer.move' && event.type !== 'pointer.up') return
      point = event.point
      position = snapGuidePosition(
        ctx.context,
        axis,
        screenToWorld(event.point, viewport),
        event.modifiers.command,
      )
      ctx.publish({
        ...ctx.snapshot,
        phase: 'guide-move',
        guideDelete: isInsideOwningRuler(axis, point),
        guidePreview: [{ id: guideId, axis, position }],
      })
    },
    commit(ctx) {
      const shouldDelete = isInsideOwningRuler(axis, point)
      const frame = resolveGuideFrame(ctx.context, ctx)
      if (frame) {
        ctx.apply([{
          type: 'command.dispatch',
          command: {
            id: ctx.context.idFactory(),
            type: shouldDelete ? 'frame.guide.delete' : 'frame.guide.move',
            payload: shouldDelete
              ? { frameId: frame.frameId, guideId }
              : {
                  frameId: frame.frameId,
                  guideId,
                  position: toFrameGuidePosition(axis, position, frame.frameOrigin),
                },
            meta: {
              label: shouldDelete
                ? ctx.context.labels?.deleteGuide ?? 'Delete guide'
                : ctx.context.labels?.moveGuide ?? 'Move guide',
              source: 'stage',
            },
          },
        }])
      }
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    cancel(ctx) {
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    // 被拖动的那条辅助线可能已被别处删除，活动 Frame 也可能已经换掉。
    isCompatibleWith: baselineHolds,
  }
}

/**
 * 拖动既有辅助线的插件。
 *
 * @remarks
 * 拖回自己那条标尺即删除，否则写回新位置。命中一条已不存在的辅助线时消费这次按下——命中判定
 * 与文档已经脱节，放行会让它落到框选。
 *
 * @public
 */
export function createStageGuideMovePlugin(): StageInteractionPlugin {
  return {
    id: STAGE_GUIDE_MOVE_PLUGIN_ID,
    priority: priorityOf(STAGE_GUIDE_MOVE_PLUGIN_ID),
    claim(event: StagePointerDownEvent, ctx: StagePluginContext): StageClaimResult {
      if (event.hit.kind !== 'guide') return null
      const { guideId: hitGuideId } = event.hit
      const { context, index } = ctx
      const frameId = resolveTargetFrameId(
        context.document,
        context.selectedIds,
        context.activeFrameId,
      )
      const guide = listFrameWorldGuides(context.document, frameId, index)
        .find((item) => item.id === hitGuideId)
      if (!guide) return 'consumed'
      ctx.publish({
        ...ctx.idleSnapshot(),
        phase: 'guide-move',
        guidePreview: [{ id: guide.id, axis: guide.axis, position: guide.value }],
      })
      ctx.apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
      return createGuideMoveSession(
        event.pointerId,
        context.viewport,
        guide.id,
        guide.axis,
        guide.value,
        event.point,
        captureStageSpatialBaseline(context),
      )
    },
  }
}
