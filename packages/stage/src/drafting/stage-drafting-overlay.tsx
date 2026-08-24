import { worldToScreen, type StagePoint, type StageRect, type StageViewport } from '@compose-ui/stage-engine'
import type { StageFeaturePoint } from '@compose-ui/stage-engine'
import {
  ComposeCanvasCrosshairLayer,
  type ComposeCanvasCrosshair,
} from '@compose-ui/canvas-kit'

/**
 * 捕捉标记的最小边长（屏幕像素）。
 *
 * @remarks
 * 实际边长还要**把拾取框套进去**：两者钉在同一个解算落点上，标记比框小就整个藏在框里面，
 * 而它恰恰是「吸上了」的唯一凭据。框的半边长由调用方给出，因此这里按当前那一帧的框现算。
 */
const MARKER_MIN_SIZE = 20

/** 标记与拾取框之间留出的可见间隙（屏幕像素）。 */
const MARKER_CLEARANCE = 8

/** {@link StageDraftingOverlay} 的属性。 @internal */
export interface StageDraftingOverlayProps {
  readonly viewport: StageViewport
  readonly surfaceSize: { readonly width: number; readonly height: number }
  /** 共享十字光标的解析结果；不绘制时为 `null`。 */
  readonly crosshair: ComposeCanvasCrosshair | null
  readonly snap: StageFeaturePoint | null
  readonly rubberBand: { readonly start: StagePoint; readonly end: StagePoint } | null
  /**
   * 被作用对象的世界包围盒轮廓，已按当前位移平移。
   *
   * @remarks
   * 刻意只画轮廓：完整幽灵渲染要把绘图会话的位移接进仲裁器的 `previewTransforms` 通道，
   * 而绘图会话不在仲裁器里——它是 Stage 自己的状态。
   */
  readonly outlines: readonly StageRect[]
}

/**
 * 绘图命令的图面反馈层：十字光标、捕捉标记与橡皮筋。
 *
 * @remarks
 * 独立于既有 overlay：这三样只在绘图命令进行期间存在，塞进 `StageOverlayContext` 会让每个
 * 既有层的上下文都多背三个永远为空的字段。
 *
 * 十字光标本身走 `canvas-kit` 的共享实现——两块画布同一个组件，第二份实现必然与第一份漂移。
 * 形态推导（等待取点画线、等待选择画框、其余不画）留在 Stage 这边：`accepts` 属于命令协议，
 * 而 canvas-kit 不依赖它，两块画布的规则也本来就不同。
 *
 * 捕捉标记与落点求解读的是**同一个** `snap`——各解一次会在指针快速移动时给出两个不同的答案，
 * 而用户看见标记贴在端点上、线却落在别处。
 *
 * 标记**不用 accent 上色**：橡皮筋、作用对象轮廓、选区框已经全是 accent，同色的标记在它们
 * 中间读不出来，而它要回答的是一个是非问题——**吸上了没有**。
 *
 * @internal
 */
export function StageDraftingOverlay({
  viewport,
  surfaceSize,
  crosshair,
  snap,
  rubberBand,
  outlines,
}: StageDraftingOverlayProps) {
  const snapScreen = snap ? worldToScreen(snap.point, viewport) : null
  const markerSize = Math.max(
    MARKER_MIN_SIZE,
    (crosshair?.box ? crosshair.boxRadius : 0) * 2 + MARKER_CLEARANCE,
  )
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
      <ComposeCanvasCrosshairLayer
        crosshair={crosshair}
        surfaceSize={surfaceSize}
        testIdPrefix="stage"
      />
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
      {outlines.map((rect, position) => {
        const origin = worldToScreen({ x: rect.x, y: rect.y }, viewport)
        return (
          <rect
            className="compose-stage__drafting-outline"
            data-testid="stage-drafting-outline"
            height={rect.height * viewport.zoom}
            key={`${position}:${rect.x}:${rect.y}`}
            width={rect.width * viewport.zoom}
            x={origin.x}
            y={origin.y}
          />
        )
      })}
      {snapScreen ? (
        <rect
          className="compose-stage__drafting-snap"
          data-snap-mode={snap?.mode}
          data-testid="stage-drafting-snap"
          height={markerSize}
          width={markerSize}
          x={snapScreen.x - markerSize / 2}
          y={snapScreen.y - markerSize / 2}
        />
      ) : null}
    </svg>
  )
}
