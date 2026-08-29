import { worldToScreen, type StagePoint, type StageRect, type StageViewport } from '@compose-ui/stage-engine'
import { StageDynamicInputLayer } from './dynamic-input'
import type { StageDynamicInputAnnotation } from './dynamic-input'
import type { StageFeaturePoint } from '@compose-ui/stage-engine'
import {
  ComposeCanvasCrosshairLayer,
  type ComposeCanvasCrosshair,
} from '@compose-ui/canvas-kit'

/**
 * 捕捉标记的边长（屏幕像素）。
 *
 * @remarks
 * **拾取框在外、标记在内**：两者钉在同一个解算落点上，而它们回答的是两个不同的问题——框说
 * 「这一块是靶区」，标记说「靶区里吸住了东西」。里外关系反过来时标记会盖住框，用户就看不出
 * 靶区还在。没有框的那一档（命令等待取点）也照这个尺寸画，标记的大小不该随上下文变。
 */
const MARKER_SIZE = 10

/**
 * 端口记号的半径（屏幕像素）。
 *
 * @remarks
 * 比捕捉标记（边长 {@link MARKER_SIZE} 的方框）**小且是圆**：两者会同时出现在同一个点上，
 * 而它们说的是两件事——「这里可以接」与「落点吸上了它」。形状必须分开，MUST NOT 只靠颜色：
 * 这块画布上颜色已经被捕捉、选中、框选与运行状态占了好几层。
 */
const PORT_MARKER_RADIUS = 3

/** {@link StageDraftingOverlay} 的属性。 @internal */
export interface StageDraftingOverlayProps {
  readonly viewport: StageViewport
  readonly surfaceSize: { readonly width: number; readonly height: number }
  /** 共享十字光标的解析结果；不绘制时为 `null`。 */
  readonly crosshair: ComposeCanvasCrosshair | null
  readonly snap: StageFeaturePoint | null
  /**
   * 取点期间显现的端口，世界坐标；不在取点时为 `null`。
   *
   * @remarks
   * 是**一个符号的全部**端口而不是最近的那一个：接线图上端子密集，只画一个的话用户读到的是
   * 「这里只有一个端子」。
   */
  readonly revealedPorts: readonly StagePoint[] | null
  /**
   * 待定几何的世界折线（弧已拍扁）；命令给不出时为 `null`。
   *
   * @remarks
   * 与 `rubberBand` **互斥**：两者回答的是同一个问题——「松手会变成什么」。预览几何里本来
   * 就含着那条待定段，再叠一条橡皮筋就是同一条线画两遍，重叠出来的更粗的虚线看起来像
   * 渲染缺陷。
   */
  readonly previewOutline: readonly StagePoint[] | null
  /** 光标旁的数值与标注；命令没声明字段时为 `null`。 */
  readonly dynamicInput: StageDynamicInputAnnotation | null
  readonly rubberBand: { readonly start: StagePoint; readonly end: StagePoint } | null
  /**
   * 角度约束命中的那条射线；没命中时为 `null`。
   *
   * @remarks
   * 不画的话用户只看到点「粘」到了某个方向上，说不清是自己手稳还是有东西在吸。命中与否由
   * 落点解算上报，这里一行都不判——各判一次的症状是「画了射线但点没落在上面」。
   */
  readonly trackingRay: { readonly origin: StagePoint; readonly degrees: number } | null
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
  revealedPorts,
  previewOutline,
  dynamicInput,
  rubberBand,
  trackingRay,
  outlines,
}: StageDraftingOverlayProps) {
  const snapScreen = snap ? worldToScreen(snap.point, viewport) : null
  const previewPoints = previewOutline
    ?.map((point) => worldToScreen(point, viewport))
    .map(({ x, y }) => `${x},${y}`)
    .join(' ')
  const bandStart = rubberBand ? worldToScreen(rubberBand.start, viewport) : null
  const bandEnd = rubberBand ? worldToScreen(rubberBand.end, viewport) : null
  /*
   * 追踪射线画满整个图面：它说的是「这条线上的任何位置都在约束里」，画到落点为止会让它
   * 看起来像另一条橡皮筋。长度取图面对角线，两端都伸出去，因此视口怎么滚都盖得住。
   */
  const rayOrigin = trackingRay ? worldToScreen(trackingRay.origin, viewport) : null
  const raySpan = Math.hypot(surfaceSize.width, surfaceSize.height)
  const rayUnit = trackingRay
    ? {
        // 屏幕 Y 轴向下，方向向量的 y 取负——与落点那一侧同一套约定。
        x: Math.cos((trackingRay.degrees * Math.PI) / 180),
        y: -Math.sin((trackingRay.degrees * Math.PI) / 180),
      }
    : null

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
      <StageDynamicInputLayer annotation={dynamicInput} testIdPrefix="stage" />
      {rayOrigin && rayUnit ? (
        <line
          className="compose-stage__drafting-tracking-ray"
          data-testid="stage-drafting-tracking-ray"
          x1={rayOrigin.x - rayUnit.x * raySpan}
          x2={rayOrigin.x + rayUnit.x * raySpan}
          y1={rayOrigin.y - rayUnit.y * raySpan}
          y2={rayOrigin.y + rayUnit.y * raySpan}
        />
      ) : null}
      {previewPoints ? (
        <polyline
          className="compose-stage__drafting-preview"
          data-testid="stage-drafting-preview"
          points={previewPoints}
        />
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
      {/*
        * 端口排在捕捉标记**之前**：吸上其中一个时两者叠在同一个点上，方框在后面画才不会被
        * 圆点盖住——框说的是「吸上了」，它得读得出来。
        */}
      {revealedPorts?.map((port) => {
        const screen = worldToScreen(port, viewport)
        return (
          <circle
            className="compose-stage__drafting-port"
            cx={screen.x}
            cy={screen.y}
            data-testid="stage-drafting-port"
            key={`${port.x}:${port.y}`}
            r={PORT_MARKER_RADIUS}
          />
        )
      })}
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
