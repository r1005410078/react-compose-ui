/** Stage 交互内核：插件契约、会话仲裁与优先级表。 */

/** 文档无关的泛型内核契约；新文档类型绑定自己的 profile 后复用同一套仲裁规则。 */
export type {
  InteractionClaimResult,
  InteractionKernelProfile,
  InteractionPlugin,
  InteractionPluginContext,
  InteractionSession,
} from './kernel-types'
export {
  createInteractionPluginRegistry,
  type InteractionPluginRegistry,
} from './plugin-registry'
export {
  createInteractionSessionArbiter,
  type InteractionArbiterBeginResult,
  type InteractionSessionArbiter,
} from './session-arbiter'

/** 泛型内核在 Stage 文档协议上的绑定与既有名称。 */
export {
  createStagePluginRegistry,
  createStageSessionArbiter,
  type StageArbiterBeginResult,
  type StageClaimResult,
  type StageInteractionPlugin,
  type StageKernelProfile,
  type StagePluginContext,
  type StagePluginRegistry,
  type StagePointerDownEvent,
  type StageSession,
  type StageSessionArbiter,
} from './stage-kernel-profile'
export { STAGE_EXTRACTED_PLUGIN_FACTORIES } from './extracted-plugins'
export {
  createStageLegacyRotateHitPlugin,
  createStageMarqueeFallbackPlugin,
  createStageRotateToolFallbackPlugin,
  STAGE_LEGACY_ROTATE_HIT_PLUGIN_ID,
  STAGE_MARQUEE_FALLBACK_PLUGIN_ID,
  STAGE_ROTATE_TOOL_FALLBACK_PLUGIN_ID,
} from './fallback-plugins'
export {
  createStageGuideCreatePlugin,
  createStageGuideMovePlugin,
  STAGE_GUIDE_CREATE_PLUGIN_ID,
  STAGE_GUIDE_MOVE_PLUGIN_ID,
} from './guide-plugin'
export {
  captureStageSpatialBaseline,
  type StageSpatialBaselineCheck,
} from './spatial-baseline'
export {
  createStageTextEditGuardPlugin,
  STAGE_TEXT_EDIT_GUARD_PLUGIN_ID,
} from './text-edit-guard-plugin'
export {
  claimStageMove,
  createStageEntitySelectMovePlugin,
  createStageMoveAxisPlugin,
  createStageMoveSession,
  STAGE_ENTITY_SELECT_MOVE_PLUGIN_ID,
  STAGE_MOVE_AXIS_PLUGIN_ID,
  type StageMoveSessionOptions,
} from './move-plugin'
export {
  createStageDrawPlugin,
  STAGE_DRAW_PLUGIN_ID,
} from './draw-plugin'
export {
  claimStageMarquee,
  createStageMarqueeConvergePlugin,
  createStageMarqueeSession,
  createStageMarqueeToolPlugin,
  shouldConvergeToMarquee,
  STAGE_MARQUEE_CONVERGE_PLUGIN_ID,
  STAGE_MARQUEE_TOOL_PLUGIN_ID,
  type StageMarqueeSessionOptions,
} from './marquee-plugin'
export {
  createStagePaintPlugin,
  STAGE_PAINT_PLUGIN_ID,
} from './paint-plugin'
export {
  createStagePaintSamplePlugin,
  STAGE_PAINT_SAMPLE_PLUGIN_ID,
} from './paint-sample-plugin'
export {
  createStageResizePlugin,
  STAGE_RESIZE_PLUGIN_ID,
} from './resize-plugin'
export {
  createStageRotatePlugin,
  STAGE_ROTATE_PLUGIN_ID,
} from './rotate-plugin'
export {
  createStageSegmentResizePlugin,
  STAGE_SEGMENT_RESIZE_PLUGIN_ID,
} from './segment-resize-plugin'
export {
  createStagePanPlugin,
  STAGE_PAN_PLUGIN_ID,
} from './pan-plugin'
export {
  createStagePathPlugin,
  STAGE_PATH_PLUGIN_ID,
} from './path-plugin'
export {
  STAGE_GESTURE_PRIORITY,
  type StageGesturePriorityEntry,
} from './gesture-priority'
