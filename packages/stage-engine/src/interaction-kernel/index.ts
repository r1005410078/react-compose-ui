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
export {
  createStageSessionArbiter,
  type StageArbiterBeginResult,
  type StageSessionArbiter,
} from './session-arbiter'
export {
  createStagePanPlugin,
  STAGE_PAN_PLUGIN_ID,
} from './pan-plugin'
export {
  STAGE_GESTURE_PRIORITY,
  STAGE_LEGACY_MONOLITH_PRIORITY,
  type StageGesturePriorityEntry,
} from './gesture-priority'
