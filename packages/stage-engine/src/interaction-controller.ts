import type {
  ComposePaint,
  ComposeDocument,
  ComposeLayoutSnapshot,
  EditorCommand,
  JsonValue,
} from '@compose-ui/core'
import {
  getComposeHierarchy,
  getComposeLock,
  isComposeGroupEntity,
  resolveComposeAppearance,
  resolveComposeGeometryConstraints,
} from '@compose-ui/core'
import {
  marqueeCombine,
  marqueeDirection,
  resolveMarqueeCommit,
  resolveMarqueeHitTest,
  type StageMarqueeMode,
} from './marquee-selection'
import { isDrawingTool } from './drawing-tools'
import { planMoveCommit, planMovePreview } from './move-planning'
import {
  type StageDropTarget,
} from './drop-target'
import {
  createStageSceneIndex,
  type StageSceneIndex,
} from './scene-index'
import {
  listFrameWorldGuides,
  resolveTargetFrameId,
  toFrameGuidePosition,
} from './frame-space'
import {
  expandScrollRange,
  snapResizePoint,
  snapValueToGrid,
} from './canvas-geometry'
import type {
  ResizeHandle,
  StageGuide,
  StageMatrix,
  StagePoint,
  StageRect,
  StageTransform,
  StageViewport,
} from './geometry'
import {
  applyMatrix,
  matrixFromTransform,
  multiplyMatrices,
  rectFromPoints,
  rectMappingMatrix,
  resizeBounds,
  screenToWorld,
  unionRects,
} from './geometry'
// 交互内核只做类型级依赖回指（`import type`），因此这里的相互引用不产生运行时循环。
import {
  createStagePluginRegistry,
  createStageSessionArbiter,
  STAGE_EXTRACTED_PLUGIN_FACTORIES,
  STAGE_LEGACY_MONOLITH_PRIORITY,
  STAGE_PAN_PLUGIN_ID,
} from './interaction-kernel'
import { planTransformCommit, resolveTransformTargets } from './transform-planning'
import {
  matrixBounds,
  resolvedSpatialTransform,
  transformedResizeSelection,
} from './transform-preview'
import type {
  StageInteractionPlugin,
  StagePluginContext,
  StageSession,
} from './interaction-kernel'

/** Stage 当前活动交互。 @public */
export type StageInteractionPhase =
  | 'idle'
  | 'pan'
  | 'marquee'
  | 'move'
  | 'resize'
  | 'segment-resize'
  | 'rotate'
  | 'draw'
  | 'guide-create'
  | 'guide-move'
  | 'paint-edit'
  | 'paint-sample'
  | 'path-edit'
  | 'external'

/** Stage 的受控工具模式；不包含 React 或 DOM 类型。 @public */
export type StageInteractionTool =
  | 'select'
  | 'marquee'
  | 'move'
  | 'scale'
  | 'rotate'
  | 'pan'
  | 'draw-container'
  | 'draw-rectangle'
  | 'draw-line'
  | 'draw-arrow'
  | 'draw-circle'
  | 'draw-text'

/** 当前绘制手势的瞬时世界坐标预览。 @public */
export interface StageDrawingPreview {
  readonly tool: Extract<StageInteractionTool, `draw-${string}`>
  readonly bounds: StageRect
  readonly start: StagePoint
  readonly end: StagePoint
}

/** 不依赖 KeyboardEvent 的交互修饰键。 @public */
export interface StageInteractionModifiers {
  readonly shift: boolean
  readonly alt: boolean
  readonly command: boolean
}

/** Palette 交给引擎的无 React descriptor。 @public */
export interface StageExternalAssetItem {
  readonly providerId: string
  readonly assetKey: string
  readonly scope: 'persistent' | 'session'
  readonly name: string
  readonly mediaType: string
}

/** Palette 或 Asset Browser 交给引擎的无 React descriptor。 @public */
export type StageExternalDragItem =
  | { readonly kind: 'preset'; readonly presetId: string }
  | { readonly kind: 'assets'; readonly items: readonly StageExternalAssetItem[] }

/** Pointer 命中的 Stage 语义目标。 @public */
export type StageInteractionHit =
  | { readonly kind: 'surface' }
  | {
      readonly kind: 'entity'
      readonly entityId: string
      /**
       * 命中来源：Entity 自身的几何（`body`）还是它在画布上的标题标签（`label`）。
       *
       * 省略时按 `body` 处理。非空容器的 body 命中会收敛为框选，只有 `label` 能直接选中
       * 它；见 `shouldConvergeToMarquee`。
       */
      readonly source?: 'body' | 'label'
    }
  | { readonly kind: 'resize'; readonly handle: ResizeHandle }
  | {
      /** 由 surface 从任意两点图形推导的端点；Engine 不依赖 Renderer 或物料类型。 */
      readonly kind: 'segment-endpoint'
      readonly entityId: string
      readonly endpoint: 'start' | 'end'
      readonly start: StagePoint
      readonly end: StagePoint
    }
  | { readonly kind: 'rotate' }
  | { readonly kind: 'move-axis'; readonly axis: 'x' | 'y' }
  | { readonly kind: 'ruler'; readonly axis: 'x' | 'y' }
  | { readonly kind: 'ruler-corner' }
  | { readonly kind: 'guide'; readonly guideId: string }
  | {
      readonly kind: 'paint-handle'
      readonly handle: StagePaintHandleKind
      readonly stopId?: string
    }
  | {
      /** 可编辑路径的顶点或切线手柄；vertexId 对引擎是不透明字符串。 */
      readonly kind: 'path-handle'
      readonly handle: StagePathHandleKind
      readonly vertexId: string
    }

/** 渐变画布控制柄的稳定语义。 @public */
export type StagePaintHandleKind =
  | 'linear-start'
  | 'linear-end'
  | 'linear-stop'
  | 'radial-center'
  | 'radial-radius-x'
  | 'radial-radius-y'
  | 'radial-stop'
  | 'angular-center'
  | 'angular-arm'
  | 'angular-stop'

/** 当前 Inspector 已打开的单 Entity Paint 编辑上下文。 @public */
export interface StagePaintEditing {
  readonly entityId: string
  readonly activeStopId?: string
}

/** 可编辑路径手柄的稳定语义。 @public */
export type StagePathHandleKind = 'vertex' | 'tangent-in' | 'tangent-out'

/**
 * 宿主打开的可编辑路径会话。
 *
 * @remarks
 * 引擎只用它判定 `path-handle` 命中是否合法并把手势结果路由回宿主；它不携带几何——
 * 几何经 `StageEditablePath` 直接交给 Overlay 渲染，不进入引擎状态机。
 * @public
 */
export interface StagePathEditing {
  readonly entityId: string
  /** 当前活动顶点；Overlay 据此决定 corner 顶点是否也显示切线手柄。 */
  readonly activeVertexId?: string
}

/** 可编辑路径的单个顶点；切线端点为世界坐标绝对位置，null 表示该侧无切线。 @public */
export interface StageEditablePathVertex {
  readonly id: string
  readonly point: StagePoint
  readonly inTangent: StagePoint | null
  readonly outTangent: StagePoint | null
  readonly mode: 'corner' | 'smooth'
}

/**
 * 宿主算好的世界坐标可编辑路径几何。
 *
 * @remarks
 * `polyline` 按弧长细分用于画轨迹；`dots` 按**时间**等分用于表达速度快慢——两者的点集
 * 不同，不能合并。顶点 ID 对 Stage 是不透明字符串，手势结果原样回传，由宿主解释它
 * 对应哪个文档事实。命名不含动画语义：这一层可被将来的矢量路径编辑复用。
 * @public
 */
export interface StageEditablePath {
  readonly entityId: string
  readonly polyline: readonly StagePoint[]
  readonly dots: readonly StagePoint[]
  readonly vertices: readonly StageEditablePathVertex[]
}

/** 当前画布图层取色的目标字段。 @public */
export interface StagePaintSampling {
  readonly entityId: string
  readonly field: 'backgroundPaint' | 'borderColor'
}

/** 图层取色过程中的瞬时反馈。 @public */
export interface StagePaintSamplePreview {
  readonly target: StagePaintSampling
  readonly point: StagePoint
  readonly sampledEntityId?: string
  readonly color?: string
  readonly status: 'ready' | 'unavailable'
}

