import type { CommandHandler, ComposeEntity } from '@compose-ui/core'
import { translateCadEntity } from '../transform'
import {
  CAD_COMPONENT_KEYS,
  getCadInsert,
  getCadLine,
  getCadPlacement,
  type CadDocument,
  type CadPoint,
} from '../document'

/** CAD 文档命令的稳定 type。 @public */
export const CAD_COMMAND_TYPES = {
  addEntity: 'cad.entity.add',
  removeEntity: 'cad.entity.remove',
  createBlock: 'cad.block.create',
  translateEntities: 'cad.entity.translate',
  duplicateEntities: 'cad.entity.duplicate',
} as const

/** `cad.entity.add` 的载荷。 @public */
export interface CadAddEntityPayload {
  readonly entity: ComposeEntity
}

/** `cad.entity.remove` 的载荷。 @public */
export interface CadRemoveEntityPayload {
  readonly entityId: string
}

const addEntity: CommandHandler<CadDocument> = {
  type: CAD_COMMAND_TYPES.addEntity,
  execute(document, command) {
    const { entity } = command.payload as unknown as CadAddEntityPayload
    if (!entity?.id) {
      return { status: 'rejected', issues: [{ code: 'cad.invalid-entity', message: '缺少 Entity' }] }
    }
    if (document.entities[entity.id]) {
      return {
        status: 'rejected',
        issues: [{ code: 'cad.duplicate-entity', message: `Entity 已存在：${entity.id}` }],
      }
    }
    // entities 与 rootIds 必须同一批写入：只写 entities 会产出孤儿，被文档校验拦下。
    return {
      status: 'patches',
      patches: [
        { op: 'set', path: ['entities', entity.id], value: entity as never },
        { op: 'insert', path: ['rootIds'], index: document.rootIds.length, value: entity.id },
      ],
    }
  },
}

const removeEntity: CommandHandler<CadDocument> = {
  type: CAD_COMMAND_TYPES.removeEntity,
  execute(document, command) {
    const { entityId } = command.payload as unknown as CadRemoveEntityPayload
    const index = document.rootIds.indexOf(entityId)
    if (index === -1 || !document.entities[entityId]) {
      return { status: 'noop', reason: `Entity 不存在：${entityId}` }
    }
    return {
      status: 'patches',
      patches: [
        { op: 'remove', path: ['rootIds', index] },
        { op: 'remove', path: ['entities', entityId] },
      ],
    }
  },
}

/** `cad.entity.translate` 的载荷。 @public */
export interface CadTranslateEntitiesPayload {
  readonly entityIds: readonly string[]
  /** 世界坐标的位移。 */
  readonly delta: CadPoint
}

/** `cad.entity.duplicate` 的载荷。 @public */
export interface CadDuplicateEntitiesPayload {
  readonly entityIds: readonly string[]
  readonly delta: CadPoint
  /** 副本的 Entity id，与 `entityIds` 一一对应。 */
  readonly newIds: readonly string[]
}

/**
 * 平移若干 Entity。
 *
 * @remarks
 * 位移由命令会话求得（它有点求解管线），**平移本身在这里做**——会话是纯状态机，拿不到文档。
 * 这条界线是刻意的：给会话整份文档，规划与求解的界线就消失了。
 */
const translateEntities: CommandHandler<CadDocument> = {
  type: CAD_COMMAND_TYPES.translateEntities,
  execute(document, command) {
    const { entityIds, delta } = command.payload as unknown as CadTranslateEntitiesPayload
    const targets = entityIds.filter((id) => document.entities[id])
    if (targets.length === 0) return { status: 'noop', reason: '没有可平移的 Entity' }
    if (delta.x === 0 && delta.y === 0) return { status: 'noop', reason: '位移为零' }
    return {
      status: 'patches',
      patches: targets.map((id) => ({
        op: 'set' as const,
        path: ['entities', id],
        value: translateCadEntity(document.entities[id]!, delta) as never,
      })),
    }
  },
}

/**
 * 按位移复制若干 Entity。
 *
 * @remarks
 * 副本的 id 由会话给出而不是在这里生成：handler 必须是纯函数，否则同一条命令重放（撤销后
 * 重做）会产出不同的 id，而 Patch 记的是上一次那批。
 */
