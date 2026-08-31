import { describe, expect, it } from 'vitest'
import { BUILTIN_COMMAND_TYPES, type ComposeDocument, type ComposeEntity } from '@compose-ui/core'
import { createStageDeleteEntitiesCommand, planStageJunctionCleanup } from './junction-cleanup'

/** 节点的身份是 `Composition.presetId`；引擎不认识它，因此这条谓词由宿主注入。 */
const isJunction = (entity: ComposeEntity) =>
  (entity.components.Composition as { presetId?: string } | undefined)?.presetId === 'junction'

function wire(id: string, ends: Record<string, { entityId: string; portId: string }>): ComposeEntity {
  return {
    id,
    name: id,
    components: {
      Composition: { presetId: 'wire', baseComponentKeys: [], capabilityIds: [] },
      Wire: ends,
    },
  } as unknown as ComposeEntity
}

function junction(id: string): ComposeEntity {
  return {
    id,
    name: id,
    components: { Composition: { presetId: 'junction', baseComponentKeys: [], capabilityIds: [] } },
  } as unknown as ComposeEntity
}

function documentWith(entities: readonly ComposeEntity[]): ComposeDocument {
  return {
    schemaVersion: 7,
    rootIds: [],
    entities: Object.fromEntries(entities.map((item) => [item.id, item])),
  } as unknown as ComposeDocument
}

const NODE = { entityId: 'j', portId: 'p' }

/** 三条支路都接在同一个节点上。 */
const three = documentWith([
  junction('j'),
  wire('a', { end: NODE }),
  wire('b', { start: NODE }),
  wire('c', { start: NODE, end: { entityId: 'device', portId: 'L1' } }),
])

let serial = 0
const idFactory = () => `id-${++serial}`

describe('planStageJunctionCleanup', () => {
  it('OpenSpec: stage-engine / 节点在支路不足时自删 / 删到只剩一条支路时节点消失', () => {
    const commands = planStageJunctionCleanup(three, ['a', 'b'], { idFactory, isJunction })

    // 剩下的那条支路必须**同时**解绑：只删节点会留下一个我们自己制造的失效绑定。
    expect(commands.map(({ type }) => type)).toEqual([
      BUILTIN_COMMAND_TYPES.updateComponent,
      BUILTIN_COMMAND_TYPES.deleteEntity,
    ])
    expect(commands[0]!.payload).toMatchObject({
      entityId: 'c',
      value: { end: { entityId: 'device', portId: 'L1' } },
    })
    expect(commands[1]!.payload).toEqual({ entityIds: ['j'] })
  })

  it('OpenSpec: stage-engine / 节点在支路不足时自删 / 两条支路时节点还在', () => {
    // 这是对 KiCad「只连接两个东西时不画点」的有意偏离：节点是真实对象，
    // 存在但不画的对象点得中却看不见。
    expect(planStageJunctionCleanup(three, ['a'], { idFactory, isJunction })).toEqual([])
  })

  it('剩下那条支路没有别的绑定时整个 Wire 一起去掉', () => {
    const two = documentWith([junction('j'), wire('a', { end: NODE }), wire('b', { start: NODE })])

    const commands = planStageJunctionCleanup(two, ['a'], { idFactory, isJunction })

    // 空 `Wire` 是读不出意图的空壳，与新建时「两端都没绑就不写 Wire」同一条判断。
    expect(commands[0]).toMatchObject({
      type: BUILTIN_COMMAND_TYPES.removeComponent,
      payload: { entityId: 'b', key: 'Wire' },
    })
  })

  it('节点自己被删掉时不再重复收拾它', () => {
    const commands = planStageJunctionCleanup(three, ['j'], { idFactory, isJunction })
    expect(commands).toEqual([])
  })
})

describe('createStageDeleteEntitiesCommand', () => {
  it('OpenSpec: stage-engine / 节点在支路不足时自删 / 自删与造成它的那一步同一次撤销', () => {
    const command = createStageDeleteEntitiesCommand(three, ['a', 'b'], { idFactory, isJunction })

    expect(command!.type).toBe(BUILTIN_COMMAND_TYPES.batch)
    const commands = (command!.payload as unknown as { commands: readonly { type: string }[] }).commands
    expect(commands.map(({ type }) => type)).toEqual([
      BUILTIN_COMMAND_TYPES.deleteEntity,
      BUILTIN_COMMAND_TYPES.updateComponent,
      BUILTIN_COMMAND_TYPES.deleteEntity,
    ])
  })

  it('没有节点要收拾时交出的就是那条删除命令', () => {
    // 多套一层 batch 会让操作日志读不出发生了什么。
    const command = createStageDeleteEntitiesCommand(three, ['a'], { idFactory, isJunction })
    expect(command!.type).toBe(BUILTIN_COMMAND_TYPES.deleteEntity)
  })

  it('宿主没有注入谓词时删除行为一个字节不变', () => {
    const command = createStageDeleteEntitiesCommand(three, ['a', 'b'], { idFactory })
    expect(command!.type).toBe(BUILTIN_COMMAND_TYPES.deleteEntity)
  })
})
