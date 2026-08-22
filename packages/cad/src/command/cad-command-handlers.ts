import type { CommandHandler, ComposeEntity } from '@compose-ui/core'
import { applyCadStrokePatch, type CadStrokePatch } from '../appearance'
import { inverseCadBlockPoint } from '../block'
import { collectCadInstancePorts, resolveCadWireEndpoint } from '../connection'
import { translateCadEntity } from '../transform'
import {
  CAD_COMPONENT_KEYS,
  createCadWireEntity,
  getCadInsert,
  getCadLine,
  getCadPlacement,
  getCadStroke,
  getCadWire,
  type CadDocument,
  type CadPoint,
  type CadPort,
  type CadWireEndpoint,
} from '../document'

/** CAD 文档命令的稳定 type。 @public */
export const CAD_COMMAND_TYPES = {
  addEntity: 'cad.entity.add',
  removeEntity: 'cad.entity.remove',
  createBlock: 'cad.block.create',
  addBlockPort: 'cad.block.add-port',
  addWire: 'cad.wire.add',
  setStroke: 'cad.entity.stroke.set',
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
        ...freezeWirePatches(document, entityId),
        { op: 'remove', path: ['rootIds', index] },
        { op: 'remove', path: ['entities', entityId] },
      ],
    }
  },
}

/**
 * 把绑定到即将被删 Entity 的导线端点冻结成自由端点。
 *
 * @remarks
 * 三个选项里只有这一个站得住：连带删除会让用户没选中的东西消失；留下悬空引用会被文档校验
 * 整批打回，删除动作直接失败。冻结用的是删除前最后一次解算的世界坐标，因此**图上什么都没
 * 变**——设备没了，线还在原处、末端悬空，撤销一步完全恢复。
 *
 * 保持文档合法本来就是删除 handler 的职责，与 `rootIds`/`entities` 必须同批写入是同一条理由。
 */
function freezeWirePatches(document: CadDocument, removedId: string) {
  const patches: { op: 'set'; path: (string | number)[]; value: never }[] = []
  for (const [id, entity] of Object.entries(document.entities)) {
    if (id === removedId) continue
    const wire = getCadWire(entity)
    if (!wire) continue
    const affected = (['start', 'end'] as const)
      .some((side) => wire[side].kind === 'port' && wire[side].entityId === removedId)
    if (!affected) continue
    const freeze = (endpoint: CadWireEndpoint): CadWireEndpoint => {
      if (endpoint.kind === 'free' || endpoint.entityId !== removedId) return endpoint
      const point = resolveCadWireEndpoint(document, endpoint)
      // 解不出来只可能是文档已经不合法；退到原点会把线甩到图纸另一头，保留引用则删除会被
      // 校验打回——两害相权，冻在零点仍然可见可选，用户能自己收拾。
      return { kind: 'free', point: point ?? { x: 0, y: 0 } }
    }
    patches.push({
      op: 'set',
      path: ['entities', id],
      value: {
        ...entity,
        components: {
          ...entity.components,
          [CAD_COMPONENT_KEYS.wire]: { start: freeze(wire.start), end: freeze(wire.end) },
        },
      } as never,
    })
  }
  return patches
}

/** `cad.wire.add` 的载荷。 @public */
export interface CadAddWirePayload {
  /** 新导线的 Entity id。 */
  readonly id: string
  readonly layerId: string
  /** 已经过点求解管线的两个世界坐标落点。 */
  readonly start: CadPoint
  readonly end: CadPoint
}

/**
 * 落点与端口视为同一点的容差。
 *
 * @remarks
 * 落点是**捕捉管线吐出来的**：端口捕捉命中时 `resolveCadPoint` 直接短路返回捕捉点，而端口
 * 世界坐标由同一段代码、同一批输入算出，逐位相同。容差只吸收将来可能插入的中间运算，
 * MUST NOT 用来表达「靠近就算」——那是捕捉的语义，不该有第二处实现。
 */
const PORT_BIND_EPSILON = 1e-9

function bindEndpoint(document: CadDocument, point: CadPoint): CadWireEndpoint {
  for (const port of collectCadInstancePorts(document)) {
    if (Math.abs(port.point.x - point.x) <= PORT_BIND_EPSILON
      && Math.abs(port.point.y - point.y) <= PORT_BIND_EPSILON) {
      return { kind: 'port', entityId: port.entityId, portId: port.portId }
    }
  }
  return { kind: 'free', point: { x: point.x, y: point.y } }
}

/**
 * 画一条导线。
 *
 * @remarks
 * **绑定在这里做而不是在会话里做**：会话是不认识文档的纯状态机，而 handler 是纯函数——同一份
 * 文档加同一条命令必然产出同一批绑定，撤销后重做不会绑到别处。
 */
