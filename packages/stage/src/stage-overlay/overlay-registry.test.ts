import { describe, expect, it } from 'vitest'
import {
  createStageOverlayRegistry,
  STAGE_OVERLAY_CONTRIBUTIONS,
} from './overlay-registry'
import type { StageOverlayContribution } from './overlay-types'

const stub = (id: string, order: number): StageOverlayContribution => ({
  id,
  order,
  Layer: () => null,
})

describe('OpenSpec: stage / Overlay 层注册表 / 绘制顺序', () => {
  it('按 order 降序排列：数值大的先画、位于下层', () => {
    const orders = STAGE_OVERLAY_CONTRIBUTIONS.map(({ order }) => order)

    expect([...orders].sort((left, right) => right - left)).toEqual(orders)
  })

  it('order 两两不同，绘制顺序完全确定', () => {
    const orders = STAGE_OVERLAY_CONTRIBUTIONS.map(({ order }) => order)

    expect(new Set(orders).size).toBe(orders.length)
  })

  it('路径顶点画在缩放手柄之上', () => {
    const orderOf = (id: string) =>
      STAGE_OVERLAY_CONTRIBUTIONS.find((item) => item.id === id)!.order

    // 关键帧顶点常与对象角点重合；压在手柄之下将永远拖不动。
    expect(orderOf('editable-path')).toBeLessThan(orderOf('resize-handles'))
  })

  it('吸附参考线画在最上层', () => {
    const last = STAGE_OVERLAY_CONTRIBUTIONS[STAGE_OVERLAY_CONTRIBUTIONS.length - 1]

    // 瞬时反馈被任何东西盖住都等于没画。
    expect(last?.id).toBe('snap-guides')
  })

  it('宿主追加的层与第一方层按同一套 order 排序', () => {
    const registry = createStageOverlayRegistry([stub('cad-dimensions', 450)])
    const ids = registry.map(({ id }) => id)

    // 450 落在 move-gizmo(500) 与 paint-handles(400) 之间：降序排列下即在两者中间。
    expect(ids.indexOf('cad-dimensions')).toBeGreaterThan(ids.indexOf('move-gizmo'))
    expect(ids.indexOf('cad-dimensions')).toBeLessThan(ids.indexOf('paint-handles'))
  })

  it('id 重复时拒绝注册', () => {
    expect(() => createStageOverlayRegistry([stub('selection', 10)]))
      .toThrow(/Duplicate stage overlay contribution: selection/)
  })
})
