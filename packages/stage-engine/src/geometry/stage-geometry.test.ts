import { describe, expect, it } from 'vitest'
import {
  applyMatrix,
  decomposeMatrix,
  getEntityParentId,
  getEntityWorldBounds,
  getEntityWorldMatrix,
  matrixFromTransform,
  pointOnRotationRay,
  resizeBounds,
  resizeReadoutPoints,
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

  it('OpenSpec: stage-engine / 局部矩阵与分解按旋转基点 / 非中心基点下互逆', () => {
    const transform = {
      x: 12,
      y: 34,
      width: 320,
      height: 180,
      rotation: 15,
      pivot: { x: 0, y: 0.5 },
    }

    const restored = decomposeMatrix(
      matrixFromTransform(transform),
      transform.width,
      transform.height,
      transform.pivot,
    )

    // 合成与分解是手势每一帧都要走的一个来回。不互逆的症状是提交后对象跳一下，
    // 位移量恰好等于基点偏移，而且只在非中心基点的对象上出现。
    expect(restored.x).toBeCloseTo(transform.x, 6)
    expect(restored.y).toBeCloseTo(transform.y, 6)
    expect(restored.rotation).toBeCloseTo(transform.rotation, 6)
  })

  it('OpenSpec: stage-engine / 局部矩阵与分解按旋转基点 / 基点决定旋转中心', () => {
    const box = { x: 0, y: 0, width: 100, height: 40 }
    const matrix = matrixFromTransform({ ...box, rotation: 90, pivot: { x: 0, y: 0.5 } })

    // 左边中点是基点，旋转前后位置不变；盒中心基点下它会被甩到别处。
    expect(applyMatrix(matrix, { x: 0, y: 20 })).toEqual({ x: 0, y: 20 })
  })

  it('OpenSpec: stage-engine / 局部矩阵与分解按旋转基点 / 未设基点仍绕盒中心', () => {
    const box = { x: 0, y: 0, width: 100, height: 40, rotation: 90 }

    // 零迁移护栏：没设基点的既有文档必须与本变更之前逐值一致。
    expect(matrixFromTransform(box)).toEqual(
      matrixFromTransform({ ...box, pivot: { x: 0.5, y: 0.5 } }),
    )
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

describe('OpenSpec: stage-engine / 手势几何写入的精度上限', () => {
  it('掐掉非整数 zoom 留下的浮点残渣', () => {
    expect(toComposeTransform({
      x: 82.96874999999991,
      y: 82.96869935990924,
      width: 373.3592610597958,
      height: 248.9061740398639,
      rotation: 0,
    })).toEqual({
      position: { x: 82.97, y: 82.97 },
      size: { width: 373.36, height: 248.91 },
      rotation: 0,
    })
  })

  it('已经吸附到网格的整数值不引入误差', () => {
    expect(toComposeTransform({ x: 80, y: 16, width: 648, height: 360, rotation: 45 })).toEqual({
      position: { x: 80, y: 16 },
      size: { width: 648, height: 360 },
      rotation: 45,
    })
  })
})

describe('resizeReadoutPoints', () => {
  /** 每个手柄的读数都从这块盒子上取，左上 `(10, 20)`、右下 `(110, 80)`。 */
  const bounds = { x: 10, y: 20, width: 100, height: 60 }
  const size = (handle: Parameters<typeof resizeReadoutPoints>[0]) => {
    const { origin, point } = resizeReadoutPoints(handle, bounds)
    return { width: Math.abs(point.x - origin.x), height: Math.abs(point.y - origin.y) }
  }

  it('OpenSpec: stage-engine / 缩放会话上报本次的尺寸参考 / 原点是与手柄对角的那个角', () => {
    expect(resizeReadoutPoints('nw', bounds)).toEqual({
      origin: { x: 110, y: 80 },
      point: { x: 10, y: 20 },
    })
    expect(resizeReadoutPoints('se', bounds)).toEqual({
      origin: { x: 10, y: 20 },
      point: { x: 110, y: 80 },
    })
  })

  it('OpenSpec: stage-engine / 缩放会话上报本次的尺寸参考 / 边手柄的原点仍是对角', () => {
    // 边手柄在它不动的那个轴上取左上/右下，因此读数仍是宽和高——用户在改的是盒，而等比
    // 约束一开边手柄同样会改另一个轴。
    expect(resizeReadoutPoints('e', bounds)).toEqual({
      origin: { x: 10, y: 20 },
      point: { x: 110, y: 80 },
    })
    expect(resizeReadoutPoints('n', bounds)).toEqual({
      origin: { x: 10, y: 80 },
      point: { x: 110, y: 20 },
    })
  })

  it('OpenSpec: stage-engine / 缩放会话上报本次的尺寸参考 / 八个手柄都给出宽高', () => {
    // 判别性在这里：任何一个手柄取错了角，两点之差就不再是盒的宽高。
    for (const handle of ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const) {
      expect(size(handle)).toEqual({ width: 100, height: 60 })
    }
  })
})
