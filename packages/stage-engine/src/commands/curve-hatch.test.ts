import { describe, expect, it } from 'vitest'
import {
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  normalizeComposeCurveGeometry,
  type ComposeCurve,
  type ComposeEntity,
} from '@compose-ui/core'
import { resolveStageHatchRegion } from './curve-hatch'
import { createStageSceneIndex } from '../hit-testing'
import { document, entity, layoutSnapshot } from '../test-fixtures'

/** 用 parent 坐标的几何造一个曲线 Entity，盒按紧包围盒。 */
function curveEntity(
  id: string,
  curve: ComposeCurve,
  extra: Record<string, unknown> = {},
  options: { readonly locked?: boolean } = {},
): ComposeEntity {
  const normalized = normalizeComposeCurveGeometry(curve)
  const base = entity(id, {
    x: normalized.offset.x,
    y: normalized.offset.y,
    width: normalized.size.width,
    height: normalized.size.height,
    ...(options.locked ? { locked: true } : {}),
  })
  return {
    ...base,
    components: {
      ...base.components,
      [COMPOSE_BUILTIN_COMPONENT_KEYS.renderer]: { type: 'curve', props: {} },
      [COMPOSE_BUILTIN_COMPONENT_KEYS.curve]: normalized.curve,
      ...extra,
    },
  } as ComposeEntity
}

const line = (x1: number, y1: number, x2: number, y2: number): ComposeCurve => (
  { kind: 'line', start: { x: x1, y: y1 }, end: { x: x2, y: y2 } }
)
const rect = (x: number, y: number, w: number, h: number): ComposeCurve => ({
  kind: 'polyline',
  closed: true,
  vertices: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }],
})
const circle = (cx: number, cy: number, radius: number): ComposeCurve => (
  { kind: 'arc', center: { x: cx, y: cy }, radius, startAngle: 0, sweep: 360 }
)

function indexOf(entities: readonly ComposeEntity[]) {
  const value = document(entities)
  return createStageSceneIndex(value, layoutSnapshot(value))
}

