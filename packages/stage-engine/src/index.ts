/**
 * 提供 React 与 DOM 无关的 Stage 坐标、空间命令与交互运行时。
 *
 * @packageDocumentation
 */

export {
  listFrameWorldGuides,
  resolveActiveFrameId,
  toFrameGuidePosition,
  type FrameOriginResolver,
} from './frame-space'
export {
  createLayerOrderCommand,
  createDuplicateCommand,
  createGroupCommand,
  createReparentCommand,
  createUngroupCommand,
  getGroupCommandAvailability,
  getLayerOrderCommandAvailability,
  getUngroupCommandAvailability,
  type ComposeDuplicateInsertion,
  type ComposeLayerOrderOperation,
  type ComposeStructureCommandAvailability,
} from './commands'
export {
  createEntityClipboard,
  createPasteFromClipboard,
  isInvalidCutInsertion,
  normalizeClipboardEntityIds,
  resolveSuggestedEntityInsertion,
  type ComposeClipboardPastePlan,
  type ComposeEntityClipboard,
  type ComposeEntityInsertion,
} from './clipboard'
export {
  createComponentExtractionPlan,
  createReplaceSelectionWithEntityCommand,
  type ComposeComponentExtractionPlan,
  type ComposeComponentExtractionResult,
  type ComposeComponentExtractionUnavailableReason,
} from './component-extraction'
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
  rectContains,
  rectMappingMatrix,
  rectsIntersect,
  resizeBounds,
  pointOnRotationRay,
  ROTATION_SNAP_DEGREES,
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
  DEFAULT_STAGE_MARQUEE_MODE,
  resolveMarqueeHitTest,
  resolveMarqueeSelection,
  type StageMarqueeCombine,
  type StageMarqueeDirection,
  type StageMarqueeMode,
  type StageMarqueeQuery,
} from './marquee-selection'
export {
  resolveStageDropIndicator,
  resolveStageDropTarget,
  type StageDropIndicator,
  type StageDropTarget,
} from './drop-target'
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
  type StageDrawnEntity,
  type StageSegmentPreview,
  type StageTextEditing,
  type StagePaintEditing,
  type StagePaintHandle,
  type StagePaintHandleKind,
  type StagePaintSamplePreview,
  type StagePaintSampling,
  type StagePathEditing,
  type StagePathHandleKind,
  type StageEditablePath,
  type StageEditablePathVertex,
  type StagePreviewGuide,
} from './interaction-controller'
export {
  describeEntityCreation,
  describeEntityTargets,
  describeTransform,
} from './transaction-labels'

/** `@compose-ui/stage-engine` 的稳定包标识。 @public */
export const COMPOSE_UI_STAGE_ENGINE_PACKAGE = '@compose-ui/stage-engine' as const
