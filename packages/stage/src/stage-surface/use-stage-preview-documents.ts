import { useEffect, useMemo } from 'react'
import type { ComposeDocument, ComposeLayoutSnapshot } from '@compose-ui/core'
import type { StageInteractionPhase } from '@compose-ui/stage-engine'
import type { ComposeStageLayoutRuntime } from '../types'
import { buildResizePreviewSolveDocument } from './resize-preview'
import {
  transformDocument,
  transformLayoutSnapshot,
  type StageTransformMap,
} from './stage-preview-document'
import type { ShapeDirection } from './drawing-entity'

/** 预览文档能力的依赖清单。 */
export interface StagePreviewDocumentsParams {
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  /** 宿主 Runtime 回灌的实时求解结果；只在 resize 期间有值。 */
  readonly layoutPreviewSnapshot: ComposeLayoutSnapshot | null | undefined
  readonly layoutRuntime: ComposeStageLayoutRuntime | undefined
  readonly interactionPhase: StageInteractionPhase
  /** 手势产生的几何覆盖；键为 Entity ID。 */
  readonly previewTransforms: StageTransformMap
  /** 两点图形的端点朝向覆盖。 */
  readonly previewDirections: Readonly<Record<string, ShapeDirection>>
}

/** 预览文档能力的出口。 */
export interface StagePreviewDocuments {
  /** 烘焙了手势覆盖的文档；Overlay 与场景渲染都读它。 */
  readonly previewDocument: ComposeDocument
  /** 与 `previewDocument` 对应的布局快照。 */
  readonly previewLayoutSnapshot: ComposeLayoutSnapshot
  /**
   * 交给场景渲染的布局快照。
   *
   * @remarks
   * resize 期间优先用宿主 Runtime 的实时求解结果，其余手势维持覆盖预览。它**不进入交互
   * Controller 的 context**——提交几何始终以冻结的提交态快照为准。
   */
  readonly sceneLayoutSnapshot: ComposeLayoutSnapshot
}

/**
 * 「把手势预览烘焙成可渲染的文档」这条能力。
 *
 * @remarks
 * resize 是唯一需要真实布局求解的手势：拖动容器手柄时兄弟要实时让位，而覆盖预览只改被拖
 * 的那一个。求解只对 Flow 目标必要——Absolute 不参与排布，覆盖已经足够。
 */
export function useStagePreviewDocuments(
  params: StagePreviewDocumentsParams,
): StagePreviewDocuments {
  const {
    document,
    interactionPhase,
    layoutPreviewSnapshot,
    layoutRuntime,
    layoutSnapshot,
    previewDirections,
    previewTransforms,
  } = params
  const previewDocument = useMemo(
    () => transformDocument(document, previewTransforms, previewDirections),
    [document, previewDirections, previewTransforms],
  )
  const previewLayoutSnapshot = useMemo(
    () => transformLayoutSnapshot(layoutSnapshot, previewTransforms),
    [layoutSnapshot, previewTransforms],
  )
  // resize 手势的实时布局：把预览文档交给 Layout Runtime 求解，兄弟随拖动让位。
  // 只有 Flow 目标需要求解（Absolute 不参与排布，previewTransforms 覆盖已足够）。
  const resizeSolveDocument = useMemo(
    () => (interactionPhase === 'resize' && layoutRuntime?.previewDocument
      ? buildResizePreviewSolveDocument(previewDocument, Object.keys(previewTransforms))
      : null),
    [interactionPhase, layoutRuntime, previewDocument, previewTransforms],
  )
  useEffect(() => {
    const runtime = layoutRuntime
    if (!runtime?.previewDocument || !runtime.clearPreview) return
    if (!resizeSolveDocument) {
      runtime.clearPreview()
      return
    }
    // rAF 合并：120Hz pointermove 下每帧最多一次求解；卸载或换帧取消未执行的请求。
    const frame = requestAnimationFrame(() => runtime.previewDocument!(resizeSolveDocument))
    return () => cancelAnimationFrame(frame)
  }, [layoutRuntime, resizeSolveDocument])
  // 卸载兜底：手势中途卸载 Stage 时不把预览状态留在宿主 Runtime 里。
  useEffect(() => () => layoutRuntime?.clearPreview?.(), [layoutRuntime])
  // 场景渲染优先用实时求解结果；求解只在 resize 期间生效，其余手势维持既有覆盖预览。
  // 预览 Snapshot 不进入交互 Controller 的 context（见 updateContext），提交几何始终以
  // 冻结的提交态 Snapshot 为准。
  const sceneLayoutSnapshot = resizeSolveDocument && layoutPreviewSnapshot
    ? layoutPreviewSnapshot
    : previewLayoutSnapshot

  return { previewDocument, previewLayoutSnapshot, sceneLayoutSnapshot }
}
