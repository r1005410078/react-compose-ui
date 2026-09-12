/** 曲线的几何编辑会话：双击进入、夹点拖动写文档、选区与工具变化即退出。 */
export { isComposeEntityGeometryEditable } from './geometry-editable'
export { useStageGeometryEditing } from './use-stage-geometry-editing'
export type { StageGeometryEditing, StageGeometryEditingOptions } from './use-stage-geometry-editing'
export { useStageCurveCorners } from './use-stage-curve-corners'
export type {
  StageCurveCornerChange,
  StageCurveCornersOptions,
  StageCurveCornersSession,
} from './use-stage-curve-corners'
export { useStageVertexEdits } from './use-stage-vertex-edits'
export type {
  StageVertexEditMessages,
  StageVertexEdits,
  StageVertexEditsOptions,
} from './use-stage-vertex-edits'
