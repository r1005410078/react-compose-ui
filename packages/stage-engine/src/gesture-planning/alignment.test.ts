import { describe, expect, it } from 'vitest'
import { createStageSceneIndex } from '../hit-testing'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import { planStageAlignment } from './alignment'
import type { ComposeEntity } from '@compose-ui/core'

function index(entities: readonly ComposeEntity[]) {
  const value = document(entities)
  return createStageSceneIndex(value, layoutSnapshot(value))
}

/*
 * 判别性来自**基准取选区包围盒**与**两端不动**两处：只断「都到了同一个 x」的用例，在一个
 * 取「最先选中那一个」为基准的实现上同样会绿；只断「中间那些动了」的用例，在一个把整排
 * 重新按等宽铺开的实现上同样会绿。
 */
describe('OpenSpec: stage-engine / 对齐与分布 / 对齐', () => {
  const trio = [
    entity('a', { x: 100, y: 20, width: 40, height: 20 }),
    entity('b', { x: 30, y: 60, width: 80, height: 20 }),
    entity('c', { x: 200, y: 100, width: 60, height: 20 }),
  ]

  it('左对齐贴到选区包围盒的左边，与选择顺序无关', () => {
    const scene = index(trio)
    const forward = planStageAlignment(scene, ['a', 'b', 'c'], 'left')
    const reversed = planStageAlignment(scene, ['c', 'b', 'a'], 'left')
    expect(forward).toEqual(reversed)
    // 包围盒左边是 b 的 30：三个 x 全部落在它上面。
    expect(forward.a?.x).toBe(30)
    expect(forward.c?.x).toBe(30)
    // 本来就贴着的那一个不产出变换——没有位移的写入只会往历史里塞一条空事务。
    expect(forward.b).toBeUndefined()
  })

  it('右对齐按各自的宽度贴右边', () => {
    const transforms = planStageAlignment(index(trio), ['a', 'b', 'c'], 'right')
    // 包围盒右边是 c 的 260。
    expect(transforms.a?.x).toBe(260 - 40)
    expect(transforms.b?.x).toBe(260 - 80)
    expect(transforms.c).toBeUndefined()
  })

  it('水平居中对齐到包围盒中线', () => {
    const transforms = planStageAlignment(index(trio), ['a', 'b', 'c'], 'center-x')
    const middle = (30 + 260) / 2
    expect(transforms.a?.x).toBe(middle - 20)
    expect(transforms.b?.x).toBe(middle - 40)
    expect(transforms.c?.x).toBe(middle - 30)
  })

  it('顶对齐作用在另一个轴上', () => {
    const transforms = planStageAlignment(index(trio), ['a', 'b', 'c'], 'top')
    expect(transforms.b?.y).toBe(20)
    expect(transforms.c?.y).toBe(20)
  })

  it('锁定的对象不动，但仍然计入基准', () => {
    const scene = index([
      entity('locked', { x: 0, y: 0, width: 40, height: 20, locked: true }),
      entity('a', { x: 100, y: 40, width: 40, height: 20 }),
      entity('b', { x: 200, y: 80, width: 40, height: 20 }),
    ])
    const transforms = planStageAlignment(scene, ['locked', 'a', 'b'], 'left')
    // 锁定的那个自己不动……
    expect(transforms.locked).toBeUndefined()
    // ……但包围盒左边仍然是它的 0，其余两个贴到那里。把它从基准里剔掉的话会贴到 100。
    expect(transforms.a?.x).toBe(0)
    expect(transforms.b?.x).toBe(0)
  })

  it('不足两个对象时什么都不产出', () => {
    expect(planStageAlignment(index(trio), ['a'], 'left')).toEqual({})
  })
})

describe('OpenSpec: stage-engine / 对齐与分布 / 分布', () => {
  /** 宽度刻意不等：等宽时「按中心等距」与「按间隙等距」给出同一个答案，判别不出来。 */
  const row = [
    entity('a', { x: 0, y: 0, width: 20, height: 10 }),
    entity('b', { x: 40, y: 0, width: 60, height: 10 }),
    entity('c', { x: 150, y: 0, width: 10, height: 10 }),
    entity('d', { x: 300, y: 0, width: 40, height: 10 }),
  ]

  it('两端不动，中间按边到边的间隙等距', () => {
    const transforms = planStageAlignment(index(row), ['a', 'b', 'c', 'd'], 'distribute-x')
    expect(transforms.a).toBeUndefined()
    expect(transforms.d).toBeUndefined()
    // 跨度 340，四个宽度共 130，三条间隙各 70。
    expect(transforms.b?.x).toBe(20 + 70)
    expect(transforms.c?.x).toBe(20 + 70 + 60 + 70)
  })

  it('按当前位置排序，不按选择顺序', () => {
    const scene = index(row)
    expect(planStageAlignment(scene, ['d', 'b', 'a', 'c'], 'distribute-x'))
      .toEqual(planStageAlignment(scene, ['a', 'b', 'c', 'd'], 'distribute-x'))
  })

  it('不足三个对象时什么都不产出：两端不动就没有中间可摊开', () => {
    expect(planStageAlignment(index(row), ['a', 'd'], 'distribute-x')).toEqual({})
  })
})
