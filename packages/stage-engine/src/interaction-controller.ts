import type {
  ComposePaint,
  ComposeDocument,
  ComposeLayoutSnapshot,
  EditorCommand,
} from '@compose-ui/core'
import {
  getComposeLock,
  resolveComposeAppearance,
} from '@compose-ui/core'
import {
  type StageMarqueeMode,
} from './hit-testing'
import { isDrawingTool } from './gesture-planning'
import {
  type StageDropTarget,
} from './hit-testing'
import {
  createStageSceneIndex,
  type StageSceneIndex,
} from './hit-testing'
import {
  expandScrollRange,
} from './geometry'
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
  screenToWorld,
  unionRects,
} from './geometry'
// 交互内核只做类型级依赖回指（`import type`），因此这里的相互引用不产生运行时循环。
import {
  createStagePluginRegistry,
  createStageSessionArbiter,
  STAGE_EXTRACTED_PLUGIN_FACTORIES,
  STAGE_PAN_PLUGIN_ID,
} from './interaction-kernel'
import {
  matrixBounds,
  resolvedSpatialTransform,
} from './gesture-planning'
import type {
  StagePluginContext,
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




/**
 * 大于此值的按键视为副按键，不开启手势。
 *
 * @remarks
 * 0 是主键、1 是中键（临时平移），2 及以上是右键与浏览器扩展键——它们承载上下文菜单，
 * 一旦被手势接管，菜单就再也打不开。
 */
const SECONDARY_BUTTON_THRESHOLD = 1

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
  // 绞杀式重构已完成：手势全部住在插件里，仲裁完全由 STAGE_GESTURE_PRIORITY 决定。
  const arbiter = createStageSessionArbiter(
    createStagePluginRegistry(STAGE_EXTRACTED_PLUGIN_FACTORIES.map((create) => create())),
  )

  let context: StageInteractionContext | null = null
  let index: StageSceneIndex | null = null
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
  /**
   * 在指针生命周期之外中止活动会话。
   *
   * @remarks
   * 调用点是并发上下文变化、surface 断开与 dispose——它们都不是 pointerup / pointercancel，
   * 但同样必须让会话把发布过的快照与捕获过的指针还原。会话自己知道该还什么，内核不知道。
   */
  const abortActiveSession = () => {
    arbiter.cancel(pluginContext)
  }
  const worldPoint = (point: StagePoint, viewport = context?.viewport) => viewport
    ? screenToWorld(point, viewport)
    : point
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
        abortActiveSession()
        if (snapshot.external) publish(initialSnapshot(snapshot.temporaryPan))
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
      const documentChanged = context?.document !== nextContext.document
        || context?.layoutSnapshot.revision !== nextContext.layoutSnapshot.revision
      const paintEditingChanged = !samePaintEditing(context?.paintEditing, nextContext.paintEditing)
      const paintSamplingChanged = !samePaintSampling(context?.paintSampling, nextContext.paintSampling)
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
      // 会话自己判断是否仍然成立：内核不再枚举手势种类，也不再保留任何按手势分类的判定。
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
        // 副按键（右键及以上）不开启任何手势——它承载的是上下文菜单。这条判定必须在询问插件
        // **之前**：插件排在 legacy 之前被询问，放到各插件里既会漏，也让每个新插件都要重复它。
        if (event.button > SECONDARY_BUTTON_THRESHOLD) return
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
        if (arbiter.activeSessionConsumesTemporaryPan()) {
          arbiter.update(event, pluginContext)
          return
        }
        if (!snapshot.temporaryPan) publish({ ...snapshot, temporaryPan: true })
        return
      }
      if (event.type === 'temporary-pan.end') {
        if (arbiter.activeSessionConsumesTemporaryPan()) {
          arbiter.update(event, pluginContext)
          return
        }
        if (arbiter.activePluginId() === STAGE_PAN_PLUGIN_ID) arbiter.cancel(pluginContext)
        if (snapshot.temporaryPan) publish({ ...snapshot, temporaryPan: false })
        return
      }
      if (event.type === 'external.begin') {
        abortActiveSession()
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
      abortActiveSession()
      surface = null
      snapshot = IDLE_SNAPSHOT
      context = null
      index = null
      scrollRange = null
      listeners.clear()
    },
  }
}
