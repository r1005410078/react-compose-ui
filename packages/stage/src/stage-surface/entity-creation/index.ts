/**
 * 把内核产出的效果落成宿主动作，含三类需要规划命令的创建路径：
 * 两点图形端点提交、绘制提交、外部拖入（资源与 Preset）。
 */
export { useStageEffectDispatch } from './use-stage-effect-dispatch'
export type {
  StageEffectDispatch,
  StageEffectDispatchParams,
} from './use-stage-effect-dispatch'
export {
  boundsCenter,
  entityFromDrawingSeed,
  entityFromSeed,
  expandClickDrawingBounds,
  seedWorldBounds,
} from './drawing-entity'
export { boundsInParentSpace, resolveRootLanding } from './root-landing'
