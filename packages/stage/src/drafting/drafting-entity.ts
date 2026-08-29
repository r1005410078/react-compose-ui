import {
  BUILTIN_COMMAND_TYPES,
  composeCurveBounds,
  getComposeHierarchy,
  getComposeLock,
  getComposeVisibility,
  normalizeComposeCurveGeometry,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeCurve,
  type ComposeLayoutSnapshot,
  type EditorCommand,
  type JsonValue,
} from '@compose-ui/core'
import type { ComposePosition, ComposeWire, ComposeWireBinding } from '@compose-ui/core'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  applyMatrix,
  getEntityWorldMatrix,
  invertMatrix,
  type StagePoint,
  type StageRect,
  type StageSceneIndex,
} from '@compose-ui/stage-engine'
import { entityFromDrawingSeed } from '../stage-surface/entity-creation/drawing-entity'
import { boundsInParentSpace } from '../stage-surface/entity-creation/root-landing'

/**
 * 取点落点到端口绑定的键。
 *
 * @remarks
 * 键是**解算后**的世界坐标：命令拿到的就是这个值，因此曲线端点与这里的键逐位相同，不需要
 * 容差比较。用容差反而会让一条恰好路过端口的线绑上。
 * @internal
 */
export function anchorKey(point: { readonly x: number; readonly y: number }): string {
  return `${point.x},${point.y}`
}

/**
 * 按取点记录求出一条导线两端的绑定。
 *
 * @remarks
 * **两端就是几何的首尾两个顶点**，因此直线与多段线走同一条路：中间的拐点是纯几何，`Wire`
 * 回答的是「这一端接到了哪个端口」，而拐点不接任何东西。弧没有导线语义。
 * @internal
 */
export function wireBindingsFor(
  anchors: ReadonlyMap<string, ComposeWireBinding>,
  curve: ComposeCurve,
): ComposeWire | undefined {
  const ends = composeCurveEndpoints(curve)
  if (!ends) return undefined
  const start = anchors.get(anchorKey(ends[0]))
  const end = anchors.get(anchorKey(ends[1]))
  return {
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
  }
}

/**
 * 一条曲线的首尾两个顶点；弧没有导线语义，返回 `null`。
 *
 * @internal
 */
export function composeCurveEndpoints(
  curve: ComposeCurve,
): readonly [ComposePosition, ComposePosition] | null {
  if (curve.kind === 'line') return [curve.start, curve.end]
  if (curve.kind !== 'polyline' || curve.vertices.length < 2) return null
  return [curve.vertices[0]!, curve.vertices[curve.vertices.length - 1]!]
}

/** 绘图落地一段线所需的最小上下文。 @internal */
export interface StageDraftingCommitContext {
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly index: StageSceneIndex
  readonly registry: ComposeEntityRegistry
  readonly idFactory: () => string
  readonly activeFrameId?: string | null
}

function usableParent(document: ComposeDocument, entityId: string | null): ComposeEntity | null {
  if (!entityId) return null
  const candidate = document.entities[entityId]
  if (!candidate) return null
  return getComposeHierarchy(candidate)
    && !getComposeLock(candidate).locked
    && getComposeVisibility(candidate).visible
    ? candidate
    : null
}

/**
 * 把世界坐标下的一条曲线换算到父级局部坐标。
 *
 * @remarks
 * Stage 的世界矩阵链只有平移与旋转（缩放由 `LayoutItem` 的宽高表达，不进矩阵），因此弧
 * 只需搬圆心、把起始角加上矩阵的旋转量——半径不受影响。矩阵若带非等比缩放，弧就不再是弧，
 * 那是另一件事，本条链上不会出现。
 */
function toParentCurve(
  curve: ComposeCurve,
  mapPoint: (point: StagePoint) => StagePoint,
  rotationDegrees: number,
): ComposeCurve {
  // `StagePoint` 没有索引签名，`ComposePosition` 有；重建一次比放宽协议类型便宜。
  const toParent = (point: StagePoint) => {
    const next = mapPoint(point)
    return { x: next.x, y: next.y }
  }
  if (curve.kind === 'line') {
    return { ...curve, start: toParent(curve.start), end: toParent(curve.end) }
  }
  if (curve.kind === 'polyline') {
    return { ...curve, vertices: curve.vertices.map(toParent) }
  }
  return {
    ...curve,
    center: toParent(curve.center),
    startAngle: curve.startAngle + rotationDegrees,
  }
}

/**
 * 一条曲线落地时的可选内容。
 *
 * @remarks
 * 箭头与导线各自走**另一个 Preset**，而不是在落地处改 Renderer props：默认描边住在物料包里
 * （`DEFAULT_ARROW_PROPS` / `DEFAULT_WIRE_PROPS`），Stage 认识 Preset id 就够了，不必也认识
 * prop 名。反过来做的话，换默认值要同时改两个包，而漏改的那一处不会有任何报错。
 *
 * @internal
 */
export interface StageDraftingCurveOptions {
  /**
   * 这是一条导线，值是取点时记下的两端绑定。
   *
   * @remarks
   * **存在即导线**：字段在不在决定走哪个 Preset，值是什么决定写不写 `Wire` Component。
   * 空对象与缺席因此是两件事——前者是「一条谁也没接的导线」（仍是主回路，仍走 `wire`
   * Preset），后者是「这根本不是导线」。
   */
  readonly wire?: ComposeWire
  /** 这条曲线带终点箭头。 */
  readonly arrow?: boolean
}

