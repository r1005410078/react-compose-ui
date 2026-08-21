import {
  BUILTIN_COMMAND_TYPES,
  getComposeLock,
  resolveComposeAppearance,
  type ComposePaint,
  type JsonValue,
} from '@compose-ui/core'
import { screenToWorld, type StageViewport } from '../geometry'
import { paintSpacePoint, updatePaintFromPointer } from '../gesture-planning'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import { captureStageSpatialBaseline, type StageSpatialBaselineCheck } from './spatial-baseline'
import type { StagePaintHandleKind } from '../interaction-controller'
import type { StageClaimResult, StageInteractionPlugin, StagePluginContext, StagePointerDownEvent, StageSession } from './stage-kernel-profile'

/** 渐变控制柄拖拽的注册 id。 @public */
export const STAGE_PAINT_PLUGIN_ID = 'paint'

const PAINT_PRIORITY = STAGE_GESTURE_PRIORITY
  .find(({ id }) => id === STAGE_PAINT_PLUGIN_ID)!.priority

interface PaintSessionOptions {
  readonly pointerId: number
  readonly viewport: StageViewport
  readonly entityId: string
  readonly handle: StagePaintHandleKind
  readonly stopId?: string
  readonly startPaint: ComposePaint
  readonly baselineHolds: StageSpatialBaselineCheck
}

function createPaintSession(options: PaintSessionOptions): StageSession {
  const { pointerId, viewport, entityId, handle, stopId, baselineHolds } = options
  let paint = options.startPaint

  return {
    pointerId,
    update(event, ctx) {
      if (event.type !== 'pointer.move' && event.type !== 'pointer.up') return
      // 变换会话使用 pointerdown 时的 viewport：宿主布局重测或受控 viewport 回传不得改变
      // 同一次 Pointer 手势的坐标基线。
      const world = screenToWorld(event.point, viewport)
      const local = paintSpacePoint(ctx.index, entityId, world)
      // 目标尺寸尚未求解时保持上一帧：Paint 几何是归一化的，没有尺寸就换算不出局部点。
      if (!local) return
      paint = updatePaintFromPointer(paint, handle, stopId, local)
      ctx.publish({
        ...ctx.snapshot,
        phase: 'paint-edit',
        paintPreview: { entityId, paint, activeStopId: stopId },
      })
    },
    commit(ctx) {
      const entity = ctx.context.document.entities[entityId]
      // 锁定校验在提交时复核：拖拽期间目标被锁上就不该再写入。
      if (entity && !getComposeLock(entity).locked) {
        ctx.apply([{
          type: 'command.dispatch',
          command: {
            id: ctx.context.idFactory(),
            type: BUILTIN_COMMAND_TYPES.setAppearance,
            payload: {
              entityId: entity.id,
              appearance: {
                ...resolveComposeAppearance(entity),
                backgroundPaint: paint,
              } as unknown as JsonValue,
            },
            meta: {
              label: `Update ${entity.name} background paint`,
              source: 'stage',
              targetIds: [entity.id],
              // 连续拖动同一个 Entity 的渐变合并成一条记录，避免每次微调都占一格撤销。
              mergeKey: `stage:paint:${entity.id}`,
            },
          },
        }])
      }
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    cancel(ctx) {
      // 预览只活在快照里，回到空闲即丢弃；捕获也由本会话释放。
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    isCompatibleWith(next) {
      // 基准 Paint 是按下当刻从 Appearance 取的一份副本，之后只被指针推进。并发的文档变化
      // 可能已经改写了同一个 Entity 的 Appearance，此时提交等于用过期基准覆盖别人的编辑。
      if (!baselineHolds(next)) return false
      // Inspector 关掉 Paint 编辑、或选区不再恰好是这一个目标，控制柄本身就已经不该存在。
      return next.paintEditing?.entityId === entityId
        && next.selectedIds.length === 1
        && next.selectedIds[0] === entityId
    },
  }
}

/**
 * 渐变控制柄拖拽插件。
 *
 * @remarks
 * 接管条件比大多数插件严：除了命中 `paint-handle`，还要求 Inspector 正打开该 Entity 的 Paint
 * 编辑、选区恰好是它、且未被锁定。任一条不满足都返回 `consumed` 而不是 `null`——控制柄压在
 * Entity 自己身上，放行会让这次按下退化成一次移动手势。
 *
 * @public
 */
export function createStagePaintPlugin(): StageInteractionPlugin {
  return {
    id: STAGE_PAINT_PLUGIN_ID,
    priority: PAINT_PRIORITY,
    claim(event: StagePointerDownEvent, ctx: StagePluginContext): StageClaimResult {
      if (event.hit.kind !== 'paint-handle') return null
      const { context } = ctx
      const editing = context.paintEditing
      const entity = editing ? context.document.entities[editing.entityId] : undefined
      if (
        !editing
        || !entity
        || context.selectedIds.length !== 1
        || context.selectedIds[0] !== editing.entityId
        || getComposeLock(entity).locked
      ) return 'consumed'

      // 首帧不带 paintPreview：还没有位移可预览，控制柄由快照派生按 Appearance 里的当前
      // Paint 算出，位置与 Inspector 完全一致。第一次 move 才产生预览。
      ctx.publish({ ...ctx.idleSnapshot(), phase: 'paint-edit' })
      ctx.apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
      return createPaintSession({
        pointerId: event.pointerId,
        viewport: context.viewport,
        entityId: editing.entityId,
        handle: event.hit.handle,
        stopId: event.hit.stopId,
        startPaint: resolveComposeAppearance(entity).backgroundPaint,
        baselineHolds: captureStageSpatialBaseline(context),
      })
    },
  }
}
