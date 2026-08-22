import { createComposeLineCurve, normalizeComposeCurveGeometry } from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { createStageSceneIndex } from './scene-index'
import { document, entity, layoutSnapshot } from '../test-fixtures'

/** 一条从盒左上到右下的对角线；盒与几何按漏斗的归一化不变量对齐。 */
function curveEntity(
  id: string,
  start: { readonly x: number; readonly y: number },
  end: { readonly x: number; readonly y: number },
  rotation = 0,
) {
  const next = normalizeComposeCurveGeometry(createComposeLineCurve(start, end))
  const base = entity(id, {
    x: next.offset.x,
    y: next.offset.y,
    width: next.size.width,
    height: next.size.height,
    rotation,
  })
  return {
    ...base,
    components: {
      ...base.components,
      Renderer: { type: 'curve', props: {} },
      Curve: next.curve,
    },
  }
}

function indexFor(value: ReturnType<typeof document>) {
  return createStageSceneIndex(value, layoutSnapshot(value))
}

describe('曲线命中按距离而不是包围盒', () => {
  const diagonal = curveEntity('curve', { x: 100, y: 100 }, { x: 200, y: 200 })

  it('点击线身命中', () => {
    const index = indexFor(document([diagonal], ['curve']))
    expect(index.entityAtPoint({ x: 150, y: 150 }, 6)).toBe('curve')
  })

  it('包围盒内远离线身的空角不命中', () => {
    const index = indexFor(document([diagonal], ['curve']))
    // 空角在盒内，按盒判定会命中；按距离判定不命中——这是两种判据的可观察差异。
    expect(index.entityAtPoint({ x: 198, y: 102 }, 6)).not.toBe('curve')
  })

  it('容差之外不命中，容差之内命中', () => {
    const index = indexFor(document([diagonal], ['curve']))
    // 点到对角线的垂距是 20 / sqrt(2) ≈ 14.14。
    expect(index.entityAtPoint({ x: 160, y: 140 }, 10)).not.toBe('curve')
    expect(index.entityAtPoint({ x: 160, y: 140 }, 15)).toBe('curve')
  })

  it('容差随缩放换算后结果一致', () => {
    const index = indexFor(document([diagonal], ['curve']))
    const screenTolerance = 8
    for (const zoom of [0.5, 1, 2.37]) {
      // world = 屏幕 / zoom：漏乘 zoom 时 zoom 恒为 1 的用例仍然会绿，因此必须多取几个值。
      expect(index.entityAtPoint({ x: 150, y: 150 }, screenTolerance / zoom)).toBe('curve')
    }
    // 缩小时同样的屏幕容差覆盖更大的世界范围，因此这一点只在 0.5 下命中。
    expect(index.entityAtPoint({ x: 156, y: 144 }, screenTolerance / 0.5)).toBe('curve')
    expect(index.entityAtPoint({ x: 156, y: 144 }, screenTolerance / 2)).not.toBe('curve')
  })

  it('曲线不遮挡下层内容的空白区', () => {
    const plate = entity('plate', { x: 0, y: 0, width: 400, height: 400 })
    const index = indexFor(document([plate, diagonal], ['plate', 'curve']))
    // 空角落在曲线盒内但不在线上，命中应当穿透到下面那块矩形。
    expect(index.entityAtPoint({ x: 198, y: 102 }, 6)).toBe('plate')
    expect(index.entityAtPoint({ x: 150, y: 150 }, 6)).toBe('curve')
  })
})

describe('旋转后的曲线命中跟随几何', () => {
  it('主对角线旋转 90 度后落在反对角线上', () => {
    // 盒 100x100，几何是左上→右下的主对角线；绕盒中心旋转 90 度后它变成反对角线。
    const start = { x: 0, y: 0 }
    const end = { x: 100, y: 100 }
    const upright = indexFor(document([curveEntity('curve', start, end)], ['curve']))
    const rotated = indexFor(document([curveEntity('curve', start, end, 90)], ['curve']))
    // (100, 0) 是主对角线的空角、却正是反对角线的端点——这一对点同时钉住「按距离」与
    // 「在局部坐标判定」两件事。
    expect(upright.entityAtPoint({ x: 100, y: 0 }, 4)).not.toBe('curve')
    expect(rotated.entityAtPoint({ x: 100, y: 0 }, 4)).toBe('curve')
    expect(upright.entityAtPoint({ x: 50, y: 50 }, 4)).toBe('curve')
  })
})
