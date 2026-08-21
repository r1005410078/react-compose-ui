/** 这一帧要画的屏幕坐标与选区派生，全部为不依赖 React 的纯函数。 */
export { resolveStageScreenModel } from './stage-screen-model'
export type { StageScreenModel, StageScreenModelInput } from './stage-screen-model'
export type {
  StageCanvasGuide,
  StageFrameScreenBounds,
  StageScreenRect,
} from './stage-screen-geometry'
export {
  isStageSelectionEditable,
  isStageSelectionRotatable,
  resolveStageResizeHandles,
  resolveStageSelectionConstraints,
  unlockedStageIds,
} from './stage-selection-derivations'
export { StageWorldUnderlay } from './stage-world-underlay'
