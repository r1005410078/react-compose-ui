import { describe, expect, it } from 'vitest'
import {
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  normalizeComposeCurveGeometry,
  type ComposeCurve,
  type ComposeEntity,
} from '@compose-ui/core'
import { resolveStageBoolean, resolveStageFlatten } from './curve-boolean'
import { createStageSceneIndex } from '../hit-testing'
import { document, entity, layoutSnapshot } from '../test-fixtures'

function curveEntity(
  id: string,
  curve: ComposeCurve,
  options: { readonly locked?: boolean; readonly extra?: Record<string, unknown> } = {},
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
      ...options.extra,
    },
  } as ComposeEntity
}

/** 不带 `Curve` 的普通盒：容器、文字、图片在这条判据下是同一类。 */
function boxEntity(id: string): ComposeEntity {
  return entity(id, { x: 0, y: 0, width: 40, height: 40 })
}

const rect = (x: number, y: number, w: number, h: number): ComposeCurve => ({
  kind: 'polyline',
  closed: true,
  vertices: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }],
})

function indexOf(entities: readonly ComposeEntity[]) {
  const value = document(entities)
  return createStageSceneIndex(value, layoutSnapshot(value))
}

describe('OpenSpec: stage-engine / 拍平的解算', () => {
  it('一个矩形拍平成一条 path', () => {
    const index = indexOf([curveEntity('a', rect(0, 0, 100, 60))])
    const resolution = resolveStageFlatten(index, ['a'])
    expect(resolution.status).toBe('resolved')
    if (resolution.status !== 'resolved') return
    expect(resolution.curve.kind).toBe('path')
    expect(resolution.operands).toHaveLength(1)
  })

  it('操作数按层序从下到上排，最下面那个排在第一个', () => {
    // `document()` 按传入顺序建 `rootIds`，先建的画在下面。
    const index = indexOf([
      curveEntity('bottom', rect(0, 0, 40, 40)),
      curveEntity('top', rect(20, 20, 40, 40)),
    ])
    const resolution = resolveStageFlatten(index, ['top', 'bottom'])
    expect(resolution.status).toBe('resolved')
    if (resolution.status !== 'resolved') return
    expect(resolution.operands.map((operand) => operand.entityId)).toEqual(['bottom', 'top'])
  })

  it('一个操作数都没有时以 too-few 拒绝', () => {
    const index = indexOf([curveEntity('a', rect(0, 0, 40, 40))])
    expect(resolveStageFlatten(index, []).status).toBe('rejected')
    expect(resolveStageFlatten(index, [])).toMatchObject({ reason: 'too-few' })
  })

  it('不带几何的对象以 no-geometry 拒绝，并指出是哪一个', () => {
    const index = indexOf([curveEntity('a', rect(0, 0, 40, 40)), boxEntity('panel')])
    const resolution = resolveStageFlatten(index, ['a', 'panel'])
    expect(resolution).toMatchObject({ status: 'rejected', reason: 'no-geometry' })
    if (resolution.status !== 'rejected') return
    expect(resolution.entityName).toBe(index.document.entities.panel!.name)
  })

  it('锁定的操作数拒绝，MUST NOT 静默跳过它', () => {
    const index = indexOf([curveEntity('a', rect(0, 0, 40, 40), { locked: true })])
    expect(resolveStageFlatten(index, ['a'])).toMatchObject({
      status: 'rejected',
      reason: 'locked',
    })
  })

  it('被导线绑着的操作数拒绝——删掉它会让绑定悬空，而那个错只在 Inspector 里现形', () => {
    const wire = curveEntity('wire', { kind: 'line', start: { x: 0, y: 0 }, end: { x: 50, y: 0 } }, {
      extra: {
        [COMPOSE_BUILTIN_COMPONENT_KEYS.wire]: { start: { entityId: 'a', portId: 'p1' } },
      },
    })
    const index = indexOf([curveEntity('a', rect(0, 0, 40, 40)), wire])
    expect(resolveStageFlatten(index, ['a'])).toMatchObject({
      status: 'rejected',
      reason: 'wired',
    })
  })

  it('贝塞尔与直线都放行——拍平不求交，那两条限制的理由在这里不成立', () => {
    const path: ComposeCurve = {
      kind: 'path',
      subpaths: [{
        start: { x: 0, y: 0 },
        segments: [{ c1: { x: 10, y: 30 }, c2: { x: 40, y: 30 }, to: { x: 50, y: 0 } }],
        closed: false,
      }],
    }
    const index = indexOf([
      curveEntity('curvy', path),
      curveEntity('straight', { kind: 'line', start: { x: 0, y: 0 }, end: { x: 30, y: 20 } }),
    ])
    expect(resolveStageFlatten(index, ['curvy', 'straight']).status).toBe('resolved')
  })
})

