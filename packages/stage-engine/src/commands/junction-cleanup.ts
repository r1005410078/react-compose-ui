import {
  BUILTIN_COMMAND_TYPES,
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  createComposeBatchCommand,
  getComposeWire,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeWire,
  type EditorCommand,
  type JsonValue,
} from '@compose-ui/core'
import { describeEntityTargets } from './transaction-labels'
import { planStageWireMerge } from './wire-merge'

/** 一条接在节点上的支路。 */
interface JunctionBranch {
  readonly entityId: string
  readonly end: 'start' | 'end'
}

/**
 * 判断一个 Entity 是不是接线节点。
 *
 * @remarks
 * **由宿主注入**：节点的身份是 `Composition.presetId`，而引擎不认识 Preset id——与「一个
 * Entity 能不能几何编辑由宿主注入谓词」是同一条既有边界。
 *
 * @public
 */
export type StageJunctionPredicate = (entity: ComposeEntity) => boolean

/** {@link createStageDeleteEntitiesCommand} 的输入。 @public */
export interface StageDeleteEntitiesOptions {
  readonly idFactory: () => string
  /** 缺席时不做节点清理：不认识节点的宿主删除行为一个字节不变。 */
  readonly isJunction?: StageJunctionPredicate
  /** 事务标签；缺席时按目标名生成。 */
  readonly label?: string
  readonly source?: string
}

/** 收集每个节点上还剩哪些支路。 */
function branchesByJunction(
  document: ComposeDocument,
  isJunction: StageJunctionPredicate,
  removed: ReadonlySet<string>,
  dropped: ReadonlySet<string> = new Set(),
): Map<string, JunctionBranch[]> {
  const branches = new Map<string, JunctionBranch[]>()
  for (const entity of Object.values(document.entities)) {
    if (removed.has(entity.id)) continue
    const wire = getComposeWire(entity)
    if (!wire) continue
    for (const end of ['start', 'end'] as const) {
      const binding = wire[end]
      if (!binding || removed.has(binding.entityId)) continue
      if (dropped.has(`${entity.id}:${end}`)) continue
      const target = document.entities[binding.entityId]
      if (!target || !isJunction(target)) continue
      const list = branches.get(binding.entityId)
      if (list) list.push({ entityId: entity.id, end })
      else branches.set(binding.entityId, [{ entityId: entity.id, end }])
    }
  }
  return branches
}

/**
 * 收拾支路不足的节点：降到 1 就删掉它，降到 2 就把那两条支路合并成一条。
 *
 * @remarks
 * **支路降到 1 时节点自删**：一个只连着一条线的节点已经不表达任何连接，留着它等于在图上放一个
 * 含义为空的实心点。
 *
 * **支路降到 2 时合并那两条支路并把节点一并删掉**。两条线在一点相接、而那一点上再没有第三样
 * 东西时，它们在电气上**就是**一条线，而同一张图不该有两种文档形态。这条规则同时收掉两个
 * 现象：把搭上去的那条删掉之后两半合回原来那一条（图形回到搭接之前，那一点作为共线顶点留下），
 * 以及「先画 A→B 再从
 * B 画到 C」——那一下取点落在第一条的末顶点上，按既有规则建出来的正是一个两支路节点，因此它
 * 当场被合并，两种画法产出逐字相同的文档。
 *
 * 这取代了此前「支路为 2 时保留节点并照常画点」那条对 KiCad 的有意偏离。那条的理由是「节点
 * 是一个真实的对象，一个存在但不画的对象点得中却看不见」，而合并把那个对象**一起消掉了**。
 * 合并不成立时（两条支路是同一条导线的两端、两者跨父级、几何不是合法的导线几何）仍然保留
 * 节点并照常画点。
 *
 * 剩下那条支路必须**同时**解绑：只删节点会留下一个指向不存在实体的绑定，它在 Inspector 里显示
 * 为失效，而用户并没有配错任何东西——那是我们自己制造的失效。
 *
 * 节点自己被删掉时不必再清理它：它已经在删除列表里。
 *
 * @returns 需要追加的命令；没有节点需要收拾时为空。
 * @public
 */
