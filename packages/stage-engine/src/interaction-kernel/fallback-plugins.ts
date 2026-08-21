import { claimStageMarquee } from './marquee-plugin'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import type {
  StageClaimResult,
  StageInteractionPlugin,
  StagePluginContext,
  StagePointerDownEvent,
} from './kernel-types'

/** 旧旋转命中兜底的注册 id。 @public */
export const STAGE_LEGACY_ROTATE_HIT_PLUGIN_ID = 'legacy-rotate-hit'

/** 旋转工具禁止框选兜底的注册 id。 @public */
export const STAGE_ROTATE_TOOL_FALLBACK_PLUGIN_ID = 'rotate-tool-fallback'

/** 默认框选兜底的注册 id。 @public */
export const STAGE_MARQUEE_FALLBACK_PLUGIN_ID = 'marquee-fallback'

const priorityOf = (id: string) =>
  STAGE_GESTURE_PRIORITY.find((entry) => entry.id === id)!.priority

/**
 * 旧旋转命中的兜底插件。
 *
 * @remarks
 * `rotate` 命中在 `tool === 'rotate'` 时已由旋转工具插件独占处理（优先级 1600）。走到这里
 * 意味着工具不是 rotate，此时手柄本不该被渲染——消费这次按下即可，放行会让它落到框选。
 *
 * @public
 */
export function createStageLegacyRotateHitPlugin(): StageInteractionPlugin {
  return {
    id: STAGE_LEGACY_ROTATE_HIT_PLUGIN_ID,
    priority: priorityOf(STAGE_LEGACY_ROTATE_HIT_PLUGIN_ID),
    claim(event: StagePointerDownEvent): StageClaimResult {
      return event.hit.kind === 'rotate' ? 'consumed' : null
    },
  }
}

/**
 * 旋转工具禁止框选的兜底插件。
 *
 * @remarks
 * 旋转工具绝不框选。旋转工具插件已经处理了它认得的全部命中，能走到这里的是漏判的命中类型；
 * 消费掉，避免它落到默认框选——那会让旋转工具下的一次误点直接清空选区。
 *
 * @public
 */
export function createStageRotateToolFallbackPlugin(): StageInteractionPlugin {
  return {
    id: STAGE_ROTATE_TOOL_FALLBACK_PLUGIN_ID,
    priority: priorityOf(STAGE_ROTATE_TOOL_FALLBACK_PLUGIN_ID),
    claim(_event: StagePointerDownEvent, ctx: StagePluginContext): StageClaimResult {
      return ctx.context.tool === 'rotate' ? 'consumed' : null
    },
  }
}

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
