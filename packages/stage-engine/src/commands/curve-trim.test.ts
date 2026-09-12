import { describe, expect, it } from 'vitest'
import {
  BUILTIN_COMMAND_TYPES,
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  normalizeComposeCurveGeometry,
  type ComposeCurve,
  type ComposeEntity,
  type EditorCommand,
} from '@compose-ui/core'
import { planStageTrim, resolveStageTrailTargets, resolveStageTrimPiece } from './curve-trim'
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

function indexOf(entities: readonly ComposeEntity[]) {
  const value = document(entities)
  return createStageSceneIndex(value, layoutSnapshot(value))
}

let serial = 0
const idFactory = () => `id-${++serial}`
const isWire = (item: ComposeEntity) =>
  (item.components.Composition as { presetId?: string }).presetId === 'wire'
const isJunction = (item: ComposeEntity) =>
  (item.components.Composition as { presetId?: string }).presetId === 'junction'
const options = { idFactory, isWire, isJunction }

/** 展开批次：合并与节点清理把命令收进一条 batch 里。 */
const flatten = (commands: readonly EditorCommand[]): EditorCommand[] => commands.flatMap((command) => (
  command.type === BUILTIN_COMMAND_TYPES.batch
    ? flatten((command.payload as unknown as { commands: EditorCommand[] }).commands)
    : [command]
))
const setCurveOf = (commands: readonly EditorCommand[], entityId: string) => flatten(commands)
  .filter((command) => command.type === BUILTIN_COMMAND_TYPES.setCurve)
  .map((command) => command.payload as { entityId: string; curve: ComposeCurve })
  .find((payload) => payload.entityId === entityId)?.curve
const created = (commands: readonly EditorCommand[]) => flatten(commands)
  .filter((command) => command.type === BUILTIN_COMMAND_TYPES.createEntity)
  .map((command) => (command.payload as unknown as { entity: ComposeEntity }).entity)
const deleted = (commands: readonly EditorCommand[]): string[] => flatten(commands)
  .filter((command) => command.type === BUILTIN_COMMAND_TYPES.deleteEntity)
  .flatMap((command) => (command.payload as { entityIds: string[] }).entityIds)