const addWire: CommandHandler<CadDocument> = {
  type: CAD_COMMAND_TYPES.addWire,
  execute(document, command) {
    const { id, layerId, start, end } = command.payload as unknown as CadAddWirePayload
    if (document.entities[id]) {
      return {
        status: 'rejected',
        issues: [{ code: 'cad.duplicate-entity', message: `Entity 已存在：${id}` }],
      }
    }
    const startPoint = bindEndpoint(document, start)
    const endPoint = bindEndpoint(document, end)
    const samePort = startPoint.kind === 'port' && endPoint.kind === 'port'
      && startPoint.entityId === endPoint.entityId && startPoint.portId === endPoint.portId
    if (samePort || (start.x === end.x && start.y === end.y)) {
      return {
        status: 'rejected',
        issues: [{ code: 'cad.degenerate-wire', message: '导线两端不能是同一个点' }],
      }
    }
    const entity = createCadWireEntity(id, { layerId, start: startPoint, end: endPoint })
    return {
      status: 'patches',
      patches: [
        { op: 'set', path: ['entities', id], value: entity as never },
        { op: 'insert', path: ['rootIds'], index: document.rootIds.length, value: id },
      ],
    }
  },
}

/** `cad.block.add-port` 的载荷。 @public */
export interface CadAddBlockPortPayload {
  /** 用来定位块并提供变换的块实例。 */
  readonly entityId: string
  /** 新端口的 id，块内唯一。 */
  readonly portId: string
  /** 世界坐标；由 handler 换算为块局部坐标。 */
  readonly point: CadPoint
}

/**
 * 给块**定义**加一个端口。
 *
 * @remarks
 * 逆变换在这里做——它要读实例的插入参数，而命令会话拿不到文档。加完之后同一个块的全部实例
 * 都有这个端口，这正是端口声明在定义上而不是实例上的意义。
 */
const addBlockPort: CommandHandler<CadDocument> = {
  type: CAD_COMMAND_TYPES.addBlockPort,
  execute(document, command) {
    const { entityId, portId, point } = command.payload as unknown as CadAddBlockPortPayload
    const entity = document.entities[entityId]
    const insert = entity ? getCadInsert(entity) : undefined
    if (!insert) {
      return {
        status: 'rejected',
        issues: [{ code: 'cad.not-instance', message: `不是块实例：${entityId}` }],
      }
    }
    const block = document.blocks[insert.blockId]
    if (!block) {
      return {
        status: 'rejected',
        issues: [{ code: 'cad.unknown-block', message: `块不存在：${insert.blockId}` }],
      }
    }
    if (block.ports.some(({ id }) => id === portId)) {
      return {
        status: 'rejected',
        issues: [{ code: 'cad.duplicate-port', message: `端口已存在：${portId}` }],
      }
    }
    const local = inverseCadBlockPoint(point, insert)
    if (!local) {
      return {
        status: 'rejected',
        issues: [{ code: 'cad.singular-insert', message: '实例比例为 0，无法换算块局部坐标' }],
      }
    }
    const port: CadPort = { id: portId, position: { x: local.x, y: local.y } }
    return {
      status: 'patches',
      patches: [{
        op: 'set',
        path: ['blocks', insert.blockId, 'ports'],
        value: [...block.ports, port] as never,
      }],
    }
  },
}

/** `cad.entity.stroke.set` 的载荷。 @public */
export interface CadSetStrokePayload {
  readonly entityIds: readonly string[]
  /** 每一项：给值即设置，`null` 即清除，缺席即不动。 */
  readonly patch: CadStrokePatch
}

/**
 * 设置或清除若干 Entity 的描边覆盖。
 *
 * @remarks
 * 三项全被清除时**删掉整个 Component**，否则文档会攒下一堆没有任何字段的空壳——它们不影响
 * 呈现，但会让「这个图元有没有被改过外观」再也读不出来。
 */
const setStroke: CommandHandler<CadDocument> = {
  type: CAD_COMMAND_TYPES.setStroke,
  execute(document, command) {
    const { entityIds, patch } = command.payload as unknown as CadSetStrokePayload
    const targets = entityIds.filter((id) => document.entities[id])
    if (targets.length === 0) return { status: 'noop', reason: '没有可修改的 Entity' }
    return {
      status: 'patches',
      patches: targets.map((id) => {
        const entity = document.entities[id]!
        const next = applyCadStrokePatch(getCadStroke(entity), patch)
        const components = { ...entity.components }
        if (next === null) delete components[CAD_COMPONENT_KEYS.stroke]
        else components[CAD_COMPONENT_KEYS.stroke] = next
        return {
          op: 'set' as const,
          path: ['entities', id],
          value: { ...entity, components } as never,
        }
      }),
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
          value: {
            id: blockId,
            name,
            rootIds: members,
            entities: blockEntities,
            ports: [],
          } as never,
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
  return [
    addEntity,
    removeEntity,
    createBlock,
    addBlockPort,
    addWire,
    setStroke,
    translateEntities,
    duplicateEntities,
  ]
}