describe('OpenSpec: stage-engine / 布尔解算与操作数次序', () => {
  it('两个重叠矩形求并集', () => {
    const index = indexOf([
      curveEntity('a', rect(0, 0, 40, 40)),
      curveEntity('b', rect(20, 20, 40, 40)),
    ])
    const resolution = resolveStageBoolean(index, ['a', 'b'], 'union')
    expect(resolution.status).toBe('resolved')
    if (resolution.status !== 'resolved') return
    expect(resolution.curve.kind).toBe('polyline')
  })

  it('差集减的是层序最靠后那个，与选中次序无关', () => {
    const index = indexOf([
      curveEntity('bottom', rect(0, 0, 40, 40)),
      curveEntity('top', rect(20, 20, 40, 40)),
    ])
    // 两种选中次序给出同一个结果：次序由层序定，不由用户点的先后定。
    for (const ids of [['top', 'bottom'], ['bottom', 'top']]) {
      const resolution = resolveStageBoolean(index, ids, 'subtract')
      expect(resolution.status).toBe('resolved')
      if (resolution.status !== 'resolved') continue
      expect(resolution.operands[0]!.entityId).toBe('bottom')
    }
  })

  it('不相交的两个形状求交集：报「没有面积」而不是求解退化', () => {
    const index = indexOf([
      curveEntity('a', rect(0, 0, 20, 20)),
      curveEntity('b', rect(100, 100, 20, 20)),
    ])
    expect(resolveStageBoolean(index, ['a', 'b'], 'intersect')).toMatchObject({
      status: 'rejected',
      reason: 'empty',
    })
  })

  it('区域运算拒绝贝塞尔与直线——拍平放行的那两条在这里挡得住', () => {
    const path: ComposeCurve = {
      kind: 'path',
      subpaths: [{
        start: { x: 0, y: 0 },
        segments: [{ c1: { x: 10, y: 30 }, c2: { x: 40, y: 30 }, to: { x: 50, y: 0 } }],
        closed: true,
      }],
    }
    const index = indexOf([
      curveEntity('box', rect(0, 0, 40, 40)),
      curveEntity('curvy', path),
      curveEntity('straight', { kind: 'line', start: { x: 0, y: 0 }, end: { x: 30, y: 20 } }),
    ])
    expect(resolveStageBoolean(index, ['box', 'curvy'], 'union')).toMatchObject({
      status: 'rejected',
      reason: 'bezier',
    })
    expect(resolveStageBoolean(index, ['box', 'straight'], 'union')).toMatchObject({
      status: 'rejected',
      reason: 'line',
    })
    // 同一批对象拍平照样成立：判据按运算分，不是一份全局清单。
    expect(resolveStageFlatten(index, ['box', 'curvy', 'straight']).status).toBe('resolved')
  })

  it('只选一个对象时区域运算以 too-few 拒绝', () => {
    const index = indexOf([curveEntity('a', rect(0, 0, 40, 40))])
    expect(resolveStageBoolean(index, ['a'], 'union')).toMatchObject({
      status: 'rejected',
      reason: 'too-few',
    })
  })
})
