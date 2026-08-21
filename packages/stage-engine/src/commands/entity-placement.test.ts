import { describe, expect, it } from 'vitest'
import { createComposeFrameEntity, createComposeGroupEntitySeed } from '@compose-ui/core'
import { clampBoundsIntoFrame, isComposeContainerEntity } from './entity-placement'
import { entity } from '../test-fixtures'

const FRAME_SIZE = { width: 1280, height: 720 }

describe('OpenSpec: stage-engine / 新建落点解析 / 容器判定', () => {
  it('容器与场景都是容器类', () => {
    expect(isComposeContainerEntity(entity('c', { childIds: [] }))).toBe(true)
    expect(isComposeContainerEntity(createComposeFrameEntity({ id: 'scene' }))).toBe(true)
  })

  it('叶 Entity 不是容器类', () => {
    expect(isComposeContainerEntity(entity('r'))).toBe(false)
  })

  it('Group 不是容器类', () => {
    expect(isComposeContainerEntity(createComposeGroupEntitySeed({ id: 'g', childIds: [] })))
      .toBe(false)
  })
})

describe('OpenSpec: stage-engine / 新建落点解析 / 钳制', () => {
  it('完全在场景之外的包围盒被拉回边界内且宽高不变', () => {
    expect(clampBoundsIntoFrame({ x: 2000, y: -300, width: 100, height: 50 }, FRAME_SIZE))
      .toEqual({ x: 1180, y: 0, width: 100, height: 50 })
  })

  it('部分重叠的包围盒被推到完全可见', () => {
    expect(clampBoundsIntoFrame({ x: 1240, y: 700, width: 100, height: 50 }, FRAME_SIZE))
      .toEqual({ x: 1180, y: 670, width: 100, height: 50 })
  })

  it('大于场景的包围盒靠齐原点', () => {
    expect(clampBoundsIntoFrame({ x: 2000, y: 900, width: 2000, height: 1000 }, FRAME_SIZE))
      .toEqual({ x: 0, y: 0, width: 2000, height: 1000 })
  })

  it('已经完整落在场景内的包围盒不动', () => {
    const bounds = { x: 40, y: 40, width: 100, height: 50 }
    expect(clampBoundsIntoFrame(bounds, FRAME_SIZE)).toEqual(bounds)
  })
})
