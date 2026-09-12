import { screenToWorld, type StagePoint } from '../geometry'
import { STAGE_GESTURE_PRIORITY } from '../interaction-kernel/gesture-priority'
import type {
  StageInteractionPlugin,
  StagePluginContext,
  StageSession,
} from '../interaction-kernel/stage-kernel-profile'

/** 绘图 `pick` 入口的注册 id。 @public */
export const STAGE_DRAFTING_PICK_PLUGIN_ID = 'drafting-pick'

const DRAFTING_PICK_PRIORITY = STAGE_GESTURE_PRIORITY
  .find(({ id }) => id === STAGE_DRAFTING_PICK_PLUGIN_ID)!.priority

/**
 * 一次 `pick` 手势：按下不动松手是点一下，指针离开过按下点就是一笔轨迹。
 *
 * @remarks
 * 判据是**指针有没有离开过按下点**而不是位移阈值，与夹点「点亮 vs 拖动」同一条：浏览器在
 * `pointerup` 之前会补发一次原地的 move，因此看「收没收到 move」是错的。
 *
 * 轨迹逐帧交给宿主（`drafting.pick-trail`）画幽灵与轨迹线；松手时整笔作为**一次** `pick`
 * 交出（`drafting.pick`），取消时把轨迹清掉。会话不认识文档，也不解算任何一截——那是宿主
 * 拿轨迹去做的事。
 */
function createPickSession(pointerId: number, origin: StagePoint): StageSession {
  const trail: StagePoint[] = []
  let moved = false
  return {
    pointerId,
    update(event, context) {
      if (event.type !== 'pointer.move' && event.type !== 'pointer.up') return
      const point = screenToWorld(event.point, context.context.viewport)
      if (!moved && (point.x !== origin.x || point.y !== origin.y)) moved = true
      if (!moved) return
      trail.push(point)
      if (event.type === 'pointer.move') {
        context.apply([{ type: 'drafting.pick-trail', trail: [origin, ...trail] }])
      }
    },
    commit(context) {
      context.publish(context.idleSnapshot())
      context.apply([
        { type: 'pointer.release', pointerId },
        { type: 'drafting.pick-trail', trail: null },
        { type: 'drafting.pick', point: origin, trail: moved ? [origin, ...trail] : null },
      ])
    },
    cancel(context) {
      context.publish(context.idleSnapshot())
      context.apply([
        { type: 'pointer.release', pointerId },
        { type: 'drafting.pick-trail', trail: null },
      ])
    },
  }
}

/**
 * 绘图 `pick` 插件。
 *
 * @remarks
 * 命令等着 `pick` 时**在任何命中类型上都接管**：与取点插件同一条理由——此刻点到一个已有
 * Entity，意图是「剪这里」而不是「选中它」。优先级同样排在平移之下：命令进行中仍要能平移
 * 画布去看远处那一截。
 *
 * 与取点插件是两个插件而不是一个：取点是瞬时的（`consumed`），而 `pick` 要跟拖动，两者的
 * 判据（`draftingAwaitingPoint` / `draftingAwaitingPick`）互斥，由提示的 `accepts` 决定。
 *
 * @public
 */
export function createStageDraftingPickPlugin(): StageInteractionPlugin {
  return {
    id: STAGE_DRAFTING_PICK_PLUGIN_ID,
    priority: DRAFTING_PICK_PRIORITY,
    claim(event, ctx: StagePluginContext) {
      if (!ctx.context.draftingAwaitingPick) return null
      ctx.apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
      return createPickSession(event.pointerId, screenToWorld(event.point, ctx.context.viewport))
    },
  }
}
