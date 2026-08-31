import {
  BUILTIN_COMMAND_TYPES,
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  COMPOSE_JUNCTION_PORT_ID,
  composeJunctionGeometry,
  composeJunctionSize,
  createComposeBatchCommand,
  getComposeComposition,
  getComposeCurve,
  getComposeLock,
  getComposeRenderer,
  getComposeWire,
  normalizeComposeCurveGeometry,
  projectComposeCurveToBox,
  splitComposeCurveAt,
  type ComposeAppearance,
  type ComposeColor,
  type ComposeCurve,
  type ComposeEntity,
  type ComposePosition,
  type ComposeWire,
  type ComposeWireBinding,
  type EditorCommand,
  type EditorCommandMeta,
  type JsonObject,
  type JsonValue,
} from '@compose-ui/core'
import {
  applyMatrix,
  getEntityParentId,
  getEntityWorldMatrix,
  invertMatrix,
  type StagePoint,
} from '@compose-ui/stage-engine'
import type { StageDraftingCommitContext } from './drafting-entity'

/**
 * 节点 Preset 的 id。
 *
 * @remarks
 * 与 {@link STAGE_RECT_PRESET_ID} 同一条边界：Stage 认识 Preset id 就够了。
 * @internal
 */
export const STAGE_JUNCTION_PRESET_ID = 'junction'

/**
 * 判断一个 Entity 是不是接线节点。
 *
 * @remarks
 * 判据是 `Composition.presetId` 而**不按几何反推**：一个被填实的小整圆与用户自己画的一个实心
 * 圆点在几何上一模一样，而后者要的确实是一个圆。与圆角手柄的判据同源。
 *
 * 引擎不认识 Preset id，因此这条谓词由 Stage 注入给它——与「一个 Entity 能不能几何编辑由宿主
 * 注入谓词」是同一条既有边界。
 *
 * @internal
 */
export function isStageJunctionEntity(entity: ComposeEntity): boolean {
  return getComposeComposition(entity).presetId === STAGE_JUNCTION_PRESET_ID
}

/**
 * 导线 Preset 的 id。
 *
 * @remarks
 * 与 {@link STAGE_JUNCTION_PRESET_ID} 同一条边界：Stage 认识 Preset id 就够了。
 * @internal
 */
export const STAGE_WIRE_PRESET_ID = 'wire'

/**
 * 判断一个 Entity 是不是导线。
 *
 * @remarks
 * 两条判据任一成立：带 `Wire`（它已经接上了什么），或者由 `WIRE` 画出（`presetId`）。
 *
 * **少了后一条会漏掉一整类导线**：`Wire` 只记录「这一端绑到了哪个端口」，两端都还没接上时
 * 根本不写这个 Component——而那正是一张图上最常见的状态（先画线、后接符号）。症状是「新画的
 * 导线接不上，接过一次之后就能接了」，用户完全无从解释。
 *
 * @internal
 */
export function isStageWireEntity(entity: ComposeEntity | undefined): boolean {
  if (!entity) return false
  return getComposeWire(entity) !== undefined
    || getComposeComposition(entity).presetId === STAGE_WIRE_PRESET_ID
}

/**
 * 一次落在导线上的取点。
 *
 * @remarks
 * 与端口锚点是**同一件事的另一种目标**：都由取点时的捕捉记下，都在提交时决定这一端接到哪儿。
 * 分成两张表而不是一张，是因为端口那一头已经是可绑的目标，而这一头还要先把节点建出来。
 * @internal
 */
export interface StageWireTapAnchor {
  /** 被接入的那条导线。 */
  readonly entityId: string
  /** 落点，世界坐标。 */
  readonly point: StagePoint
}

/** {@link planStageWireTap} 的结果。 @internal */
export interface StageWireTapPlan {
  /**
   * 建节点那一条，**单独交出来**。
   *
   * @remarks
   * 它必须排在整个事务的**最后**：子级顺序就是绘制顺序，先建的在底下。节点若排在新画的那条
   * 导线之前，接头正中央按下去抓到的是那条线而不是节点——而接头是三条支路唯一的公共入口。
   * 图上也一样：一个被线盖住的接头读作「这里有一条线经过」。
   *
   * 与 {@link StageWireTapPlan.edits} 分开而不是靠调用方在数组里挑，是因为「哪一条是节点」
   * 只有这里知道；让调用方按 `type` 反查会在下一次改动里选错那一条。
   */
  readonly junction: EditorCommand
  /** 断线与改绑；它们作用在既有 Entity 上，排在哪里都不影响绘制顺序。 */
  readonly edits: readonly EditorCommand[]
  /** 新画的这条线的该端应当绑到哪儿。 */
  readonly binding: ComposeWireBinding
}

/**
 * 读出一条导线的墨色与线宽。
 *
 * @remarks
 * 这是 Stage 唯一读 Renderer prop **名字**的地方，与「Stage 认识 Preset id 就够了」那条边界
 * 不冲突：那条挡的是在落地处**改写默认值**（换默认色要同时改两个包），而这里读的是作者写在
 * 这条线上的值——接头必须与它接的那条线同色同粗，否则一张绿色停电回路上会冒出一个红点。
 * 默认值仍然只住在物料包里。
 */
