import { createStageDrawPlugin } from './draw-plugin'
import {
  createStageLegacyRotateHitPlugin,
  createStageMarqueeFallbackPlugin,
  createStageRotateToolFallbackPlugin,
} from './fallback-plugins'
import {
  createStageGuideCreatePlugin,
  createStageGuideMovePlugin,
} from './guide-plugin'
import {
  createStageMarqueeConvergePlugin,
  createStageMarqueeToolPlugin,
} from './marquee-plugin'
import {
  createStageEntitySelectMovePlugin,
  createStageMoveAxisPlugin,
} from './move-plugin'
import { createStagePaintPlugin } from './paint-plugin'
import { createStagePaintSamplePlugin } from './paint-sample-plugin'
import { createStagePanPlugin } from './pan-plugin'
import { createStagePathPlugin } from './path-plugin'
import { createStageResizePlugin } from './resize-plugin'
import { createStageRotatePlugin } from './rotate-plugin'
import { createStageSegmentResizePlugin } from './segment-resize-plugin'
import { createStageTextEditGuardPlugin } from './text-edit-guard-plugin'
import type { StageInteractionPlugin } from './kernel-types'

/**
 * Stage 交互插件的全量登记处，按优先级自顶向下排列。
 *
 * @remarks
 * 这份清单是**唯一**的登记处：controller 用它组装注册表，优先级不变量测试也用它校验。
 * 两边共用一个来源，新增插件时不可能只改一处——先前把清单手抄进测试的写法，在 rotate 与
 * paint-sample 落地时就悄悄过期了，守卫等于失效。
 *
 * 绞杀式重构已经完成：曾经兜底的 legacy 单体插件不复存在，因此这份清单**必须**覆盖
 * {@link STAGE_GESTURE_PRIORITY} 的每一项——漏掉一项就是一类命中彻底无人接管。
 *
 * 数组顺序不参与仲裁（注册表按 `priority` 排序），它只是让这里的清单与优先级表能逐行对照。
 *
 * @public
 */
export const STAGE_EXTRACTED_PLUGIN_FACTORIES: readonly (() => StageInteractionPlugin)[] = [
  createStageTextEditGuardPlugin,
  createStagePanPlugin,
  createStageRotatePlugin,
  createStagePaintSamplePlugin,
  createStagePathPlugin,
  createStagePaintPlugin,
  createStageSegmentResizePlugin,
  createStageMarqueeToolPlugin,
  createStageDrawPlugin,
  createStageMoveAxisPlugin,
  createStageMarqueeConvergePlugin,
  createStageEntitySelectMovePlugin,
  createStageResizePlugin,
  createStageLegacyRotateHitPlugin,
  createStageGuideCreatePlugin,
  createStageGuideMovePlugin,
  createStageRotateToolFallbackPlugin,
  createStageMarqueeFallbackPlugin,
]
