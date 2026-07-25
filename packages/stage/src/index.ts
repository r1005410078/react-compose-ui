/**
 * 提供 DOM Scene 与 SVG Overlay 组合的无限编辑 Stage。
 *
 * @packageDocumentation
 */

import './styles.css'

export { Stage } from './stage'
export { ComponentPalette, type ComponentPaletteProps } from './palette'
export {
  createStageDragController,
  type StageDragController,
  type StageDragState,
  type StageDropTarget,
  type StageFramePreset,
} from './drag-controller'
export type { StageDispatch, StageProps, StageTool } from './types'
export {
  createDuplicateCommand,
  createGroupCommand,
  createReparentCommand,
  createUngroupCommand,
} from './commands'
export {
  applyMatrix,
  decomposeMatrix,
  getNodeParentId,
  getNodeWorldBounds,
  getNodeWorldMatrix,
  invertMatrix,
  matrixFromTransform,
  multiplyMatrices,
  rectMappingMatrix,
  resizeBounds,
  rotationFromPointer,
  rotationMatrixAround,
  screenToWorld,
  snapTranslation,
  unionRects,
  worldToScreen,
  zoomViewportAt,
  translationMatrix,
  type ResizeHandle,
  type StageGuide,
  type StageMatrix,
  type StagePoint,
  type StageRect,
  type StageViewport,
} from './geometry'

/** `@compose-ui/stage` 的稳定包标识。 @public */
export const COMPOSE_UI_STAGE_PACKAGE = '@compose-ui/stage' as const
