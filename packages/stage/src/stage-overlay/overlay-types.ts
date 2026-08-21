import type {
  ResizeHandle,
  StageEditablePath,
  StageGuide,
  StageInteractionHit,
  StageInteractionTool,
  StageDrawingPreview,
  StageDropIndicator,
  StageMarqueeMode,
  StagePaintHandle,
  StagePaintSamplePreview,
  StagePoint,
  StagePreviewGuide,
  StageRect,
  StageViewport,
} from '@compose-ui/stage-engine'
import type { ComponentType, PointerEvent as ReactPointerEvent } from 'react'

/**
 * Overlay 的全部输入。
 *
 * @remarks
 * 每一项都直接来自 engine snapshot 或宿主派生，Overlay MUST NOT 持有手势状态——它只把
 * 快照画出来，指针事件原样交回 `onInteraction`。
 *
 * @public
 */
export interface StageOverlayProps {
  readonly label: string
  readonly viewport: StageViewport
  readonly canvasGuides: readonly StagePreviewGuide[]
  readonly screenBounds: StageRect | null
  /**
   * 已下钻选中的实例内部实体矩形。
   *
   * @remarks
   * 内部实体不属于宿主文档，几何来自 DOM 测量。只画只读边框、不带任何手柄：实例内部的
   * 几何编辑要经由实例覆盖，尚未接线。
   */
  readonly instanceSelectionBounds?: StageRect | null
  /** 单选两点图形的精确世界端点；存在时替代通用矩形选区。 */
  readonly lineSelection?: {
    readonly entityId: string
    readonly start: StagePoint
    readonly end: StagePoint
  } | null
  readonly handlePoints: Readonly<
    Record<ResizeHandle, readonly [number, number]>
  > | null
  readonly editableSelection: boolean
  readonly resizeHandles: readonly ResizeHandle[]
  readonly visibleResizeHandles: readonly ResizeHandle[]
  readonly rotatable: boolean
  /**
   * 选区正处于画布内文字编辑会话。
   *
   * 此时不显示任何 Resize 或旋转手柄，只显示一个编辑边框以区别于普通选中态——编辑态下
   * 拖拽的语义是选择文本。该抑制与 TransformConstraints 的抑制是两条独立规则，叠加生效。
   */
  readonly textEditing: boolean
  readonly tool: StageInteractionTool
  readonly drawing: StageDrawingPreview | null
  /**
   * 拖拽落点的世界坐标指示。
   *
   * 存在时说明松手会改变结构：`reparent` 高亮目标容器，`reorder` 在插入位画一根落点线。
   * 被拖动目标自身的选中框与手柄呈现不受影响——两者是不同对象，不存在反馈叠加。
   */
  readonly dropIndicator: StageDropIndicator | null
  /**
   * Godot 旋转拉线预览（世界坐标）：选区中心 → 当前指针。
   *
   * @remarks
   * 仅在 `phase === 'rotate'` 时由 engine 提供；存在时 Overlay 画拉杆并跟随鼠标。
   * Shift 吸附时 pointer 已投影到 15° 射线，`angleDegrees` 为增量角。
   */
  readonly rotationPreview?: {
    readonly center: StagePoint
    readonly pointer: StagePoint
    readonly angleDegrees?: number
    readonly snapped?: boolean
  } | null
  /** 当前框选实际生效的判定；决定 marquee 边框是实线还是虚线。 */
  readonly marqueeHitTest: Exclude<StageMarqueeMode, 'directional'> | null
  readonly marqueeScreen: StageRect | null
  readonly snapGuides: readonly StageGuide[]
  readonly paintHandles: readonly StagePaintHandle[]
  readonly paintSample: StagePaintSamplePreview | null
  /** 宿主算好的世界坐标可编辑路径几何；null 时不渲染任何路径元素。 */
  readonly editablePath?: StageEditablePath | null
  /** 当前活动顶点：corner 顶点被激活时也显示切线手柄。 */
  readonly activePathVertexId?: string | null
  readonly onInteraction: (
    hit: StageInteractionHit,
    event: ReactPointerEvent<Element>,
  ) => void
}
/**
 * 单个 Overlay 层拿到的上下文。
 *
 * @remarks
 * 与 {@link StageOverlayProps} 同构：层各自从中取自己需要的字段并**自行**完成世界→屏幕
 * 换算。刻意不预先算好一个共享派生包——那会让每加一层就往包里塞几个字段，最终又变回一个
 * 谁都在读、谁都不敢改的大对象。重复几次 `worldToScreen` 的代价远小于它。
 *
 * @public
 */
export type StageOverlayContext = StageOverlayProps

/**
 * 一个可注册的 Overlay 层。
 *
 * @remarks
 * 层是纯呈现：输入是上下文，输出是 SVG 片段，不持有状态也不写文档。这让 CAD 之类的新文档
 * 类型可以贡献自己的层，而不必改动 Overlay 本体。
 *
 * @public
 */
export interface StageOverlayContribution {
  /** 注册表内唯一。 */
  readonly id: string
  /**
   * 绘制顺序，数值大的画在上面。
   *
   * @remarks
   * SVG 没有 z-index，**绘制顺序即命中顺序**：后画的元素压在上面，也先接到指针。因此这个
   * 数值同时决定了重叠区域归谁——例如路径顶点必须排在变换手柄之上，否则与对象角点重合时
   * 永远拖不动。
   */
  readonly order: number
  readonly Layer: ComponentType<StageOverlayContext>
}
