import { describe, expect, it } from 'vitest'
import { BUILTIN_COMMAND_TYPES, type ComposeDocument, type ComposeEntity } from '@compose-ui/core'
import { planStageWireMerge } from './wire-merge'

/**
 * 一条导线。
 *
 * @param vertices - parent 局部坐标下的顶点；盒按它的紧包围盒给出，与 `entity.curve.set`
 * 落地之后的形状一致。
 */
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
      // `Lock` 在 v7 里是必备 chrome，读取方按它一定在写；夹具少了它读出来是 undefined。
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
      ...(Object.keys(ends).length > 0 ? { Wire: ends } : {}),
    },
  } as unknown as ComposeEntity
}

function frame(id: string, childIds: readonly string[]): ComposeEntity {
  return {
    id,
    name: id,
    components: { Hierarchy: { childIds: [...childIds] } },
  } as unknown as ComposeEntity
}

function documentWith(entities: readonly ComposeEntity[]): ComposeDocument {
  return {
    schemaVersion: 7,
    rootIds: ['f'],
    entities: Object.fromEntries(entities.map((item) => [item.id, item])),
  } as unknown as ComposeDocument
}

let serial = 0
const idFactory = () => `id-${++serial}`
const plan = (document: ComposeDocument, a: { entityId: string; end: 'start' | 'end' }, b: typeof a) =>
  planStageWireMerge(document, [a, b], { idFactory })

/** 取一条 `entity.curve.set` 写下的顶点。 */
function verticesOf(command: { payload: unknown }): readonly { x: number; y: number }[] {
  return (command.payload as { curve: { vertices: { x: number; y: number }[] } }).curve.vertices
}

const A_PORT = { entityId: 'device-a', portId: 'L1' }
const B_PORT = { entityId: 'device-b', portId: 'L2' }

