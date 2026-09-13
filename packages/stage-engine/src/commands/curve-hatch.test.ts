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

describe('OpenSpec: stage-engine / 填充解算有两支，由边界是谁决定', () => {
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
      curveEntity('fill', rect(0, 0, 200, 120), {
        [COMPOSE_BUILTIN_COMPONENT_KEYS.hatch]: { seed: { x: 100, y: 60 } },
      }),
    ])
    const resolution = resolveStageHatchRegion(index, { x: 100, y: 60 })
    expect(resolution.status).toBe('fill')
    if (resolution.status !== 'fill') return
    expect(resolution.entityId).toBe('box')
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