/** SVG/DOM overlay 可绘制的世界坐标 Paint 控制柄。 @public */
export interface StagePaintHandle {
  readonly kind: StagePaintHandleKind
  readonly point: StagePoint
  readonly stopId?: string
}

/** 任意两点图形在端点拖拽过程中的世界坐标预览。 @public */
export interface StageSegmentPreview {
  readonly entityId: string
  readonly start: StagePoint
  readonly end: StagePoint
}

/** Stage surface 最新受控上下文。 @public */
export interface StageInteractionContext {
  /** 最新正式文档引用；内部手势据此检测并发文档变化。 */
  readonly document: ComposeDocument
  /** 与 document 同一求解周期的布局快照。 */
  readonly layoutSnapshot: ComposeLayoutSnapshot
  /**
   * 额外视为不可见的 Entity；其后代一并不可命中。
   *
   * @remarks
   * 宿主从 WidgetSwitcher 的活动索引与编辑期预览覆盖派生。Controller 只消费结果，不读取
   * 切换语义本身，也不感知选择驱动的预览规则。集合引用必须稳定，否则每次上下文更新都会
   * 绕过 SceneIndex 缓存重建整棵场景。
   */
  readonly hiddenEntityIds?: ReadonlySet<string>
  /** 最新受控 viewport。 */
  readonly viewport: StageViewport
  /** 不含标尺和滚动条的 surface CSS 像素尺寸。 */
  readonly surfaceSize: { readonly width: number; readonly height: number }
  /** 当前持久工具；临时平移由独立事件控制。 */
  readonly tool: StageInteractionTool
  /**
   * 框选命中判定模式；`select` 与 `marquee` 两个入口共用同一个值。
   *
   * @defaultValue 'intersect'
   */
  readonly marqueeMode?: StageMarqueeMode
  /** 最新受控选择，按宿主顺序排列。 */
  readonly selectedIds: readonly string[]
  /**
   * 没有选择时 Frame 相关动作回退的默认 Frame。
   *
   * @remarks
   * 只承担回退职责：有选择时目标始终解析为选中项最近的祖先 Frame，本字段 MUST NOT 覆盖
   * 显式选择。缺省时回退到第一个根 Frame。
   */
  readonly activeFrameId?: string | null
  /** Inspector 打开的单 Entity 背景填充编辑；缺失时不渲染也不接收 Paint 控制柄。 */
  readonly paintEditing?: StagePaintEditing | null
  /** 宿主打开的可编辑路径会话；缺失时引擎不接收 `path-handle` 命中，行为与现在完全一致。 */
  readonly pathEditing?: StagePathEditing | null
  /** Inspector 请求的画布图层取色目标；存在时普通 Stage 命中被临时屏蔽。 */
  readonly paintSampling?: StagePaintSampling | null
  /** 宿主持有的画布内文字编辑会话；存在时该 Entity 的空间手势被屏蔽。 */
  readonly textEditing?: StageTextEditing | null
  /**
   * 判定一个 Entity 能否原地编辑文字；缺省时视为全部不可编辑。
   *
   * @remarks
   * 可编辑性来自 Registry 的 Renderer 契约，而 stage-engine 不依赖 Registry，因此由宿主查询后
   * 以判定入口传入。Controller 只消费判定结果，不感知 Renderer type 或 prop 名称。
   */
  readonly isTextEditable?: (entityId: string) => boolean
  /** 宿主回灌的最近一次绘制创建结果；`draw-text` 的创建据此进入编辑。 */
  readonly drawnEntity?: StageDrawnEntity | null
  /**
   * 判定一个 Entity 的内容高度是否随可用宽度重排（例如文字换行）；缺省时视为不重排。
   *
   * @remarks
   * 该事实来自 Renderer 的 measurement 声明，而 stage-engine 不依赖 Registry，因此由宿主
   * 查询后传入。缩放这类 Entity 时其 Hug 高度会被保留——见下方缩放规则。
   */
  readonly contentReflowsWithWidth?: (entityId: string) => boolean
  /**
   * 宿主级「锁定原父级」：为 true 时全部 move 手势与按住 Space 同一语义——不产生跨父级
   * reparent 落点与命令，同容器重排照常。
   *
   * @remarks
   * 编辑器动画模式用它把画布拖拽限定为姿态编辑：拖动只表达关键帧/offset 变化，不得把
   * 对象拖出所属场景。与手势中的 Space 锁定可叠加，任一生效即锁定。
   */
  readonly lockGestureParent?: boolean
  /** 为命令、batch、guide 和结构节点创建稳定 ID。 */
  readonly idFactory: () => string
  /** 保留 React/i18n 层提供的命令标签。 */
  readonly labels?: {
    readonly createGuide: string
    readonly createGuides: string
    readonly moveGuide: string
    readonly deleteGuide: string
  }
}

/** 引擎发送给 DOM/React surface 的副作用请求。 @public */
export type StageInteractionEffect =
  | { readonly type: 'pointer.capture'; readonly pointerId: number }
  | { readonly type: 'pointer.release'; readonly pointerId: number }
  | { readonly type: 'viewport.change'; readonly viewport: StageViewport }
  | { readonly type: 'selection.change'; readonly selectedIds: readonly string[] }
  | { readonly type: 'paint.sample.complete' }
  | { readonly type: 'command.dispatch'; readonly command: EditorCommand }
  | {
      readonly type: 'drawing.commit'
      readonly tool: Extract<StageInteractionTool, `draw-${string}`>
      readonly bounds: StageRect
      readonly start: StagePoint
      readonly end: StagePoint
      readonly parentId: string | null
    }
  | {
      /** Engine 只回传两端世界坐标，surface 决定如何持久化其图形语义。 */
      readonly type: 'segment.commit'
      readonly entityId: string
      readonly start: StagePoint
      readonly end: StagePoint
    }
  | {
      readonly type: 'external.drop'
      readonly item: StageExternalDragItem
      readonly clientPoint: StagePoint | null
      readonly worldPoint: StagePoint
      readonly parentId: string | null
    }
  /** 请求宿主开启文字编辑会话；宿主据此持有状态并作为 context 回传。 */
  | { readonly type: 'text-editing.enter'; readonly entityId: string }
  /** 请求宿主结束文字编辑会话并按内容收敛为最多一条事务。 */
  | { readonly type: 'text-editing.exit' }
  | {
      /**
       * 路径手柄手势的阶段性世界坐标结果；引擎不理解它对应的文档语义，也绝不因此
       * 产出 Patch 或命令。`move` 供宿主更新本地预览，`end` 才应落成一条可撤销记录，
       * `cancel` 表示手势被打断（Esc、并发文档变化），宿主应丢弃预览。
       */
      readonly type: 'path.change'
      readonly entityId: string
      readonly vertexId: string
      readonly handle: StagePathHandleKind
      readonly phase: 'start' | 'move' | 'end' | 'cancel'
      readonly worldPoint: StagePoint
      readonly modifiers: StageInteractionModifiers
    }
  /**
   * 双击路径顶点；宿主据此切换 corner / smooth。放在引擎而不是 DOM dblclick：
   * 手势期间指针被 capture，DOM 双击事件在真实浏览器里无法可靠合成。
   */
  | { readonly type: 'path.vertex-toggle'; readonly entityId: string; readonly vertexId: string }

/** surface 与 controller 之间唯一允许的命令式端口。 @public */
export interface StageInteractionSurfacePort {
  /** 把 client 坐标映射为 surface 坐标；surface 暂不可用时返回 null。 */
  resolveClientPoint(point: StagePoint): StagePoint | null
  /** 同步应用 controller 生成的一批 effect。 */
  applyEffects(effects: readonly StageInteractionEffect[]): void
}

/**
 * 宿主持有的画布内文字编辑会话。
 *
 * @remarks
 * Controller 只判定会话的进入、退出与提交时机，不持有编辑中的文本——中间文本是宿主 DOM 层的
 * 瞬时状态，逐字符进入状态机既无必要，也会把每次按键变成一次手势事件。
 * @public
 */
