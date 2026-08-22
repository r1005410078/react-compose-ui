import { BUILTIN_COMMAND_TYPES } from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { planStageDraftingEdits } from './drafting-edits'
import { createStageSceneIndex } from '../hit-testing'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import type { StageDraftingEffect } from './drafting-types'

const value = document([
  entity('a', { x: 0, y: 0, width: 40, height: 40 }),
  entity('b', { x: 100, y: 0, width: 40, height: 40 }),
])

function plan(effect: StageDraftingEffect) {
  const ids = (function* () {
    let n = 0
    while (true) yield `new-${n++}`
  })()
  const snapshot = layoutSnapshot(value)
  return planStageDraftingEdits({
    document: value,
    layoutSnapshot: snapshot,
    index: createStageSceneIndex(value, snapshot),
    effect,
    idFactory: () => ids.next().value!,
  })
}

describe('绘图编辑效果规划', () => {
  it('多选平移只产出一条变换命令', () => {
    const commands = plan({ translate: { entityIds: ['a', 'b'], delta: { x: 30, y: 20 } } })

    // 一条命令等于一步撤销：多选移动之后撤销一次，两个对象一起回位。
    expect(commands).toHaveLength(1)
    expect(commands[0]?.type).toBe(BUILTIN_COMMAND_TYPES.setTransform)
    const updates = (commands[0]?.payload as { updates: { entityId: string; transform: { position: { x: number; y: number } } }[] }).updates
    expect(updates.map(({ entityId }) => entityId)).toEqual(['a', 'b'])
    expect(updates.map(({ transform }) => transform.position)).toEqual([
      { x: 30, y: 20 },
      { x: 130, y: 20 },
    ])
  })

  it('小于拖动激活阈值的位移照样提交', () => {
    // 激活阈值区分「点一下」与「拖一下」，命令没有这个歧义。
    const commands = plan({ translate: { entityIds: ['a'], delta: { x: 1, y: 0 } } })

    const updates = (commands[0]?.payload as { updates: { transform: { position: { x: number } } }[] }).updates
    expect(updates[0]?.transform.position.x).toBe(1)
  })

  it('位移不被网格吸附改写', () => {
    // 基点与位移点已经各自过了点输入管线；再吸一次会改写键入的坐标。
    const commands = plan({ translate: { entityIds: ['a'], delta: { x: 7, y: 3 } } })

    const updates = (commands[0]?.payload as { updates: { transform: { position: { x: number; y: number } } }[] }).updates
    expect(updates[0]?.transform.position).toEqual({ x: 7, y: 3 })
  })

  it('复制按给定位移落点，不叠加默认错开量', () => {
    const commands = plan({ duplicate: { entityIds: ['a'], delta: { x: 50, y: 0 } } })

    expect(commands).toHaveLength(1)
    expect(commands[0]?.type).toBe(BUILTIN_COMMAND_TYPES.duplicateEntity)
    const entities = (commands[0]?.payload as {
      entities: Record<string, { components: { LayoutItem: { offset: { x: number; y: number } } } }>
    }).entities
    expect(Object.values(entities)[0]?.components.LayoutItem.offset).toEqual({ x: 50, y: 0 })
  })

  it('删除产出一条批量删除命令', () => {
    const commands = plan({ removed: ['a', 'b'] })

    expect(commands).toHaveLength(1)
    expect(commands[0]?.type).toBe(BUILTIN_COMMAND_TYPES.deleteEntity)
    expect((commands[0]?.payload as { entityIds: string[] }).entityIds).toEqual(['a', 'b'])
  })

  it('锁定对象不被删除', () => {
    const locked = document([
      entity('a', { x: 0, y: 0, width: 40, height: 40, locked: true }),
      entity('b', { x: 100, y: 0, width: 40, height: 40 }),
    ])
    const snapshot = layoutSnapshot(locked)
    const commands = planStageDraftingEdits({
      document: locked,
      layoutSnapshot: snapshot,
      index: createStageSceneIndex(locked, snapshot),
      effect: { removed: ['a', 'b'] },
      idFactory: () => 'cmd',
    })

    expect((commands[0]?.payload as { entityIds: string[] }).entityIds).toEqual(['b'])
  })

  it('没有可提交内容时不产出命令', () => {
    expect(plan({ reference: { x: 0, y: 0 } })).toEqual([])
    expect(plan({ translate: { entityIds: [], delta: { x: 1, y: 1 } } })).toEqual([])
  })
})
