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
import type { ComposeWire, ComposeWireBinding } from '@compose-ui/core'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  applyMatrix,
  getEntityParentId,
  getEntityWorldMatrix,
  invertMatrix,
  type StagePoint,
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
 * 只有直线是导线（v1 没有拐点），其余 kind 一律没有绑定。
 * @internal
 */
export function wireBindingsFor(
  anchors: ReadonlyMap<string, ComposeWireBinding>,
  curve: ComposeCurve,
): ComposeWire | undefined {
  if (curve.kind !== 'line') return undefined
  const start = anchors.get(anchorKey(curve.start))
  const end = anchors.get(anchorKey(curve.end))
  return {
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
  }
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
  const { arrow, wire } = options
  const seed = context.registry.createSeed(arrow ? 'arrow' : 'curve')
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

  // 过滤必须排在这里而不是调用方：只有算完落地父级才知道哪一端跨了层级。
  const bindings = sameParentWireEnds(context.document, wire, parent ? parent.id : null)

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