export interface StageTextEditing {
  /** 正在编辑的 Entity。 */
  readonly entityId: string
}

/**
 * 一次绘制提交实际创建的 Entity。
 *
 * @remarks
 * Controller 发 `drawing.commit` 时并不创建实体，也不铸 ID：真正创建的是宿主。因此「点击创建
 * 文字后立刻进入编辑」需要宿主把结果回灌，Controller 才知道该编辑谁。
 *
 * Controller 按 `entityId` 去重，同一次创建只进入一次编辑；宿主无需清理该字段，也无需保持
 * 对象引用稳定。
 * @public
 */
export interface StageDrawnEntity {
  /** 本次绘制创建的 Entity。 */
  readonly entityId: string
  /** 创建它的绘制工具；只有 `draw-text` 会进入编辑。 */
  readonly tool: Extract<StageInteractionTool, `draw-${string}`>
}

/** snapshot 中的临时文档辅助线。 @public */
export interface StagePreviewGuide {
  readonly id: string
  readonly axis: 'x' | 'y'
  readonly position: number
}

/** 可由任意渲染层订阅的不可变交互快照。 @public */
export interface StageInteractionSnapshot {
  /** 当前互斥交互 phase。 */
  readonly phase: StageInteractionPhase
  /** 尚未提交的节点局部 transform。 */
  readonly previewTransforms: Readonly<Record<string, StageTransform>>
  /** 框选中的世界矩形。 */
  readonly marquee: StageRect | null
  /**
   * 当前框选实际生效的判定；非框选 phase 为 null。
   *
   * @remarks
   * `directional` 已在这里归约成 `intersect`/`contain`，Overlay 据此区分虚线与实线，
   * 不需要自己再判断拖拽方向。
   */
  readonly marqueeHitTest: Exclude<StageMarqueeMode, 'directional'> | null
  /** 当前智能吸附反馈线。 */
  readonly snapGuides: readonly StageGuide[]
  /** 创建或移动中的文档辅助线 preview。 */
  readonly guidePreview: readonly StagePreviewGuide[]
  /** 尚未提交的背景 Paint；仅控制柄拖动期间存在。 */
  readonly paintPreview: {
    readonly entityId: string
    readonly paint: ComposePaint
    readonly activeStopId?: string
  } | null
  /** 当前 Inspector Paint 编辑目标的控制柄；坐标均为 world 坐标。 */
  readonly paintHandles: readonly StagePaintHandle[]
  /** 当前图层取色准星和命中反馈。 */
  readonly paintSample: StagePaintSamplePreview | null
  /** Palette 外部拖入 preview；非 external phase 时为空。 */
  readonly external: {
    readonly item: StageExternalDragItem
    readonly clientPoint: StagePoint | null
  } | null
  /** 绘制工具在 pointerup 前的世界坐标预览。 */
  readonly drawing: StageDrawingPreview | null
  /** 两点图形端点拖动的世界坐标预览。 */
  readonly segmentPreview: StageSegmentPreview | null
  /**
   * 旋转拉线预览（Godot 风格）：从选区中心到当前指针的世界坐标。
   *
   * @remarks
   * 仅在 `phase === 'rotate'` 时有值；Overlay 画拉杆，不依赖固定旋转手柄。
   * Shift 角度吸附时 `pointer` 落在吸附射线上，`angleDegrees` 为本次增量。
   */
  readonly rotationPreview: {
    readonly center: StagePoint
    readonly pointer: StagePoint
    /** 相对手势起点的旋转增量（度），吸附后已量化。 */
    readonly angleDegrees: number
    /** 是否处于 Shift 角度吸附。 */
    readonly snapped: boolean
  } | null
  /** 临时平移键是否仍被按住。 */
  readonly temporaryPan: boolean
  /** 当前选区（包含 transform preview）的世界轴对齐边界。 */
  readonly selectionBounds: StageRect | null
  /** 当前 controller 会话内只扩不缩的世界滚动范围。 */
  readonly scrollRange: StageRect | null
  /** 不含 CSS/DOM 类型的语义光标提示。 */
  readonly cursor:
    | 'default'
    | 'grab'
    | 'grabbing'
    | 'crosshair'
    | 'move'
    | 'resize'
    | 'rotate'
    | 'copy'
    | 'guide-delete'
  /** 辅助线手势当前停在所属标尺内，松手将删除该辅助线。 */
  readonly guideDelete: boolean
  /**
   * move 手势当前的落点判定；非 move phase 或不满足判定条件时为 null。
   *
   * @remarks
   * Overlay 据此渲染候选容器高亮与容器内重排的落点指示。为 null 表示松手只更新坐标，
   * 不改变父子关系与顺序。
   */
  readonly dropTarget: StageDropTarget | null
}

/*
 * 辅助线拖回“自己那条标尺”即视为删除：横线（axis 'y'）属于顶部标尺，落点 y 为负表示已经
 * 退回标尺区域；竖线（axis 'x'）属于左侧标尺，看 x。surface 坐标以标尺内边缘为原点，因此
 * 负值就等价于“在标尺里”。
 */
function isInsideOwningRuler(axis: 'x' | 'y', point: StagePoint): boolean {
  return axis === 'y' ? point.y < 0 : point.x < 0
}

/** controller 接受的普通数据事件。 @public */
export type StageInteractionEvent =
  | {
      readonly type: 'pointer.down'
      readonly pointerId: number
      readonly button: number
      readonly point: StagePoint
      readonly hit: StageInteractionHit
      readonly modifiers: StageInteractionModifiers
      /**
       * 连击计数；由宿主按平台惯例归一化后传入。
       *
       * @remarks
       * 双击的时间窗口是平台约定，属于 DOM 层知识，Controller 不自行计时。
       * @defaultValue 1
       */
      readonly clickCount?: number
    }
  | {
      readonly type: 'pointer.move'
      readonly pointerId: number
      readonly point: StagePoint
      readonly modifiers: StageInteractionModifiers
    }
  | {
      readonly type: 'pointer.up'
      readonly pointerId: number
      readonly point: StagePoint
      readonly modifiers: StageInteractionModifiers
    }
  | { readonly type: 'pointer.cancel'; readonly pointerId?: number }
  /** 与文字编辑会话相关的归一化按键；宿主只转发这两个键，不传原生事件。 */
  | { readonly type: 'key.down'; readonly key: 'Escape' | 'Enter' }
  | { readonly type: 'temporary-pan.start' }
  | { readonly type: 'temporary-pan.end' }
  | { readonly type: 'external.begin'; readonly item: StageExternalDragItem; readonly clientPoint: StagePoint }
  | { readonly type: 'external.move'; readonly clientPoint: StagePoint }
  | { readonly type: 'external.end'; readonly clientPoint: StagePoint }
  | { readonly type: 'external.add'; readonly item: StageExternalDragItem }
  | { readonly type: 'external.cancel' }

/** 一个 Editor 实例内的 headless Stage 交互运行时。 @public */
export interface StageInteractionController {
  /** 返回引用稳定的当前 snapshot。 */
  getSnapshot(): StageInteractionSnapshot
  /** 订阅 snapshot 变化。 */
  subscribe(listener: () => void): () => void
  /** 连接唯一 surface；返回断开函数。 */
  connectSurface(port: StageInteractionSurfacePort): () => void
  /** 替换最新受控 Stage context。 */
  updateContext(context: StageInteractionContext): void
  /** 发送一个归一化事件。 */
  send(event: StageInteractionEvent): void
  /** 取消会话并永久释放 controller。 */
  dispose(): void
}

const IDLE_SNAPSHOT: StageInteractionSnapshot = {
  phase: 'idle',
  previewTransforms: {},
  marquee: null,
  marqueeHitTest: null,
  snapGuides: [],
  guidePreview: [],
  paintPreview: null,
  paintHandles: [],
  paintSample: null,
  external: null,
  drawing: null,
  segmentPreview: null,
  rotationPreview: null,
  temporaryPan: false,
  selectionBounds: null,
  scrollRange: null,
  cursor: 'default',
  guideDelete: false,
  dropTarget: null,
}

