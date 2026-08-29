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
import { entityFromDrawingSeed } from '../stage-surface/entity-creation/drawing-entity'
import { boundsInParentSpace } from '../stage-surface/entity-creation/root-landing'
import {
  applyMatrix,
  getEntityParentId,
  getEntityWorldMatrix,
  invertMatrix,
  type StagePoint,
  type StageRect,
  type StageSceneIndex,
} from '@compose-ui/stage-engine'

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

/** {@link sameParentWireEnds} 的结果。 @internal */
export interface StageWireParentFilter {
  /** 因为父级不一致而被丢掉的那些端。 */
  readonly dropped: readonly ('start' | 'end')[]
  /** 过滤之后的绑定；两端都没了时是 undefined。 */
  readonly wire: ComposeWire | undefined
}

/**
 * 丢掉与落地父级不一致的那些绑定端。
 *
 * @remarks
 * `wire.parent-mismatch` 是**文档非法**而不是警告：端口的父级坐标要按实例的盒与旋转基点
 * 换算，跨层级还要合成整条祖先链的变换，因此协议直接把它限制在同一父级下。
 *
 * 而落地父级按线段紧包围盒中心判定，所以「从帧内符号的端口拉一条线到帧外」是一次很平常的
 * 手势——绑上就会让整份文档校验失败，此后连保存这类与画线毫无关系的操作都被阻断。
 *
 * 因此这里**不绑**，并由调用方在命令行说明。不绑是**可见的**降级：Inspector 显示该端自由，
 * 符号移动时看得出线没跟着走；非法文档是不可见的。另外两条路都更差——绑上让校验报错，会给
 * 用户一条他不认识、成因又在屏幕上看不见的错误；把线搬进符号的父级，则悄悄改变了它的落点
 * 归属，而用户刚刚明确地把它画在了别处。
 *
 * @internal
 */
export function sameParentWireEnds(
  document: ComposeDocument,
  wire: ComposeWire | undefined,
  parentId: string | null,
): StageWireParentFilter {
  if (!wire) return { dropped: [], wire: undefined }
  const dropped: ('start' | 'end')[] = []
  const kept: { start?: ComposeWireBinding; end?: ComposeWireBinding } = {}
  for (const key of ['start', 'end'] as const) {
    const binding = wire[key]
    if (!binding) continue
    // 目标不存在时不算跨父级：那是「配的东西没了」，由解算失败与 Inspector 的失效态承担，
    // 与本函数要挡的文档非法是两件事。
    if (document.entities[binding.entityId]
      && getEntityParentId(document, binding.entityId) !== parentId) {
      dropped.push(key)
      continue
    }
    kept[key] = binding
  }
  const hasBinding = kept.start !== undefined || kept.end !== undefined
  return { dropped, wire: hasBinding ? kept : undefined }
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

/** 一条曲线落地时的可选内容。 @internal */
export interface StageDraftingCurveOptions {
  /**
   * 取点时记下的端口绑定；两端都没绑时不写 `Wire`。
   *
   * @remarks
   * 与落地父级不一致的那些端会在这里被丢掉并经返回值报出来，见 {@link sameParentWireEnds}。
   */
  readonly wire?: ComposeWire
  /**
   * 这条曲线由 `WIRE` 画出。
   *
   * @remarks
   * 与 {@link StageDraftingCurveOptions.wire} **是两件事**：那个说「两端接到了哪儿」，这个说
   * 「用户是在接线」。两端都落在空白处的导线仍然是导线（预留、接到图外），外观不该因为它此刻
   * 没接上就退回普通线；反过来，`LINE` 顺手吸上端口的那一条**事实上**也是导线，因此两者
   * 任一成立就走导线 Preset。
   */
  readonly wiring?: boolean
  /**
   * 这条曲线带终点箭头。
   *
   * @remarks
   * 走**另一个 Preset** 而不是在这里改 Renderer props：箭头的默认描边住在物料包里
   * （`DEFAULT_ARROW_PROPS`），Stage 认识 Preset id 就够了，不必也认识 prop 名。
   */
  readonly arrow?: boolean
}

/** {@link createStageDraftingCurveCommand} 的结果。 @internal */
export interface StageDraftingCurveCommand {
  readonly command: EditorCommand
  /** 因为父级不一致而没能绑上的那些端；调用方 MUST 把它说出来。 */
  readonly droppedWireEnds: readonly ('start' | 'end')[]
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
 * @returns 可派发的命令与被丢掉的绑定端；Preset 缺失时返回 null。
 * @internal
 */
export function createStageDraftingCurveCommand(
  context: StageDraftingCommitContext,
  curve: ComposeCurve,
  options: StageDraftingCurveOptions = {},
): StageDraftingCurveCommand | null {
  const { arrow, wire, wiring } = options
  /*
   * 导线走 `wire` Preset（一次回路的红色粗实线），判据是**这条线真的绑上了端口**而不是
   * 走了哪条命令——`WIRE` 合并进 `LINE` 之后没有第二种线可分，绑定跟着取点来源走，因此
   * 「是不是导线」只能从绑定读出来。两端都没碰过端口时 `wireBindingsFor` 给出空对象，
   * 那是一条普通线。
   *
   * MUST NOT 在 Preset 缺失时静默回退到 `curve`：回退画出来的是一条看起来像标注线的导线，
   * 而它是主回路、还带着屏幕上看不见的绑定。
   */
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

  // 过滤必须排在这里而不是调用方：只有算完落地父级才知道哪一端跨了层级。
  const bindings = sameParentWireEnds(context.document, wire, parent ? parent.id : null)
  /*
   * 导线走 `wire` Preset（一次回路的红色粗实线）。判据有两条，任一成立即可：用户是在**接线**
   * （`WIRE`），或者这条线**事实上绑上了**端口（`LINE` 顺手吸上了）。前者让两端都自由的导线
   * 仍然是导线，后者让「像素级正确却从未接上」这个屏幕上看不见的错误不再可能。
   *
   * 绑定读的是**过滤之后**的那份：跨父级的端已经被丢掉，丢完两端都空的普通线不再宣称自己
   * 是导线。
   *
   * MUST NOT 在 Preset 缺失时静默回退到 `curve`：回退画出来的是一条看起来像标注线的导线，
   * 而它是主回路、还带着屏幕上看不见的绑定。
   */
  const seed = context.registry.createSeed(
    wiring || bindings.wire ? 'wire' : arrow ? 'arrow' : 'curve',
  )
  if (!seed.ok) return null

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
      ...(bindings.wire ? { Wire: bindings.wire } : {}),
      LayoutItem: {
        ...layoutItem,
        offset: normalized.offset,
        width: { ...(layoutItem.width as object), value: normalized.size.width },
        height: { ...(layoutItem.height as object), value: normalized.size.height },
      },
    },
  }

  return {
    command: {
      id: context.idFactory(),
      type: BUILTIN_COMMAND_TYPES.createEntity,
      payload: {
        entity: entity as unknown as JsonValue,
        parentId: parent ? parent.id : null,
      },
      meta: { label: entity.name, source: 'stage', targetIds: [entityId] },
    },
    droppedWireEnds: bindings.dropped,
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