const duplicateEntities: CommandHandler<CadDocument> = {
  type: CAD_COMMAND_TYPES.duplicateEntities,
  execute(document, command) {
    const { entityIds, delta, newIds } = command.payload as unknown as CadDuplicateEntitiesPayload
    const pairs = entityIds
      .map((id, index) => ({ source: document.entities[id], id: newIds[index] }))
      .filter((pair): pair is { source: ComposeEntity; id: string } =>
        Boolean(pair.source) && Boolean(pair.id) && !document.entities[pair.id!])
    if (pairs.length === 0) return { status: 'noop', reason: '没有可复制的 Entity' }
    return {
      status: 'patches',
      patches: pairs.flatMap(({ source, id }, index) => [
        {
          op: 'set' as const,
          path: ['entities', id],
          value: { ...translateCadEntity(source, delta), id } as never,
        },
        {
          op: 'insert' as const,
          path: ['rootIds'],
          index: document.rootIds.length + index,
          value: id,
        },
      ]),
    }
  },
}

/** `cad.block.create` 的载荷。 @public */
export interface CadCreateBlockPayload {
  readonly blockId: string
  readonly name: string
  /** 块的插入基点（世界坐标）；被选图元按它换算为块局部坐标。 */
  readonly basePoint: CadPoint
  /** 被收进块的顶层 Entity。 */
  readonly entityIds: readonly string[]
  /** 原地替换用的实例 Entity id。 */
  readonly insertId: string
}

const translate = (point: CadPoint, dx: number, dy: number): CadPoint => ({
  x: point.x - dx,
  y: point.y - dy,
})

/**
 * 把选中的图元收成一个块，并原地替换为一个实例。
 *
 * @remarks
 * 建块、删原件、插实例 MUST 在同一批 patch 里：拆成三条命令会让撤销要按三次，而用户做的是
 * 一个动作。这与 LINE 的多段折线是同一条理由。
 */
const createBlock: CommandHandler<CadDocument> = {
  type: CAD_COMMAND_TYPES.createBlock,
  execute(document, command) {
    const { blockId, name, basePoint, entityIds, insertId } =
      command.payload as unknown as CadCreateBlockPayload
    if (document.blocks[blockId]) {
      return {
        status: 'rejected',
        issues: [{ code: 'cad.duplicate-block', message: `块已存在：${blockId}` }],
      }
    }
    if (Object.values(document.blocks).some((block) => block.name === name)) {
      return {
        status: 'rejected',
        issues: [{ code: 'cad.duplicate-block', message: `块名已存在：${name}` }],
      }
    }
    const members = entityIds.filter((id) => document.entities[id])
    if (members.length === 0) {
      return { status: 'noop', reason: '没有可收进块的 Entity' }
    }
    // 嵌套块被文档校验拒绝，因此这里先拦一次——让用户在命令层就得到答案，而不是提交后被
    // 校验器打回一条看不懂的路径。
    if (members.some((id) => getCadInsert(document.entities[id]!))) {
      return {
        status: 'rejected',
        issues: [{ code: 'cad.nested-block', message: '块内不得再插入块' }],
      }
    }

    const blockEntities: Record<string, ComposeEntity> = {}
    for (const id of members) {
      const entity = document.entities[id]!
      const line = getCadLine(entity)
      blockEntities[id] = line
        ? {
            ...entity,
            components: {
              ...entity.components,
              [CAD_COMPONENT_KEYS.line]: {
                start: translate(line.start, basePoint.x, basePoint.y),
                end: translate(line.end, basePoint.x, basePoint.y),
              },
            },
          }
        : entity
    }

    const insert: ComposeEntity = {
      id: insertId,
      name,
      components: {
        [CAD_COMPONENT_KEYS.placement]: {
          ...(getCadPlacement(document.entities[members[0]!]!) ?? { layerId: '0' }),
        },
        [CAD_COMPONENT_KEYS.insert]: {
          blockId,
          position: { x: basePoint.x, y: basePoint.y },
          rotation: 0,
          scale: { x: 1, y: 1 },
        },
      },
    }

    const removed = new Set(members)
    return {
      status: 'patches',
      patches: [
        {
          op: 'set',
          path: ['blocks', blockId],
          value: { id: blockId, name, rootIds: members, entities: blockEntities } as never,
        },
        ...members.map((id) => ({ op: 'remove' as const, path: ['entities', id] })),
        { op: 'set', path: ['entities', insertId], value: insert as never },
        // rootIds 整体替换而不是逐个 remove+insert：逐个删要倒序算下标，写错只在多选时才现形。
        {
          op: 'set',
          path: ['rootIds'],
          value: [...document.rootIds.filter((id) => !removed.has(id)), insertId] as never,
        },
      ],
    }
  },
}

/**
 * CAD 文档的内建命令 handler。
 *
 * @remarks
 * 与 ComposeDocument 的 `entity.*` 完全分离：那套词汇属于另一个文档协议，注入给 CAD 只会得到
 * 一批必然失败的 handler。
 *
 * @public
 */
export function createCadCommandHandlers(): readonly CommandHandler<CadDocument>[] {
  return [addEntity, removeEntity, createBlock, translateEntities, duplicateEntities]
}
