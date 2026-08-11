import type {
  ComposePaint,
  ComposeDocument,
  ComposeLayoutSnapshot,
  EditorCommand,
  JsonValue,
} from '@compose-ui/core'
import {
  BUILTIN_COMMAND_TYPES,
  getComposeLock,
  getComposeLayoutItem,
  getComposeAppearance,
  getComposeRenderer,
  evaluateComposePaintAtLocalPoint,
  getComposeTransform,
  resolveComposeAppearance,
  resolveComposeGeometryConstraints,
} from '@compose-ui/core'
import {
  createStageSceneIndex,
  type StageSceneIndex,
} from './scene-index'
import { describeTransform } from './transaction-labels'
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
  decomposeMatrix,
  invertMatrix,
  matrixFromTransform,
  multiplyMatrices,
  rectMappingMatrix,
  resizeBounds,
  rotationFromPointer,
  rotationMatrixAround,
  screenToWorld,
  snapTranslation,
  toComposeTransform,
  translationMatrix,
  unionRects,
} from './geometry'

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
  | 'external'

/** Stage 的受控工具模式；不包含 React 或 DOM 类型。 @public */
export type StageInteractionTool =
  | 'select'
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
  | { readonly kind: 'output' }
  | { readonly kind: 'entity'; readonly entityId: string }
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
  /** 最新受控 viewport。 */
  readonly viewport: StageViewport
  /** 不含标尺和滚动条的 surface CSS 像素尺寸。 */
  readonly surfaceSize: { readonly width: number; readonly height: number }
  /** 当前持久工具；临时平移由独立事件控制。 */
  readonly tool: StageInteractionTool
  /** 最新受控选择，按宿主顺序排列。 */
  readonly selectedIds: readonly string[]
  /** Inspector 打开的单 Entity 背景填充编辑；缺失时不渲染也不接收 Paint 控制柄。 */
  readonly paintEditing?: StagePaintEditing | null
  /** Inspector 请求的画布图层取色目标；存在时普通 Stage 命中被临时屏蔽。 */
  readonly paintSampling?: StagePaintSampling | null
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
  | { readonly type: 'output.select' }
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

/** surface 与 controller 之间唯一允许的命令式端口。 @public */
export interface StageInteractionSurfacePort {
  /** 把 client 坐标映射为 surface 坐标；surface 暂不可用时返回 null。 */
  resolveClientPoint(point: StagePoint): StagePoint | null
  /** 同步应用 controller 生成的一批 effect。 */
  applyEffects(effects: readonly StageInteractionEffect[]): void
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
  snapGuides: [],
  guidePreview: [],
  paintPreview: null,
  paintHandles: [],
  paintSample: null,
  external: null,
  drawing: null,
  segmentPreview: null,
  temporaryPan: false,
  selectionBounds: null,
  scrollRange: null,
  cursor: 'default',
  guideDelete: false,
}

type Gesture =
  | {
      readonly type: 'pan'
      readonly pointerId: number
      readonly startPoint: StagePoint
      readonly startViewport: StageViewport
    }
  | {
      readonly type: 'marquee'
      readonly pointerId: number
      readonly viewport: StageViewport
      readonly startWorld: StagePoint
      readonly origin: 'surface' | 'output'
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
      readonly type: 'segment-resize'
      readonly pointerId: number
      readonly viewport: StageViewport
      readonly entityId: string
      readonly endpoint: 'start' | 'end'
      start: StagePoint
      end: StagePoint
    }
  | {
      readonly type: 'rotate'
      readonly pointerId: number
      readonly viewport: StageViewport
      readonly ids: readonly string[]
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
      readonly type: 'paint'
      readonly pointerId: number
      readonly viewport: StageViewport
      readonly entityId: string
      readonly handle: StagePaintHandleKind
      readonly stopId?: string
      paint: ComposePaint
    }
  | {
      readonly type: 'paint-sample'
      readonly pointerId: number
      readonly viewport: StageViewport
      readonly target: StagePaintSampling
      point: StagePoint
      alt: boolean
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
  | {
      readonly type: 'draw'
      readonly pointerId: number
      readonly viewport: StageViewport
      readonly tool: Extract<StageInteractionTool, `draw-${string}`>
      readonly startWorld: StagePoint
      currentWorld: StagePoint
      drawingStartWorld: StagePoint
      drawingEndWorld: StagePoint
    }

function rectFromPoints(first: StagePoint, second: StagePoint): StageRect {
  const x = Math.min(first.x, second.x)
  const y = Math.min(first.y, second.y)
  return {
    x,
    y,
    width: Math.abs(first.x - second.x),
    height: Math.abs(first.y - second.y),
  }
}

interface DrawingPoints {
  readonly start: StagePoint
  readonly end: StagePoint
}

/**
 * Shift 约束时，鼠标必须始终落在正在绘制图形的角点上。若只调整 end，视觉上的角点会偏离
 * 指针；这里保持 end 为真实指针位置，并把较短轴的起点外扩为等长边。
 */
function constrainSquareDrawingPoints(start: StagePoint, end: StagePoint): DrawingPoints {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const side = Math.max(Math.abs(deltaX), Math.abs(deltaY))
  const directionX = deltaX === 0 ? (deltaY < 0 ? -1 : 1) : Math.sign(deltaX)
  const directionY = deltaY === 0 ? (deltaX < 0 ? -1 : 1) : Math.sign(deltaY)

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return {
      start: { x: start.x, y: end.y - directionY * side },
      end,
    }
  }
  return {
    start: { x: end.x - directionX * side, y: start.y },
    end,
  }
}

