/** Stage 交互内核：插件契约、会话仲裁与优先级表。 */
export type {
  StageClaimResult,
  StageInteractionPlugin,
  StagePluginContext,
  StagePointerDownEvent,
  StageSession,
} from './kernel-types'
export {
  createStagePluginRegistry,
  type StagePluginRegistry,
} from './plugin-registry'
export { STAGE_EXTRACTED_PLUGIN_FACTORIES } from './extracted-plugins'
export {
  captureStageSpatialBaseline,
  type StageSpatialBaselineCheck,
} from './spatial-baseline'
export {
  createStageSessionArbiter,
  type StageArbiterBeginResult,
  type StageSessionArbiter,
} from './session-arbiter'
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
  STAGE_LEGACY_MONOLITH_PRIORITY,
  type StageGesturePriorityEntry,
} from './gesture-priority'
