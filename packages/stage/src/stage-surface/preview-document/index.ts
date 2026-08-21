/** 把手势预览烘焙成可渲染的文档与布局快照，含 resize 期间的实时布局求解。 */
export { useStagePreviewDocuments } from './use-stage-preview-documents'
export type {
  StagePreviewDocuments,
  StagePreviewDocumentsParams,
} from './use-stage-preview-documents'
export {
  bootstrapSelectionBounds,
  directionAxis,
  lineSegmentForEntity,
  lineSegmentTransform,
} from './stage-preview-document'
export type { ShapeDirection, StageTransformMap } from './stage-preview-document'
