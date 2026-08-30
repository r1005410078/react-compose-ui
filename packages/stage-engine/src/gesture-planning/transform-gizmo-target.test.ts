import { describe, expect, it } from 'vitest'
import { createStageSceneIndex } from '../hit-testing'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import { resolveTransformGizmoTarget } from './transform-gizmo-target'

function indexOf(value: ReturnType<typeof document>) {
  return createStageSceneIndex(value, layoutSnapshot(value))
}

describe('OpenSpec: stage / Rive 式变换指示器 / 中心与轴向', () => {
  it('单选取该 Entity 的旋转基点', () => {
    // 铰点在左边中点：盒 (0,0) 100×50 → 世界 (0, 25)。包围盒中心是 (50, 25)。
    const value = document([
      entity('p', { x: 0, y: 0, width: 100, height: 50, pivot: { x: 0, y: 0.5 } }),
    ])

    const target = resolveTransformGizmoTarget(
      indexOf(value),
      ['p'],
      { x: 0, y: 0, width: 100, height: 50 },
    )

    expect(target.center).toEqual({ x: 0, y: 25 })
    // `atan2(-0, 1)` 给的是 `-0`，`toEqual` 分得清正负零。
    expect(target.degrees).toBeCloseTo(0)
  })

  it('单选时轴向跟着对象的旋转', () => {
    const value = document([entity('p', { x: 0, y: 0, width: 100, height: 50, rotation: 30 })])
    const target = resolveTransformGizmoTarget(
      indexOf(value),
      ['p'],
      { x: 0, y: 0, width: 100, height: 50 },
    )

    expect(Math.abs(target.degrees)).toBeCloseTo(30)
  })

  it('多选退回包围盒中心与轴对齐', () => {
    /*
     * 那时没有单一基点（各有各的 `pivot`），也没有单一 `rotation`；绕包围盒中心转正是原
     * `rotate` 工具的行为，补上它删除那个工具才不留缺口。
     */
    const value = document([
      entity('p', { x: 0, y: 0, width: 100, height: 50, pivot: { x: 0, y: 0.5 }, rotation: 30 }),
      entity('q', { x: 200, y: 0, width: 100, height: 50 }),
    ])

    expect(resolveTransformGizmoTarget(indexOf(value), ['p', 'q'], { x: 0, y: 0, width: 300, height: 50 }))
      .toEqual({ center: { x: 150, y: 25 }, degrees: 0 })
    // 多选的 `degrees` 是构造出来的常量 0，不经过 `atan2`，因此没有正负零的问题。
  })

  it('缺席基点即盒中心', () => {
    // 「缺席即中心」这条回退让没设过基点的文档行为逐像素不变。
    const value = document([entity('p', { x: 10, y: 20, width: 100, height: 50 })])

    expect(resolveTransformGizmoTarget(indexOf(value), ['p'], { x: 10, y: 20, width: 100, height: 50 }).center)
      .toEqual({ x: 60, y: 45 })
  })
})
