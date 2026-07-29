import { describe, expect, it } from 'vitest'
import {
  getEntityParentId,
  getEntityWorldBounds,
  getEntityWorldMatrix,
  matrixFromTransform,
  resizeBounds,
  toComposeTransform,
  toStageTransform,
} from './geometry'
import { document, entity } from './test-fixtures'

describe('Stage ECS geometry', () => {
  it('OpenSpec: Transform System / 在 Hierarchy 中组合局部矩阵', () => {
    const child = entity('child', { x: 10, y: 20, width: 40, height: 20 })
    const container = entity('container', {
      x: 100,
      y: 50,
      childIds: ['child'],
      width: 200,
      height: 100,
    })
    const value = document([container, child], ['container'])
    expect(getEntityParentId(value, 'child')).toBe('container')
    expect(getEntityWorldMatrix(value, 'child')).toMatchObject({ e: 110, f: 70 })
    expect(getEntityWorldBounds(value, 'child')).toEqual({
      x: 110,
      y: 70,
      width: 40,
      height: 20,
    })
  })

  it('OpenSpec: Transform System / ECS 与 Stage 投影可逆', () => {
    const compose = {
      position: { x: 12, y: 34 },
      size: { width: 320, height: 180 },
      rotation: 15,
    }
    expect(toComposeTransform(toStageTransform(compose))).toEqual(compose)
    expect(matrixFromTransform(toStageTransform(compose))).toMatchObject({
      e: expect.any(Number),
      f: expect.any(Number),
    })
  })

  it('OpenSpec: Resize System / 计算四角与单轴边界', () => {
    const bounds = { x: 10, y: 20, width: 100, height: 50 }
    expect(resizeBounds(
      bounds,
      'e',
      { x: 160, y: 45 },
      { shift: false, alt: false },
    )).toEqual({ x: 10, y: 20, width: 150, height: 50 })
    expect(resizeBounds(
      bounds,
      'se',
      { x: 210, y: 120 },
      { shift: true, alt: false },
    )).toEqual({ x: 10, y: 20, width: 200, height: 100 })
  })
})
