/**
 * 用键盘操作舞台：有序的动作级联、键位表与方向键微调的命令规划。
 *
 * @remarks
 * 级联的分支次序本身是行为，见 `useStageKeyboardCommands` 的 TSDoc。
 */
export { useStageKeyboardCommands } from './use-stage-keyboard'
export type {
  StageKeyboardCommands,
  StageKeyboardCommandsParams,
} from './use-stage-keyboard'
export { planStageNudge } from './nudge-planning'
export type { StageNudgePlan, StageNudgeUpdate } from './nudge-planning'
export {
  DEFAULT_STAGE_SHORTCUTS,
  DELEGATABLE_STAGE_ACTIONS,
  isEditableTarget,
  isStageShortcutMatch,
  keyboardEventCode,
  LAYER_ORDER_SHORTCUTS,
  STAGE_SHORTCUT_ACTIONS,
} from './stage-shortcuts'
