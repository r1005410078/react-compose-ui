import {
  BUILTIN_COMMAND_TYPES,
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  getComposeWire,
  normalizeComposeCurveGeometry,
  type ComposeCurve,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeWire,
  type EditorCommand,
  type JsonObject,
  type JsonValue,
} from '@compose-ui/core'
import { getEntityParentId } from '../geometry/stage-geometry'
import {
  createStageDeleteEntitiesCommand,
  planStageJunctionCleanup,
  type StageJunctionPredicate,
} from './junction-cleanup'

/** {@link planStageCurveReplacement} 的入参。 @public */
export interface StageCurveReplacementOptions {
  readonly idFactory: () => string
  /**
   * 第一条剩下的曲线是不是从原曲线的**起点**出发；最后一条是不是走到原曲线的**终点**。
   *
   * @remarks
   * 只影响导线的绑定怎么继承：起点还在的那一半继承 `start`，终点还在的那一半继承 `end`，
   * 其余各端都是自由端。缺席即两端都不在（例如闭合折线去掉一段）。
   */
  readonly keepStart?: boolean
  readonly keepEnd?: boolean
  /**
   * 判断一个 Entity 是不是接线节点；缺席时不收拾节点。
   *
   * @remarks
   * 剪掉导线含端口那一截时绑定跟着那一截走，节点因此少一条支路——它要在**同一个事务**里被
   * 收拾（降到 1 删掉、降到 2 合并），否则图上留着一个只连着两条线的实心点。
   */
  readonly isJunction?: StageJunctionPredicate
  /** 事务标签；缺席时按 Entity 名。 */
  readonly label?: string
}

/** {@link planStageCurveReplacement} 的结果。 @public */
export interface StageCurveReplacementPlan {
  /** 新建出来的 Entity（第二条及之后的剩余曲线）。 */
  readonly createdIds: readonly string[]
  /** 原 Entity 有没有被整个删掉。 */
  readonly removed: boolean
  readonly commands: readonly EditorCommand[]
}

/** 只保留给定几端的 `Wire`；一端都不剩时为 `null`。 */
function keptWire(
  wire: ComposeWire | undefined,
  keep: { readonly start: boolean; readonly end: boolean },
): ComposeWire | null {
  if (!wire) return null
  const next: Record<string, unknown> = {}
  if (keep.start && wire.start) next.start = wire.start
  if (keep.end && wire.end) next.end = wire.end
  return Object.keys(next).length > 0 ? (next as unknown as ComposeWire) : null
}

/**
 * 用若干条曲线**替换**一个曲线 Entity 的几何。
 *
 * @remarks
 * 这是剪断与修剪共用的落地：第一条留在**原 Entity** 上（id 不变，选中与撤销都还认得它），其余
 * 各建一个新 Entity 并整份复制呈现，一条都不剩时删掉原 Entity。与搭接断线是同一条判断。
 *
 * 导线的绑定按 {@link StageCurveReplacementOptions.keepStart} / `keepEnd` 继承：起点还在的那
 * 一半继承 `start`、终点还在的那一半继承 `end`，被去掉的那一端在同一个事务里交给节点清理。
 *
 * `Wire` 两端都空时整个不写——空 `Wire` 是读不出意图的空壳；它本来就没有时**不写这个字段**：
 * 去掉一个不存在的 Component 会让整条批次被拒（`patch.invalid-path`），而两端都自由正是一张图上
 * 最常见的状态。
 *
 * @param remaining - 剩下的曲线，**parent 局部坐标**，按原曲线的走向排列
 * @public
 */
export function planStageCurveReplacement(
  document: ComposeDocument,
  entityId: string,
  remaining: readonly ComposeCurve[],
  options: StageCurveReplacementOptions,
): StageCurveReplacementPlan | null {
  const entity = document.entities[entityId]
  if (!entity) return null
  const label = options.label ?? entity.name
  const wire = getComposeWire(entity)
  const keepStart = options.keepStart === true
  const keepEnd = options.keepEnd === true

  if (remaining.length === 0) {
    const removal = createStageDeleteEntitiesCommand(document, [entityId], {
      idFactory: options.idFactory,
      ...(options.isJunction ? { isJunction: options.isJunction } : {}),
      label,
    })
    return removal ? { createdIds: [], removed: true, commands: [removal] } : null
  }

  const commands: EditorCommand[] = []
  const createdIds: string[] = []
  const last = remaining.length - 1
  remaining.forEach((curve, position) => {
    const keep = {
      start: position === 0 && keepStart,
      end: position === last && keepEnd,
    }
    const pieceWire = keptWire(wire, keep)
    if (position === 0) {
      commands.push({
        id: options.idFactory(),
        type: BUILTIN_COMMAND_TYPES.setCurve,
        payload: {
          entityId,
          curve: curve as unknown as JsonValue,
          // 本来就没有 `Wire` 时不写这个字段；有而一端都不剩时显式去掉它。
          ...(wire === undefined ? {} : { wire: pieceWire as unknown as JsonValue }),
        },
        meta: { label, source: 'stage', targetIds: [entityId] },
      })
      return
    }
    const normalized = normalizeComposeCurveGeometry(curve)
    const createdId = options.idFactory()
    const item = entity.components[COMPOSE_BUILTIN_COMPONENT_KEYS.layoutItem] as Record<string, unknown>
    const components: Record<string, unknown> = {
      ...entity.components,
      [COMPOSE_BUILTIN_COMPONENT_KEYS.curve]: normalized.curve,
      [COMPOSE_BUILTIN_COMPONENT_KEYS.layoutItem]: {
        ...item,
        offset: normalized.offset,
        width: { ...(item.width as object), value: normalized.size.width },
        height: { ...(item.height as object), value: normalized.size.height },
      },
    }
    if (pieceWire) components[COMPOSE_BUILTIN_COMPONENT_KEYS.wire] = pieceWire
    else delete components[COMPOSE_BUILTIN_COMPONENT_KEYS.wire]
    const created: ComposeEntity = {
      ...entity,
      id: createdId,
      components: components as Record<string, JsonObject>,
    }
    createdIds.push(createdId)
    commands.push({
      id: options.idFactory(),
      type: BUILTIN_COMMAND_TYPES.createEntity,
      payload: { entity: created as unknown as JsonValue, parentId: getEntityParentId(document, entityId) },
      meta: { label: created.name, source: 'stage', targetIds: [createdId] },
    })
  })

  // 被去掉的绑定：那一端的节点少了一条支路，在同一个事务里收拾。
  if (wire && options.isJunction) {
    const dropped = (['start', 'end'] as const)
      .filter((end) => wire[end] && !(end === 'start' ? keepStart : keepEnd))
      .map((end) => ({ entityId, end }))
    if (dropped.length > 0) {
      commands.push(...planStageJunctionCleanup(document, [], {
        idFactory: options.idFactory,
        isJunction: options.isJunction,
        droppedBindings: dropped,
      }))
    }
  }
  return { createdIds, removed: false, commands }
}