function constrainedDrawingPoints(
  tool: Extract<StageInteractionTool, `draw-${string}`>,
  start: StagePoint,
  end: StagePoint,
  modifiers: StageInteractionModifiers,
) : DrawingPoints {
  return modifiers.shift && (tool === 'draw-rectangle' || tool === 'draw-circle')
    ? constrainSquareDrawingPoints(start, end)
    : { start, end }
}

function isDrawingTool(
  tool: StageInteractionTool,
): tool is Extract<StageInteractionTool, `draw-${string}`> {
  return tool.startsWith('draw-')
}

function intersects(first: StageRect, second: StageRect) {
  return first.x <= second.x + second.width
    && first.x + first.width >= second.x
    && first.y <= second.y + second.height
    && first.y + first.height >= second.y
}

function selectionBounds(index: StageSceneIndex, ids: readonly string[]) {
  return unionRects(ids
    .filter((id) => index.isVisible(id))
    .map((id) => index.getWorldBounds(id))
    .filter((rect): rect is StageRect => rect !== null))
}

function matrixBounds(matrix: StageMatrix, width: number, height: number): StageRect {
  const points = [
    applyMatrix(matrix, { x: 0, y: 0 }),
    applyMatrix(matrix, { x: width, y: 0 }),
    applyMatrix(matrix, { x: width, y: height }),
    applyMatrix(matrix, { x: 0, y: height }),
  ]
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  }
}

/** 手势必须冻结 pointerdown 对应 Snapshot 的已求解 box，不能回读 LayoutItem fallback。 */
function resolvedSpatialTransform(index: StageSceneIndex, entityId: string): StageTransform | null {
  const entity = index.document.entities[entityId]
  const box = index.layoutSnapshot.boxes[entityId]
  if (!entity || !box) return null
  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rotation: getComposeTransform(entity).rotation,
  }
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

function paintAtLocalPoint(
  index: StageSceneIndex,
  entityId: string,
  worldPoint: StagePoint,
): { readonly x: number; readonly y: number } | null {
  const entity = index.document.entities[entityId]
  const matrix = index.getWorldMatrix(entityId)
  if (!entity || !matrix) return null
  const transform = resolvedSpatialTransform(index, entityId)
  if (!transform) return null
  const local = applyMatrix(invertMatrix(matrix), worldPoint)
  return { x: local.x / transform.width, y: local.y / transform.height }
}