type Gesture =
  | {
      readonly type: 'marquee'
      readonly pointerId: number
      readonly viewport: StageViewport
      readonly startWorld: StagePoint
      readonly origin: 'surface'
      /**
       * 起框所在的容器 Entity。
       *
       * 从非空容器体上起框时，用户看的是「容器内的画布」，结果不应把这个容器连同它的祖先
       * 一起选中——否则收敛之后仍然会选到容器，等于没有解决冲突。
       */
      readonly originEntityId?: string
      /** 框选开始前的选区；Shift 加选与 Alt 减选以它为基准，不受拖拽过程影响。 */
      readonly baseSelection: readonly string[]
      currentWorld: StagePoint
    }
  | {
      readonly type: 'move'
      readonly pointerId: number
      readonly viewport: StageViewport
      readonly ids: readonly string[]
      readonly startWorld: StagePoint
      readonly bounds: StageRect
      readonly axis?: 'x' | 'y'
      transforms: Readonly<Record<string, StageTransform>>
      dropTarget: StageDropTarget | null
      /** 手势中按住 Space：锁定原父级，经过其他容器不产生 reparent 落点。 */
      parentLocked: boolean
      /** 最近一次指针位置与修饰键，Space 切换时用于原地重算落点。 */
      lastPoint: StagePoint
      lastModifiers: StageInteractionModifiers
    }
  | {
      readonly type: 'resize'
      readonly pointerId: number
      readonly viewport: StageViewport
      readonly ids: readonly string[]
      readonly handle: ResizeHandle
      readonly startWorld: StagePoint
      readonly bounds: StageRect
      transforms: Readonly<Record<string, StageTransform>>
    }
  | {
      readonly type: 'guide-create'
      readonly pointerId: number
      readonly viewport: StageViewport
      guides: readonly StagePreviewGuide[]
      point: StagePoint
    }
  | {
      readonly type: 'guide-move'
      readonly pointerId: number
      readonly viewport: StageViewport
      readonly guideId: string
      readonly axis: 'x' | 'y'
      position: number
      point: StagePoint
    }

/**
 * 判断一次 entity 命中是否应当收敛为框选而不是选中该 Entity。
 *
 * @remarks
 * 容器一旦装了内容，它的空白区域在用户眼里就是「容器内的画布」而不是容器本身——沿用
 * Figma Frame 与 Rive Artboard 的约定，此时容器体不再抢占选中，选中入口收敛到标题标签。
 *
 * 收敛只发生在**顶层**容器上：标题标签只画给顶层容器（v7 下即 `rootIds` 里的场景），
 * 嵌套容器没有标签，一旦收敛就没有任何选中入口了。已经在选区里的容器同理例外，
 * 否则从标签选中之后就再也无法拖动它。
 */
function shouldConvergeToMarquee(
  tool: StageInteractionTool,
  document: ComposeDocument,
  selectedIds: readonly string[],
  hit: Extract<StageInteractionHit, { kind: 'entity' }>,
): boolean {
  if (tool !== 'select' && tool !== 'move') return false
  const entity = document.entities[hit.entityId]
  if (!entity) return false
  const hierarchy = getComposeHierarchy(entity)
  // 锁定的容器与 Group 完全退出画布选中：它们本来就是用来「挡住不要动的东西」的，
  // 还能被点中只会让用户反复误选。标签同样不再是入口，改从场景树选中。
  if (hierarchy && getComposeLock(entity).locked) return true
  if (hit.source === 'label') return false
  if (selectedIds.includes(hit.entityId)) return false
  if (!isTopLevelEntity(document, hit.entityId)) return false
  // Group 不是「容器」：它没有画布标签，收敛之后就再也选不中了。
  if (isComposeGroupEntity(entity)) return false
  return (hierarchy?.childIds.length ?? 0) > 0
}

/**
 * 判断 Entity 是否位于顶层。
 *
 * @remarks
 * 顶层 = `rootIds` 的直接成员，v7 下即各块场景。判定必须与标题标签的渲染范围保持一致：
 * 收敛只能作用于带标签的容器，否则被收敛的容器在画布上没有任何选中入口。
 */
function isTopLevelEntity(document: ComposeDocument, entityId: string): boolean {
  return document.rootIds.includes(entityId)
}


function localPaintPointToWorld(
  matrix: StageMatrix,
  transform: { readonly width: number; readonly height: number },
  point: { readonly x: number; readonly y: number },
): StagePoint {
  return applyMatrix(matrix, {
    x: point.x * transform.width,
    y: point.y * transform.height,
  })
}

function paintHandlesFor(
  index: StageSceneIndex,
  entityId: string,
  paint: ComposePaint,
): readonly StagePaintHandle[] {
  if (paint.kind === 'solid' || paint.kind === 'image') return []
  const entity = index.document.entities[entityId]
  const matrix = index.getWorldMatrix(entityId)
  if (!entity || !matrix) return []
  const transform = resolvedSpatialTransform(index, entityId)
  if (!transform) return []
  const world = (point: { readonly x: number; readonly y: number }) =>
    localPaintPointToWorld(matrix, transform, point)
  if (paint.kind === 'linear-gradient') {
    const pointAt = (position: number) => ({
      x: paint.start.x + (paint.end.x - paint.start.x) * position,
      y: paint.start.y + (paint.end.y - paint.start.y) * position,
    })
    return [
      { kind: 'linear-start', point: world(paint.start) },
      { kind: 'linear-end', point: world(paint.end) },
      ...paint.stops.map((stop) => ({ kind: 'linear-stop' as const, point: world(pointAt(stop.position)), stopId: stop.id })),
    ]
  }
  if (paint.kind === 'radial-gradient') {
    return [
      { kind: 'radial-center', point: world(paint.center) },
      { kind: 'radial-radius-x', point: world({ x: paint.center.x + paint.radiusX, y: paint.center.y }) },
      { kind: 'radial-radius-y', point: world({ x: paint.center.x, y: paint.center.y + paint.radiusY }) },
      ...paint.stops.map((stop) => ({
        kind: 'radial-stop' as const,
        point: world({ x: paint.center.x + paint.radiusX * stop.position, y: paint.center.y }),
        stopId: stop.id,
      })),
    ]
  }
  const radialPoint = (position: number) => {
    const radians = (paint.angle + position * 360) * Math.PI / 180
    return { x: paint.center.x + Math.cos(radians) * 0.5, y: paint.center.y + Math.sin(radians) * 0.5 }
  }
  return [
    { kind: 'angular-center', point: world(paint.center) },
    { kind: 'angular-arm', point: world(radialPoint(0)) },
    ...paint.stops.map((stop) => ({ kind: 'angular-stop' as const, point: world(radialPoint(stop.position)), stopId: stop.id })),
  ]
}

function previewSelectionBounds(
  index: StageSceneIndex,
  ids: readonly string[],
  transforms: Readonly<Record<string, StageTransform>>,
) {
  return unionRects(index.topLevelSelection(ids)
    .filter((id) => index.isVisible(id))
    .map((id) => {
      const entity = index.document.entities[id]
      const preview = transforms[id]
      if (!entity || !preview) return index.getWorldBounds(id)
      const parentId = index.getParentId(id)
      const parentWorld = parentId ? index.getWorldMatrix(parentId) : null
      const world = parentWorld
        ? multiplyMatrices(parentWorld, matrixFromTransform(preview))
        : matrixFromTransform(preview)
      return matrixBounds(world, preview.width, preview.height)
    })
    .filter((rect): rect is StageRect => rect !== null))
}

function equalRect(left: StageRect | null, right: StageRect | null) {
  return left === right || Boolean(
    left
    && right
    && left.x === right.x
    && left.y === right.y
    && left.width === right.width
    && left.height === right.height,
  )
}

