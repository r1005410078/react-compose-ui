import { describe, expect, it } from 'vitest'
import { BUILTIN_COMMAND_TYPES, type ComposeDocument, type ComposeEntity } from '@compose-ui/core'
import { createStageDeleteEntitiesCommand, planStageJunctionCleanup } from './junction-cleanup'

/** 节点的身份是 `Composition.presetId`；引擎不认识它，因此这条谓词由宿主注入。 */
const isJunction = (entity: ComposeEntity) =>
  (entity.components.Composition as { presetId?: string } | undefined)?.presetId === 'junction'

/**
 * 一条导线。
 *
 * @param vertices - parent 局部坐标下的顶点。两支路那一档要真的合并，因此夹具必须带上
 * 几何——没有 `Curve` 的假导线会静默走进「不能合并」那一支，用例照样绿。
 */
function wire(
  id: string,
  ends: Record<string, { entityId: string; portId: string }>,
  vertices: readonly (readonly [number, number])[] = [[0, 0], [100, 0]],
): ComposeEntity {
  const xs = vertices.map(([x]) => x)
  const ys = vertices.map(([, y]) => y)
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  return {
    id,
    name: id,
    components: {
      Composition: { presetId: 'wire', baseComponentKeys: [], capabilityIds: [] },
      Lock: { locked: false },
      Curve: {
        kind: 'polyline',
        closed: false,
        vertices: vertices.map(([x, y]) => ({ x: x - left, y: y - top })),
      },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: left, y: top },
        width: { mode: 'fixed', value: Math.max(...xs) - left },
        height: { mode: 'fixed', value: Math.max(...ys) - top },
      },
      Wire: ends,
    },
  } as unknown as ComposeEntity
}

function junction(id: string): ComposeEntity {
  return {
    id,
    name: id,
    components: {
      Composition: { presetId: 'junction', baseComponentKeys: [], capabilityIds: [] },
      Lock: { locked: false },
    },
  } as unknown as ComposeEntity
}

/** 全部 Entity 都挂在同一块场景下：合并要求两条支路同父级。 */
function documentWith(entities: readonly ComposeEntity[]): ComposeDocument {
  const frame = {
    id: 'f',
    name: 'f',
    components: {
      Hierarchy: { childIds: entities.map(({ id }) => id) },
      Lock: { locked: false },
    },
  } as unknown as ComposeEntity
  return {
    schemaVersion: 7,
    rootIds: ['f'],
    entities: Object.fromEntries([frame, ...entities].map((item) => [item.id, item])),
  } as unknown as ComposeDocument
}

const NODE = { entityId: 'j', portId: 'p' }

/** 三条支路都接在同一个节点上。 */
const three = documentWith([
  junction('j'),
  wire('a', { end: NODE }, [[0, 0], [100, 0]]),
  wire('b', { start: NODE }, [[100, 0], [200, 0]]),
  wire('c', { start: NODE, end: { entityId: 'device', portId: 'L1' } }, [[100, 0], [100, 90]]),
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

  it('OpenSpec: stage-engine / 节点在支路不足时自删 / 降到两条支路时两条合回一条', () => {
    const commands = planStageJunctionCleanup(three, ['c'], { idFactory, isJunction })

    // 两条线在一点相接、那一点上再没有第三样东西时，它们在电气上就是一条线。
    expect(commands.map(({ type }) => type)).toEqual([
      BUILTIN_COMMAND_TYPES.setCurve,
      BUILTIN_COMMAND_TYPES.deleteEntity,
      BUILTIN_COMMAND_TYPES.deleteEntity,
    ])
    expect(commands[0]!.payload).toMatchObject({ entityId: 'a' })
    expect((commands[0]!.payload as unknown as {
      curve: { vertices: readonly { x: number; y: number }[] }
    }).curve.vertices).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }])
    expect(commands[1]!.payload).toEqual({ entityIds: ['b'] })
    // 节点一并删掉：合并之后那一点上已经没有东西可连。
    expect(commands[2]!.payload).toEqual({ entityIds: ['j'] })
  })

  it('OpenSpec: stage-engine / 节点在支路不足时自删 / 同一条导线的两端接在同一个节点上时不合并', () => {
    const loop = documentWith([
      junction('j'),
      wire('loop', { start: NODE, end: NODE }),
      wire('c', { start: NODE }, [[100, 0], [100, 90]]),
    ])

    // 合并会把它接成一个环，因此这一档保留节点并照常画点。
    expect(planStageJunctionCleanup(loop, ['c'], { idFactory, isJunction })).toEqual([])
  })

  it('合不成一条时保留节点', () => {
    // 两条支路缺几何（不是合法的导线几何）：不合并，也不留下半途的命令。
    const broken = {
      ...three,
      entities: {
        ...three.entities,
        b: {
          ...three.entities.b!,
          components: { ...three.entities.b!.components, Curve: undefined },
        },
      },
    } as unknown as ComposeDocument

    expect(planStageJunctionCleanup(broken, ['c'], { idFactory, isJunction })).toEqual([])
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

  it('OpenSpec: stage-engine / 节点在支路不足时自删 / 撤销一次搭接式删除回到搭接之前', () => {
    // 删掉搭上去的那条，被断开的两半合回一条、节点消失——一步撤销因此回到搭接之前。
    const command = createStageDeleteEntitiesCommand(three, ['c'], { idFactory, isJunction })

    expect(command!.type).toBe(BUILTIN_COMMAND_TYPES.batch)
    const commands = (command!.payload as unknown as { commands: readonly { type: string }[] }).commands
    expect(commands.map(({ type }) => type)).toEqual([
      BUILTIN_COMMAND_TYPES.deleteEntity,
      BUILTIN_COMMAND_TYPES.setCurve,
      BUILTIN_COMMAND_TYPES.deleteEntity,
      BUILTIN_COMMAND_TYPES.deleteEntity,
    ])
  })

  it('宿主没有注入谓词时删除行为一个字节不变', () => {
    const command = createStageDeleteEntitiesCommand(three, ['a', 'b'], { idFactory })
    expect(command!.type).toBe(BUILTIN_COMMAND_TYPES.deleteEntity)
  })
})
