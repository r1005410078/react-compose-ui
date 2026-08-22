import { worldToScreen, type StagePoint, type StageViewport } from '@compose-ui/stage-engine'
import type { StageFeaturePoint } from '@compose-ui/stage-engine'

/** 捕捉标记的边长（屏幕像素）。 */
const MARKER_SIZE = 10

/** {@link StageDraftingOverlay} 的属性。 @internal */
export interface StageDraftingOverlayProps {
  readonly viewport: StageViewport
  readonly surfaceSize: { readonly width: number; readonly height: number }
  /** 十字线中心；指针不在图面上时为 null。 */
  readonly crosshair: StagePoint | null
  readonly snap: StageFeaturePoint | null
  readonly rubberBand: { readonly start: StagePoint; readonly end: StagePoint } | null
}

/**
 * 绘图模式的图面反馈层：十字线、捕捉标记与橡皮筋。
 *
 * @remarks
 * 独立于既有 overlay：这三样只在绘图模式存在，塞进 `StageOverlayContext` 会让每个既有层的
 * 上下文都多背三个永远为空的字段。
 *
 * 捕捉标记与落点求解读的是**同一个** `snap`——各解一次会在指针快速移动时给出两个不同的答案，
 * 而用户看见标记贴在端点上、线却落在别处。
 *
 * @internal
 */
export function StageDraftingOverlay({
  viewport,
  surfaceSize,
  crosshair,
  snap,
  rubberBand,
}: StageDraftingOverlayProps) {
  const snapScreen = snap ? worldToScreen(snap.point, viewport) : null
  const bandStart = rubberBand ? worldToScreen(rubberBand.start, viewport) : null
  const bandEnd = rubberBand ? worldToScreen(rubberBand.end, viewport) : null

  return (
    <svg
      aria-hidden="true"
      className="compose-stage__drafting"
      data-testid="stage-drafting-overlay"
      height={surfaceSize.height}
      width={surfaceSize.width}
    >
      {crosshair ? (
        <g className="compose-stage__drafting-crosshair" data-testid="stage-drafting-crosshair">
          <line x1={0} x2={surfaceSize.width} y1={crosshair.y} y2={crosshair.y} />
          <line x1={crosshair.x} x2={crosshair.x} y1={0} y2={surfaceSize.height} />
        </g>
      ) : null}
      {bandStart && bandEnd ? (
        <line
          className="compose-stage__drafting-band"
          data-testid="stage-drafting-band"
          x1={bandStart.x}
          x2={bandEnd.x}
          y1={bandStart.y}
          y2={bandEnd.y}
        />
      ) : null}
      {snapScreen ? (
        <rect
          className="compose-stage__drafting-snap"
          data-snap-mode={snap?.mode}
          data-testid="stage-drafting-snap"
          height={MARKER_SIZE}
          width={MARKER_SIZE}
          x={snapScreen.x - MARKER_SIZE / 2}
          y={snapScreen.y - MARKER_SIZE / 2}
        />
      ) : null}
    </svg>
  )
}