function updatePaintFromPointer(
  paint: ComposePaint,
  handle: StagePaintHandleKind,
  stopId: string | undefined,
  local: { readonly x: number; readonly y: number },
): ComposePaint {
  if (paint.kind === 'solid' || paint.kind === 'image') return paint
  if (paint.kind === 'linear-gradient') {
    if (handle === 'linear-start') return { ...paint, start: local }
    if (handle === 'linear-end') return { ...paint, end: local }
    const x = paint.end.x - paint.start.x
    const y = paint.end.y - paint.start.y
    const length = x * x + y * y
    const position = length === 0 ? 0 : Math.min(1, Math.max(0, ((local.x - paint.start.x) * x + (local.y - paint.start.y) * y) / length))
    return { ...paint, stops: paint.stops.map((stop) => stop.id === stopId ? { ...stop, position } : stop) }
  }
  if (paint.kind === 'radial-gradient') {
    if (handle === 'radial-center') return { ...paint, center: local }
    if (handle === 'radial-radius-x') return { ...paint, radiusX: Math.max(0.000_001, Math.abs(local.x - paint.center.x)) }
    if (handle === 'radial-radius-y') return { ...paint, radiusY: Math.max(0.000_001, Math.abs(local.y - paint.center.y)) }
    const position = Math.min(1, Math.max(0, Math.abs(local.x - paint.center.x) / paint.radiusX))
    return { ...paint, stops: paint.stops.map((stop) => stop.id === stopId ? { ...stop, position } : stop) }
  }
  if (handle === 'angular-center') return { ...paint, center: local }
  const degrees = Math.atan2(local.y - paint.center.y, local.x - paint.center.x) * 180 / Math.PI
  const angle = ((degrees % 360) + 360) % 360
  if (handle === 'angular-arm') return { ...paint, angle }
  const position = (((angle - paint.angle) % 360) + 360) % 360 / 360
  return { ...paint, stops: paint.stops.map((stop) => stop.id === stopId ? { ...stop, position } : stop) }
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

/**
 * 图层取色只能读取我们能用结构化 Paint 精确解释的层。Image/SVG 的可见像素来自资源内容，
 * 自定义 Renderer 的像素也没有 headless 采样协议；把它们当作背景色会制造错误的取色结果。
 */
function hasSampleableBackgroundPaint(entity: ComposeDocument['entities'][string]): boolean {
  const renderer = getComposeRenderer(entity)
  return renderer === undefined || renderer.type === 'rectangle' || renderer.type === 'text'
}

function targetTransform(
  index: StageSceneIndex,
  entityId: string,
  targetWorld: StageMatrix,
  width: number,
  height: number,
) {
  const parentId = index.getParentId(entityId)
  const parentWorld = parentId ? index.getWorldMatrix(parentId) : null
  const local = parentWorld
    ? multiplyMatrices(invertMatrix(parentWorld), targetWorld)
    : targetWorld
  return decomposeMatrix(local, width, height)
}

function transformedSelection(
  index: StageSceneIndex,
  ids: readonly string[],
  worldTransform: StageMatrix,
  resize?: { readonly scaleX: number; readonly scaleY: number },
) {
  const updates: Record<string, StageTransform> = {}
  ids.forEach((id) => {
    const entity = index.document.entities[id]
    const entityWorld = index.getWorldMatrix(id)
    if (!entity || !entityWorld) return
    const transform = resolvedSpatialTransform(index, id)
    if (!transform) return
    const candidate = targetTransform(
      index,
      id,
      multiplyMatrices(worldTransform, entityWorld),
      transform.width * (resize?.scaleX ?? 1),
      transform.height * (resize?.scaleY ?? 1),
    )
    if (!resize) {
      updates[id] = candidate
      return
    }
    const constraints = resolveComposeGeometryConstraints(entity)
    const layoutItem = getComposeLayoutItem(entity)
    const minimum = {
      width: layoutItem.width.min ?? 0,
      height: layoutItem.height.min ?? 0,
    }
    const maximum = {
      width: layoutItem.width.max ?? undefined,
      height: layoutItem.height.max ?? undefined,
    }
    const clamp = (value: number, minimum: number, max: number | undefined) =>
      Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(minimum, value))
    if (constraints.resize === 'preserve-aspect') {
      const widthScale = candidate.width / transform.width
      const heightScale = candidate.height / transform.height
      let scale = Math.abs(widthScale - 1) >= Math.abs(heightScale - 1)
        ? widthScale
        : heightScale
      const minScale = Math.max(
        minimum.width / transform.width,
        minimum.height / transform.height,
      )
      const maxScale = maximum.width !== undefined || maximum.height !== undefined
        ? Math.min(
            (maximum.width ?? Number.POSITIVE_INFINITY) / transform.width,
            (maximum.height ?? Number.POSITIVE_INFINITY) / transform.height,
          )
        : Number.POSITIVE_INFINITY
      scale = Math.min(maxScale, Math.max(minScale, scale))
      updates[id] = {
        ...candidate,
        width: transform.width * scale,
        height: transform.height * scale,
      }
      return
    }
    updates[id] = {
      ...candidate,
      width: constraints.resize === 'vertical'
        ? transform.width
        : clamp(candidate.width, minimum.width, maximum.width),
      height: constraints.resize === 'horizontal'
        ? transform.height
        : clamp(candidate.height, minimum.height, maximum.height),
    }
  })
  return updates
}

