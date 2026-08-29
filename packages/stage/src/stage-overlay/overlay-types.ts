import type {
  ResizeHandle,
  StageEditablePath,
  StageGuide,
  StageWireEnd,
  StageInteractionHit,
  StageInteractionTool,
  StageDrawingPreview,
  StageDropIndicator,
  StageMarqueeHitTest,
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
  /**
   * 单选一条曲线时的世界坐标轮廓折线；其余情形为 `null`。
   *
   * @remarks
   * 存在时它**取代**选区矩形与 Resize 手柄：盒不是曲线的轮廓，一条对角线的包围盒里绝大部分
   * 是空的。覆盖层不认识文档，也不知道「什么算曲线」——判定与派生都在宿主，这里只负责换算到
   * 屏幕并画出来。
   */
  readonly selectionOutline?: readonly StagePoint[] | null
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
  /**
   * 处于曲线几何编辑会话。
   *
   * @remarks
   * 与文字编辑那条同构：此时不显示 Resize 与旋转手柄，改为显示夹点——盒的角手柄与角顶点
   * 几乎压在同一个像素上，两个含义叠在一起谁也点不准。
   */
  readonly geometryEditing: boolean
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
  readonly marqueeHitTest: StageMarqueeHitTest | null
  readonly marqueeScreen: StageRect | null
  readonly snapGuides: readonly StageGuide[]
  /**
   * 要画出来的导线端点记号。
   *
   * @remarks
   * 由调用方按「问了才想知道 / 没问也必须知道」算好：选中的导线画两端，**失效的端点常驻**
   * 不依赖选中集——它是一个缺陷，等用户主动选中那条线才显形，等于把发现缺陷的责任推给他，
   * 而他恰恰不知道该去选哪一条。
   */
  readonly wireEnds?: readonly StageWireEnd[]
  readonly paintHandles: readonly StagePaintHandle[]
  readonly paintSample: StagePaintSamplePreview | null
  /** 宿主算好的世界坐标可编辑路径几何；null 时不渲染任何路径元素。 */
  readonly editablePath?: StageEditablePath | null
  /** 当前活动顶点：corner 顶点被激活时也显示切线手柄。 */
  readonly activePathVertexId?: string | null
  /**
   * 已点亮的夹点（AutoCAD 的 `GRIPHOT`）。
   *
   * @remarks
   * 只在**点亮**时给，拖动时不给：拖动中夹点就在光标底下，「正在动的是哪一个」已经在屏幕上；
   * 点亮后它停在原位而光标在别处找目标点，没有它就没有任何东西说得出下一个点会挪哪个顶点。
   */
  readonly hotPathVertexId?: string | null
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
 * 层是纯呈现：输入是上下文，输出是 SVG 片段，不持有状态也不写文档。宿主因此可以贡献自己的
 * 层，而不必改动 Overlay 本体。
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
