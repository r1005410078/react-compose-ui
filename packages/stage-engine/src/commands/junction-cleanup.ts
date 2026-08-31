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
): Map<string, JunctionBranch[]> {
  const branches = new Map<string, JunctionBranch[]>()
  for (const entity of Object.values(document.entities)) {
    if (removed.has(entity.id)) continue
    const wire = getComposeWire(entity)
    if (!wire) continue
    for (const end of ['start', 'end'] as const) {
      const binding = wire[end]
      if (!binding || removed.has(binding.entityId)) continue
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
 * 删掉支路不足的节点，并把剩下那条支路的该端解绑。
 *
 * @remarks
 * **支路降到 1 时节点自删**：一个只连着一条线的节点已经不表达任何连接，留着它等于在图上放一个
 * 含义为空的实心点。支路为 2 时**保留并照常画点**——这是对 KiCad「只连接两个东西时不画点」的
 * 有意偏离，理由是我们的节点是一个真实的对象：一个存在但不画的对象点得中却看不见，而这块画布
 * 已经为「看不见却接管指针」付过一次代价。
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
  options: { readonly idFactory: () => string; readonly isJunction: StageJunctionPredicate },
): readonly EditorCommand[] {
  const removed = new Set(removedIds)
  const branches = branchesByJunction(document, options.isJunction, removed)
  const commands: EditorCommand[] = []
  for (const [junctionId, remaining] of branches) {
    if (removed.has(junctionId) || remaining.length > 1) continue
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
