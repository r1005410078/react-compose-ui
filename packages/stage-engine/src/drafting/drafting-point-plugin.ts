import { screenToWorld } from '../geometry'
import { STAGE_GESTURE_PRIORITY } from '../interaction-kernel/gesture-priority'
import type {
  StageInteractionPlugin,
  StagePluginContext,
} from '../interaction-kernel/stage-kernel-profile'

/** 绘图取点入口的注册 id。 @public */
export const STAGE_DRAFTING_POINT_PLUGIN_ID = 'drafting-point'

const DRAFTING_POINT_PRIORITY = STAGE_GESTURE_PRIORITY
  .find(({ id }) => id === STAGE_DRAFTING_POINT_PLUGIN_ID)!.priority

/**
 * 绘图取点插件。
 *
 * @remarks
 * 命令进行中把一次按下变成一个世界坐标交给宿主，**在任何命中类型上都接管**：命令等着取点时
 * 用户点到一个已有 Entity，意图是「在那里取一个点」而不是「选中它」。这与设计模式恰好相反，
 * 正是模式的意义所在。
 *
 * 优先级排在**平移之下**：这是对「命令取点最高」这条 CAD 惯例的有意偏离——`pan` 在 Stage
 * 里是按住空格或中键的临时覆盖，命令进行中仍然要能平移画布去看远处那个目标点。
 *
 * 一次点击是瞬时的，没有需要推进的会话，因此 claim 返回 `consumed` 而不是一个 session。
 *
 * @public
 */
export function createStageDraftingPointPlugin(): StageInteractionPlugin {
  return {
    id: STAGE_DRAFTING_POINT_PLUGIN_ID,
    priority: DRAFTING_POINT_PRIORITY,
    claim(event, ctx: StagePluginContext) {
      if (!ctx.context.draftingAwaitingPoint) return null
      ctx.apply([{
        type: 'drafting.point',
        point: screenToWorld(event.point, ctx.context.viewport),
      }])
      return 'consumed'
    },
  }
}
