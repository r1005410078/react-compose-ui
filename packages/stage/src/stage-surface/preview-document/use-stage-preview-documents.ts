import { useEffect, useMemo } from 'react'
import type { ComposeDocument, ComposeLayoutSnapshot } from '@compose-ui/core'
import type { StageDropTarget, StageInteractionPhase } from '@compose-ui/stage-engine'
import type { ComposeStageLayoutRuntime } from '../../types'
import { buildGridPreviewSolveDocument } from './grid-preview'
import { buildResizePreviewSolveDocument } from './resize-preview'
import {
  transformDocument,
  transformLayoutSnapshot,
  type StageTransformMap,
} from './stage-preview-document'

/** 预览文档能力的依赖清单。 */
export interface StagePreviewDocumentsParams {
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  /** 宿主 Runtime 回灌的实时求解结果；只在 resize 期间有值。 */
  readonly layoutPreviewSnapshot: ComposeLayoutSnapshot | null | undefined
  readonly layoutRuntime: ComposeStageLayoutRuntime | undefined
  readonly interactionPhase: StageInteractionPhase
  /** 内核发布的几何覆盖；键为 Entity ID。 */
  readonly transforms: StageTransformMap
  /** 当前落点；网格的 move 需要它才知道被拖的那一个会压住谁。 */
  readonly dropTarget?: StageDropTarget | null
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
   * resize 与网格 move 期间优先用宿主 Runtime 的实时求解结果，其余手势维持覆盖预览。
   * 它**不进入交互 Controller 的 context**——提交几何始终以冻结的提交态快照为准。这条在
   * 网格下更强：网格的提交几何是格坐标，根本不从快照反算像素。
   */
  readonly sceneLayoutSnapshot: ComposeLayoutSnapshot
}

/**
 * 「把手势预览烘焙成可渲染的文档」这条能力。
 *
 * @remarks
 * 两类手势需要真实布局求解，其余维持覆盖预览：
 *
 * - **resize**：拖容器手柄时子级要实时重排，拖 Flow 子级时兄弟要实时让位。Absolute 目标
 *   不参与排布，覆盖已经足够。
 * - **网格里的 move**：拖动在网格里**就是**改坐标，被压住的兄弟必须当场让位。Auto Layout
 *   里的 move 只改顺序、几何由排布算出来，因此不在此列。
 */
export function useStagePreviewDocuments(
  params: StagePreviewDocumentsParams,
): StagePreviewDocuments {
  const {
    document,
    dropTarget,
    interactionPhase,
    layoutPreviewSnapshot,
    layoutRuntime,
    layoutSnapshot,
    transforms,
  } = params

  const previewTransforms = transforms
  const previewDocument = useMemo(
    () => transformDocument(document, previewTransforms),
    [document, previewTransforms],
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
  /*
   * **move 同样需要真实求解，但只在网格里。**
   *
   * Auto Layout 里拖子级只改顺序、几何由排布算出来，覆盖预览已经够；而网格里拖动**就是**
   * 改坐标，被压住的兄弟必须当场让位——看不见推挤的结果，用户就没法判断这一下该不该松手，
   * 整件事会退化成一个已经有了的能力（网格吸附）。
   */
  const gridSolveDocument = useMemo(
    () => (interactionPhase === 'move' && layoutRuntime?.previewDocument
      ? buildGridPreviewSolveDocument(
          previewDocument,
          document,
          dropTarget ?? null,
          Object.keys(previewTransforms),
          layoutSnapshot,
        )
      : null),
    [document, dropTarget, interactionPhase, layoutRuntime, layoutSnapshot, previewDocument, previewTransforms],
  )
  const solveDocument = resizeSolveDocument ?? gridSolveDocument
  useEffect(() => {
    const runtime = layoutRuntime
    if (!runtime?.previewDocument || !runtime.clearPreview) return
    if (!solveDocument) {
      runtime.clearPreview()
      return
    }
    // rAF 合并：120Hz pointermove 下每帧最多一次求解；卸载或换帧取消未执行的请求。
    const frame = requestAnimationFrame(() => runtime.previewDocument!(solveDocument))
    return () => cancelAnimationFrame(frame)
  }, [layoutRuntime, solveDocument])
  // 卸载兜底：手势中途卸载 Stage 时不把预览状态留在宿主 Runtime 里。
  useEffect(() => () => layoutRuntime?.clearPreview?.(), [layoutRuntime])
  // 场景渲染优先用实时求解结果；求解只在 resize 期间生效，其余手势维持既有覆盖预览。
  // 预览 Snapshot 不进入交互 Controller 的 context（见 updateContext），提交几何始终以
  // 冻结的提交态 Snapshot 为准。
  /*
   * 网格的 move 要把两份反馈叠起来：兄弟取**求解结果**（它们真的让位了），被拖的那一个取
   * **光标覆盖**（跟手、不吸格）。resize 那一档不叠——它的几何已经烘进求解用文档了，再叠
   * 一次覆盖等于把同一个位移应用两遍。
   */
  const sceneLayoutSnapshot = gridSolveDocument && layoutPreviewSnapshot
    ? transformLayoutSnapshot(layoutPreviewSnapshot, previewTransforms)
    : resizeSolveDocument && layoutPreviewSnapshot
      ? layoutPreviewSnapshot
      : previewLayoutSnapshot

  return { previewDocument, previewLayoutSnapshot, sceneLayoutSnapshot }
}