describe('OpenSpec: stage-engine / TRIM 命令去掉光标底下的一截', () => {
  it('两线相交去掉交点一侧：横线缩到交点，竖线不动', () => {
    const index = indexOf([curveEntity('h', line(0, 100, 200, 100)), curveEntity('v', line(100, 0, 100, 200))])
    const plan = planStageTrim(index, [{ id: 'h', point: { x: 150, y: 100 } }], options)

    expect(setCurveOf(plan.commands, 'h')).toEqual(line(0, 100, 100, 100))
    expect(setCurveOf(plan.commands, 'v')).toBeUndefined()
    expect(created(plan.commands)).toHaveLength(0)
  })

  it('线穿过矩形挖掉中间：一条变两条，矩形不变', () => {
    const index = indexOf([curveEntity('h', line(0, 100, 200, 100)), curveEntity('r', rect(50, 50, 100, 100))])
    const plan = planStageTrim(index, [{ id: 'h', point: { x: 100, y: 100 } }], options)

    expect(setCurveOf(plan.commands, 'h')).toEqual(line(0, 100, 50, 100))
    const [right] = created(plan.commands)
    expect(right).toBeDefined()
    expect(right!.components.Curve).toEqual({ kind: 'line', start: { x: 0, y: 0 }, end: { x: 50, y: 0 } })
    expect((right!.components.LayoutItem as { offset: unknown }).offset).toEqual({ x: 150, y: 100 })
    expect(setCurveOf(plan.commands, 'r')).toBeUndefined()
  })

  it('圆变成弧：kind 仍是 arc，扫掠角变成 180', () => {
    const circle: ComposeCurve = { kind: 'arc', center: { x: 100, y: 100 }, radius: 50, startAngle: 0, sweep: 360 }
    const index = indexOf([curveEntity('c', circle), curveEntity('h', line(0, 100, 200, 100))])
    const plan = planStageTrim(index, [{ id: 'c', point: { x: 100, y: 50 } }], options)

    const remaining = setCurveOf(plan.commands, 'c')
    expect(remaining?.kind).toBe('arc')
    expect(Math.abs((remaining as { sweep: number }).sweep)).toBeCloseTo(180)
    // 剩下的是下半：弧的中点在圆心下方。
    const startAngle = (remaining as { startAngle: number }).startAngle
    const mid = ((startAngle + (remaining as { sweep: number }).sweep / 2) % 360 + 360) % 360
    expect(mid).toBeCloseTo(90)
  })

  it('矩形的一条边：闭合变开放，仍是同一个 Entity', () => {
    const index = indexOf([curveEntity('r', rect(50, 50, 100, 100))])
    const plan = planStageTrim(index, [{ id: 'r', point: { x: 150, y: 100 } }], options)

    expect(setCurveOf(plan.commands, 'r')).toEqual({
      kind: 'polyline',
      closed: false,
      vertices: [{ x: 150, y: 150 }, { x: 50, y: 150 }, { x: 50, y: 50 }, { x: 150, y: 50 }],
    })
    expect(created(plan.commands)).toHaveLength(0)
  })

  it('一段上多个交点只掉光标两侧最近的那一格', () => {
    const index = indexOf([
      curveEntity('h', line(0, 100, 300, 100)),
      curveEntity('v1', line(50, 0, 50, 200)),
      curveEntity('v2', line(100, 0, 100, 200)),
      curveEntity('v3', line(150, 0, 150, 200)),
    ])
    const plan = planStageTrim(index, [{ id: 'h', point: { x: 75, y: 100 } }], options)

    expect(setCurveOf(plan.commands, 'h')).toEqual(line(0, 100, 50, 100))
    const [right] = created(plan.commands)
    expect((right!.components.LayoutItem as { offset: unknown }).offset).toEqual({ x: 100, y: 100 })
    expect(right!.components.Curve).toEqual({ kind: 'line', start: { x: 0, y: 0 }, end: { x: 200, y: 0 } })
  })

  it('孤线整条删除', () => {
    const index = indexOf([curveEntity('h', line(0, 100, 200, 100))])
    const plan = planStageTrim(index, [{ id: 'h', point: { x: 100, y: 100 } }], options)

    expect(deleted(plan.commands)).toEqual(['h'])
    expect(plan.removedIds).toEqual(['h'])
  })

  it('剪到节点触发合并：支路消失后节点只剩两条支路，两条并成一条', () => {
    const wire = (id: string, curve: ComposeCurve, ends: Record<string, unknown>) => curveEntity(id, curve, {
      Composition: { presetId: 'wire', baseComponentKeys: [], capabilityIds: [] },
      ...(Object.keys(ends).length > 0 ? { Wire: ends } : {}),
    })
    const junction = curveEntity('j', rect(97, 97, 6, 6), {
      Composition: { presetId: 'junction', baseComponentKeys: [], capabilityIds: [] },
      Ports: { items: [{ id: 'p', position: { x: 3, y: 3 } }] },
    })
    const index = indexOf([
      wire('a', line(0, 100, 100, 100), { end: { entityId: 'j', portId: 'p' } }),
      wire('b', line(100, 100, 200, 100), { start: { entityId: 'j', portId: 'p' } }),
      wire('c', line(100, 100, 100, 0), { start: { entityId: 'j', portId: 'p' } }),
      junction,
    ])
    const plan = planStageTrim(index, [{ id: 'c', point: { x: 100, y: 50 } }], options)

    expect(deleted(plan.commands)).toContain('c')
    expect(deleted(plan.commands)).toContain('j')
    expect(deleted(plan.commands)).toContain('b')
    expect(setCurveOf(plan.commands, 'a')).toEqual({
      kind: 'polyline',
      closed: false,
      vertices: [{ x: 0, y: 100 }, { x: 100, y: 100 }, { x: 200, y: 100 }],
    })
  })

  it('绑定随被去掉的那一截消失，留下的那一半继承另一端', () => {
    const port = { entityId: 'device', portId: 'L1' }
    const index = indexOf([
      curveEntity('w', { kind: 'polyline', closed: false, vertices: [{ x: 0, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 0 }] }, {
        Composition: { presetId: 'wire', baseComponentKeys: [], capabilityIds: [] },
        Wire: { start: port, end: { entityId: 'other', portId: 'L2' } },
      }),
    ])
    const plan = planStageTrim(index, [{ id: 'w', point: { x: 100, y: 50 } }], options)

    const command = plan.commands.find((item) => item.type === BUILTIN_COMMAND_TYPES.setCurve)
    expect((command?.payload as { wire: unknown }).wire).toEqual({ start: port })
    expect(setCurveOf(plan.commands, 'w')).toEqual(line(0, 100, 100, 100))
  })

  it('接线点不是切割边', () => {
    const index = indexOf([
      curveEntity('a', line(0, 100, 100, 100), {
        Composition: { presetId: 'wire', baseComponentKeys: [], capabilityIds: [] },
      }),
      curveEntity('j', rect(97, 97, 6, 6), {
        Composition: { presetId: 'junction', baseComponentKeys: [], capabilityIds: [] },
      }),
    ])
    const resolution = resolveStageTrimPiece(index, 'a', { x: 50, y: 100 }, options)
    expect(resolution.status).toBe('ok')
    // 节点的方块边框不算边界：这一截就是整条线。
    expect(resolution.status === 'ok' && resolution.piece.whole).toBe(true)
  })

  it('不可见的 Entity 不是切割边', () => {
    const hidden = curveEntity('v', line(100, 0, 100, 200))
    ;(hidden.components.Visibility as { visible: boolean }).visible = false
    const index = indexOf([curveEntity('h', line(0, 100, 200, 100)), hidden])
    const resolution = resolveStageTrimPiece(index, 'h', { x: 150, y: 100 }, options)
    expect(resolution.status === 'ok' && resolution.piece.whole).toBe(true)
  })

  it('一笔多截：每个目标各去一截，同一个 Entity 只受理第一次', () => {
    const index = indexOf([curveEntity('h', line(0, 100, 200, 100)), curveEntity('v', line(100, 0, 100, 200))])
    const plan = planStageTrim(index, [
      { id: 'h', point: { x: 150, y: 100 } },
      { id: 'v', point: { x: 100, y: 50 } },
      { id: 'h', point: { x: 50, y: 100 } },
    ], options)

    expect(setCurveOf(plan.commands, 'h')).toEqual(line(0, 100, 100, 100))
    expect(setCurveOf(plan.commands, 'v')).toEqual(line(100, 100, 100, 200))
    expect(flatten(plan.commands).filter((item) => item.type === BUILTIN_COMMAND_TYPES.setCurve)).toHaveLength(2)
    // 一笔一个事务。
    expect(plan.commands).toHaveLength(1)
    expect(plan.commands[0]!.type).toBe(BUILTIN_COMMAND_TYPES.batch)
  })

  it('整圆上只有一个交点时拒绝', () => {
    const circle: ComposeCurve = { kind: 'arc', center: { x: 100, y: 100 }, radius: 50, startAngle: 0, sweep: 360 }
    const index = indexOf([curveEntity('c', circle), curveEntity('t', line(0, 50, 200, 50))])
    expect(resolveStageTrimPiece(index, 'c', { x: 100, y: 150 }, options))
      .toEqual({ status: 'rejected', reason: 'single-boundary' })
  })

  it('四种拒绝互不相同', () => {
    const path: ComposeCurve = {
      kind: 'path',
      subpaths: [{ start: { x: 0, y: 0 }, closed: false, segments: [{ c1: { x: 10, y: 40 }, c2: { x: 60, y: 40 }, to: { x: 100, y: 0 } }] }],
    }
    const fixed = curveEntity('fixed', rect(0, 0, 6, 6))
    ;(fixed.components as Record<string, unknown>).GeometryConstraints = { resize: 'none', movable: true, rotatable: false }
    const index = indexOf([
      curveEntity('locked', line(0, 0, 100, 0), {}, { locked: true }),
      fixed,
      entity('box', { x: 0, y: 0, width: 40, height: 40 }),
      curveEntity('path', path),
    ])
    const reasons = ['locked', 'fixed', 'box', 'path']
      .map((id) => resolveStageTrimPiece(index, id, { x: 1, y: 1 }, options))
      .map((resolution) => (resolution.status === 'rejected' ? resolution.reason : 'ok'))
    expect(reasons).toEqual(['locked', 'fixed-size', 'not-curve', 'path'])
    expect(new Set(reasons).size).toBe(4)
  })

  it('盒被拉伸过的曲线按投影后的几何求交', () => {
    // 几何是 (0,0)→(100,50)，盒却是 200×100：画出来的线是 (0,0)→(200,100)。
    const stretched = curveEntity('s', line(0, 0, 100, 50))
    ;(stretched.components.LayoutItem as { width: { value: number }; height: { value: number } }).width.value = 200
    ;(stretched.components.LayoutItem as { width: { value: number }; height: { value: number } }).height.value = 100
    const index = indexOf([stretched, curveEntity('v', line(100, 0, 100, 200))])
    const plan = planStageTrim(index, [{ id: 's', point: { x: 150, y: 75 } }], options)

    expect(setCurveOf(plan.commands, 's')).toEqual(line(0, 0, 100, 50))
  })

  it('预览的剪口落在交点上，带线的走向', () => {
    const index = indexOf([curveEntity('h', line(0, 100, 200, 100)), curveEntity('v', line(100, 0, 100, 200))])
    const resolution = resolveStageTrimPiece(index, 'h', { x: 150, y: 100 }, options)
    if (resolution.status !== 'ok') throw new Error('应当解算出一截')
    expect(resolution.piece.cuts).toHaveLength(1)
    expect(resolution.piece.cuts[0]!.point).toEqual({ x: 100, y: 100 })
    expect(Math.abs(resolution.piece.cuts[0]!.direction.x)).toBeCloseTo(1)
    expect(resolution.piece.outline).toEqual([{ x: 100, y: 100 }, { x: 200, y: 100 }])
  })
})

describe('OpenSpec: stage / TRIM 的悬停预览与拖动 / 拖过多条一个事务', () => {
  it('轨迹碰到的每一条曲线各成一个目标', () => {
    const index = indexOf([
      curveEntity('h1', line(0, 100, 300, 100)),
      curveEntity('h2', line(0, 200, 300, 200)),
      curveEntity('v', line(150, 0, 150, 300)),
    ])
    const targets = resolveStageTrailTargets(index, [{ x: 50, y: 50 }, { x: 250, y: 250 }], options)
    expect(targets.map(({ id }) => id).sort()).toEqual(['h1', 'h2', 'v'])
    const plan = planStageTrim(index, targets, options)
    expect(flatten(plan.commands).filter((item) => item.type === BUILTIN_COMMAND_TYPES.setCurve)).toHaveLength(3)
  })

  it('没划过的曲线不是目标', () => {
    const index = indexOf([curveEntity('h', line(0, 100, 100, 100))])
    expect(resolveStageTrailTargets(index, [{ x: 0, y: 0 }, { x: 50, y: 50 }], options)).toEqual([])
  })
})