function sameIds(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

function samePaintEditing(
  left: StagePaintEditing | null | undefined,
  right: StagePaintEditing | null | undefined,
) {
  return left?.entityId === right?.entityId && left?.activeStopId === right?.activeStopId
}

function samePaintSampling(
  left: StagePaintSampling | null | undefined,
  right: StagePaintSampling | null | undefined,
) {
  return left?.entityId === right?.entityId && left?.field === right?.field
}




function initialSnapshot(temporaryPan: boolean): StageInteractionSnapshot {
  return temporaryPan ? { ...IDLE_SNAPSHOT, temporaryPan: true } : IDLE_SNAPSHOT
}

/**
 * 创建没有 React、DOM 或模块级共享状态的 Stage controller。
 *
 * @returns 新的隔离 controller。
 * @public
 */
export function createStageInteractionController(): StageInteractionController {
  let snapshot = IDLE_SNAPSHOT
  const listeners = new Set<() => void>()
  let surface: StageInteractionSurfacePort | null = null
  /*
   * 绞杀式重构的过渡形态：注册表里只有 legacy 一个插件，它内部仍走 begin() 的原级联，
   * 因此 STAGE_GESTURE_PRIORITY 这张表当前尚未承担仲裁职责。步骤 3 每拆出一个真实插件，
   * 就把它按表中优先级排到 legacy 之前，legacy 只接住尚未搬走的分支。
   *
   * claim 引用后面定义的 legacyClaim：它只在事件到达时被调用，届时闭包已完整建立。
   */
  const legacyPlugin: StageInteractionPlugin = {
    id: 'legacy-monolith',
    priority: STAGE_LEGACY_MONOLITH_PRIORITY,
    claim: (event, pluginContext) => legacyClaim(event, pluginContext),
  }
  const arbiter = createStageSessionArbiter(
    createStagePluginRegistry([
      ...STAGE_EXTRACTED_PLUGIN_FACTORIES.map((create) => create()),
      legacyPlugin,
    ]),
  )
  /** 辅助线读写与 Frame 相关动作共用的活动 Frame 求解。 */
  const targetFrameId = (value: StageInteractionContext) =>
    resolveTargetFrameId(value.document, value.selectedIds, value.activeFrameId)

  let context: StageInteractionContext | null = null
  let index: StageSceneIndex | null = null
  let gesture: Gesture | null = null
  let scrollRange: StageRect | null = null
  let disposed = false
  // 已消费过的回灌 Entity；context 会因文档、选区、viewport 等无关原因反复更新，不去重会让
  // 同一次创建重复触发进入编辑。
  let consumedDrawnEntityId: string | null = null

  const textEditable = (entityId: string) =>
    Boolean(context?.isTextEditable?.(entityId))


  const enrich = (next: StageInteractionSnapshot): StageInteractionSnapshot => {
    const selected = next.segmentPreview
      ? rectFromPoints(next.segmentPreview.start, next.segmentPreview.end)
      : context && index
      ? previewSelectionBounds(
          index,
          context.selectedIds,
          next.previewTransforms,
        )
      : null
    if (context && index) {
      const visible = {
        ...screenToWorld({ x: 0, y: 0 }, context.viewport),
        width: context.surfaceSize.width / context.viewport.zoom,
        height: context.surfaceSize.height / context.viewport.zoom,
      }
      const content = unionRects([
        // v7 没有文档级输出：滚动范围以全部根 Frame 的世界边界为内容基线。
        ...context.document.rootIds
          .map((frameId) => index!.getWorldBounds(frameId))
          .filter((rect): rect is StageRect => rect !== null),
        ...index.order
          .filter((id) => index!.isVisible(id))
          .map((id) => index!.getWorldBounds(id))
          .filter((rect): rect is StageRect => rect !== null),
        ...(selected ? [selected] : []),
      ])
      scrollRange = expandScrollRange(scrollRange, content, visible)
    }
    const paintEntity = context?.paintEditing
      ? context.document.entities[context.paintEditing.entityId]
      : undefined
    const activePaint = context?.paintEditing
      && context.selectedIds.length === 1
      && context.selectedIds[0] === context.paintEditing.entityId
      && paintEntity
      ? next.paintPreview?.entityId === context.paintEditing.entityId
        ? next.paintPreview.paint
        : resolveComposeAppearance(paintEntity).backgroundPaint
      : null
    const cursor = next.guideDelete
      ? 'guide-delete'
      : next.phase === 'pan' || next.phase === 'rotate'
      ? 'grabbing'
      : next.phase === 'move'
        ? 'move'
        : next.phase === 'resize' || next.phase === 'segment-resize'
          ? 'resize'
            : next.phase === 'draw'
              ? 'crosshair'
            : next.phase === 'marquee'
              || next.phase === 'guide-create'
              || next.phase === 'guide-move'
              || next.phase === 'paint-edit'
              || next.phase === 'paint-sample'
              ? 'crosshair'
              : next.phase === 'external'
                ? 'copy'
                : next.temporaryPan || context?.tool === 'pan'
                  ? 'grab'
                  : context?.tool === 'rotate'
                    ? 'grab'
                  : isDrawingTool(context?.tool ?? 'select') || context?.tool === 'marquee'
                    ? 'crosshair'
                  : 'default'
    return {
      ...next,
      paintPreview: activePaint && next.paintPreview?.entityId !== context?.paintEditing?.entityId
        ? null
        : next.paintPreview,
      paintHandles: activePaint && context && index
        ? paintHandlesFor(index, context.paintEditing!.entityId, activePaint)
        : [],
      selectionBounds: selected,
      scrollRange,
      cursor,
    }
  }
  const publish = (next: StageInteractionSnapshot) => {
    snapshot = enrich(next)
    listeners.forEach((listener) => listener())
  }
  const apply = (effects: readonly StageInteractionEffect[]) => {
    if (effects.length > 0) surface?.applyEffects(effects)
  }
  const reset = (releasePointer = true) => {
    const pointerId = gesture?.pointerId
    gesture = null
    // reset 是 legacy 中止手势的唯一漏斗，并且有一半调用点在指针生命周期之外（并发文档
    // 变化、surface 断开、dispose）。在这里同步释放仲裁器的会话引用，否则仲裁器会认为手势
    // 仍在进行而拒绝下一次接管。release 不回调 session.cancel，因此不会与本函数互相递归。
    arbiter.release()
    publish(initialSnapshot(snapshot.temporaryPan))
    if (releasePointer && pointerId !== undefined) {
      apply([{ type: 'pointer.release', pointerId }])
    }
  }
  const worldPoint = (point: StagePoint, viewport = context?.viewport) => viewport
    ? screenToWorld(point, viewport)
    : point
  const updateGesture = (
    point: StagePoint,
    modifiers: StageInteractionModifiers,
  ) => {
    if (!gesture || !context || !index) return
    // 变换会话使用 pointerdown 时的 viewport；宿主布局重测或受控 viewport 回传
    // 不得改变同一次 Pointer 手势的坐标基线。
    const world = worldPoint(point, gesture.viewport)
    if (gesture.type === 'marquee') {
      gesture.currentWorld = world
      publish({
        ...snapshot,
        phase: 'marquee',
        marquee: rectFromPoints(gesture.startWorld, world),
        marqueeHitTest: resolveMarqueeHitTest(
          context?.marqueeMode,
          marqueeDirection(gesture.startWorld, world),
        ),
      })
      return
    }
    if (gesture.type === 'guide-create') {
      gesture.point = point
      gesture.guides = gesture.guides.map((guide) => ({
        ...guide,
        position: snapValueToGrid(
          guide.axis === 'x' ? world.x : world.y,
          guide.axis === 'x'
            ? context!.document.canvas.grid.stepX
            : context!.document.canvas.grid.stepY,
          guide.axis === 'x'
            ? context!.document.canvas.grid.offsetX
            : context!.document.canvas.grid.offsetY,
          context!.document.canvas.grid.snapEnabled && !modifiers.command,
        ),
      }))
      publish({
        ...snapshot,
        phase: 'guide-create',
        guidePreview: gesture.guides,
        guideDelete: gesture.guides.every((guide) => isInsideOwningRuler(guide.axis, point)),
      })
      return
    }
    if (gesture.type === 'guide-move') {
      gesture.point = point
      gesture.position = snapValueToGrid(
        gesture.axis === 'x' ? world.x : world.y,
        gesture.axis === 'x'
          ? context.document.canvas.grid.stepX
          : context.document.canvas.grid.stepY,
        gesture.axis === 'x'
          ? context.document.canvas.grid.offsetX
          : context.document.canvas.grid.offsetY,
        context.document.canvas.grid.snapEnabled && !modifiers.command,
      )
      publish({
        ...snapshot,
        phase: 'guide-move',
        guideDelete: isInsideOwningRuler(gesture.axis, point),
        guidePreview: [{
          id: gesture.guideId,
          axis: gesture.axis,
          position: gesture.position,
        }],
      })
      return
    }
    if (gesture.type === 'move') {
      gesture.lastPoint = point
      gesture.lastModifiers = modifiers
      const preview = planMovePreview({
        context,
        index,
        ids: gesture.ids,
        bounds: gesture.bounds,
        startWorld: gesture.startWorld,
        world,
        axis: gesture.axis,
        zoom: gesture.viewport.zoom,
        modifiers,
        parentLocked: gesture.parentLocked,
      })
      gesture.transforms = preview.transforms
      gesture.dropTarget = preview.dropTarget
      publish({
        ...snapshot,
        phase: 'move',
        previewTransforms: preview.transforms,
        snapGuides: preview.snapGuides,
        dropTarget: preview.dropTarget,
      })
      return
    }
    if (gesture.type === 'resize') {
      const snapped = snapResizePoint({
        point: world,
        handle: gesture.handle,
        candidates: index.snapCandidates(gesture.ids, targetFrameId(context)),
        canvas: context.document.canvas,
        zoom: gesture.viewport.zoom,
        disabled: modifiers.command,
      })
      const preserveAspect = gesture.ids.some((id) => {
        const entity = context!.document.entities[id]
        return entity
          ? resolveComposeGeometryConstraints(entity).resize === 'preserve-aspect'
          : false
      })
      const nextBounds = resizeBounds(
        gesture.bounds,
        gesture.handle,
        snapped.point,
        { ...modifiers, shift: modifiers.shift || preserveAspect },
      )
      gesture.transforms = transformedResizeSelection(
        index,
        gesture.ids,
        rectMappingMatrix(gesture.bounds, nextBounds),
        {
          scaleX: nextBounds.width / gesture.bounds.width,
          scaleY: nextBounds.height / gesture.bounds.height,
        },
        context?.contentReflowsWithWidth,
        gesture.handle,
      )
      publish({
        ...snapshot,
        phase: 'resize',
        previewTransforms: gesture.transforms,
        snapGuides: snapped.guides,
      })
      return
    }
  }

  const begin = (event: Extract<StageInteractionEvent, { type: 'pointer.down' }>) => {
    if (!context || !index || !surface || event.button > 1) return
    const effects: StageInteractionEffect[] = []
    const startTransform = (
      type: 'move' | 'resize',
      ids: readonly string[],
      handle?: ResizeHandle,
      axis?: 'x' | 'y',
    ) => {
      const targets = resolveTransformTargets({
        document: context!.document,
        index: index!,
        type,
        ids,
        handle,
      })
      if (!targets) return false
      const { editableIds, bounds } = targets
      const viewport = context!.viewport
      const startWorld = worldPoint(event.point, viewport)
      if (type === 'move') {
        gesture = {
          type,
          pointerId: event.pointerId,
          viewport,
          ids: editableIds,
          startWorld,
          bounds,
          axis,
          transforms: {},
          dropTarget: null,
          parentLocked: false,
          lastPoint: event.point,
          lastModifiers: event.modifiers,
        }
        publish({
          ...initialSnapshot(snapshot.temporaryPan),
          phase: 'move',
        })
      }
      else if (type === 'resize') {
        if (!handle) return false
        gesture = {
          type,
          pointerId: event.pointerId,
          viewport,
          ids: editableIds,
          handle,
          startWorld,
          bounds,
          transforms: {},
        }
        publish({
          ...initialSnapshot(snapshot.temporaryPan),
          phase: 'resize',
        })
      }
      effects.push({ type: 'pointer.capture', pointerId: event.pointerId })
      return true
    }

    const startMarquee = (originEntityId?: string) => {
      const viewport = context!.viewport
      const startWorld = worldPoint(event.point, viewport)
      gesture = {
        type: 'marquee',
        pointerId: event.pointerId,
        viewport,
        startWorld,
        origin: 'surface',
        originEntityId,
        baseSelection: context!.selectedIds,
        currentWorld: startWorld,
      }
      publish({
        ...initialSnapshot(snapshot.temporaryPan),
        phase: 'marquee',
        // 起点即终点，方向尚未确定；按下的一瞬间先按 ltr 归约，移动时会立即刷新。
        marqueeHitTest: resolveMarqueeHitTest(context!.marqueeMode, 'ltr'),
      })
      apply([...effects, { type: 'pointer.capture', pointerId: event.pointerId }])
    }
    if (
      event.hit.kind === 'entity'
      && shouldConvergeToMarquee(
        context.tool,
        context.document,
        context.selectedIds,
        event.hit,
      )
    ) {
      startMarquee(event.hit.entityId)
      return
    }
    if (event.hit.kind === 'entity') {
      const entity = context.document.entities[event.hit.entityId]
      if (!entity) return
      const selected = context.selectedIds.filter((id) => context!.document.entities[id])
      const nextSelection = event.modifiers.shift
        ? selected.includes(entity.id)
          ? selected.filter((id) => id !== entity.id)
          : [...selected, entity.id]
        : selected.includes(entity.id) ? selected : [entity.id]
      effects.push(
        { type: 'selection.change', selectedIds: nextSelection },
      )
      // 双击可编辑 Entity 进入原地编辑，且不开始移动手势。
      if (
        context.tool === 'select'
        && (event.clickCount ?? 1) >= 2
        && !getComposeLock(entity).locked
        && textEditable(entity.id)
      ) {
        effects.push({ type: 'text-editing.enter', entityId: entity.id })
        apply(effects)
        return
      }
      if (
        !getComposeLock(entity).locked
        && (context.tool === 'select' || context.tool === 'move')
      ) startTransform('move', nextSelection)
      apply(effects)
      return
    }
    if (event.hit.kind === 'resize') {
      if (
        (context.tool === 'select' || context.tool === 'scale')
        && startTransform('resize', context.selectedIds, event.hit.handle)
      ) apply(effects)
      return
    }
    if (event.hit.kind === 'rotate') {
      // 非 rotate 工具忽略旧旋转命中；rotate 工具已在上方独占处理。
      return
    }
    if (
      event.hit.kind === 'ruler'
      || event.hit.kind === 'ruler-corner'
    ) {
      /*
       * 顶部（水平）标尺拖出的是横线，横线由 world.y 定位，因此 guide.axis 是 'y'；左侧标尺
       * 同理拖出 axis 'x' 的竖线。标尺自身的 axis 与辅助线的 axis 互为反向，不能直接沿用。
       */
      const axes: readonly ('x' | 'y')[] = event.hit.kind === 'ruler-corner'
        ? ['x', 'y']
        : [event.hit.axis === 'x' ? 'y' : 'x']
      const viewport = context.viewport
      const world = worldPoint(event.point, viewport)
      const guides = axes.map((axis) => ({
        id: context!.idFactory(),
        axis,
        position: snapValueToGrid(
          axis === 'x' ? world.x : world.y,
          axis === 'x'
            ? context!.document.canvas.grid.stepX
            : context!.document.canvas.grid.stepY,
          axis === 'x'
            ? context!.document.canvas.grid.offsetX
            : context!.document.canvas.grid.offsetY,
          context!.document.canvas.grid.snapEnabled && !event.modifiers.command,
        ),
      }))
      gesture = {
        type: 'guide-create',
        pointerId: event.pointerId,
        viewport,
        guides,
        point: event.point,
      }
      publish({
        ...initialSnapshot(snapshot.temporaryPan),
        phase: 'guide-create',
        guidePreview: guides,
      })
      apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
      return
    }
    if (event.hit.kind === 'guide') {
      const guideId = event.hit.guideId
      const guide = listFrameWorldGuides(
        context.document,
        targetFrameId(context),
        index,
      ).find((item) => item.id === guideId)
      if (!guide) return
      gesture = {
        type: 'guide-move',
        pointerId: event.pointerId,
        viewport: context.viewport,
        guideId: guide.id,
        axis: guide.axis,
        position: guide.value,
        point: event.point,
      }
      publish({
        ...initialSnapshot(snapshot.temporaryPan),
        phase: 'guide-move',
        guidePreview: [{ id: guide.id, axis: guide.axis, position: guide.value }],
      })
      apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
      return
    }
    // 旋转工具绝不框选（兜底：避免漏判的 hit 落到默认 marquee）。
    if (context.tool === 'rotate') return
    startMarquee()
  }

  const finish = (
    event: Extract<StageInteractionEvent, { type: 'pointer.up' }>,
  ) => {
    if (!gesture || gesture.pointerId !== event.pointerId || !context || !index) return
    // 最终点的推进由仲裁器在 commit 之前驱动（见 StageSessionArbiter.commit），这里不再自行
    // 调用 updateGesture：提交几何取自最终点推进之后的状态，该约束现在由内核统一保证。
    const finished = gesture
    const pointerId = finished.pointerId
    gesture = null
    const effects: StageInteractionEffect[] = []
    if (finished.type === 'marquee') {
      const selectedIds = resolveMarqueeCommit({
        area: rectFromPoints(finished.startWorld, finished.currentWorld),
        base: finished.baseSelection,
        // 组合意图以释放时按住的修饰键为准，用户可以在拖拽途中改主意。
        combine: marqueeCombine(event.modifiers),
        direction: marqueeDirection(finished.startWorld, finished.currentWorld),
        document: context.document,
        index,
        mode: context.marqueeMode,
        originEntityId: finished.originEntityId,
      })
      effects.push({ type: 'selection.change', selectedIds })
    }
    else if (finished.type === 'guide-create') {
      // axis 'y' 的横线来自顶部标尺，落点仍在标尺内（y < 0）就放弃创建；竖线同理看 x。
      const created = finished.guides.filter((guide) => guide.axis === 'y'
        ? finished.point.y >= 0
        : finished.point.x >= 0)
      const frameId = targetFrameId(context)
      const frameOrigin = frameId ? index.getFrameOrigin(frameId) : null
      if (created.length > 0 && frameId && frameOrigin) {
        // 手势全程在世界坐标里进行，落盘前换算回该 Frame 的局部坐标。
        const commands = created.map((guide) => ({
          id: context!.idFactory(),
          type: 'frame.guide.create',
          payload: {
            frameId,
            guide: {
              id: guide.id,
              axis: guide.axis,
              position: toFrameGuidePosition(guide.axis, guide.position, frameOrigin),
            } as unknown as JsonValue,
          },
        }))
        effects.push({
          type: 'command.dispatch',
          command: created.length === 1
            ? {
                ...commands[0]!,
                meta: {
                  label: context.labels?.createGuide ?? 'Create guide',
                  source: 'stage',
                },
              }
            : {
                id: context.idFactory(),
                type: 'transaction.batch',
                payload: { commands: commands as unknown as JsonValue },
                meta: {
                  label: context.labels?.createGuides ?? 'Create guides',
                  source: 'stage',
                },
              },
        })
      }
    }
    else if (finished.type === 'guide-move') {
      const shouldDelete = isInsideOwningRuler(finished.axis, finished.point)
      const frameId = targetFrameId(context)
      const frameOrigin = frameId ? index.getFrameOrigin(frameId) : null
      if (!frameId || !frameOrigin) return effects
      effects.push({
        type: 'command.dispatch',
        command: {
          id: context.idFactory(),
          type: shouldDelete ? 'frame.guide.delete' : 'frame.guide.move',
          payload: shouldDelete
            ? { frameId, guideId: finished.guideId }
            : {
                frameId,
                guideId: finished.guideId,
                position: toFrameGuidePosition(finished.axis, finished.position, frameOrigin),
              },
          meta: {
            label: shouldDelete
              ? context.labels?.deleteGuide ?? 'Delete guide'
              : context.labels?.moveGuide ?? 'Move guide',
            source: 'stage',
          },
        },
      })
    }
    else if (finished.type === 'move') {
      const planned = planMoveCommit({
        document: context.document,
        layoutSnapshot: context.layoutSnapshot,
        index,
        ids: finished.ids,
        transforms: finished.transforms,
        dropTarget: finished.dropTarget,
        idFactory: context.idFactory,
      })
      if (planned) effects.push(planned)
    }
    else if (finished.type === 'resize') {
      const planned = planTransformCommit({
        document: context.document,
        layoutSnapshot: context.layoutSnapshot,
        index,
        finished,
        idFactory: context.idFactory,
      })
      if (planned) effects.push(planned)
    }
    // 正式命令必须在 preview 清理和 capture 释放前同步交给宿主，否则 React
    // 会短暂重新渲染旧 document，造成高速松手时可见的“回弹”。
    apply(effects)
    publish(initialSnapshot(snapshot.temporaryPan))
    apply([{ type: 'pointer.release', pointerId }])
  }

  /**
   * legacy 单体插件的会话：把内核的三段生命周期转调既有的 updateGesture / finish / reset。
   *
   * 会话记住最近一次指针事件，因为 finish 需要松手时的修饰键（例如 marquee 的布尔组合以
   * 释放时按住的键为准）。仲裁器保证 commit 之前刚以 pointerup 调用过 update，因此这里记下的
   * 就是那次事件。
   */
  const createLegacySession = (pointerId: number): StageSession => {
    let lastPointerEvent: Extract<
      StageInteractionEvent,
      { type: 'pointer.up' | 'pointer.move' }
    > | null = null
    return {
      pointerId,
      update(event) {
        if (event.type === 'pointer.move' || event.type === 'pointer.up') {
          lastPointerEvent = event
          updateGesture(event.point, event.modifiers)
          return
        }
        // move 手势用 Space 表达「锁定原父级」而不是临时平移：两种意图不会同时出现，
        // 手势中无法再按下第二个指针开始平移。原地重算落点以立即反映锁定状态。
        if (event.type === 'temporary-pan.start' && gesture?.type === 'move') {
          gesture.parentLocked = true
          updateGesture(gesture.lastPoint, gesture.lastModifiers)
          return
        }
        if (event.type === 'temporary-pan.end' && gesture?.type === 'move') {
          gesture.parentLocked = false
          updateGesture(gesture.lastPoint, gesture.lastModifiers)
        }
      },
      commit() {
        // 没有指针事件说明会话在任何 update 之前就被提交，legacy 无从确定终点，按取消处理。
        if (!lastPointerEvent || lastPointerEvent.type !== 'pointer.up') {
          reset()
          return
        }
        finish(lastPointerEvent)
      },
      cancel() {
        reset()
      },
    }
  }

  /**
   * legacy 插件的 claim：整段既有 begin() 级联就是它的判定。
   *
   * begin 即使不开手势也可能已经处理掉这次按下（改选区、进入文字编辑、被守卫拦下），
   * 而 legacy 是注册表里最后一个插件，因此无论是否产生手势都算「已消费」——返回 null 会让
   * 仲裁器继续询问不存在的后续插件，语义上也不成立。
   */
  const legacyClaim = (
    event: Extract<StageInteractionEvent, { type: 'pointer.down' }>,
    _pluginContext: StagePluginContext,
  ): StageSession | 'consumed' => {
    void _pluginContext
    begin(event)
    return gesture ? createLegacySession(gesture.pointerId) : 'consumed'
  }

  /**
   * 交给插件的运行时上下文。
   *
   * @remarks
   * legacy 插件闭包捕获了同一批值，因此忽略本参数；这里仍如实构造，使步骤 3 拆出的真实插件
   * 从第一天起就只依赖公开的 {@link StagePluginContext} 而不是闭包。context 与 index 用取值器
   * 读取当前值——它们随 updateContext 变化，快照式传入会让会话读到过期文档。
   */
  const pluginContext: StagePluginContext = {
    get context() {
      if (!context) throw new Error('StageInteractionController has no context')
      return context
    },
    get index() {
      if (!index) throw new Error('StageInteractionController has no scene index')
      return index
    },
    // 取值器而非快照式捕获：temporaryPan 在会话之外变化，claim 必须读到判定当刻的值。
    get snapshot() {
      return snapshot
    },
    apply,
    publish,
    idleSnapshot: () => initialSnapshot(snapshot.temporaryPan),
  }

  const externalDrop = (
    item: StageExternalDragItem,
    clientPoint: StagePoint | null,
  ) => {
    if (!context || !index || !surface) return
    const selectionParentId = index.commonContainerForSelection(context.selectedIds)
    const selectionParentBounds = selectionParentId
      ? index.getWorldBounds(selectionParentId)
      : null
    const surfacePoint = clientPoint
      ? surface.resolveClientPoint(clientPoint)
      : selectionParentBounds
        ? {
            x: (selectionParentBounds.x + selectionParentBounds.width / 2)
              * context.viewport.zoom + context.viewport.x,
            y: (selectionParentBounds.y + selectionParentBounds.height / 2)
              * context.viewport.zoom + context.viewport.y,
          }
        : {
            x: context.surfaceSize.width / 2,
            y: context.surfaceSize.height / 2,
          }
    if (!surfacePoint) return
    const world = worldPoint(surfacePoint)
    // 点击添加没有空间意图：没有选区时也要按落点找容器，否则会被当成"在所有场景之外新建"
    // 而升格出一块新场景——而用户只是点了一下物料面板。
    const parentId = clientPoint
      ? index.containerAtPoint(world)
      : selectionParentId ?? index.containerAtPoint(world)
    apply([{
      type: 'external.drop',
      item,
      clientPoint,
      worldPoint: world,
      parentId,
    }])
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    connectSurface(port) {
      if (disposed) throw new Error('StageInteractionController is disposed')
      if (surface) throw new Error('StageInteractionController already has a connected surface')
      surface = port
      return () => {
        if (surface !== port) return
        if (gesture) reset(false)
        else if (snapshot.external) publish(initialSnapshot(snapshot.temporaryPan))
        surface = null
      }
    },
    updateContext(nextContext) {
      if (disposed) return
      const nextIndex = createStageSceneIndex(
        nextContext.document,
        nextContext.layoutSnapshot,
        nextContext.hiddenEntityIds,
      )
      const gestureIds = gesture
        && (gesture.type === 'move' || gesture.type === 'resize')
        ? gesture.ids
        : null
      const documentChanged = context?.document !== nextContext.document
        || context?.layoutSnapshot.revision !== nextContext.layoutSnapshot.revision
      const paintEditingChanged = !samePaintEditing(context?.paintEditing, nextContext.paintEditing)
      const paintSamplingChanged = !samePaintSampling(context?.paintSampling, nextContext.paintSampling)
      // draw 抽成插件后，legacy 里只剩引用 Entity 的空间手势，「绘制不被文档变化打断」这条
      // 例外随之搬进了 draw 插件的 isCompatibleWith，这里不再需要区分手势种类。
      const incompatible = Boolean(
        gesture
        && context
        && (
          context.document !== nextContext.document
          || context.layoutSnapshot.revision !== nextContext.layoutSnapshot.revision
          || context.tool !== nextContext.tool
          || (
            gestureIds
            && !sameIds(
              gestureIds,
              nextIndex.topLevelSelection(nextContext.selectedIds),
            )
          )
        ),
      )
      // 会话的存续只看新 context：目标从文档中消失，或选区已经不再是该目标，都必须结束。
      // 这两种情况来自撤销、删除、替换或外部选择变化，Controller 无法预先知道。
      const editingTarget = nextContext.textEditing?.entityId
      const textEditingEnded = editingTarget !== undefined
        && (
          !nextContext.document.entities[editingTarget]
          || !nextContext.selectedIds.includes(editingTarget)
        )
      // 回灌只对 draw-text 生效，且同一个 Entity 只消费一次。
      const drawn = nextContext.drawnEntity
      const enterDrawnEditing = Boolean(
        drawn
        && drawn.tool === 'draw-text'
        && drawn.entityId !== consumedDrawnEntityId
        && nextContext.document.entities[drawn.entityId],
      )

      context = nextContext
      index = nextIndex
      if (textEditingEnded) apply([{ type: 'text-editing.exit' }])
      if (enterDrawnEditing) {
        consumedDrawnEntityId = drawn!.entityId
        apply([{ type: 'text-editing.enter', entityId: drawn!.entityId }])
      }
      if (incompatible) {
        reset()
        return
      }
      // 已抽成插件的会话自己判断是否仍然成立：内核不再枚举手势种类。上面的 incompatible
      // 只覆盖仍住在 legacy 里的手势。
      if (arbiter.revalidate(nextContext, nextIndex, pluginContext)) return
      const next = enrich(snapshot)
      if (
        next.cursor !== snapshot.cursor
        || !equalRect(next.selectionBounds, snapshot.selectionBounds)
        || !equalRect(next.scrollRange, snapshot.scrollRange)
        // Inspector 更新背景填充时编辑目标不变；仍须发布新的 handles，避免 Solid
        // 切到 Gradient 后 React 持有旧的空快照。
        || documentChanged
        || paintEditingChanged
        || paintSamplingChanged
      ) {
        snapshot = next
        listeners.forEach((listener) => listener())
      }
    },
    send(event) {
      if (disposed) return
      if (event.type === 'key.down') {
        if (!context) return
        if (event.key === 'Escape') {
          if (context.textEditing) apply([{ type: 'text-editing.exit' }])
          return
        }
        // Enter 只在「没有进行中的会话 + 恰好单选一个可编辑 Entity」时进入编辑；
        // 多选时目标不唯一，进入哪个都是猜测。
        const targetId = context.selectedIds.length === 1 ? context.selectedIds[0]! : null
        if (
          context.textEditing
          || targetId === null
          || !context.document.entities[targetId]
          || getComposeLock(context.document.entities[targetId]!).locked
          || !textEditable(targetId)
        ) return
        apply([{ type: 'text-editing.enter', entityId: targetId }])
        return
      }
      // 指针生命周期统一走仲裁器：接管判定、单会话独占与「commit 前吃掉最终点」都由内核保证。
      if (event.type === 'pointer.down') {
        arbiter.begin(event, pluginContext)
        return
      }
      if (event.type === 'pointer.move') {
        arbiter.update(event, pluginContext)
        return
      }
      if (event.type === 'pointer.up') {
        arbiter.commit(event, pluginContext)
        return
      }
      if (event.type === 'pointer.cancel') {
        arbiter.cancel(pluginContext, event.pointerId)
        return
      }
      if (event.type === 'temporary-pan.start') {
        // 非指针事件同样转给活动会话：move 手势用它表达「锁定原父级」。会话消费掉的场景下
        // 不再改 temporaryPan 标志——两种意图不会同时出现。判据由会话自报，内核不认识手势种类。
        if (gesture?.type === 'move' || arbiter.activeSessionConsumesTemporaryPan()) {
          arbiter.update(event, pluginContext)
          return
        }
        if (!snapshot.temporaryPan) publish({ ...snapshot, temporaryPan: true })
        return
      }
      if (event.type === 'temporary-pan.end') {
        if (gesture?.type === 'move' || arbiter.activeSessionConsumesTemporaryPan()) {
          arbiter.update(event, pluginContext)
          return
        }
        if (arbiter.activePluginId() === STAGE_PAN_PLUGIN_ID) arbiter.cancel(pluginContext)
        if (snapshot.temporaryPan) publish({ ...snapshot, temporaryPan: false })
        return
      }
      if (event.type === 'external.begin') {
        if (gesture) reset()
        publish({
          ...IDLE_SNAPSHOT,
          phase: 'external',
          external: { item: event.item, clientPoint: event.clientPoint },
        })
        return
      }
      if (event.type === 'external.move' && snapshot.external) {
        publish({
          ...snapshot,
          external: { ...snapshot.external, clientPoint: event.clientPoint },
        })
        return
      }
      if (event.type === 'external.end' && snapshot.external) {
        const item = snapshot.external.item
        publish(IDLE_SNAPSHOT)
        externalDrop(item, event.clientPoint)
        return
      }
      if (event.type === 'external.add') {
        externalDrop(event.item, null)
        return
      }
      if (event.type === 'external.cancel' && snapshot.external) {
        publish(IDLE_SNAPSHOT)
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      if (gesture) reset()
      surface = null
      snapshot = IDLE_SNAPSHOT
      context = null
      index = null
      scrollRange = null
      listeners.clear()
    },
  }
}
