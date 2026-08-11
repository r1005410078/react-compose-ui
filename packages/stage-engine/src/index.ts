/**
 * 提供 React 与 DOM 无关的 Stage 坐标、空间命令与交互运行时。
 *
 * @packageDocumentation
 */

export {
  createDuplicateCommand,
  createGroupCommand,
  createReparentCommand,
  createUngroupCommand,
  getGroupCommandAvailability,
  getUngroupCommandAvailability,
  type ComposeStructureCommandAvailability,
} from './commands'
export {
  createAxisLattice,
  createRulerTicks,
  latticeLineBand,
  latticeLinePosition,
  expandScrollRange,
  scrollAxisToViewport,
  snapResizePoint,
  snapValueToGrid,
  viewportToScrollAxes,
  type StageAxisLattice,
  type StageLatticeBand,
  type StageRulerTick,
  type StageScrollAxis,
} from './canvas-geometry'
export {
  applyMatrix,
  decomposeMatrix,
  getEntityParentId,
  getEntityWorldBounds,
  getEntityWorldMatrix,
  invertMatrix,
  matrixFromTransform,
  multiplyMatrices,
  rectMappingMatrix,
  resizeBounds,
  rotationFromPointer,
  rotationMatrixAround,
  screenToWorld,
  snapTranslation,
  toComposeTransform,
  toStageTransform,
  translationMatrix,
  unionRects,
  worldToScreen,
  zoomViewportAt,
  type ResizeHandle,
  type StageGuide,
  type StageMatrix,
  type StagePoint,
  type StageRect,
  type StageTransform,
  type StageViewport,
} from './geometry'
export {
  createStageSceneIndex,
  type StageSceneIndex,
} from './scene-index'
export {
  createStageInteractionController,
  type StageExternalAssetItem,
  type StageExternalDragItem,
  type StageInteractionContext,
  type StageInteractionController,
  type StageInteractionEffect,
  type StageInteractionEvent,
  type StageInteractionHit,
  type StageInteractionModifiers,
  type StageInteractionPhase,
  type StageInteractionSnapshot,
  type StageInteractionSurfacePort,
  type StageInteractionTool,
  type StageDrawingPreview,
  type StageSegmentPreview,
  type StagePaintEditing,
  type StagePaintHandle,
  type StagePaintHandleKind,
  type StagePaintSamplePreview,
  type StagePaintSampling,
  type StagePreviewGuide,
} from './interaction-controller'
export {
  describeEntityCreation,
  describeEntityTargets,
  describeTransform,
} from './transaction-labels'

/** `@compose-ui/stage-engine` 的稳定包标识。 @public */
export const COMPOSE_UI_STAGE_ENGINE_PACKAGE = '@compose-ui/stage-engine' as const
