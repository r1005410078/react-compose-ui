/**
 * 取点过程中光标旁的数值与标注。
 *
 * @remarks
 * 几何求解是纯函数，与文档、选择集和任何一条具体命令无关。它**不进 `canvas-kit`**：那里的
 * 准入判据（不认识文档或选择集）是必要条件而不是充分条件，而本几何只有一个消费者，
 * 「未来可能复用」不是提前抽象的理由。
 */
export {
  dynamicInputAdornment,
  dynamicInputBoxWidth,
  resolveStageDynamicInput,
  resolveStageDynamicInputPrompt,
  DYNAMIC_INPUT_BOX_HEIGHT,
  DYNAMIC_INPUT_CHAR_WIDTH,
  DYNAMIC_INPUT_FONT_SIZE,
} from './dynamic-input-geometry'
export type {
  StageDynamicInputAdornment,
  StageDynamicInputAnnotation,
  StageDynamicInputBox,
  StageDynamicInputBoxState,
  StageDynamicInputField,
  StageDynamicInputRequest,
} from './dynamic-input-geometry'
export { stageCornerRadiusReadout } from './corner-radius-readout'
export { stageResizeReadout } from './resize-readout'
export { stageRotationReadout } from './rotation-readout'
export type { StageRotationReadoutInput } from './rotation-readout'
export type { StageResizeReadoutInput } from './resize-readout'
export { StageDynamicInputLayer } from './stage-dynamic-input-layer'
