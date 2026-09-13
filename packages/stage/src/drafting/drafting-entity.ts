import {
  BUILTIN_COMMAND_TYPES,
  composeCurveBounds,
  getComposeHierarchy,
  getComposeLock,
  getComposeVisibility,
  getComposeWire,
  normalizeComposeCurveGeometry,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeCurve,
  type ComposeLayoutSnapshot,
  type EditorCommand,
  type JsonValue,
} from '@compose-ui/core'
import type { ComposePosition, ComposeWire, ComposeWireBinding } from '@compose-ui/core'
import { batchStageCommands, planStageWireTap } from './wire-tap'
import type { StageWireTapAnchor, StageWireTapMerge } from './wire-tap'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  applyMatrix,
  getEntityParentId,
  getEntityWorldMatrix,
  invertMatrix,
  orientStageWireVertices,
  stageWireParentVertices,
  type StagePoint,
  type StageSceneIndex,
} from '@compose-ui/stage-engine'

/**
 * 矩形 Preset 的 id。
 *
 * @remarks
 * 落地时挑 Preset 与**圆角手柄该不该出**两处读同一个：`Composition.presetId` 是文档里
 * 「这是一个矩形」的唯一记录，而闭合四顶点多段线在几何上与 `PLINE` 画出来的折线一模一样
 * ——按几何反推是错的，意图只能由建它的那条命令说出来。
 * @internal
 */
export const STAGE_RECT_PRESET_ID = 'rect'

/**
 * 填充 Preset 的 id。
 *
 * @remarks
 * 与 `rect` 同一条边界：引擎只说出「这是一块填充」，挑哪个 Preset 由持有 Registry 的宿主决定。
 * @internal
 */
export const STAGE_HATCH_PRESET_ID = 'hatch'

/**
 * 给定的那些 Entity 在同一个父级下最靠前的位置；没有一个同父级时返回 null。
 *
 * @remarks
 * 只看**同父级**的那些：跨层级的边界在这个父级的子级列表里没有位置可言，拿它算等于按一个
 * 不存在的下标插入。一个都没有时不插，落在最后（最上面）——那时这块填充与它的边界本来就不在
 * 同一层，层序由容器之间的次序决定。
 */
function lowestSiblingIndex(
  document: ComposeDocument,
  parentId: string | null,
  ids: readonly string[],
): number | null {
  const siblings = parentId
    ? getComposeHierarchy(document.entities[parentId])?.childIds ?? []
    : document.rootIds
  const positions = ids
    .map((id) => siblings.indexOf(id))
    .filter((position) => position >= 0)
  return positions.length === 0 ? null : Math.min(...positions)
}

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
 * 按取点记录求出一条曲线两端各落在了哪条既有导线上。
 *
 * @remarks
 * 与 {@link wireBindingsFor} 是同一张表的两半：端口那一头已经是可绑的目标，线身这一头还要
 * 先把节点建出来。两者读的是**同一个键**（解算后的世界坐标），因此一次取点只可能落进其中
 * 一张表——捕捉给出的候选只有一个。
 * @internal
 */
