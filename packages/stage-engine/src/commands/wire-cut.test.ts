import { describe, expect, it } from 'vitest'
import { BUILTIN_COMMAND_TYPES, type ComposeDocument, type ComposeEntity } from '@compose-ui/core'
import { planStageWireCut } from './wire-cut'

function wire(
  id: string,
  vertices: readonly (readonly [number, number])[],
  ends: Record<string, { entityId: string; portId: string }> = {},
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
      Renderer: { type: 'curve', props: { stroke: '#ff3b30', strokeWidth: 2 } },
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
      ...(Object.keys(ends).length > 0 ? { Wire: ends } : {}),
    },
  } as unknown as ComposeEntity
}

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

let serial = 0
const idFactory = () => `id-${++serial}`
const isWire = (entity: ComposeEntity) =>
  (entity.components.Composition as { presetId?: string } | undefined)?.presetId === 'wire'
const options = { idFactory, isWire }

const A_PORT = { entityId: 'device-a', portId: 'L1' }
const B_PORT = { entityId: 'device-b', portId: 'L2' }

/** 一条四顶点导线：横 100、下 90、再横 100，共三段，中间那一段是竖的。 */
const four = documentWith([
  wire('w', [[0, 0], [100, 0], [100, 90], [200, 90]], { start: A_PORT, end: B_PORT }),
])

function created(commands: readonly { type: string; payload: unknown }[]): ComposeEntity {
  const create = commands.find(({ type }) => type === BUILTIN_COMMAND_TYPES.createEntity)
  return (create!.payload as { entity: ComposeEntity }).entity
}

describe('planStageWireCut', () => {
  it('OpenSpec: stage-engine / 剪断导线的一段 / 中间段剪断成两条', () => {
    const result = planStageWireCut(four, 'w', 1, options)

    expect(result).not.toBeNull()
    expect(result!.commands.map(({ type }) => type)).toEqual([
      BUILTIN_COMMAND_TYPES.setCurve,
      BUILTIN_COMMAND_TYPES.createEntity,
    ])
    // 左半留在原 Entity 上：id 不变，选中与撤销都还认得它。
    expect(result!.commands[0]!.payload).toMatchObject({
      entityId: 'w',
      curve: { vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
      wire: { start: A_PORT },
    })
    const right = created(result!.commands)
    expect(right.components.Curve).toMatchObject({
      vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    })
    expect(right.components.LayoutItem).toMatchObject({ offset: { x: 100, y: 90 } })
    expect(right.components.Wire).toEqual({ end: B_PORT })
  })

  it('OpenSpec: stage-engine / 剪断导线的一段 / 剪口留下看得见的缺口', () => {
    const result = planStageWireCut(four, 'w', 1, options)

    // 在一点上断开产出的是两个**重合**的自由端，屏幕上与没剪之前逐像素相同。
    const rightOffset = (created(result!.commands).components.LayoutItem as {
      offset: { x: number; y: number }
    }).offset
    expect(rightOffset).toEqual({ x: 100, y: 90 })
    // 左半止于 (100, 0)，右半起于 (100, 90)：中间那一整段没了。
  })

  it('两半继承原来那条的呈现', () => {
    const right = created(planStageWireCut(four, 'w', 1, options)!.commands)
    expect(right.components.Renderer).toEqual(four.entities.w!.components.Renderer)
    expect(right.components.Composition).toEqual(four.entities.w!.components.Composition)
  })

  it('OpenSpec: stage-engine / 剪断导线的一段 / 端段拒绝', () => {
    const three = documentWith([wire('w', [[0, 0], [100, 0], [100, 90]])])

    // 端段去掉就是把外侧那个端点删掉，而那已经有入口（点亮外侧的端点方块按 Delete）。
    expect(planStageWireCut(three, 'w', 0, options)).toBeNull()
    expect(planStageWireCut(three, 'w', 1, options)).toBeNull()
  })

  it('OpenSpec: stage-engine / 剪断导线的一段 / 只有一段的导线拒绝', () => {
    const two = documentWith([wire('w', [[0, 0], [100, 0]])])
    expect(planStageWireCut(two, 'w', 0, options)).toBeNull()
  })

  it('OpenSpec: stage-engine / 剪断导线的一段 / 普通曲线不受理', () => {
    const plain = documentWith([wire('w', [[0, 0], [100, 0], [100, 90], [200, 90]])])
    const curve = {
      ...plain.entities.w!,
      components: {
        ...plain.entities.w!.components,
        Composition: { presetId: 'rect', baseComponentKeys: [], capabilityIds: [] },
      },
    } as ComposeEntity

    expect(planStageWireCut(
      { ...plain, entities: { ...plain.entities, w: curve } } as ComposeDocument,
      'w',
      1,
      options,
    )).toBeNull()
  })

  it('锁定的导线不剪断', () => {
    const locked = {
      ...four.entities.w!,
      components: { ...four.entities.w!.components, Lock: { locked: true } },
    } as ComposeEntity

    expect(planStageWireCut(
      { ...four, entities: { ...four.entities, w: locked } } as ComposeDocument,
      'w',
      1,
      options,
    )).toBeNull()
  })
})
