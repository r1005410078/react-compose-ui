import { claimStageMarquee } from './marquee-plugin'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import type { StageClaimResult, StageInteractionPlugin, StagePluginContext, StagePointerDownEvent } from './stage-kernel-profile'

/** 默认框选兜底的注册 id。 @public */
export const STAGE_MARQUEE_FALLBACK_PLUGIN_ID = 'marquee-fallback'

const priorityOf = (id: string) =>
  STAGE_GESTURE_PRIORITY.find((entry) => entry.id === id)!.priority

/**
 * 默认框选插件。
 *
 * @remarks
 * 优先级表里最低的一项：所有更具体的判定都不接管时，这次按下就是一次框选。它是框选三个入口
 * 中的最后一个，与工具入口、容器体收敛共用 {@link claimStageMarquee}。
 *
 * 从空白起框，因此没有起框容器需要排除。
 *
 * @public
 */
export function createStageMarqueeFallbackPlugin(): StageInteractionPlugin {
  return {
    id: STAGE_MARQUEE_FALLBACK_PLUGIN_ID,
    priority: priorityOf(STAGE_MARQUEE_FALLBACK_PLUGIN_ID),
    claim(event: StagePointerDownEvent, ctx: StagePluginContext): StageClaimResult {
      return claimStageMarquee(event, ctx)
    },
  }
}