function wireInk(entity: ComposeEntity): {
  readonly color: ComposeColor | null
  readonly width: number | null
} {
  const props = getComposeRenderer(entity)?.props as JsonObject | undefined
  const color = props?.stroke
  const width = props?.strokeWidth
  return {
    color: typeof color === 'string' && (color === 'transparent' || color.startsWith('#'))
      ? color as ComposeColor
      : null,
    width: typeof width === 'number' && Number.isFinite(width) && width > 0 ? width : null,
  }
}

/** 把世界坐标的曲线换算到 parent 局部；与新建曲线走同一条换算。 */
function toParentCurve(
  curve: ComposeCurve,
  toParent: (point: ComposePosition) => ComposePosition,
): ComposeCurve {
  if (curve.kind === 'line') {
    return { kind: 'line', start: toParent(curve.start), end: toParent(curve.end) }
  }
  if (curve.kind === 'polyline') {
    return { ...curve, vertices: curve.vertices.map(toParent) }
  }
  return curve
}

/** 一条导线在世界空间里的几何；接线的拆分在世界空间做，与命中、捕捉同一条链。 */
function worldCurve(
  context: StageDraftingCommitContext,
  entity: ComposeEntity,
): ComposeCurve | null {
  const geometry = getComposeCurve(entity)
  const box = context.index.layoutSnapshot.boxes[entity.id]
  const matrix = context.index.getWorldMatrix(entity.id)
  if (!geometry || !box || !matrix) return null
  const projected = projectComposeCurveToBox(geometry, box)
  const toWorld = (point: ComposePosition): ComposePosition => {
    const next = applyMatrix(matrix, point)
    return { x: next.x, y: next.y }
  }
  return toParentCurve(projected, toWorld)
}

/**
 * 建一个节点 Entity 的创建命令。
 *
 * @remarks
 * 直径与填色都取自被接入的那条导线：接头是那条线的一部分，不是一个独立的装饰。
 */
function createJunctionCommand(
  context: StageDraftingCommitContext,
  ink: ReturnType<typeof wireInk>,
  center: ComposePosition,
  parentId: string | null,
): { readonly command: EditorCommand; readonly entityId: string } | null {
  const seed = context.registry.createSeed(STAGE_JUNCTION_PRESET_ID)
  if (!seed.ok) return null
  const layoutItem = seed.seed.components.LayoutItem as Record<string, unknown>
  const defaultSize = {
    width: (layoutItem.width as { value: number }).value,
    height: (layoutItem.height as { value: number }).value,
  }
  const size = ink.width ? composeJunctionSize(ink.width) : defaultSize
  const appearance = seed.seed.components.Appearance as ComposeAppearance | undefined
  const entityId = context.idFactory()
  const entity: ComposeEntity = {
    ...seed.seed,
    id: entityId,
    components: {
      ...seed.seed.components,
      Curve: composeJunctionGeometry(size) as unknown as JsonObject,
      // 端口落在盒心，因此三条支路的端点都解算到落点上。
      Ports: {
        items: [{
          id: COMPOSE_JUNCTION_PORT_ID,
          position: { x: size.width / 2, y: size.height / 2 },
        }],
      },
      ...(ink.color
        ? { Appearance: { ...appearance, backgroundPaint: { kind: 'solid', color: ink.color } } }
        : {}),
      LayoutItem: {
        ...layoutItem,
        // 盒心对准落点：端口在盒心，而接头要正好画在用户落笔的地方。
        offset: { x: center.x - size.width / 2, y: center.y - size.height / 2 },
        width: { ...(layoutItem.width as object), value: size.width },
        height: { ...(layoutItem.height as object), value: size.height },
      },
    },
  }
  return {
    entityId,
    command: {
      id: context.idFactory(),
      type: BUILTIN_COMMAND_TYPES.createEntity,
      payload: { entity: entity as unknown as JsonValue, parentId },
      meta: { label: entity.name, source: 'stage', targetIds: [entityId] },
    },
  }
}

/** 把一条导线的一端换成新的绑定；另一端原样保留。 */
function rebind(
  wire: ComposeWire | undefined,
  end: 'start' | 'end',
  binding: ComposeWireBinding | null,
): ComposeWire {
  const other = end === 'start' ? 'end' : 'start'
  return {
    ...(wire?.[other] ? { [other]: wire[other] } : {}),
    ...(binding ? { [end]: binding } : {}),
  }
}

/**
 * 规划一次「接到另一条导线上」。
 *
 * @remarks
 * 三件事必须在**同一个事务**里：建节点、把被接入的导线断成两段、三条支路各绑到节点的端口。
 * 拆开会产生一个可观察的不一致中间态（节点已经在了、线还没断），撤销也会变成多步。
 *
 * **落点落在被接入导线的首尾顶点上时不断线**：那里没有需要断开的线身，只把那一端改绑到节点。
 * 合成一种会产出一段零长度的残线——图上看不见，却出现在场景树里。
 *
 * 断开的两段**各自继承靠近自己那一端的原绑定**，并把靠近落点的那一端绑到节点；描边、虚线、
 * marker 与 Preset 整份复制，因此用户看到的仍然是同一条线。
 *
 * @param parentId - 本次落地的父级；被接入的导线不在同一父级时返回 `null`（**不接**），由
 * 调用方在命令行说明。与「绑定端与被绑实体不在同一父级时不绑定」是同一条既有判据：不接是
 * **可见的**降级，非法文档是不可见的。
 *
 * @returns 目标不是导线、被锁定、跨父级或节点 Preset 缺失时为 `null`。
 * @internal
 */
