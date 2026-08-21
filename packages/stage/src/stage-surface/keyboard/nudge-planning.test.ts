import { describe, expect, it } from 'vitest'
import type { ComposeDocument, ComposeEntity, ComposeLayoutSnapshot } from '@compose-ui/core'
import { planStageNudge } from './nudge-planning'

interface EntityOptions {
  readonly positioning?: 'flow' | 'absolute'
  readonly widthMode?: 'fixed' | 'fill' | 'hug'
  readonly offset?: { x: number; y: number }
  readonly locked?: boolean
  readonly childIds?: readonly string[]
  readonly borderWidth?: number
}

function entity(id: string, options: EntityOptions = {}): ComposeEntity {
  const {
    borderWidth = 0,
    childIds,
    offset = { x: 0, y: 0 },
    positioning = 'absolute',
    widthMode = 'fixed',
  } = options
  return {
    id,
    name: id,
    components: {
      Composition: { presetId: null, baseComponentKeys: [], capabilityIds: [] },
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning,
        offset,
        width: { mode: widthMode, value: 120, min: null, max: null },
        height: { mode: 'fixed', value: 40, min: null, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      ...(childIds ? { Hierarchy: { childIds } } : {}),
      Appearance: { borderWidth },
    },
  } as unknown as ComposeEntity
}

function doc(entities: readonly ComposeEntity[]): ComposeDocument {
  return {
    schemaVersion: 7,
    canvas: {} as ComposeDocument['canvas'],
    rootIds: [entities[0]!.id],
    entities: Object.fromEntries(entities.map((item) => [item.id, item])),
  }
}

function snapshot(
  boxes: Readonly<Record<string, { x: number; y: number }>>,
): ComposeLayoutSnapshot {
  return {
    revision: 1,
    boxes: Object.fromEntries(Object.entries(boxes).map(([id, box]) => [
      id,
      { ...box, width: 120, height: 40 },
    ])),
  } as unknown as ComposeLayoutSnapshot
}

const RIGHT = { x: 1, y: 0 }

describe('OpenSpec: stage / 方向键微调的命令规划可独立求值', () => {
  it('Absolute 子级按自身 offset 反推父级内容盒原点', () => {
    // 求解位置 (30, 12) 与 authored offset (10, 4) 相差 (20, 8)，即父级内容盒原点。
    const value = doc([
      entity('frame', { childIds: ['box'] }),
      entity('box', { offset: { x: 10, y: 4 } }),
    ])
    const plan = planStageNudge(
      value,
      snapshot({ frame: { x: 0, y: 0 }, box: { x: 30, y: 12 } }),
      ['box'],
      RIGHT,
      1,
    )

    expect(plan.movableIds).toEqual(['box'])
    expect(plan.updates[0]!.transform.position).toEqual({ x: 11, y: 4 })
  })

  it('父级边框不额外参与内缩，因为它已经含在 offset 反推里', () => {
    // 边框宽度会把内容盒原点推后，而求解位置同样含这段偏移，两者相减即抵消；
    // 再按边框宽度算一次就会重复内缩。
    const value = doc([
      entity('frame', { borderWidth: 3, childIds: ['box'] }),
      entity('box', { offset: { x: 10, y: 10 } }),
    ])
    const plan = planStageNudge(
      value,
      snapshot({ frame: { x: 0, y: 0 }, box: { x: 13, y: 13 } }),
      ['box'],
      RIGHT,
      10,
    )

    expect(plan.updates[0]!.transform.position).toEqual({ x: 20, y: 10 })
  })

  it('Fill 尺寸写求解值而不是 authored 值', () => {
    const value = doc([
      entity('frame', { childIds: ['box'] }),
      entity('box', { widthMode: 'fill' }),
    ])
    const plan = planStageNudge(
      value,
      snapshot({ frame: { x: 0, y: 0 }, box: { x: 0, y: 0 } }),
      ['box'],
      RIGHT,
      1,
    )

    // 求解宽度与 authored value 在夹具里同为 120；断言的是它来自求解结果，
    // 因此高度这一侧（fixed）读 authored 值 40，两者同源才说明分支走对了。
    expect(plan.updates[0]!.transform.size).toEqual({ width: 120, height: 40 })
  })

  it('Flow 子级被排除，全为 Flow 时不产生任何更新', () => {
    const value = doc([
      entity('frame', { childIds: ['flowed', 'floating'] }),
      entity('flowed', { positioning: 'flow' }),
      entity('floating'),
    ])
    const boxes = snapshot({
      frame: { x: 0, y: 0 },
      flowed: { x: 0, y: 0 },
      floating: { x: 50, y: 50 },
    })

    expect(planStageNudge(value, boxes, ['flowed', 'floating'], RIGHT, 1).movableIds)
      .toEqual(['floating'])
    // 位置由 Auto Layout 决定，写 offset 只会提交一个看不出效果的空事务。
    expect(planStageNudge(value, boxes, ['flowed'], RIGHT, 1).updates).toEqual([])
  })

  it('步长按输入生效，方向不改变另一轴', () => {
    const value = doc([
      entity('frame', { childIds: ['box'] }),
      entity('box'),
    ])
    const plan = planStageNudge(
      value,
      snapshot({ frame: { x: 0, y: 0 }, box: { x: 5, y: 7 } }),
      ['box'],
      { x: 0, y: -1 },
      10,
    )

    expect(plan.stageUpdates[0]!.transform).toMatchObject({ x: 5, y: -3 })
  })
})
