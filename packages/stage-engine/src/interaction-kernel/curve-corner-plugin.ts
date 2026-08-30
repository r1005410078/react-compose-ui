import { screenToWorld, type StagePoint, type StageViewport } from '../geometry'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import { captureStageSpatialBaseline, type StageSpatialBaselineCheck } from './spatial-baseline'
import type { StageClaimResult, StageInteractionPlugin, StagePluginContext, StagePointerDownEvent, StageSession } from './stage-kernel-profile'

/** 圆角手柄拖拽的注册 id。 @public */
export const STAGE_CURVE_CORNER_PLUGIN_ID = 'curve-corner'

const CURVE_CORNER_PRIORITY = STAGE_GESTURE_PRIORITY
  .find(({ id }) => id === STAGE_CURVE_CORNER_PLUGIN_ID)!.priority

interface CurveCornerSessionOptions {
  readonly pointerId: number
  readonly viewport: StageViewport
  readonly entityId: string
  readonly cornerIndex: number
  readonly startWorld: StagePoint
  readonly baselineHolds: StageSpatialBaselineCheck
}

function createCurveCornerSession(options: CurveCornerSessionOptions): StageSession {
  const { pointerId, viewport, entityId, cornerIndex, baselineHolds } = options
  let point = options.startWorld

  /** 三个阶段的载荷只差 phase，集中拼装避免字段漏写。 */
  const change = (phase: 'move' | 'end' | 'cancel') => ({
    type: 'curve-corner.change' as const,
    entityId,
    cornerIndex,
    phase,
    worldPoint: point,
  })

  return {
    pointerId,
    update(event, ctx) {
      if (event.type !== 'pointer.move' && event.type !== 'pointer.up') return
      // 与其余变换会话一致，坐标基线冻结在 pointerdown 那一刻的 viewport 上：宿主布局重测
      // 或受控 viewport 回传不得改变同一次手势的换算。
      point = screenToWorld(event.point, viewport)
      ctx.apply([change('move')])
    },
    commit(ctx) {
      ctx.apply([change('end')])
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    cancel(ctx) {
      // 宿主拿着本地预览，引擎自己不持有几何——不显式告知就收不回来。
      ctx.apply([change('cancel')])
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    isCompatibleWith(next) {
      // 选中集换了对象，这次拖动引用的那个角就不再属于当前会话。
      if (!next.selectedIds.includes(entityId)) return false
      return baselineHolds(next)
    },
  }
}

/**
 * 圆角手柄拖拽插件。
 *
 * @remarks
 * 优先级排在**变换指示器之上**：指示器的轴把手会横穿角内侧，排在它之下会让圆角手柄在盒被
 * 转过之后的某些角度上按不动，而那正是它最容易被抓到的地方。同时排在路径与 Paint 手柄之下
 * ——那些是**别的编辑会话**的把手，不该被它偷走。
 *
 * 手柄由呈现层画在选中的曲线上，因此本插件不判断「该不该有手柄」：命中类型自带 `entityId`
 * 与角下标，判断留在画它的那一侧。
 *
 * @public
 */
export function createStageCurveCornerPlugin(): StageInteractionPlugin {
  return {
    id: STAGE_CURVE_CORNER_PLUGIN_ID,
    priority: CURVE_CORNER_PRIORITY,
    claim(event: StagePointerDownEvent, ctx: StagePluginContext): StageClaimResult {
      if (event.hit.kind !== 'curve-corner') return null
      const { context } = ctx
      const startWorld = screenToWorld(event.point, context.viewport)
      ctx.apply([
        { type: 'pointer.capture', pointerId: event.pointerId },
        {
          type: 'curve-corner.change',
          entityId: event.hit.entityId,
          cornerIndex: event.hit.cornerIndex,
          phase: 'start',
          worldPoint: startWorld,
        },
      ])
      return createCurveCornerSession({
        pointerId: event.pointerId,
        viewport: context.viewport,
        entityId: event.hit.entityId,
        cornerIndex: event.hit.cornerIndex,
        startWorld,
        baselineHolds: captureStageSpatialBaseline(context),
      })
    },
  }
}
