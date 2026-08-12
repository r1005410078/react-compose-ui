import { createComposeGroupEntitySeed } from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { createStageSceneIndex } from './scene-index'
import { document, entity, layoutSnapshot } from './test-fixtures'

function indexFor(value: ReturnType<typeof document>) {
  return createStageSceneIndex(value, layoutSnapshot(value))
}

describe('StageSceneIndex ECS queries', () => {
  it('OpenSpec: Hierarchy System / 建立顺序、父级和容器查询', () => {
    const child = entity('child', { x: 10, y: 10 })
    const container = entity('container', {
      x: 100,
      y: 50,
      width: 300,
      height: 200,
      childIds: ['child'],
    })
    const index = indexFor(document([container, child], ['container']))
    expect(index.order).toEqual(['container', 'child'])
    expect(index.getParentId('child')).toBe('container')
    expect(index.closestContainerForEntity('child')).toBe('container')
    expect(index.commonContainerForSelection(['child'])).toBe('container')
    expect(index.containerAtPoint({ x: 120, y: 80 })).toBe('container')
  })

  it('OpenSpec: ECS SceneIndex / 容器命中排除自身与后代', () => {
    // outer > middle > leaf 三层容器同原点重叠（offset 相对父级，故子级用 0）：
    // 拖动 middle 时它自己和后代 leaf 都不能作为落点。
    const leaf = entity('leaf', { width: 100, height: 60, childIds: [] })
    const middle = entity('middle', { width: 200, height: 120, childIds: ['leaf'] })
    const outer = entity('outer', { x: 100, y: 50, width: 300, height: 200, childIds: ['middle'] })
    const index = indexFor(document([outer, middle, leaf], ['outer']))
    const point = { x: 150, y: 80 }

    expect(index.containerAtPoint(point)).toBe('leaf')
    expect(index.containerAtPoint(point, ['middle'])).toBe('outer')
    expect(index.containerAtPoint(point, [])).toBe('leaf')
    expect(index.containerAtPoint(point, ['outer'])).toBeNull()
  })

  it('OpenSpec: Visibility/Clip System / 祖先隐藏并排除裁剪外容器', () => {
    const child = entity('child')
    const hidden = entity('hidden', { childIds: ['child'], visible: false })
    const hiddenIndex = indexFor(document([hidden, child], ['hidden']))
    expect(hiddenIndex.isVisible('child')).toBe(false)

    const clipped = entity('clipped', {
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      childIds: [],
      clip: true,
    })
    const outside = entity('outside', {
      x: 200,
      y: 200,
      width: 50,
      height: 50,
      childIds: ['clipped'],
    })
    const index = indexFor(document([outside, clipped], ['outside']))
    expect(index.containerAtPoint({ x: 310, y: 310 })).toBeNull()
  })

  it('OpenSpec: Selection Query / 移除已选祖先的后代', () => {
    const child = entity('child')
    const container = entity('container', { childIds: ['child'] })
    const index = indexFor(document([container, child], ['container']))
    expect(index.topLevelSelection(['container', 'child'])).toEqual(['container'])
  })

  it('OpenSpec: Paint sample / 从最上层可见 Entity 取样并遵守裁剪祖先', () => {
    const lower = entity('lower', { x: 0, y: 0, width: 100, height: 100 })
    const upper = entity('upper', { x: 20, y: 20, width: 60, height: 60 })
    const index = indexFor(document([lower, upper]))
    expect(index.entityAtPoint({ x: 30, y: 30 })).toBe('upper')
    expect(index.entityAtPoint({ x: 10, y: 10 })).toBe('lower')
  })

  it('OpenSpec: stage-engine / Group 动态编辑范围 / 后代移出初始范围', () => {
    const child = entity('child', { x: 200, y: 40, width: 80, height: 30 })
    const group = createComposeGroupEntitySeed({
      id: 'group',
      childIds: ['child'],
      position: { x: 10, y: 20 },
      size: { width: 40, height: 40 },
    })
    const value = document([group, child], ['group'])
    const index = indexFor(value)

    expect(index.getWorldBounds('group')).toEqual({
      x: 210,
      y: 60,
      width: 80,
      height: 30,
    })
    expect(index.containerAtPoint({ x: 220, y: 70 })).toBe('group')
    expect(value.entities.group?.components.LayoutItem).toMatchObject({
      offset: { x: 10, y: 20 },
      width: { value: 40 },
      height: { value: 40 },
    })
  })
})

describe('OpenSpec: stage / Page Slot 嵌套内容不进入场景索引', () => {
  it('被引用页面的实体不出现在外层文档的索引中', () => {
    // page-slot 实体在外层文档里是一个普通叶子节点；被引用页面的实体属于另一份文档，
    // 因此框选、吸附候选与场景树都取不到它们，嵌套渲染不会把它们注入外层索引。
    const index = indexFor(document([entity('slot')]))

    expect(index.order).toEqual(['slot'])
  })
})
