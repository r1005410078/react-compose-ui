import { describe, expect, it } from 'vitest'
import { createStageSceneIndex } from './scene-index'
import { document, entity } from './test-fixtures'

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
    const index = createStageSceneIndex(document([container, child], ['container']))
    expect(index.order).toEqual(['container', 'child'])
    expect(index.getParentId('child')).toBe('container')
    expect(index.closestContainerForEntity('child')).toBe('container')
    expect(index.commonContainerForSelection(['child'])).toBe('container')
    expect(index.containerAtPoint({ x: 120, y: 80 })).toBe('container')
  })

  it('OpenSpec: Visibility/Clip System / 祖先隐藏并排除裁剪外容器', () => {
    const child = entity('child')
    const hidden = entity('hidden', { childIds: ['child'], visible: false })
    const hiddenIndex = createStageSceneIndex(document([hidden, child], ['hidden']))
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
    const index = createStageSceneIndex(document([outside, clipped], ['outside']))
    expect(index.containerAtPoint({ x: 310, y: 310 })).toBeNull()
  })

  it('OpenSpec: Selection Query / 移除已选祖先的后代', () => {
    const child = entity('child')
    const container = entity('container', { childIds: ['child'] })
    const index = createStageSceneIndex(document([container, child], ['container']))
    expect(index.topLevelSelection(['container', 'child'])).toEqual(['container'])
  })
})
