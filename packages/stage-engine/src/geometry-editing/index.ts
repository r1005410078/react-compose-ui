/** 曲线夹点的派生与顶点编辑求解；两者都是纯函数，不修改文档也不派发命令。 */
export {
  applyStageCurveCorner,
  applyStageCurveGrip,
  stageCurveBoxGeometry,
  stageCurveCorners,
  stageCurveGripNeighbor,
  stageCurveGrips,
  stageCurveLocalPoint,
  stageCurveOutline,
} from './curve-grips'
export {
  deleteStageCurveVertex,
  insertStageCurveVertex,
} from './vertex-edits'
export type {
  StageVertexEdit,
  StageVertexEditRejection,
} from './vertex-edits'
export type {
  StageCurveCorner,
  StageCurveGeometrySource,
  StageCurveGrip,
  StageCurveGripRole,
} from './curve-grips'