/**
 * 把一条世界坐标的曲线变成一条 `entity.create` 命令。
 *
 * @remarks
 * **引擎不创建 Entity**，因此这一步在宿主完成：Preset 与 ID 都在这里定。几何写进 `Curve`
 * 与 `LayoutItem` 时走 `normalizeComposeCurveGeometry`——与 `entity.curve.set` 漏斗同一个
 * 换算，否则新建的线与之后编辑出来的线会遵守两套盒对齐规则。
 *
 * 落点父级取线段中点所在的容器；不在任何容器里时落进激活场景，与「根层落点按类型分流」
 * 一致——曲线不是容器，不走升格。
 *
 * @returns 可派发的命令；Preset 缺失时返回 null。
 * @internal
 */
export function createStageDraftingCurveCommand(
  context: StageDraftingCommitContext,
  curve: ComposeCurve,
  options: StageDraftingCurveOptions = {},
): EditorCommand | null {
  const { arrow, wire } = options
  /*
   * 导线走 `wire` Preset——它比普通曲线粗一档（一次回路粗实线）。这里 MUST NOT 在 Preset
   * 缺失时静默回退到 `curve`：回退画出来的是一条看起来像标注线的导线，而它是主回路，还带着
   * 屏幕上看不见的端口绑定。
   */
  const seed = context.registry.createSeed(wire ? 'wire' : arrow ? 'arrow' : 'curve')
  if (!seed.ok) return null

  // 落点父级按几何紧包围盒的中心判定：对线来说就是原来的线段中点，对弧与多段线也自然成立。
  const bounds = composeCurveBounds(curve)
  const anchor: StagePoint = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  }
  const parent = usableParent(context.document, context.index.containerAtPoint(anchor))
    ?? usableParent(context.document, context.activeFrameId ?? null)
  const inverse = parent
    ? invertMatrix(getEntityWorldMatrix(context.document, context.layoutSnapshot, parent.id))
    : null
  const toParent = (point: StagePoint) => (inverse ? applyMatrix(inverse, point) : point)
  const rotationDegrees = inverse ? Math.atan2(inverse.b, inverse.a) * 180 / Math.PI : 0
  const normalized = normalizeComposeCurveGeometry(
    toParentCurve(curve, toParent, rotationDegrees),
  )

  const entityId = context.idFactory()
  const layoutItem = seed.seed.components.LayoutItem as Record<string, unknown>
  const entity: ComposeEntity = {
    ...seed.seed,
    id: entityId,
    components: {
      ...seed.seed.components,
      Curve: normalized.curve,
      // 两端都没绑到端口的「导线」不带 `Wire`：一条谁也没接的线与普通线没有任何差别，
      // 留一个空 Component 只会让文档攒下读不出意图的空壳。
      ...(wire && (wire.start || wire.end) ? { Wire: wire } : {}),
      LayoutItem: {
        ...layoutItem,
        offset: normalized.offset,
        width: { ...(layoutItem.width as object), value: normalized.size.width },
        height: { ...(layoutItem.height as object), value: normalized.size.height },
      },
    },
  }

  return {
    id: context.idFactory(),
    type: BUILTIN_COMMAND_TYPES.createEntity,
    payload: {
      entity: entity as unknown as JsonValue,
      parentId: parent ? parent.id : null,
    },
    meta: { label: entity.name, source: 'stage', targetIds: [entityId] },
  }
}

/**
 * 把一个世界坐标的盒变成一条创建**矩形物料**的命令。
 *
 * @remarks
 * 与 `createStageDraftingCurveCommand` 是两种意图：折线是「一段几何」，盒是「一块有背景、
 * 边框与圆角的面积」。`RECTANGLE` 走这一条——画完矩形外框，下一步九成是填色、调圆角、往里
 * 塞东西，而这些 `Curve` 全都做不到。
 *
 * 落地复用 `entityFromDrawingSeed` 与 `boundsInParentSpace`：它们已经是「一个盒 + 一个
 * Preset → 一个 Entity」的唯一实现（拖拽绘制容器与文字走的就是它）。另写一份的症状是
 * 「命令画的矩形与拖出来的容器在 `positioning`、最小尺寸或 Hug 处理上差一点」，而这种差别
 * 要等到有人对比两者时才会发现。
 *
 * 落点父级与曲线一致：盒中心所在的容器，不在任何容器里时落进激活场景。Rectangle Preset
 * 没有 `Hierarchy`，因此按「根层落点按类型分流」它不升格成新场景。
 *
 * @returns 可派发的命令；Preset 缺失时返回 null。
 * @internal
 */
export function createStageDraftingBoxCommand(
  context: StageDraftingCommitContext,
  box: StageRect,
): EditorCommand | null {
  const seed = context.registry.createSeed('rectangle')
  if (!seed.ok) return null

  const anchor: StagePoint = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const parent = usableParent(context.document, context.index.containerAtPoint(anchor))
    ?? usableParent(context.document, context.activeFrameId ?? null)
  const inverse = parent
    ? invertMatrix(getEntityWorldMatrix(context.document, context.layoutSnapshot, parent.id))
    : null

  const entityId = context.idFactory()
  const entity = entityFromDrawingSeed(seed.seed, entityId, boundsInParentSpace(box, inverse))

  return {
    id: context.idFactory(),
    type: BUILTIN_COMMAND_TYPES.createEntity,
    payload: {
      entity: entity as unknown as JsonValue,
      parentId: parent ? parent.id : null,
    },
    meta: { label: entity.name, source: 'stage', targetIds: [entityId] },
  }
}