export function planStageJunctionCleanup(
  document: ComposeDocument,
  removedIds: readonly string[],
  options: {
    readonly idFactory: () => string
    readonly isJunction: StageJunctionPredicate
    /**
     * 同一次变更里被**去掉的绑定**（Entity 还在，只是那一端不再绑着）。
     *
     * @remarks
     * 修剪掉导线含端口的那一截时，Entity 留下、绑定跟着那一截走；节点因此少了一条支路，
     * 而它不在 `removedIds` 里。不把这一档交进来的症状是「剪掉一条支路之后图上留着一个只连着
     * 两条线的实心点」。
     */
    readonly droppedBindings?: readonly { readonly entityId: string; readonly end: 'start' | 'end' }[]
  },
): readonly EditorCommand[] {
  const removed = new Set(removedIds)
  const dropped = new Set((options.droppedBindings ?? []).map(({ entityId, end }) => `${entityId}:${end}`))
  const branches = branchesByJunction(document, options.isJunction, removed, dropped)
  const commands: EditorCommand[] = []
  for (const [junctionId, remaining] of branches) {
    if (removed.has(junctionId)) continue
    if (remaining.length === 2) {
      const merge = planStageWireMerge(document, [remaining[0]!, remaining[1]!], {
        idFactory: options.idFactory,
      })
      // 合不成一条时保留节点：半条规则产出的形状用户预测不了。
      if (!merge) continue
      commands.push(...merge.commands, {
        id: options.idFactory(),
        type: BUILTIN_COMMAND_TYPES.deleteEntity,
        payload: { entityIds: [junctionId] },
        meta: { source: 'stage', targetIds: [junctionId] },
      })
      continue
    }
    if (remaining.length > 1) continue
    for (const branch of remaining) {
      const entity = document.entities[branch.entityId]
      const wire = getComposeWire(entity)
      if (!wire) continue
      const other = branch.end === 'start' ? 'end' : 'start'
      const kept: ComposeWire = wire[other] ? { [other]: wire[other] } : {}
      commands.push(Object.keys(kept).length === 0
        ? {
            id: options.idFactory(),
            type: BUILTIN_COMMAND_TYPES.removeComponent,
            payload: { entityId: branch.entityId, key: COMPOSE_BUILTIN_COMPONENT_KEYS.wire },
            meta: { source: 'stage', targetIds: [branch.entityId] },
          }
        : {
            id: options.idFactory(),
            type: BUILTIN_COMMAND_TYPES.updateComponent,
            payload: {
              entityId: branch.entityId,
              key: COMPOSE_BUILTIN_COMPONENT_KEYS.wire,
              value: kept as unknown as JsonValue,
            },
            meta: { source: 'stage', targetIds: [branch.entityId] },
          })
    }
    commands.push({
      id: options.idFactory(),
      type: BUILTIN_COMMAND_TYPES.deleteEntity,
      payload: { entityIds: [junctionId] },
      meta: { source: 'stage', targetIds: [junctionId] },
    })
  }
  return commands
}

/**
 * 删除若干 Entity，并在同一个事务里收拾因此失去支路的节点。
 *
 * @remarks
 * 删除有好几个入口（键盘、右键菜单、`ERASE`、命令面板），**清理只有这一份实现**：逐条挂钩子
 * 漏一条的症状是「删掉一条线之后图上留着一个孤零零的点」，而那看起来像渲染缺陷。
 *
 * 没有节点要收拾时交出的就是那条 `entity.delete`，不套 batch——历史里多一层空壳会让操作日志
 * 读不出发生了什么。
 *
 * @returns 没有可删对象时为 `null`。
 * @public
 */
export function createStageDeleteEntitiesCommand(
  document: ComposeDocument,
  entityIds: readonly string[],
  options: StageDeleteEntitiesOptions,
): EditorCommand | null {
  if (entityIds.length === 0) return null
  const label = options.label ?? `Delete ${describeEntityTargets(document, entityIds)}`
  const source = options.source ?? 'stage'
  const remove: EditorCommand = {
    id: options.idFactory(),
    type: BUILTIN_COMMAND_TYPES.deleteEntity,
    payload: { entityIds: [...entityIds] },
    meta: { label, source, targetIds: [...entityIds] },
  }
  const cleanup = options.isJunction
    ? planStageJunctionCleanup(document, entityIds, {
        idFactory: options.idFactory,
        isJunction: options.isJunction,
      })
    : []
  if (cleanup.length === 0) return remove
  return createComposeBatchCommand({
    id: options.idFactory(),
    commands: [remove, ...cleanup],
    meta: { label, source, targetIds: [...entityIds] },
  })
}
