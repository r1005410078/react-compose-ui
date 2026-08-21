import type { CommandHandler, ComposeEntity } from '@compose-ui/core'
import type { CadDocument } from '../document'

/** CAD 文档命令的稳定 type。 @public */
export const CAD_COMMAND_TYPES = {
  addEntity: 'cad.entity.add',
  removeEntity: 'cad.entity.remove',
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
  return [addEntity, removeEntity]
}