describe('planStageWireMerge', () => {
  it('OpenSpec: stage-engine / 两条导线合并成一条 / 两条合成一条，两端的绑定都在', () => {
    const document = documentWith([
      frame('f', ['ab', 'bc']),
      wire('ab', [[0, 0], [100, 0]], { start: A_PORT, end: { entityId: 'j', portId: 'p' } }),
      wire('bc', [[100, 0], [100, 80]], { start: { entityId: 'j', portId: 'p' }, end: B_PORT }),
    ])

    const result = plan(document, { entityId: 'ab', end: 'end' }, { entityId: 'bc', end: 'start' })

    expect(result).not.toBeNull()
    expect(result!.keptId).toBe('ab')
    expect(result!.removedId).toBe('bc')
    expect(result!.commands.map(({ type }) => type)).toEqual([
      BUILTIN_COMMAND_TYPES.setCurve,
      BUILTIN_COMMAND_TYPES.deleteEntity,
    ])
    expect(result!.commands[0]!.payload).toMatchObject({
      entityId: 'ab',
      wire: { start: A_PORT, end: B_PORT },
    })
    expect(result!.commands[1]!.payload).toEqual({ entityIds: ['bc'] })
  })

  it('OpenSpec: stage-engine / 两条导线合并成一条 / 相接点留下来', () => {
    const document = documentWith([
      frame('f', ['ab', 'bc']),
      wire('ab', [[0, 0], [100, 0]]),
      wire('bc', [[100, 0], [200, 0]]),
    ])

    const result = plan(document, { entityId: 'ab', end: 'end' }, { entityId: 'bc', end: 'start' })

    // 两侧共线，但相接点仍然留着：一次画出的 A→B→C 就是三个顶点，而让两种画法产出
    // 逐字相同的文档正是这条规则的全部目的。
    expect(verticesOf(result!.commands[0]!)).toEqual([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 },
    ])
  })

  it('OpenSpec: stage-engine / 两条导线合并成一条 / 顶点序按需反转', () => {
    const document = documentWith([
      frame('f', ['ab', 'cb']),
      // 两条的**末**顶点都是相接点：被并掉的那条要反转才接得上。
      wire('ab', [[0, 0], [100, 0]], { start: A_PORT }),
      wire('cb', [[200, 0], [100, 0]], { start: B_PORT }),
    ])

    const result = plan(document, { entityId: 'ab', end: 'end' }, { entityId: 'cb', end: 'end' })

    expect(verticesOf(result!.commands[0]!)).toEqual([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 },
    ])
    expect(result!.commands[0]!.payload).toMatchObject({ wire: { start: A_PORT, end: B_PORT } })
  })

  it('保留下来的是场景树里更靠前的那一条', () => {
    const document = documentWith([
      frame('f', ['bc', 'ab']),
      wire('ab', [[0, 0], [100, 0]]),
      wire('bc', [[100, 0], [200, 0]]),
    ])

    const result = plan(document, { entityId: 'ab', end: 'end' }, { entityId: 'bc', end: 'start' })

    // 「并进图上先有的那一条」：取顶点数多的那条会要求用户在脑子里比一个他看不见的量。
    expect(result!.keptId).toBe('bc')
    expect(result!.removedId).toBe('ab')
  })

  it('OpenSpec: stage-engine / 两条导线合并成一条 / 同一条导线的两端不合并', () => {
    const document = documentWith([
      frame('f', ['loop']),
      wire('loop', [[0, 0], [100, 0]], {
        start: { entityId: 'j', portId: 'p' },
        end: { entityId: 'j', portId: 'p' },
      }),
    ])

    // 合并会把它接成一个环。
    expect(plan(document, { entityId: 'loop', end: 'start' }, { entityId: 'loop', end: 'end' }))
      .toBeNull()
  })

  it('跨父级不合并', () => {
    const document = documentWith([
      frame('f', ['ab', 'g']),
      frame('g', ['bc']),
      wire('ab', [[0, 0], [100, 0]]),
      wire('bc', [[100, 0], [200, 0]]),
    ])

    // 导线与它绑定的实体必须同父级，合并会把远端绑定带到另一个父级下。
    expect(plan(document, { entityId: 'ab', end: 'end' }, { entityId: 'bc', end: 'start' }))
      .toBeNull()
  })

  it('锁定的导线不合并', () => {
    const locked = wire('bc', [[100, 0], [200, 0]])
    const document = documentWith([
      frame('f', ['ab', 'bc']),
      wire('ab', [[0, 0], [100, 0]]),
      { ...locked, components: { ...locked.components, Lock: { locked: true } } } as ComposeEntity,
    ])

    expect(plan(document, { entityId: 'ab', end: 'end' }, { entityId: 'bc', end: 'start' }))
      .toBeNull()
  })

  it('原来就带 Wire、合并后两端都自由时把它去掉', () => {
    const document = documentWith([
      frame('f', ['ab', 'bc']),
      wire('ab', [[0, 0], [100, 0]], { end: { entityId: 'j', portId: 'p' } }),
      wire('bc', [[100, 0], [200, 0]], { start: { entityId: 'j', portId: 'p' } }),
    ])

    const result = plan(document, { entityId: 'ab', end: 'end' }, { entityId: 'bc', end: 'start' })

    expect(result!.commands[0]!.payload).toMatchObject({ wire: null })
  })

  it('两端都不绑、原来也没有 Wire 时不写这个字段', () => {
    const document = documentWith([
      frame('f', ['ab', 'bc']),
      wire('ab', [[0, 0], [100, 0]]),
      wire('bc', [[100, 0], [200, 0]]),
    ])

    const result = plan(document, { entityId: 'ab', end: 'end' }, { entityId: 'bc', end: 'start' })

    /*
     * 空 `Wire` 是读不出意图的空壳，与「两端都解除后整个 Wire 删掉」同一条判断。但这两条线
     * 本来就没有 `Wire`，因此**不写这个字段**——去掉一个不存在的 Component 会让整条批次被拒，
     * 症状是整次合并静默地什么都没发生。
     */
    expect(result!.commands[0]!.payload).not.toHaveProperty('wire')
  })
})
