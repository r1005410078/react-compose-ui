import type {
  ComposeDocument,
  EditorCommand,
  JsonValue,
} from '@compose-ui/core'
import {
  BUILTIN_COMMAND_TYPES,
  getComposeLock,
  getComposeTransform,
  resolveComposeTransformConstraints,
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
  | 'rotate'
  | 'guide-create'
  | 'guide-move'
  | 'external'

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
  | { readonly kind: 'rotate' }
  | { readonly kind: 'ruler'; readonly axis: 'x' | 'y' }
  | { readonly kind: 'ruler-corner' }
  | { readonly kind: 'guide'; readonly guideId: string }

/** Stage surface 最新受控上下文。 @public */
export interface StageInteractionContext {
  /** 最新正式文档引用；内部手势据此检测并发文档变化。 */
  readonly document: ComposeDocument
  /** 最新受控 viewport。 */
  readonly viewport: StageViewport
  /** 不含标尺和滚动条的 surface CSS 像素尺寸。 */
  readonly surfaceSize: { readonly width: number; readonly height: number }
  /** 当前持久工具；临时平移由独立事件控制。 */
  readonly tool: 'select' | 'pan'
  /** 最新受控选择，按宿主顺序排列。 */
  readonly selectedIds: readonly string[]
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
  | { readonly type: 'command.dispatch'; readonly command: EditorCommand }
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
  /** Palette 外部拖入 preview；非 external phase 时为空。 */
  readonly external: {
    readonly item: StageExternalDragItem
    readonly clientPoint: StagePoint | null
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
  external: null,
  temporaryPan: false,
  selectionBounds: null,
  scrollRange: null,
  cursor: 'default',
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
      readonly type: 'guide-move'
      readonly pointerId: number
      readonly viewport: StageViewport
      readonly guideId: string
      readonly axis: 'x' | 'y'
      position: number
      point: StagePoint
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
    const transform = getComposeTransform(entity)
    const candidate = targetTransform(
      index,
      id,
      multiplyMatrices(worldTransform, entityWorld),
      transform.size.width * (resize?.scaleX ?? 1),
      transform.size.height * (resize?.scaleY ?? 1),
    )
    if (!resize) {
      updates[id] = candidate
      return
    }
    const constraints = resolveComposeTransformConstraints(entity)
    const maximum = constraints.maxSize
    const clamp = (value: number, minimum: number, max: number | undefined) =>
      Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(minimum, value))
    if (constraints.resize === 'preserve-aspect') {
      const widthScale = candidate.width / transform.size.width
      const heightScale = candidate.height / transform.size.height
      let scale = Math.abs(widthScale - 1) >= Math.abs(heightScale - 1)
        ? widthScale
        : heightScale
      const minScale = Math.max(
        constraints.minSize.width / transform.size.width,
        constraints.minSize.height / transform.size.height,
      )
      const maxScale = maximum
        ? Math.min(
            maximum.width / transform.size.width,
            maximum.height / transform.size.height,
          )
        : Number.POSITIVE_INFINITY
      scale = Math.min(maxScale, Math.max(minScale, scale))
      updates[id] = {
        ...candidate,
        width: transform.size.width * scale,
        height: transform.size.height * scale,
      }
      return
    }
    updates[id] = {
      ...candidate,
      width: constraints.resize === 'vertical'
        ? transform.size.width
        : clamp(candidate.width, constraints.minSize.width, maximum?.width),
      height: constraints.resize === 'horizontal'
        ? transform.size.height
        : clamp(candidate.height, constraints.minSize.height, maximum?.height),
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

  const enrich = (next: StageInteractionSnapshot): StageInteractionSnapshot => {
    const selected = context && index
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
    const cursor = next.phase === 'pan'
      ? 'grabbing'
      : next.phase === 'move'
        ? 'move'
        : next.phase === 'resize'
          ? 'resize'
          : next.phase === 'rotate'
            ? 'rotate'
            : next.phase === 'marquee'
              || next.phase === 'guide-create'
              || next.phase === 'guide-move'
              ? 'crosshair'
              : next.phase === 'external'
                ? 'copy'
                : next.temporaryPan || context?.tool === 'pan'
                  ? 'grab'
                  : 'default'
    return {
      ...next,
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
      publish({ ...snapshot, phase: 'guide-create', guidePreview: gesture.guides })
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
        guidePreview: [{
          id: gesture.guideId,
          axis: gesture.axis,
          position: gesture.position,
        }],
      })
      return
    }
    if (gesture.type === 'move') {
      const delta = {
        x: world.x - gesture.startWorld.x,
        y: world.y - gesture.startWorld.y,
      }
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
          ? resolveComposeTransformConstraints(entity).resize === 'preserve-aspect'
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
    const startTransform = (
      type: 'move' | 'resize' | 'rotate',
      ids: readonly string[],
      handle?: ResizeHandle,
    ) => {
      const editableIds = index!.topLevelSelection(ids)
        .filter((id) => {
          const entity = context!.document.entities[id]
          if (!entity || !index!.isVisible(id) || getComposeLock(entity).locked) return false
          const constraints = resolveComposeTransformConstraints(entity)
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
      if (!getComposeLock(entity).locked) startTransform('move', nextSelection)
      apply(effects)
      return
    }
    if (event.hit.kind === 'resize') {
      if (startTransform('resize', context.selectedIds, event.hit.handle)) apply(effects)
      return
    }
    if (event.hit.kind === 'rotate') {
      if (startTransform('rotate', context.selectedIds)) apply(effects)
      return
    }
    if (
      event.hit.kind === 'ruler'
      || event.hit.kind === 'ruler-corner'
    ) {
      const axes: readonly ('x' | 'y')[] = event.hit.kind === 'ruler-corner'
        ? ['x', 'y']
        : [event.hit.axis]
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
    if (finished.type === 'marquee') {
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
    else if (finished.type === 'guide-create') {
      const created = finished.guides.filter((guide) => guide.axis === 'x'
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
      const shouldDelete = finished.axis === 'x'
        ? finished.point.y < 0
        : finished.point.x < 0
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
        const updates = stageUpdates.map(({ entityId, transform }) => ({
          entityId,
          transform: toComposeTransform(transform),
        }))
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
      const nextIndex = createStageSceneIndex(nextContext.document)
      const gestureIds = gesture
        && (
          gesture.type === 'move'
          || gesture.type === 'resize'
          || gesture.type === 'rotate'
        )
        ? gesture.ids
        : null
      const incompatible = Boolean(
        gesture
        && context
        && (
          context.document !== nextContext.document
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