export function planStageWireTap(
  context: StageDraftingCommitContext,
  anchor: StageWireTapAnchor,
  parentId: string | null,
): StageWireTapPlan | null {
  const target = context.document.entities[anchor.entityId]
  if (!target || !isStageWireEntity(target)) return null
  if (getComposeLock(target).locked) return null
  if (getEntityParentId(context.document, target.id) !== parentId) return null

  const parent = parentId ? context.document.entities[parentId] : undefined
  const inverse = parent
    ? invertMatrix(getEntityWorldMatrix(context.document, context.layoutSnapshot, parent.id))
    : null
  const toParent = (point: ComposePosition): ComposePosition => {
    const next = inverse ? applyMatrix(inverse, point) : point
    return { x: next.x, y: next.y }
  }

  const world = worldCurve(context, target)
  if (!world) return null
  const split = splitComposeCurveAt(world, { x: anchor.point.x, y: anchor.point.y })
  if (!split) return null

  const junction = createJunctionCommand(
    context,
    wireInk(target),
    toParent({ x: anchor.point.x, y: anchor.point.y }),
    parentId,
  )
  if (!junction) return null
  const binding: ComposeWireBinding = {
    entityId: junction.entityId,
    portId: COMPOSE_JUNCTION_PORT_ID,
  }
  const wire = getComposeWire(target)

  if (split.kind === 'at-end') {
    /*
     * 落在首尾顶点上：只改绑，**几何一个字节不动**。走 `entity.component.update` 而不是
     * `entity.curve.set`——后者会把几何做一次世界→局部的来回换算再量化，把线挪动一个百分位，
     * 而用户这一步根本没有碰它的形状。
     */
    return {
      binding,
      junction: junction.command,
      edits: [
        {
          id: context.idFactory(),
          type: BUILTIN_COMMAND_TYPES.updateComponent,
          payload: {
            entityId: target.id,
            key: COMPOSE_BUILTIN_COMPONENT_KEYS.wire,
            value: rebind(wire, split.end, binding) as unknown as JsonValue,
          },
          meta: { source: 'stage', targetIds: [target.id] },
        },
      ],
    }
  }

  // 断开：第一段留在原 Entity 上（id 不变，选中与撤销都还认得它），第二段是一个新 Entity。
  const first = toParentCurve(split.first, toParent)
  const second = normalizeComposeCurveGeometry(toParentCurve(split.second, toParent))
  const secondId = context.idFactory()
  const secondLayoutItem = target.components.LayoutItem as Record<string, unknown>
  const secondEntity: ComposeEntity = {
    ...target,
    id: secondId,
    components: {
      ...target.components,
      Curve: second.curve as unknown as JsonObject,
      Wire: rebind(wire, 'start', binding) as unknown as JsonObject,
      LayoutItem: {
        ...secondLayoutItem,
        offset: second.offset,
        width: { ...(secondLayoutItem.width as object), value: second.size.width },
        height: { ...(secondLayoutItem.height as object), value: second.size.height },
      },
    },
  }
  return {
    binding,
    junction: junction.command,
    edits: [
      {
        id: context.idFactory(),
        type: BUILTIN_COMMAND_TYPES.setCurve,
        payload: {
          entityId: target.id,
          curve: first as unknown as JsonValue,
          wire: rebind(wire, 'end', binding) as unknown as JsonValue,
        },
        meta: { source: 'stage', targetIds: [target.id] },
      },
      {
        id: context.idFactory(),
        type: BUILTIN_COMMAND_TYPES.createEntity,
        payload: {
          entity: secondEntity as unknown as JsonValue,
          parentId,
        },
        meta: { label: secondEntity.name, source: 'stage', targetIds: [secondId] },
      },
    ],
  }
}

/**
 * 把一次接线的全部命令收成一条原子事务。
 *
 * @remarks
 * 一次接线可能同时接两端（一条线的两端各落在一条既有导线上），因此收口在这里而不是在
 * {@link planStageWireTap} 里：撤销一步 MUST 回到接入之前，而不是回到「接了一半」。
 *
 * 只有一条命令时直接交出去，不套一层 batch——历史里多一层空壳会让操作日志读不出发生了什么。
 *
 * @internal
 */
export function batchStageCommands(
  idFactory: () => string,
  commands: readonly EditorCommand[],
  label: string,
  meta?: EditorCommandMeta,
): EditorCommand | null {
  if (commands.length === 0) return null
  if (commands.length === 1) return commands[0]!
  return createComposeBatchCommand({
    id: idFactory(),
    commands,
    meta: meta ?? { label, source: 'stage' },
  })
}