function transformedResizeSelection(
  index: StageSceneIndex,
  ids: readonly string[],
  worldTransform: StageMatrix,
  resize: { readonly scaleX: number; readonly scaleY: number },
) {
  return transformedSelection(
    index,
    index.topLevelSelection(ids),
    worldTransform,
    resize,
  )
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
  let context: StageInteractionContext | null = null
  let index: StageSceneIndex | null = null
  let gesture: Gesture | null = null
  let scrollRange: StageRect | null = null
  let disposed = false

  const samplePaintAt = (
    target: StagePaintSampling,
    world: StagePoint,
    alt: boolean,
  ): {
    readonly preview: StagePaintSamplePreview
    readonly paint?: ComposePaint
    readonly color?: string
  } => {
    const currentContext = context
    const currentIndex = index
    if (!currentContext || !currentIndex) {
      return { preview: { target, point: world, status: 'unavailable' } }
    }
    const sampledEntityId = currentIndex.entityAtPoint(world)
    if (!sampledEntityId) {
      return { preview: { target, point: world, status: 'unavailable' } }
    }
    const sampled = currentContext.document.entities[sampledEntityId]
    if (sampled && !hasSampleableBackgroundPaint(sampled)) {
      return { preview: { target, point: world, sampledEntityId, status: 'unavailable' } }
    }
    const explicitPaint = sampled ? getComposeAppearance(sampled)?.backgroundPaint : undefined
    if (!sampled || !explicitPaint) {
      return { preview: { target, point: world, sampledEntityId, status: 'unavailable' } }
    }
    const matrix = currentIndex.getWorldMatrix(sampledEntityId)
    const transform = resolvedSpatialTransform(currentIndex, sampledEntityId)
    if (!matrix) return { preview: { target, point: world, sampledEntityId, status: 'unavailable' } }
    if (!transform) return { preview: { target, point: world, sampledEntityId, status: 'unavailable' } }
    const local = applyMatrix(invertMatrix(matrix), world)
    const point = { x: local.x / transform.width, y: local.y / transform.height }
    const color = evaluateComposePaintAtLocalPoint(explicitPaint, point)
    return {
      preview: { target, point: world, sampledEntityId, color, status: 'ready' },
      ...(target.field === 'backgroundPaint' && alt
        ? { paint: explicitPaint }
        : { color }),
    }
  }

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
        {
          x: 0,
          y: 0,
          width: context.document.output.width,
          height: context.document.output.height,
        },
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
      : next.phase === 'pan'
      ? 'grabbing'
      : next.phase === 'move'
        ? 'move'
        : next.phase === 'resize' || next.phase === 'segment-resize'
          ? 'resize'
      : next.phase === 'rotate'
            ? 'rotate'
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
                  : isDrawingTool(context?.tool ?? 'select')
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
    if (gesture.type === 'pan') {
      apply([{
        type: 'viewport.change',
        viewport: {
          ...gesture.startViewport,
          x: gesture.startViewport.x + point.x - gesture.startPoint.x,
          y: gesture.startViewport.y + point.y - gesture.startPoint.y,
        },
      }])
      return
    }
    // 变换会话使用 pointerdown 时的 viewport；宿主布局重测或受控 viewport 回传
    // 不得改变同一次 Pointer 手势的坐标基线。
    const world = worldPoint(point, gesture.viewport)
    if (gesture.type === 'marquee') {
      gesture.currentWorld = world
      publish({
        ...snapshot,
        phase: 'marquee',
        marquee: rectFromPoints(gesture.startWorld, world),
      })
      return
    }
    if (gesture.type === 'draw') {
      const drawing = constrainedDrawingPoints(
        gesture.tool,
        gesture.startWorld,
        world,
        modifiers,
      )
      gesture.currentWorld = world
      gesture.drawingStartWorld = drawing.start
      gesture.drawingEndWorld = drawing.end
      publish({
        ...snapshot,
        phase: 'draw',
        drawing: {
          tool: gesture.tool,
          bounds: rectFromPoints(drawing.start, drawing.end),
          start: drawing.start,
          end: drawing.end,
        },
      })
      return
    }
    if (gesture.type === 'segment-resize') {
      const snapped = snapResizePoint({
        point: world,
        // 两点图形的端点可以沿两个轴自由移动；使用角手柄复用既有 smart/grid snap 规则。
        handle: 'se',
        candidates: index.snapCandidates([gesture.entityId]),
        canvas: context.document.canvas,
        zoom: gesture.viewport.zoom,
        disabled: modifiers.command,
      })
      if (gesture.endpoint === 'start') gesture.start = snapped.point
      else gesture.end = snapped.point
      publish({
        ...snapshot,
        phase: 'segment-resize',
        segmentPreview: {
          entityId: gesture.entityId,
          start: gesture.start,
          end: gesture.end,
        },
        snapGuides: snapped.guides,
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
    if (gesture.type === 'paint-sample') {
      const result = samplePaintAt(gesture.target, world, modifiers.alt)
      gesture.point = world
      gesture.alt = modifiers.alt
      publish({
        ...snapshot,
        phase: 'paint-sample',
        paintSample: result.preview,
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
      const rawDelta = {
        x: world.x - gesture.startWorld.x,
        y: world.y - gesture.startWorld.y,
      }
      const delta = gesture.axis === 'x'
        ? { x: rawDelta.x, y: 0 }
        : gesture.axis === 'y'
          ? { x: 0, y: rawDelta.y }
          : rawDelta
      if (Math.hypot(delta.x, delta.y) * gesture.viewport.zoom < 2) {
        gesture.transforms = {}
        publish({ ...snapshot, phase: 'move', previewTransforms: {}, snapGuides: [] })
        return
      }
      const snapped = snapTranslation(
        gesture.bounds,
        delta,
        index.snapCandidates(gesture.ids),
        gesture.viewport.zoom,
        modifiers.command,
        {
          stepX: context.document.canvas.grid.stepX,
          stepY: context.document.canvas.grid.stepY,
          offsetX: context.document.canvas.grid.offsetX,
          offsetY: context.document.canvas.grid.offsetY,
          enabled: context.document.canvas.grid.snapEnabled,
        },
      )
      gesture.transforms = transformedSelection(
        index,
        gesture.ids,
        translationMatrix(snapped.delta.x, snapped.delta.y),
      )
      publish({
        ...snapshot,
        phase: 'move',
        previewTransforms: gesture.transforms,
        snapGuides: snapped.guides,
      })
      return
    }
    if (gesture.type === 'resize') {
      const snapped = snapResizePoint({
        point: world,
        handle: gesture.handle,
        candidates: index.snapCandidates(gesture.ids),
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
      )
      publish({
        ...snapshot,
        phase: 'resize',
        previewTransforms: gesture.transforms,
        snapGuides: snapped.guides,
      })
      return
    }
    if (gesture.type === 'paint') {
      const local = paintAtLocalPoint(index, gesture.entityId, world)
      if (!local) return
      gesture.paint = updatePaintFromPointer(gesture.paint, gesture.handle, gesture.stopId, local)
      publish({
        ...snapshot,
        phase: 'paint-edit',
        paintPreview: {
          entityId: gesture.entityId,
          paint: gesture.paint,
          activeStopId: gesture.stopId,
        },
      })
      return
    }
    const center = {
      x: gesture.bounds.x + gesture.bounds.width / 2,
      y: gesture.bounds.y + gesture.bounds.height / 2,
    }
    const angle = rotationFromPointer(
      center,
      gesture.startWorld,
      world,
      modifiers.shift,
    )
    gesture.transforms = transformedSelection(
      index,
      gesture.ids,
      rotationMatrixAround(center, angle),
    )
    publish({
      ...snapshot,
      phase: 'rotate',
      previewTransforms: gesture.transforms,
      snapGuides: [],
    })
  }

  const begin = (event: Extract<StageInteractionEvent, { type: 'pointer.down' }>) => {
    if (!context || !index || !surface || event.button > 1) return
    const effects: StageInteractionEffect[] = []
    const startPan = context.tool === 'pan'
      || snapshot.temporaryPan
      || event.button === 1
    if (startPan) {
      gesture = {
        type: 'pan',
        pointerId: event.pointerId,
        startPoint: event.point,
        startViewport: context.viewport,
      }
      publish({ ...initialSnapshot(snapshot.temporaryPan), phase: 'pan' })
      apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
      return
    }
    if (context.paintSampling) {
      gesture = {
        type: 'paint-sample',
        pointerId: event.pointerId,
        viewport: context.viewport,
        target: context.paintSampling,
        point: worldPoint(event.point, context.viewport),
        alt: event.modifiers.alt,
      }
      const result = samplePaintAt(
        context.paintSampling,
        gesture.point,
        event.modifiers.alt,
      )
      publish({
        ...initialSnapshot(snapshot.temporaryPan),
        phase: 'paint-sample',
        paintSample: result.preview,
      })
      apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
      return
    }
    if (event.hit.kind === 'paint-handle') {
      const editing = context.paintEditing
      const entity = editing ? context.document.entities[editing.entityId] : undefined
      if (
        !editing
        || !entity
        || context.selectedIds.length !== 1
        || context.selectedIds[0] !== editing.entityId
        || getComposeLock(entity).locked
      ) return
      gesture = {
        type: 'paint',
        pointerId: event.pointerId,
        viewport: context.viewport,
        entityId: editing.entityId,
        handle: event.hit.handle,
        stopId: event.hit.stopId,
        paint: resolveComposeAppearance(entity).backgroundPaint,
      }
      publish({
        ...initialSnapshot(snapshot.temporaryPan),
        phase: 'paint-edit',
      })
      apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
      return
    }
    if (event.hit.kind === 'segment-endpoint') {
      const entity = context.document.entities[event.hit.entityId]
      const selected = index.topLevelSelection(context.selectedIds)
      const constraints = entity ? resolveComposeGeometryConstraints(entity) : null
      if (
        !entity
        || selected.length !== 1
        || selected[0] !== event.hit.entityId
        || !index.isVisible(entity.id)
        || getComposeLock(entity).locked
        || constraints?.resize === 'none'
        || (context.tool !== 'select' && context.tool !== 'scale')
      ) return
      gesture = {
        type: 'segment-resize',
        pointerId: event.pointerId,
        viewport: context.viewport,
        entityId: entity.id,
        endpoint: event.hit.endpoint,
        start: event.hit.start,
        end: event.hit.end,
      }
      publish({
        ...initialSnapshot(snapshot.temporaryPan),
        phase: 'segment-resize',
        segmentPreview: {
          entityId: entity.id,
          start: event.hit.start,
          end: event.hit.end,
        },
      })
      apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
      return
    }
    if (
      isDrawingTool(context.tool)
      && (
        event.hit.kind === 'surface'
        || event.hit.kind === 'output'
        || event.hit.kind === 'entity'
      )
    ) {
      const startWorld = worldPoint(event.point, context.viewport)
      gesture = {
        type: 'draw',
        pointerId: event.pointerId,
        viewport: context.viewport,
        tool: context.tool,
        startWorld,
        currentWorld: startWorld,
        drawingStartWorld: startWorld,
        drawingEndWorld: startWorld,
      }
      publish({
        ...initialSnapshot(snapshot.temporaryPan),
        phase: 'draw',
        drawing: {
          tool: context.tool,
          bounds: rectFromPoints(startWorld, startWorld),
          start: startWorld,
          end: startWorld,
        },
      })
      apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
      return
    }
    const startTransform = (
      type: 'move' | 'resize' | 'rotate',
      ids: readonly string[],
      handle?: ResizeHandle,
      axis?: 'x' | 'y',
    ) => {
      const editableIds = index!.topLevelSelection(ids)
        .filter((id) => {
          const entity = context!.document.entities[id]
          if (!entity || !index!.isVisible(id) || getComposeLock(entity).locked) return false
          const constraints = resolveComposeGeometryConstraints(entity)
          if (type === 'move') return constraints.movable
          if (type === 'rotate') return constraints.rotatable
          if (constraints.resize === 'none') return false
          if (!handle) return true
          if (constraints.resize === 'horizontal') return handle === 'e' || handle === 'w'
          if (constraints.resize === 'vertical') return handle === 'n' || handle === 's'
          if (constraints.resize === 'preserve-aspect') {
            return handle === 'ne' || handle === 'se' || handle === 'sw' || handle === 'nw'
          }
          return true
        })
      const bounds = selectionBounds(index!, editableIds)
      if (!bounds || editableIds.length === 0) return false
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
        }
      }
      else if (type === 'resize' && handle) {
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
      }
      else {
        gesture = {
          type: 'rotate',
          pointerId: event.pointerId,
          viewport,
          ids: editableIds,
          startWorld,
          bounds,
          transforms: {},
        }
      }
      publish({
        ...initialSnapshot(snapshot.temporaryPan),
        phase: type,
      })
      effects.push({ type: 'pointer.capture', pointerId: event.pointerId })
      return true
    }

    if (event.hit.kind === 'move-axis') {
      if (context.tool === 'move') {
        if (startTransform('move', context.selectedIds, undefined, event.hit.axis)) apply(effects)
      }
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
      if (context.tool === 'rotate' && startTransform('rotate', context.selectedIds)) apply(effects)
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
      const guide = context.document.canvas.guides.find(
        (item) => item.id === guideId,
      )
      if (!guide) return
      gesture = {
        type: 'guide-move',
        pointerId: event.pointerId,
        viewport: context.viewport,
        guideId: guide.id,
        axis: guide.axis,
        position: guide.position,
        point: event.point,
      }
      publish({
        ...initialSnapshot(snapshot.temporaryPan),
        phase: 'guide-move',
        guidePreview: [guide],
      })
      apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
      return
    }
    const viewport = context.viewport
    const startWorld = worldPoint(event.point, viewport)
    const outputHit = event.hit.kind === 'output'
    if (outputHit) {
      effects.push(
        { type: 'selection.change', selectedIds: [] },
        { type: 'output.select' },
      )
    }
    gesture = {
      type: 'marquee',
      pointerId: event.pointerId,
      viewport,
      startWorld,
      origin: outputHit ? 'output' : 'surface',
      currentWorld: startWorld,
    }
    publish({ ...initialSnapshot(snapshot.temporaryPan), phase: 'marquee' })
    apply([...effects, { type: 'pointer.capture', pointerId: event.pointerId }])
  }

  const finish = (
    event: Extract<StageInteractionEvent, { type: 'pointer.up' }>,
  ) => {
    if (!gesture || gesture.pointerId !== event.pointerId || !context || !index) return
    updateGesture(event.point, event.modifiers)
    const finished = gesture
    const pointerId = finished.pointerId
    gesture = null
    const effects: StageInteractionEffect[] = []
    if (finished.type === 'draw') {
      const bounds = rectFromPoints(finished.drawingStartWorld, finished.drawingEndWorld)
      const canCreate = finished.tool === 'draw-text'
        || bounds.width >= 1
        || bounds.height >= 1
      if (canCreate) {
        const center = {
          x: bounds.x + bounds.width / 2,
          y: bounds.y + bounds.height / 2,
        }
        effects.push({
          type: 'drawing.commit',
          tool: finished.tool,
          bounds,
          start: finished.drawingStartWorld,
          end: finished.drawingEndWorld,
          parentId: index.containerAtPoint(center),
        })
      }
    }
    else if (finished.type === 'segment-resize') {
      effects.push({
        type: 'segment.commit',
        entityId: finished.entityId,
        start: finished.start,
        end: finished.end,
      })
    }
    else if (finished.type === 'marquee') {
      const area = rectFromPoints(finished.startWorld, finished.currentWorld)
      const selectedIds = area.width < 1 && area.height < 1
        ? []
        : index.order.filter((id) => {
            const entity = context!.document.entities[id]
            const bounds = index!.getWorldBounds(id)
            return Boolean(
              entity
              && bounds
              && index!.isVisible(id)
              && !getComposeLock(entity).locked
              && intersects(area, bounds),
            )
          })
      if (finished.origin !== 'output' || selectedIds.length > 0) {
        effects.push({ type: 'selection.change', selectedIds })
      }
    }
    else if (finished.type === 'paint-sample') {
      const result = samplePaintAt(finished.target, finished.point, finished.alt)
      if (result.preview.status === 'ready') {
        const entity = context.document.entities[finished.target.entityId]
        if (entity && !getComposeLock(entity).locked) {
          const current = resolveComposeAppearance(entity)
          const appearance = finished.target.field === 'backgroundPaint'
            ? { ...current, backgroundPaint: result.paint ?? { kind: 'solid' as const, color: result.color! } }
            : { ...current, borderColor: result.color! }
          effects.push({
            type: 'command.dispatch',
            command: {
              id: context.idFactory(),
              type: BUILTIN_COMMAND_TYPES.setAppearance,
              payload: { entityId: entity.id, appearance: appearance as unknown as JsonValue },
              meta: {
                label: `Sample ${entity.name} paint`,
                source: 'stage',
                targetIds: [entity.id],
                mergeKey: `stage:paint-sample:${entity.id}:${finished.target.field}`,
              },
            },
          })
        }
      }
      effects.push({ type: 'paint.sample.complete' })
    }
    else if (finished.type === 'guide-create') {
      // axis 'y' 的横线来自顶部标尺，落点仍在标尺内（y < 0）就放弃创建；竖线同理看 x。
      const created = finished.guides.filter((guide) => guide.axis === 'y'
        ? finished.point.y >= 0
        : finished.point.x >= 0)
      if (created.length > 0) {
        const commands = created.map((guide) => ({
          id: context!.idFactory(),
          type: 'canvas.guide.create',
          payload: { guide: { ...guide } as unknown as JsonValue },
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
      effects.push({
        type: 'command.dispatch',
        command: {
          id: context.idFactory(),
          type: shouldDelete ? 'canvas.guide.delete' : 'canvas.guide.move',
          payload: shouldDelete
            ? { guideId: finished.guideId }
            : { guideId: finished.guideId, position: finished.position },
          meta: {
            label: shouldDelete
              ? context.labels?.deleteGuide ?? 'Delete guide'
              : context.labels?.moveGuide ?? 'Move guide',
            source: 'stage',
          },
        },
      })
    }
    else if (finished.type === 'paint') {
      const entity = context.document.entities[finished.entityId]
      if (entity && !getComposeLock(entity).locked) {
        effects.push({
          type: 'command.dispatch',
          command: {
            id: context.idFactory(),
            type: BUILTIN_COMMAND_TYPES.setAppearance,
            payload: {
              entityId: entity.id,
              appearance: {
                ...resolveComposeAppearance(entity),
                backgroundPaint: finished.paint,
              } as unknown as JsonValue,
            },
            meta: {
              label: `Update ${entity.name} background paint`,
              source: 'stage',
              targetIds: [entity.id],
              mergeKey: `stage:paint:${entity.id}`,
            },
          },
        })
      }
    }
    else if (
      finished.type === 'move'
      || finished.type === 'resize'
      || finished.type === 'rotate'
    ) {
      const stageUpdates = Object.entries(finished.transforms).map(([entityId, transform]) => ({
        entityId,
        transform,
      }))
      if (stageUpdates.length > 0) {
        const updates = stageUpdates.map(({ entityId, transform }) => {
          const next = toComposeTransform(transform)
          const entity = context!.document.entities[entityId]
          const item = entity ? getComposeLayoutItem(entity) : null
          const persistedAbsolutePosition = () => {
            const initialBox = context!.layoutSnapshot.boxes[entityId]
            const parentId = index?.getParentId(entityId)
            const parent = parentId ? context!.document.entities[parentId] : undefined
            const borderInset = parent ? resolveComposeAppearance(parent).borderWidth : 0
            const inset = item?.positioning === 'absolute' && initialBox
              ? {
                  x: initialBox.x - item.offset.x,
                  y: initialBox.y - item.offset.y,
                }
              : { x: borderInset, y: borderInset }
            return {
              x: next.position.x - inset.x,
              y: next.position.y - inset.y,
            }
          }
          // move 的几何来自冻结 Snapshot；非 Fill 轴仍保留持久 fallback，避免把
          // Yoga clamp 后的尺寸误记成一次 Resize。Fill 转 Absolute 时才烘焙求解尺寸。
          if (!item) return { entityId, transform: next }
          if (finished.type === 'move') {
            return {
              entityId,
              transform: {
                ...next,
                position: persistedAbsolutePosition(),
                size: {
                  width: item.width.mode === 'fill' ? next.size.width : item.width.value,
                  height: item.height.mode === 'fill' ? next.size.height : item.height.value,
                },
              },
            }
          }
          if (finished.type === 'resize') {
            const changesWidth = finished.handle.includes('e') || finished.handle.includes('w')
            const changesHeight = finished.handle.includes('n') || finished.handle.includes('s')
            return {
              entityId,
              transform: {
                ...next,
                position: item.positioning === 'flow'
                  ? item.offset
                  : persistedAbsolutePosition(),
                size: {
                  width: changesWidth ? next.size.width : item.width.value,
                  height: changesHeight ? next.size.height : item.height.value,
                },
              },
            }
          }
          return {
            entityId,
            transform: {
              ...next,
              position: item.positioning === 'flow'
                ? item.offset
                : persistedAbsolutePosition(),
              size: { width: item.width.value, height: item.height.value },
            },
          }
        })
        effects.push({
          type: 'command.dispatch',
          command: {
            id: context.idFactory(),
            type: BUILTIN_COMMAND_TYPES.setTransform,
            payload: { operation: finished.type, updates },
            meta: {
              label: describeTransform(
                context.document,
                stageUpdates,
                finished.type,
              ),
              source: 'stage',
              targetIds: finished.ids,
            },
          },
        })
      }
    }
    // 正式命令必须在 preview 清理和 capture 释放前同步交给宿主，否则 React
    // 会短暂重新渲染旧 document，造成高速松手时可见的“回弹”。
    apply(effects)
    publish(initialSnapshot(snapshot.temporaryPan))
    apply([{ type: 'pointer.release', pointerId }])
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
    const parentId = clientPoint
      ? index.containerAtPoint(world)
      : selectionParentId
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
      const nextIndex = createStageSceneIndex(nextContext.document, nextContext.layoutSnapshot)
      const gestureIds = gesture
        && (
          gesture.type === 'move'
          || gesture.type === 'resize'
          || gesture.type === 'rotate'
        )
        ? gesture.ids
        : null
      const paintGestureId = gesture?.type === 'paint' ? gesture.entityId : null
      const segmentGestureId = gesture?.type === 'segment-resize' ? gesture.entityId : null
      const documentChanged = context?.document !== nextContext.document
        || context?.layoutSnapshot.revision !== nextContext.layoutSnapshot.revision
      const paintEditingChanged = !samePaintEditing(context?.paintEditing, nextContext.paintEditing)
      const paintSamplingChanged = !samePaintSampling(context?.paintSampling, nextContext.paintSampling)
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
          || (paintGestureId !== null && (
            nextContext.selectedIds.length !== 1
            || nextContext.selectedIds[0] !== paintGestureId
            || nextContext.paintEditing?.entityId !== paintGestureId
          ))
          || (segmentGestureId !== null && (
            nextContext.selectedIds.length !== 1
            || nextContext.selectedIds[0] !== segmentGestureId
          ))
          || (gesture?.type === 'paint-sample' && !samePaintSampling(
            gesture.target,
            nextContext.paintSampling,
          ))
        ),
      )
      context = nextContext
      index = nextIndex
      if (incompatible) {
        reset()
        return
      }
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
      if (event.type === 'pointer.down') {
        begin(event)
        return
      }
      if (event.type === 'pointer.move') {
        if (gesture?.pointerId === event.pointerId) updateGesture(event.point, event.modifiers)
        return
      }
      if (event.type === 'pointer.up') {
        finish(event)
        return
      }
      if (event.type === 'pointer.cancel') {
        if (gesture && (event.pointerId === undefined || gesture.pointerId === event.pointerId)) {
          reset()
        }
        return
      }
      if (event.type === 'temporary-pan.start') {
        if (!snapshot.temporaryPan) publish({ ...snapshot, temporaryPan: true })
        return
      }
      if (event.type === 'temporary-pan.end') {
        if (gesture?.type === 'pan') reset()
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
