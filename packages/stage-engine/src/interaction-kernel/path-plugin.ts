import { screenToWorld, type StagePoint, type StageViewport } from '../geometry'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import { captureStageSpatialBaseline, type StageSpatialBaselineCheck } from './spatial-baseline'
import type {
  StageInteractionModifiers,
  StagePathHandleKind,
} from '../interaction-controller'
import type { StageClaimResult, StageInteractionPlugin, StagePluginContext, StagePointerDownEvent, StageSession } from './stage-kernel-profile'

/** 可编辑路径手柄拖拽的注册 id。 @public */
export const STAGE_PATH_PLUGIN_ID = 'path'

const PATH_PRIORITY = STAGE_GESTURE_PRIORITY
  .find(({ id }) => id === STAGE_PATH_PLUGIN_ID)!.priority

interface PathSessionOptions {
  readonly pointerId: number
  readonly viewport: StageViewport
  readonly entityId: string
  readonly handle: StagePathHandleKind
  readonly vertexId: string
  readonly startWorld: StagePoint
  readonly startModifiers: StageInteractionModifiers
  readonly baselineHolds: StageSpatialBaselineCheck
}

function createPathSession(options: PathSessionOptions): StageSession {
  const {
    pointerId, viewport, entityId, handle, vertexId, baselineHolds,
  } = options
  let point = options.startWorld
  let modifiers = options.startModifiers

  /** 三个阶段的载荷只差 phase，集中拼装避免字段漏写。 */
  const change = (phase: 'move' | 'end' | 'cancel') => ({
    type: 'path.change' as const,
    entityId,
    vertexId,
    handle,
    phase,
    worldPoint: point,
    modifiers,
  })

  return {
    pointerId,
    update(event, ctx) {
      if (event.type !== 'pointer.move' && event.type !== 'pointer.up') return
      // 变换会话使用 pointerdown 时的 viewport：宿主布局重测或受控 viewport 回传不得改变
      // 同一次 Pointer 手势的坐标基线。
      point = screenToWorld(event.point, viewport)
      modifiers = event.modifiers
      // 移动阶段只把世界坐标交给宿主更新预览；引擎既不产出 Patch 也不缓存几何。
      ctx.apply([change('move')])
    },
    commit(ctx) {
      // 结束阶段只回传最终世界坐标；写成什么命令由宿主决定，引擎不理解路径的文档语义。
      // 终点与松手修饰键都来自仲裁器在 commit 前驱动的那次 update。
      ctx.apply([change('end')])
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    cancel(ctx) {
      // 路径手势被打断（Esc、并发文档变化、会话关闭）时必须显式告知宿主丢弃预览，
      // 否则宿主的本地预览几何会停留在半途状态——引擎自己不持有几何，收不回来。
      ctx.apply([change('cancel')])
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    isCompatibleWith(next) {
      // 宿主换了正在编辑的路径，本次拖拽引用的顶点就不再属于当前会话。
      if (next.pathEditing?.entityId !== entityId) return false
      // 起点世界坐标是按下当刻冻结的，并发的文档或布局变化会让它与真实几何脱节。
      return baselineHolds(next)
    },
  }
}

/**
 * 可编辑路径手柄拖拽插件。
 *
 * @remarks
 * 命中优先级高于 Entity 本体（顶点常常压在自己所属的 Entity 上），因此在优先级表中排在
 * 实体选择与框选之前。宿主未注入 `pathEditing` 时本插件消费掉这次按下而不开手势：Overlay
 * 不该在没有会话时渲染手柄，这里是兜底，保持既有行为不变。
 *
 * @public
 */
export function createStagePathPlugin(): StageInteractionPlugin {
  return {
    id: STAGE_PATH_PLUGIN_ID,
    priority: PATH_PRIORITY,
    claim(event: StagePointerDownEvent, ctx: StagePluginContext): StageClaimResult {
      if (event.hit.kind !== 'path-handle') return null
      const { context } = ctx
      const editing = context.pathEditing
      if (!editing) return 'consumed'

      // 双击顶点 = 切换 corner / smooth，不开始拖拽手势。必须恰好等于 2：连击计数会从
      // 邻近的上一次拖拽延续，若用 >=2，双击的两次按下会各触发一次切换（计数 2 和 3），
      // 净效果是切过去又切回来。toggle 不幂等，这与实体双击进入文字编辑的 >=2 不同。
      if (event.hit.handle === 'vertex' && event.clickCount === 2) {
        ctx.apply([{
          type: 'path.vertex-toggle',
          entityId: editing.entityId,
          vertexId: event.hit.vertexId,
        }])
        return 'consumed'
      }

      const startWorld = screenToWorld(event.point, context.viewport)
      ctx.publish({ ...ctx.idleSnapshot(), phase: 'path-edit' })
      ctx.apply([
        { type: 'pointer.capture', pointerId: event.pointerId },
        {
          type: 'path.change',
          entityId: editing.entityId,
          vertexId: event.hit.vertexId,
          handle: event.hit.handle,
          phase: 'start',
          worldPoint: startWorld,
          modifiers: event.modifiers,
        },
      ])
      return createPathSession({
        pointerId: event.pointerId,
        viewport: context.viewport,
        entityId: editing.entityId,
        handle: event.hit.handle,
        vertexId: event.hit.vertexId,
        startWorld,
        startModifiers: event.modifiers,
        baselineHolds: captureStageSpatialBaseline(context),
      })
    },
  }
}