describe('OpenSpec: stage-engine / 填充解算有三支，由边界与图上那块墨决定', () => {
  it('没有东西穿过的矩形：改它的填充，不新建', () => {
    const index = indexOf([curveEntity('box', rect(0, 0, 200, 120))])
    const resolution = resolveStageHatchRegion(index, { x: 100, y: 60 })
    expect(resolution.status).toBe('fill')
    if (resolution.status !== 'fill') return
    expect(resolution.entityId).toBe('box')
  })

  it('一条线穿过矩形：新建，且只填被点的那半边', () => {
    const index = indexOf([
      curveEntity('box', rect(0, 0, 200, 120)),
      curveEntity('cut', line(100, 0, 100, 120)),
    ])
    const resolution = resolveStageHatchRegion(index, { x: 40, y: 60 })
    expect(resolution.status).toBe('create')
    if (resolution.status !== 'create') return
    expect(resolution.islandCount).toBe(0)
    expect([...resolution.boundaryIds].sort()).toEqual(['box', 'cut'])
    expect(resolution.curve.kind).toBe('polyline')
    if (resolution.curve.kind !== 'polyline') return
    expect(Math.max(...resolution.curve.vertices.map((vertex) => vertex.x))).toBeCloseTo(100, 6)
  })

  it('自交折线的一个环：走新建那一支', () => {
    // 8 字形：两个环都出自它自己，改它的填充会把两个环一起填上，不是用户点的那一个。
    const figureEight: ComposeCurve = {
      kind: 'polyline',
      closed: true,
      vertices: [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 100, y: 0 }],
    }
    const index = indexOf([curveEntity('eight', figureEight)])
    const resolution = resolveStageHatchRegion(index, { x: 50, y: 80 })
    expect(resolution.status).toBe('create')
    if (resolution.status !== 'create') return
    expect(resolution.boundaryIds).toEqual(['eight'])
  })

  it('矩形里有个圆：新建，并把圆挖空', () => {
    const index = indexOf([
      curveEntity('box', rect(0, 0, 200, 200)),
      curveEntity('hole', circle(100, 100, 40)),
    ])
    const resolution = resolveStageHatchRegion(index, { x: 20, y: 20 })
    expect(resolution.status).toBe('create')
    if (resolution.status !== 'create') return
    expect(resolution.islandCount).toBe(1)
    expect(resolution.curve.kind).toBe('path')
    if (resolution.curve.kind !== 'path') return
    expect(resolution.curve.fillRule).toBe('evenodd')
  })

  it('锁定的目标拒绝并说明，MUST NOT 退回去新建', () => {
    const index = indexOf([curveEntity('box', rect(0, 0, 200, 120), {}, { locked: true })])
    const resolution = resolveStageHatchRegion(index, { x: 100, y: 60 })
    expect(resolution).toEqual({ status: 'rejected', reason: 'locked' })
  })

  it('边界没闭合：拒绝并带上自由端的位置', () => {
    const index = indexOf([
      curveEntity('a', line(0, 0.5, 200, 0)),
      curveEntity('b', line(200, 0, 200, 120)),
      curveEntity('c', line(200, 120, 0, 120)),
      curveEntity('d', line(0, 120, 0, 1)),
    ])
    const resolution = resolveStageHatchRegion(index, { x: 100, y: 60 })
    expect(resolution.status).toBe('rejected')
    if (resolution.status !== 'rejected') return
    expect(resolution.reason).toBe('open')
    expect(resolution.gaps).toHaveLength(2)
  })

  it('落点在图外面：另一句话', () => {
    const index = indexOf([curveEntity('box', rect(0, 0, 200, 120))])
    const resolution = resolveStageHatchRegion(index, { x: 400, y: 60 })
    expect(resolution).toEqual({ status: 'rejected', reason: 'outside' })
  })

  it('已经落下的填充不当边界', () => {
    // 上一次求面的产物与边界逐像素重合；当边界只会让每条边多出一份叠在一起的拷贝。
    const index = indexOf([
      curveEntity('box', rect(0, 0, 200, 120)),
      curveEntity('cover', rect(0, 300, 200, 120), {
        [COMPOSE_BUILTIN_COMPONENT_KEYS.hatch]: { seed: { x: 100, y: 60 } },
      }),
    ])
    // 那块填充在别处，因此这一下仍然是「改矩形自己的填充」——它没有被当成第二条边界。
    const resolution = resolveStageHatchRegion(index, { x: 100, y: 60 })
    expect(resolution.status).toBe('fill')
    if (resolution.status !== 'fill') return
    expect(resolution.entityId).toBe('box')
  })

  it('这块面上压着一块填充：改它的颜色，不新建', () => {
    /*
     * 没有这一支，对同一块面再点一次会在原来那块上面叠一块——两块几何逐像素重合、下面那块
     * 再也点不到，而屏幕上看起来只是换了个颜色。
     */
    const index = indexOf([
      curveEntity('box', rect(0, 0, 200, 120)),
      curveEntity('fill', rect(0, 0, 200, 120), {
        [COMPOSE_BUILTIN_COMPONENT_KEYS.hatch]: { seed: { x: 100, y: 60 } },
      }),
    ])
    const resolution = resolveStageHatchRegion(index, { x: 100, y: 60 })
    // 次序：填充压过「边界恰好是某一个 Entity 的完整几何」——用户看见的那块色就是它。
    expect(resolution.status).toBe('recolor')
    if (resolution.status !== 'recolor') return
    expect(resolution.entityId).toBe('fill')
  })

  it('在同一块面里点别的地方，认出来的还是那一块', () => {
    /*
     * 判别性在这里：环从射线**第一次穿过**的那条边起手，而射线是从落点射出去的——不把起点
     * 归一化的话，换个位置再点一次会写出一个起点不同的同一个环，逐位比较说「不是同一块」，
     * 于是又叠一块上去。
     */
    // 夹具必须是**凹**形：凸形上从哪个内点射出去都先穿过同一条边，起点碰巧一致，用例永远绿。
    const ell: ComposeCurve = {
      kind: 'polyline',
      closed: true,
      vertices: [
        { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 },
        { x: 100, y: 100 }, { x: 100, y: 200 }, { x: 0, y: 200 },
      ],
    }
    const index = indexOf([
      curveEntity('box', ell),
      curveEntity('fill', ell, {
        [COMPOSE_BUILTIN_COMPONENT_KEYS.hatch]: { seed: { x: 50, y: 50 } },
      }),
    ])
    for (const point of [{ x: 50, y: 50 }, { x: 50, y: 150 }, { x: 150, y: 50 }]) {
      const resolution = resolveStageHatchRegion(index, point)
      expect(resolution.status).toBe('recolor')
    }
  })

  it('面被劈开之后不再是同一块：两半都新建', () => {
    /*
     * 两半是**全等**的矩形，归一化之后 `Curve` 逐位相同——因此判据必须连归一化偏移一起比，
     * 否则填了左半再点右半会被判成「就是那一块」，右半永远填不上。
     */
    const index = indexOf([
      curveEntity('box', rect(0, 0, 200, 120)),
      curveEntity('cut', line(100, -20, 100, 140)),
      curveEntity('left', rect(0, 0, 100, 120), {
        [COMPOSE_BUILTIN_COMPONENT_KEYS.hatch]: { seed: { x: 50, y: 60 } },
      }),
    ])
    expect(resolveStageHatchRegion(index, { x: 50, y: 60 }).status).toBe('recolor')
    expect(resolveStageHatchRegion(index, { x: 150, y: 60 }).status).toBe('create')
  })

  it('已有填充锁定时拒绝，MUST NOT 退回去新建', () => {
    const index = indexOf([
      curveEntity('box', rect(0, 0, 200, 120)),
      curveEntity('fill', rect(0, 0, 200, 120), {
        [COMPOSE_BUILTIN_COMPONENT_KEYS.hatch]: { seed: { x: 100, y: 60 } },
      }, { locked: true }),
    ])
    const resolution = resolveStageHatchRegion(index, { x: 100, y: 60 })
    expect(resolution.status).toBe('rejected')
    if (resolution.status !== 'rejected') return
    expect(resolution.reason).toBe('locked')
  })

  it('接线节点不当边界', () => {
    const isJunction = (item: ComposeEntity) =>
      (item.components.Composition as { presetId?: string }).presetId === 'junction'
    const index = indexOf([
      curveEntity('box', rect(0, 0, 200, 120)),
      {
        ...curveEntity('dot', rect(98, 58, 4, 4)),
        components: {
          ...curveEntity('dot', rect(98, 58, 4, 4)).components,
          Composition: { presetId: 'junction', baseComponentKeys: [], capabilityIds: [] },
        },
      } as ComposeEntity,
    ])
    const resolution = resolveStageHatchRegion(index, { x: 40, y: 30 }, { isJunction })
    expect(resolution.status).toBe('fill')
    if (resolution.status !== 'fill') return
    expect(resolution.entityId).toBe('box')
  })

  it('悬停与落地读同一份解算', () => {
    const index = indexOf([
      curveEntity('box', rect(0, 0, 200, 120)),
      curveEntity('cut', line(100, 0, 100, 120)),
    ])
    const first = resolveStageHatchRegion(index, { x: 40, y: 60 })
    const second = resolveStageHatchRegion(index, { x: 40, y: 60 })
    expect(first).toEqual(second)
  })
})

