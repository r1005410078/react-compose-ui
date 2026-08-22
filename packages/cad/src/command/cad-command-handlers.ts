import type { CommandHandler, ComposeEntity } from '@compose-ui/core'
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
  return [addEntity, removeEntity, createBlock]
}
