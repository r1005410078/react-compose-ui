import { describe, expect, it } from 'vitest'
import {
  getEntityParentId,
  getEntityWorldBounds,
  getEntityWorldMatrix,
  matrixFromTransform,
  pointOnRotationRay,
  resizeBounds,
  rotationFromPointer,
  toComposeTransform,
  toStageTransform,
} from './stage-geometry'
import { document, entity, layoutSnapshot } from '../test-fixtures'

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
    const snapshot = layoutSnapshot(value)
    expect(getEntityWorldMatrix(value, snapshot, 'child')).toMatchObject({ e: 110, f: 70 })
    expect(getEntityWorldBounds(value, snapshot, 'child')).toEqual({
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

  it('旋转角度吸附 / Shift 将绝对角量化到 15°', () => {
    const center = { x: 0, y: 0 }
    const start = { x: 100, y: 0 }
    // 约 +20°：无吸附保留连续角；有 baseRotation=7 时目标绝对角 round((7+20)/15)*15=30 → delta=23
    const current = {
      x: 100 * Math.cos((20 * Math.PI) / 180),
      y: 100 * Math.sin((20 * Math.PI) / 180),
    }
    const free = rotationFromPointer(center, start, current, false)
    expect(free).toBeCloseTo(20, 5)

    const relativeSnap = rotationFromPointer(center, start, current, true)
    expect(relativeSnap).toBe(15)

    const absoluteSnap = rotationFromPointer(center, start, current, {
      shift: true,
      baseRotation: 7,
    })
    expect(absoluteSnap).toBe(23)

    const ray = pointOnRotationRay(center, start, current, 15)
    expect(Math.hypot(ray.x, ray.y)).toBeCloseTo(100, 5)
    expect(Math.atan2(ray.y, ray.x) * 180 / Math.PI).toBeCloseTo(15, 5)
  })
})