export function wireTapsFor(
  anchors: ReadonlyMap<string, StageWireTapAnchor>,
  curve: ComposeCurve,
): { readonly start?: StageWireTapAnchor; readonly end?: StageWireTapAnchor } | undefined {
  const ends = composeCurveEndpoints(curve)
  if (!ends) return undefined
  const start = anchors.get(anchorKey(ends[0]))
  const end = anchors.get(anchorKey(ends[1]))
  if (!start && !end) return undefined
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
  // 绘图命令眼下不产出 `path`（最窄 kind 落成直线、弧或多段线），但这条链是「任意曲线落地」
  // 的唯一入口，缺这一支的症状会是某天从别处落一条 `path` 时它静默地把控制点留在原坐标系里。
  // 旋转不出现在这里：只有弧把它记成角，其余 kind 由 `mapPoint` 一并带过去。
  if (curve.kind === 'path') {
    return {
      ...curve,
      subpaths: curve.subpaths.map((subpath) => ({
        ...subpath,
        start: toParent(subpath.start),
        segments: subpath.segments.map((segment) => ({
          c1: toParent(segment.c1),
          c2: toParent(segment.c2),
          to: toParent(segment.to),
        })),
      })),
    }
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
   * 这条曲线是一个矩形。
   *
   * @remarks
   * 走 `rect` Preset——**与物料面板里那一个是同一个**，因此两条入口产出的东西逐字段相同，
   * 场景树里也都叫 Rectangle。同一个词在这个产品里只指一件东西。
   */
  readonly rectangle?: boolean
  /**
   * 这条曲线带终点箭头。
   *
   * @remarks
   * 走**另一个 Preset** 而不是在这里改 Renderer props：箭头的默认描边住在物料包里
   * （`DEFAULT_ARROW_PROPS`），Stage 认识 Preset id 就够了，不必也认识 prop 名。
   */
  readonly arrow?: boolean
  /**
   * 取点时落在**另一条导线**上的那些端。
   *
   * @remarks
   * 与 {@link StageDraftingCurveOptions.wire} 是同一件事的另一种目标：那个是「落在端口上」，
   * 这个是「落在线身上」。后者要先把节点建出来，因此它在这里被展开成建节点、断线与改绑三条
   * 命令，与本条曲线的创建一起收进**同一个事务**。
   */
  readonly taps?: {
    readonly start?: StageWireTapAnchor
    readonly end?: StageWireTapAnchor
  }
  /** 事务的展示名；接线一步会产出多条命令，历史里需要一句话说清它是什么。 */
  readonly tapLabel?: string
  /**
   * 改**这一个已有 Entity** 的几何，而不是新建一个。
   *
   * @remarks
   * 导线每取一个点就落地，产出的仍然是一个 Entity：第二个点新建，之后每一下走这一支。
   * 写入走 `entity.curve.set`——曲线几何写入的唯一漏斗，它在同一个事务里写 `Curve` 与
   * `LayoutItem`。
   *
   * **落地父级取它当前的父级，不重算**：新建那一支按几何紧包围盒的中心挑父级，而那个中心
   * 随着导线变长一直在动，每一步重算会让一条画到一半的线突然从一个场景搬到另一个场景。
   *
   * 目标不存在或被锁定时退回新建：那一个已经被外部撤销掉了，会话因此自己愈合，而不是从此
   * 每一步都写不进去。
   */
  readonly replace?: string
  /**
   * 这条曲线是一块**求面产出的填充**。
   *
   * @remarks
   * 与 `rectangle` / `arrow` / `wiring` 一样是意图标记，但它多带两样东西：`seed`（重新生成要
   * 用的那个落点）与层序。走 `hatch` Preset。
   */
  readonly hatch?: StageDraftingHatchOptions
}

/** 新建一块填充时的额外信息。 @internal */
export interface StageDraftingHatchOptions {
  /**
   * 求出这块面用的**世界**落点。
   *
   * @remarks
   * 写进 `Hatch.seed` 之前换算成 Entity 局部坐标——与 `Ports.position`、`Curve` 的盒局部几何
   * 同一个空间，因此移动这块填充不改写它。
   *
   * **不量化到两位小数**：`roundComposeGeometry` 的作用对象是会被看见、会被再编辑的几何，
   * 而这个数是求解器的输入。一块窄面上挪两个百分点就够让重新生成跑到隔壁那一块去。
   */
  readonly seed: StagePoint
  /** 这一次的填充色。 */
  readonly color: string
  /** 围出这块面的那些 Entity；填充插到它们**之下**。 */
  readonly belowIds: readonly string[]
}

/** {@link createStageDraftingCurveCommand} 的结果。 @internal */
export interface StageDraftingCurveCommand {
  readonly command: EditorCommand
  /** 因为父级不一致而没能绑上的那些端；调用方 MUST 把它说出来。 */
  readonly droppedWireEnds: readonly ('start' | 'end')[]
  /**
   * 这条曲线被并进了哪个既有 Entity。
   *
   * @remarks
   * 只有「落在另一条导线的自由端上」那一档有值。调用方 MUST 把会话记着的「我建的那一个」换成
   * 它——本次画的那条线已经不在文档里了，不换的话「参考点跟着文档走」会把它当成一次删除，
   * 把会话往回退一个点。
   */
  readonly mergedInto?: string
  /** 合并之后那条线的顶点数；与 {@link StageDraftingCurveCommand.mergedInto} 成对出现。 */
  readonly mergedVertices?: number
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
 * `options.replace` 给出目标时改的是**那一个**：命令换成 `entity.curve.set`，父级取它当前的
 * 父级。导线每取一个点就落地、产出仍然是一个 Entity，走的就是这一支。
 *
 * @returns 可派发的命令与被丢掉的绑定端；Preset 缺失时返回 null。
 * @internal
 */
export function createStageDraftingCurveCommand(
  context: StageDraftingCommitContext,
  curve: ComposeCurve,
  options: StageDraftingCurveOptions = {},
): StageDraftingCurveCommand | null {
  const { arrow, hatch, rectangle, replace, taps, tapLabel, wire, wiring } = options
  const existing = replace ? context.document.entities[replace] : undefined
  const target = existing && !getComposeLock(existing).locked ? existing : undefined
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
  const parentId = target
    ? getEntityParentId(context.document, target.id)
    : (usableParent(context.document, context.index.containerAtPoint(anchor))
      ?? usableParent(context.document, context.activeFrameId ?? null))?.id ?? null
  const inverse = parentId
    ? invertMatrix(getEntityWorldMatrix(context.document, context.layoutSnapshot, parentId))
    : null
  const toParent = (point: StagePoint) => (inverse ? applyMatrix(inverse, point) : point)
  const rotationDegrees = inverse ? Math.atan2(inverse.b, inverse.a) * 180 / Math.PI : 0
  const local = toParentCurve(curve, toParent, rotationDegrees)
  const normalized = normalizeComposeCurveGeometry(local)

  /*
   * 接入另一条导线：先把节点建出来、把被接入的线断成两段，再让本条曲线的那一端绑上去。
   *
   * 排在过滤之前是因为它**产出**绑定：节点是本次事务新建的，此刻还不在 `document` 里，因此
   * 它天然通过同父级过滤（那一条只拦「已存在但父级不同」的目标）。
   *
   * 跨父级的接入在 `planStageWireTap` 里被拒绝并返回 null，与端口那一侧同一条判据：不接是
   * **可见的**降级，非法文档是不可见的。
   */
  const tapEdits: EditorCommand[] = []
  const tapJunctions: EditorCommand[] = []
  const tapBindings: { start?: ComposeWireBinding; end?: ComposeWireBinding } = {}
  const droppedTaps: ('start' | 'end')[] = []
  const merges: { readonly key: 'start' | 'end'; readonly plan: StageWireTapMerge }[] = []
  for (const key of ['start', 'end'] as const) {
    const anchor = taps?.[key]
    if (!anchor) continue
    const plan = planStageWireTap(context, anchor, parentId)
    if (!plan) {
      droppedTaps.push(key)
      continue
    }
    // 落在另一条导线的自由端上：不建节点，把这一段并进那条线（见 `planStageWireMerge`）。
    if (plan.kind === 'merge') {
      merges.push({ key, plan })
      continue
    }
    tapEdits.push(...plan.edits)
    tapJunctions.push(plan.junction)
    tapBindings[key] = plan.binding
  }
  const tapped = Object.keys(tapBindings).length > 0
  const requested: ComposeWire | undefined = wire || tapped
    ? { ...(wire ?? {}), ...tapBindings }
    : undefined

  // 过滤必须排在这里而不是调用方：只有算完落地父级才知道哪一端跨了层级。
  const bindings = sameParentWireEnds(context.document, requested, parentId)
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
  /*
   * 改一个已有 Entity 的几何：走 `entity.curve.set`，载荷是 parent 局部坐标，盒与几何由那条
   * 唯一漏斗一起写。Preset 与父级都不在这一支里——它们在这个 Entity 建出来的那一刻就定下了。
   *
   * `wire` 每一步按当前几何重算：末端吸上端口就绑、下一下走开就解绑。缺席即不动 `Wire`，
   * 因此一条从来没碰过端口的线不会被写上一个空壳，也不会每一步都产生一条无谓的补丁。
   */
  if (merges.length > 0) {
    const merged = planStageDraftingWireMerge({
      context,
      local,
      wire: bindings.wire,
      merges,
      removedIds: target ? [target.id] : [],
      label: tapLabel ?? target?.name ?? '',
    })
    if (merged) return { ...merged, droppedWireEnds: [...bindings.dropped, ...droppedTaps] }
  }

  if (target) {
    const current = getComposeWire(target)
    const nextWire = bindings.wire ?? (current ? null : undefined)
    const update: EditorCommand = {
      id: context.idFactory(),
      type: BUILTIN_COMMAND_TYPES.setCurve,
      payload: {
        entityId: target.id,
        curve: local as unknown as JsonValue,
        ...(nextWire === undefined ? {} : { wire: nextWire as unknown as JsonValue }),
      },
      meta: { label: target.name, source: 'stage', targetIds: [target.id] },
    }
    return {
      command: tapJunctions.length > 0
        ? batchStageCommands(
            context.idFactory,
            [...tapEdits, update, ...tapJunctions],
            tapLabel ?? target.name ?? '',
            { label: tapLabel ?? target.name, source: 'stage', targetIds: [target.id] },
          ) ?? update
        : update,
      droppedWireEnds: [...bindings.dropped, ...droppedTaps],
    }
  }

  const seed = context.registry.createSeed(
    hatch
      ? STAGE_HATCH_PRESET_ID
      : wiring || bindings.wire
        ? 'wire'
        : arrow ? 'arrow' : rectangle ? STAGE_RECT_PRESET_ID : 'curve',
  )
  if (!seed.ok) return null

  const entityId = context.idFactory()
  const layoutItem = seed.seed.components.LayoutItem as Record<string, unknown>
  /*
   * 填充多带两样：重新生成要用的那个落点，与这一次的颜色。落点换算成 Entity 局部坐标
   * （几何归一化把紧包围盒的左上角挪到了原点，因此还要减去 `normalized.offset`）。
   */
  const hatchComponents = hatch
    ? (() => {
      const seedLocal = toParent(hatch.seed)
      return {
        Hatch: {
          seed: {
            x: seedLocal.x - normalized.offset.x,
            y: seedLocal.y - normalized.offset.y,
          },
        },
        Appearance: {
          ...(seed.seed.components.Appearance as Record<string, unknown>),
          backgroundPaint: { kind: 'solid', color: hatch.color },
        },
      }
    })()
    : {}
  const entity: ComposeEntity = {
    ...seed.seed,
    id: entityId,
    components: {
      ...seed.seed.components,
      ...hatchComponents,
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

  /*
   * 填充压在边界之下：子级顺序就是绘制顺序，先建的在底下。不插的话它落在最上面，把围出这块
   * 面的那些线连同区域里的符号整片盖住——而那正是 AutoCAD 把 `HPDRAWORDER` 默认成「送到边界
   * 之后」的理由。取的是同父级那些边界里**最靠前**的一个：只要压在最下面那条边界之下，就压在
   * 全部边界之下。
   */
  const insertion = hatch ? lowestSiblingIndex(context.document, parentId, hatch.belowIds) : null
  const create: EditorCommand = {
    id: context.idFactory(),
    type: BUILTIN_COMMAND_TYPES.createEntity,
    payload: {
      entity: entity as unknown as JsonValue,
      parentId,
      ...(insertion === null ? {} : { index: insertion }),
    },
    meta: { label: entity.name, source: 'stage', targetIds: [entityId] },
  }
  /*
   * 接线的三件事与本条曲线的创建收进**同一个事务**：撤销一步 MUST 回到接入之前，而不是回到
   * 「接了一半」。批次的 `targetIds` 仍指向新画的这条线——`LINE` 的 `U` 靠它出栈。
   *
   * **节点排在最后**：子级顺序就是绘制顺序，先建的在底下。它排在新画的那条导线之前时，接头
   * 正中央按下去抓到的是那条线——而接头是三条支路唯一的公共入口。绑定指向一个此刻还不存在的
   * Entity 不成问题：批次是原子的，而「指向不存在的实体」本来就只是解算失败、不是文档非法。
   */
  const command = tapJunctions.length > 0
    ? batchStageCommands(
        context.idFactory,
        [...tapEdits, create, ...tapJunctions],
        tapLabel ?? entity.name,
        { label: tapLabel ?? entity.name, source: 'stage', targetIds: [entityId] },
      ) ?? create
    : create
  return {
    command,
    droppedWireEnds: [...bindings.dropped, ...droppedTaps],
  }
}

/** {@link planStageDraftingWireMerge} 的入参。 */
interface StageDraftingWireMergeOptions {
  readonly context: StageDraftingCommitContext
  /** 本次画的这条线，parent 局部坐标。 */
  readonly local: ComposeCurve
  /** 本次画的这条线两端各绑到了哪个端口；被并掉的那一端由对方的远端接手。 */
  readonly wire: ComposeWire | undefined
  readonly merges: readonly { readonly key: 'start' | 'end'; readonly plan: StageWireTapMerge }[]
  /** 本次画的这条线如果已经落过地，它的 id——合并之后要把它删掉。 */
  readonly removedIds: readonly string[]
  readonly label: string
}

/**
 * 把本次画的这条线并进它两端碰到的那些既有导线。
 *
 * @remarks
 * 留下来的是**图上先有的那一条**：它的 id、名称与全部呈现都不变，动画轨道与数据绑定也跟着
 * 留下。被删掉的是本次刚画出来的那一条——它还什么都没有可失去的。两端各碰到一条时留下的是
 * `start` 那一侧碰到的，另一条与本次这条一起删掉。
 *
 * 相接点作为一个顶点留下，MUST NOT 因为两侧共线就消解掉：一次画出的 A→B→C 是三个顶点，
 * 分两次画出的合并之后也必须是三个顶点——让两种画法产出逐字相同的文档正是这条规则的全部目的。
 *
 * @returns 任一条的几何不是合法导线几何时为 `null`，调用方退回建节点那条老路。
 */
function planStageDraftingWireMerge(
  options: StageDraftingWireMergeOptions,
): { readonly command: EditorCommand; readonly mergedInto: string; readonly mergedVertices: number } | null {
  const { context, local, wire, merges, removedIds, label } = options
  const own = composeCurveVertices(local)
  if (!own) return null

  let vertices = own
  let start = wire?.start
  let end = wire?.end
  let survivor: ComposeEntity | undefined
  const removed = [...removedIds]
  for (const { key, plan } of merges) {
    const entity = context.document.entities[plan.targetId]
    const theirs = entity ? stageWireParentVertices(entity) : null
    if (!entity || !theirs) return null
    const theirWire = getComposeWire(entity)
    const far = theirWire?.[plan.end === 'start' ? 'end' : 'start']
    if (key === 'start') {
      vertices = [...orientStageWireVertices(theirs, plan.end, 'last'), ...vertices.slice(1)]
      start = far
    } else {
      vertices = [...vertices, ...orientStageWireVertices(theirs, plan.end, 'first').slice(1)]
      end = far
    }
    if (survivor) removed.push(entity.id)
    else survivor = entity
  }
  if (!survivor) return null

  const merged: ComposeWire = { ...(start ? { start } : {}), ...(end ? { end } : {}) }
  /*
   * 两端都没绑的导线不留一个空壳 `Wire`：`null` 在这条命令上就是「把它去掉」。它本来就没有时
   * **不写这个字段**——去掉一个不存在的 Component 会让整条批次被拒（`patch.invalid-path`），
   * 而两端都自由正是一张图上最常见的状态，症状是整次合并静默地什么都没发生。
   */
  const nextWire = Object.keys(merged).length > 0
    ? merged
    : (getComposeWire(survivor) ? null : undefined)
  const update: EditorCommand = {
    id: context.idFactory(),
    type: BUILTIN_COMMAND_TYPES.setCurve,
    payload: {
      entityId: survivor.id,
      curve: { kind: 'polyline', closed: false, vertices } as unknown as JsonValue,
      ...(nextWire === undefined ? {} : { wire: nextWire as unknown as JsonValue }),
    },
    meta: { label: survivor.name, source: 'stage', targetIds: [survivor.id] },
  }
  const commands: EditorCommand[] = [update]
  if (removed.length > 0) {
    commands.push({
      id: context.idFactory(),
      type: BUILTIN_COMMAND_TYPES.deleteEntity,
      payload: { entityIds: removed },
      meta: { source: 'stage', targetIds: removed },
    })
  }
  return {
    command: batchStageCommands(context.idFactory, commands, label || survivor.name, {
      label: label || survivor.name,
      source: 'stage',
      targetIds: [survivor.id],
    }) ?? update,
    mergedInto: survivor.id,
    mergedVertices: vertices.length,
  }
}

/** 一条线的顶点；不是合法的导线几何时为 `null`。 */
function composeCurveVertices(curve: ComposeCurve): readonly ComposePosition[] | null {
  if (curve.kind === 'line') return [curve.start, curve.end]
  if (curve.kind !== 'polyline' || curve.closed) return null
  return curve.vertices.length >= 2 ? curve.vertices : null
}
