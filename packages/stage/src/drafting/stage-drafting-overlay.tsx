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

/**
 * 沙漏形捕捉记号：`nearest` 专用。
 *
 * @remarks
 * 边长与方框记号同为 {@link MARKER_SIZE}，因此它同样**套得住**拾取框——比框小的记号会整个
 * 藏进框里，用户根本看不见吸没吸上。
 */
function hourglassPath(center: StagePoint): string {
  const half = MARKER_SIZE / 2
  const left = center.x - half
  const right = center.x + half
  const top = center.y - half
  const bottom = center.y + half
  return `M${left} ${top}H${right}L${left} ${bottom}H${right}Z`
}

/** 修剪预览里的一截：世界折线、两头的剪口与它自己的描边色。 @internal */
export interface StageTrimOverlayPiece {
  readonly outline: readonly StagePoint[]
  readonly cuts: readonly { readonly point: StagePoint; readonly direction: StagePoint }[]
  /** Entity 自己的描边色；读不到时退回 accent。 */
  readonly stroke: string | null
}

/** 修剪的悬停预览与拖动轨迹。 @internal */
export interface StageTrimOverlay {
  readonly pieces: readonly StageTrimOverlayPiece[]
  /** 拖动中的轨迹，世界坐标；点选悬停时为 `null`。 */
  readonly trail: readonly StagePoint[] | null
}

/**
 * 剪口短划的半长（屏幕像素）。
 *
 * @remarks
 * 与线垂直、比线宽长得多：它回答「这一截的两头在这里」，压在线上要一眼能读出来。
 */
const CUT_MARK_HALF = 6

/** 徽标离拾取框右下角的偏移（屏幕像素）：贴着框但不压住它。 */
const BADGE_OFFSET = 5

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
   * 落笔会接上的那条导线的整条几何，世界坐标；不会接线时为 `null`。
   *
   * @remarks
   * 高亮整条而不只画那一个点：密集图上两条平行导线只隔几个像素，只画一个点说不清它长在谁
   * 身上，而用户此刻要回答的正是「我会接到哪条线上」。
   */
  readonly revealedWire: readonly StagePoint[] | null
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
  /**
   * 修剪的预览；不在等 `pick` 时为 `null`。
   *
   * @remarks
   * 被去掉的那一截**不换色**：按 Entity 自己的描边色改成点画、再压一层画布底色淡掉。一条红
   * 导线上涂任何颜色都读不出来，淡掉在每种墨上都读得出来。剪口用自己的颜色。
   */
  readonly trim: StageTrimOverlay | null
  /**
   * 提示声明的光标徽标；缺席不画。
   *
   * @remarks
   * 画在拾取框的右下、刀尖指向框，按**同一个** `crosshair` 解析结果画——解析说不画时它也不画，
   * 系统光标的隐藏因此仍然只有一个来源。角度固定，不跟着被剪的那一段转。
   */
  readonly badge: 'scissors' | null
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
  revealedWire,
  previewOutline,
  dynamicInput,
  rubberBand,
  trackingRay,
  outlines,
  trim,
  badge,
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
      {crosshair && badge === 'scissors' ? (
        <g
          className="compose-stage__drafting-badge"
          data-testid="stage-drafting-badge"
          transform={`translate(${crosshair.center.x + crosshair.boxRadius + BADGE_OFFSET} ${crosshair.center.y + crosshair.boxRadius + BADGE_OFFSET - 2}) rotate(-45 6 6)`}
        >
          <circle cx="2.6" cy="9.6" r="2.2" />
          <circle cx="9.4" cy="9.6" r="2.2" />
          <path d="M4 8L10.5 0.5M8 8L1.5 0.5" />
        </g>
      ) : null}
      {trim?.pieces.map((piece, position) => {
        const points = piece.outline
          .map((point) => worldToScreen(point, viewport))
          .map(({ x, y }) => `${x},${y}`)
          .join(' ')
        return (
          <g data-testid="stage-trim-piece" key={`${position}:${points}`}>
            <polyline className="compose-stage__trim-dim" points={points} />
            <polyline
              className="compose-stage__trim-ghost"
              points={points}
              style={piece.stroke ? { stroke: piece.stroke } : undefined}
            />
            {piece.cuts.map((cut, cutIndex) => {
              const center = worldToScreen(cut.point, viewport)
              // 视口没有旋转，世界方向就是屏幕方向；剪口与线垂直。
              const nx = -cut.direction.y * CUT_MARK_HALF
              const ny = cut.direction.x * CUT_MARK_HALF
              return (
                <line
                  className="compose-stage__trim-cut"
                  data-testid="stage-trim-cut"
                  key={cutIndex}
                  x1={center.x - nx}
                  x2={center.x + nx}
                  y1={center.y - ny}
                  y2={center.y + ny}
                />
              )
            })}
          </g>
        )
      })}
      {trim?.trail ? (
        <polyline
          className="compose-stage__trim-trail"
          data-testid="stage-trim-trail"
          points={trim.trail
            .map((point) => worldToScreen(point, viewport))
            .map(({ x, y }) => `${x},${y}`)
            .join(' ')}
        />
      ) : null}
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
      {revealedWire ? (
        <polyline
          className="compose-stage__drafting-tap-target"
          data-testid="stage-drafting-tap-target"
          points={revealedWire
            .map((point) => worldToScreen(point, viewport))
            .map(({ x, y }) => `${x},${y}`)
            .join(' ')}
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
      {/*
        * `nearest` 画沙漏而不是方框（AutoCAD 的 Nearest 记号就是沙漏）：这块画布的规矩是
        * **形状先分开、颜色再分开**，而「吸在这条线上的某一点」与「吸在一个特征点上」是两件
        * 事——后者说得出那个点是什么（端点、中点、圆心），前者说不出。
        */}
      {snapScreen && snap?.mode === 'nearest' ? (
        <path
          className="compose-stage__drafting-snap compose-stage__drafting-snap--nearest"
          d={hourglassPath(snapScreen)}
          data-snap-mode={snap.mode}
          data-testid="stage-drafting-snap"
        />
      ) : snapScreen ? (
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
