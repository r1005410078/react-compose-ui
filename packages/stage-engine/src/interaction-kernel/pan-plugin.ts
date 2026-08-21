import type { StagePoint, StageViewport } from '../geometry'
import type { StageInteractionPlugin, StagePluginContext, StageSession } from './stage-kernel-profile'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'

/** 平移插件的注册 id；内核在非指针事件上据此识别活动会话。 @public */
export const STAGE_PAN_PLUGIN_ID = 'pan'

const PAN_PRIORITY = STAGE_GESTURE_PRIORITY
  .find(({ id }) => id === STAGE_PAN_PLUGIN_ID)!.priority

/** 中键：与工具选择无关的通用平移入口。 */
const MIDDLE_BUTTON = 1

function createPanSession(
  pointerId: number,
  startPoint: StagePoint,
  startViewport: StageViewport,
): StageSession {
  return {
    pointerId,
    update(event, ctx) {
      if (event.type !== 'pointer.move' && event.type !== 'pointer.up') return
      // 位移始终以按下时的视口为基线：手势期间宿主回传的受控 viewport 不得改变坐标基准，
      // 否则每帧都会把上一帧的位移再累加一次。
      ctx.apply([{
        type: 'viewport.change',
        viewport: {
          ...startViewport,
          x: startViewport.x + event.point.x - startPoint.x,
          y: startViewport.y + event.point.y - startPoint.y,
        },
      }])
    },
    commit(ctx) {
      // 平移不引用任何 Entity，因此没有可提交的文档意图：松手只是收尾。顺序与原实现在
      // finish() 尾部的处理一致——先回到空闲快照，再释放指针捕获。
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    cancel(ctx) {
      // 收尾必须由会话自己做：它在 claim 里发布过 pan phase 并捕获了指针，内核并不知道。
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
  }
}

/**
 * 平移手势插件。
 *
 * @remarks
 * 12 个手势里耦合最浅的一个：只改变视口，不读文档也不读场景索引，因此 `claim` 与会话都不
 * 触碰 `ctx.context.document` 或 `ctx.index`。
 *
 * @public
 */
export function createStagePanPlugin(): StageInteractionPlugin {
  return {
    id: STAGE_PAN_PLUGIN_ID,
    priority: PAN_PRIORITY,
    claim(event, ctx: StagePluginContext) {
      // 三个入口：显式 pan 工具、按住空格的临时平移、中键。temporaryPan 是跨会话存活的
      // 内核状态，必须在判定当刻读取。
      const shouldPan = ctx.context.tool === 'pan'
        || ctx.snapshot.temporaryPan
        || event.button === MIDDLE_BUTTON
      if (!shouldPan) return null
      ctx.publish({ ...ctx.idleSnapshot(), phase: 'pan' })
      ctx.apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
      return createPanSession(event.pointerId, event.point, ctx.context.viewport)
    },
  }
}
