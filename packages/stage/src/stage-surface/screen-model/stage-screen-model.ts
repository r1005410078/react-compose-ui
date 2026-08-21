import { getComposeVisibility, type ComposeDocument, type ComposeLayoutSnapshot } from '@compose-ui/core'
import {
  createRulerTicks,
  createStageSceneIndex,
  expandScrollRange,
  getEntityWorldBounds,
  listFrameWorldGuides,
  resolveTargetFrameId,
  unionRects,
  viewportToScrollAxes,
  worldToScreen,
  type ResizeHandle,
  type StagePoint,
  type StageRect,
  type StageViewport,
} from '@compose-ui/stage-engine'
import {
  frameScreenBounds,
  mergeCanvasGuides,
  resizeHandlePoints,
  visibleWorldRect,
  worldRectToScreen,
  type StageCanvasGuide,
  type StageFrameScreenBounds,
  type StageScreenRect,
} from './stage-screen-geometry'
import type { StageSurfaceSize } from '../use-stage-surface-size'

/** 求屏幕模型所需的输入。 */
export interface StageScreenModelInput {
  /** 未经手势预览变形的文档；场景边界与辅助线以它为准。 */
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  /** 烘焙了手势预览的文档；只用于首帧的内容边界回退。 */
  readonly previewDocument: ComposeDocument
  readonly previewLayoutSnapshot: ComposeLayoutSnapshot
  readonly hiddenEntityIds: ReadonlySet<string>
  readonly viewport: StageViewport
  readonly surfaceSize: StageSurfaceSize
  /** 选区世界包围盒；无选区时为 null。 */
  readonly selectionBounds: StageRect | null
  /** 框选矩形（世界坐标）；不在框选中时为 null。 */
  readonly marquee: StageRect | null
  /** 拖动中的辅助线预览。 */
  readonly guidePreview: readonly StageCanvasGuide[]
  /** 宿主给出的原始选区；辅助线的归属 Frame 由它解析。 */
  readonly selectedIds: readonly string[]
  readonly activeFrameId: string | null | undefined
  /** 内核已发布的滚动范围；首帧尚未发布时为 null。 */
  readonly scrollRange: StageRect | null
}

/** 这一帧要画的全部屏幕坐标。 */
export interface StageScreenModel {
  readonly screenBounds: StageScreenRect | null
  readonly frameBounds: readonly StageFrameScreenBounds[]
  readonly worldOriginScreen: StagePoint
  readonly marqueeScreen: StageScreenRect | null
  readonly handlePoints: Readonly<Record<ResizeHandle, readonly [number, number]>> | null
  readonly horizontalTicks: ReturnType<typeof createRulerTicks>
  readonly verticalTicks: ReturnType<typeof createRulerTicks>
  readonly canvasGuides: readonly StageCanvasGuide[]
  readonly scrollAxes: ReturnType<typeof viewportToScrollAxes>
}

/**
 * 求这一帧的屏幕模型：标尺刻度、场景边界、手柄锚点、辅助线与滚动轴。
 *
 * @remarks
 * 结果完全由输入决定，不依赖 React。它是一次性的视图模型——**产出后只被 JSX 读取，没有第二个
 * 消费者往里塞字段**，因此不会退化成一个谁都在读、谁都不敢改的共享派生包。
 *
 * 内容边界（`scrollRange` 缺失时的回退）**必须惰性求值**：它要遍历全部 Entity 算世界包围盒，
 * 而只有内核尚未发布滚动范围的首帧才会用到。提前求值意味着每个平移帧都为一个立刻被丢弃的
 * 结果做一次全场景遍历。
 */
export function resolveStageScreenModel(input: StageScreenModelInput): StageScreenModel {
  const {
    activeFrameId,
    document,
    guidePreview,
    hiddenEntityIds,
    layoutSnapshot,
    marquee,
    previewDocument,
    previewLayoutSnapshot,
    scrollRange,
    selectedIds,
    selectionBounds,
    surfaceSize,
    viewport,
  } = input
  const sceneIndex = createStageSceneIndex(document, layoutSnapshot, hiddenEntityIds)
  const screenBounds = worldRectToScreen(selectionBounds, viewport)
  const { grid } = document.canvas

  // 辅助线保存在活动 Frame 的局部坐标里，Overlay 在世界坐标绘制，因此这里映射一次。
  const targetFrameId = resolveTargetFrameId(document, selectedIds, activeFrameId)
  const canvasGuides = mergeCanvasGuides(
    listFrameWorldGuides(document, targetFrameId, sceneIndex)
      .map((guide) => ({ id: guide.id, axis: guide.axis, position: guide.value })),
    guidePreview,
  )

  const bootstrapContentBounds = () => unionRects(
    Object.values(previewDocument.entities)
      .filter((entity) => getComposeVisibility(entity).visible)
      .map((entity) => getEntityWorldBounds(previewDocument, previewLayoutSnapshot, entity.id)),
  )
  const activeScrollRange = scrollRange
    ?? expandScrollRange(
      null,
      bootstrapContentBounds(),
      visibleWorldRect(viewport, surfaceSize),
    )

  return {
    screenBounds,
    frameBounds: frameScreenBounds(document, sceneIndex, viewport),
    worldOriginScreen: worldToScreen({ x: 0, y: 0 }, viewport),
    marqueeScreen: worldRectToScreen(marquee, viewport),
    handlePoints: resizeHandlePoints(screenBounds),
    horizontalTicks: createRulerTicks({
      axis: 'x',
      viewport,
      length: surfaceSize.width,
      step: grid.stepX,
      offset: grid.offsetX,
      primaryLineEvery: grid.primaryLineEvery,
    }),
    verticalTicks: createRulerTicks({
      axis: 'y',
      viewport,
      length: surfaceSize.height,
      step: grid.stepY,
      offset: grid.offsetY,
      primaryLineEvery: grid.primaryLineEvery,
    }),
    canvasGuides,
    scrollAxes: viewportToScrollAxes(viewport, surfaceSize, activeScrollRange),
  }
}
