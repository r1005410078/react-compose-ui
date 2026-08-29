import { describe, expect, it } from 'vitest'
import { documentFixture, rendererEntity, ROOT_FRAME_ID } from './test-fixtures'
import { normalizeComposeCurveGeometry } from './curve'
import { validateComposeDocument } from './document'
import { isValidComposeWire, resolveComposeWires } from './wire'
import type { ComposeDocument, ComposeEntity, ComposeLayoutSnapshot } from './document-types'

function deviceEntity(id: string, x: number, y: number, rotation = 0): ComposeEntity {
  const base = rendererEntity(id)
  return {
    ...base,
    components: {
      ...base.components,
      Transform: { position: { x, y }, size: { width: 40, height: 40 }, rotation },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x, y },
        width: { mode: 'fixed', value: 40, min: null, max: null },
        height: { mode: 'fixed', value: 40, min: null, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Ports: { items: [{ id: 'L1', position: { x: 0, y: 0 } }] },
    },
  }
}

function wireEntity(id: string, binding: { readonly start?: unknown; readonly end?: unknown }): ComposeEntity {
  const geometry = normalizeComposeCurveGeometry({
    kind: 'line',
    start: { x: 100, y: 100 },
    end: { x: 300, y: 260 },
  })
  const base = rendererEntity(id)
  return {
    ...base,
    components: {
      ...base.components,
      Renderer: { type: 'curve', props: {} },
      LayoutItem: {
        positioning: 'absolute',
        offset: geometry.offset,
        width: { mode: 'fixed', value: geometry.size.width, min: null, max: null },
        height: { mode: 'fixed', value: geometry.size.height, min: null, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Curve: geometry.curve,
      Wire: binding,
    } as ComposeEntity['components'],
  }
}

function snapshotOf(value: ComposeDocument): ComposeLayoutSnapshot {
  return {
    revision: 1,
    boxes: Object.fromEntries(Object.entries(value.entities).map(([id, entity]) => {
      const item = entity.components.LayoutItem as {
        readonly offset: { readonly x: number; readonly y: number }
        readonly width: { readonly value: number }
        readonly height: { readonly value: number }
      } | undefined
      return [id, {
        x: item?.offset.x ?? 0,
        y: item?.offset.y ?? 0,
        width: item?.width.value ?? 0,
        height: item?.height.value ?? 0,
        positioning: 'absolute' as const,
      }]
    })),
    diagnostics: [],
  }
}

/** 解算后导线在父级坐标下的两个端点。 */
function endpoints(value: ComposeDocument, snapshot: ComposeLayoutSnapshot, id: string) {
  const entity = value.entities[id]!
  const curve = entity.components.Curve as { readonly start: { x: number; y: number }; readonly end: { x: number; y: number } }
  const box = snapshot.boxes[id]!
  return {
    start: { x: box.x + curve.start.x, y: box.y + curve.start.y },
    end: { x: box.x + curve.end.x, y: box.y + curve.end.y },
  }
}

/** 一条带两个拐点的折线导线：(100,100) → (200,100) → (200,200) → (300,260)。 */
function polylineWireEntity(
  id: string,
  binding: { readonly start?: unknown; readonly end?: unknown },
): ComposeEntity {
  const geometry = normalizeComposeCurveGeometry({
    kind: 'polyline',
    vertices: [
      { x: 100, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 200 }, { x: 300, y: 260 },
    ],
    closed: false,
  })
  const base = wireEntity(id, binding)
  return {
    ...base,
    components: {
      ...base.components,
      LayoutItem: {
        ...(base.components.LayoutItem as Record<string, unknown>),
        offset: geometry.offset,
        width: { mode: 'fixed', value: geometry.size.width, min: null, max: null },
        height: { mode: 'fixed', value: geometry.size.height, min: null, max: null },
      },
      Curve: geometry.curve,
    } as ComposeEntity['components'],
  }
}

/** 折线导线的全部顶点，世界坐标。 */
function vertices(value: ComposeDocument, snapshot: ComposeLayoutSnapshot, id: string) {
  const curve = value.entities[id]!.components.Curve as
    { readonly vertices: readonly { x: number; y: number }[] }
  const box = snapshot.boxes[id]!
  return curve.vertices.map(({ x, y }) => ({ x: box.x + x, y: box.y + y }))
}

describe('Wire Component', () => {
  it('两端可选，缺席即自由端', () => {
    expect(isValidComposeWire({})).toBe(true)
    expect(isValidComposeWire({ start: { entityId: 'a', portId: 'L1' } })).toBe(true)
  })

  it('绑定不完整非法', () => {
    // 「配错了」与「还没配」必须可区分：整端缺席是自由端，缺字段是坏数据。
    expect(isValidComposeWire({ start: { entityId: 'a' } })).toBe(false)
    expect(isValidComposeWire({ end: { entityId: 'a', portId: '' } })).toBe(false)
  })

  it('指向已删除的实体不让文档非法', () => {
    const value = documentFixture(
      { wire: wireEntity('wire', { start: { entityId: 'gone', portId: 'L1' } }) },
      ['wire'],
    )
    expect(validateComposeDocument(value).valid).toBe(true)
  })

  it('跨父级绑定给出可判别的问题码', () => {
    const device = deviceEntity('device', 100, 100)
    const value = documentFixture({ device, wire: wireEntity('wire', { start: { entityId: 'device', portId: 'L1' } }) }, ['device', 'wire'])
    const nested: ComposeDocument = {
      ...value,
      entities: {
        ...value.entities,
        [ROOT_FRAME_ID]: {
          ...value.entities[ROOT_FRAME_ID]!,
          components: {
            ...value.entities[ROOT_FRAME_ID]!.components,
            Hierarchy: { childIds: ['wire'] },
          },
        },
        box: {
          id: 'box',
          name: 'box',
          components: {
            ...value.entities.device!.components,
            Hierarchy: { childIds: ['device'] },
          },
        },
      },
      rootIds: value.rootIds,
    }
    const withBox: ComposeDocument = {
      ...nested,
      entities: {
        ...nested.entities,
        [ROOT_FRAME_ID]: {
          ...nested.entities[ROOT_FRAME_ID]!,
          components: {
            ...nested.entities[ROOT_FRAME_ID]!.components,
            Hierarchy: { childIds: ['wire', 'box'] },
          },
        },
      },
    }
    const result = validateComposeDocument(withBox)
    expect(result.valid).toBe(false)
    const issues = result.valid ? [] : result.issues.map((issue) => issue.code)
    expect(issues).toContain('wire.parent-mismatch')
  })
})

describe('resolveComposeWires', () => {
  it('绑定端跟着实例走，自由端不动', () => {
    const value = documentFixture(
      {
        device: deviceEntity('device', 100, 100),
        wire: wireEntity('wire', { start: { entityId: 'device', portId: 'L1' } }),
      },
      ['device', 'wire'],
    )
    const before = resolveComposeWires(value, snapshotOf(value))
    expect(endpoints(before.document, before.snapshot, 'wire').start).toMatchObject({ x: 100, y: 100 })

    const moved: ComposeDocument = {
      ...value,
      entities: { ...value.entities, device: deviceEntity('device', 180, 60) },
    }
    const after = resolveComposeWires(moved, snapshotOf(moved))
    const points = endpoints(after.document, after.snapshot, 'wire')
    expect(points.start).toMatchObject({ x: 180, y: 60 })
    // 自由端一动不动。
    expect(points.end).toMatchObject({ x: 300, y: 260 })
  })

  it('OpenSpec: compose-document / 导线几何求解不存储 / 多段线只动被绑的那一端', () => {
    const value = documentFixture(
      {
        device: deviceEntity('device', 100, 100),
        wire: polylineWireEntity('wire', { start: { entityId: 'device', portId: 'L1' } }),
      },
      ['device', 'wire'],
    )
    const moved: ComposeDocument = {
      ...value,
      entities: { ...value.entities, device: deviceEntity('device', 180, 60) },
    }
    const after = resolveComposeWires(moved, snapshotOf(moved))
    const points = vertices(after.document, after.snapshot, 'wire')

    // 首顶点落到端口的新位置上。
    expect(points[0]).toMatchObject({ x: 180, y: 60 })
    /*
     * 中间两个拐点与末顶点**一个都不动**——绑定端移动之后第一段会变斜，这是明写的代价。
     * 不补偿相邻顶点：两端都可能绑定时中间该听谁的没有答案，而半条「保持正交」的规则产出的
     * 形状用户预测不了。
     */
    expect(points[1]).toMatchObject({ x: 200, y: 100 })
    expect(points[2]).toMatchObject({ x: 200, y: 200 })
    expect(points[3]).toMatchObject({ x: 300, y: 260 })
  })

  it('OpenSpec: compose-document / 导线几何求解不存储 / 两端都绑时首尾各自落到自己的端口上', () => {
    const value = documentFixture(
      {
        a: deviceEntity('a', 100, 100),
        b: deviceEntity('b', 300, 260),
        wire: polylineWireEntity('wire', {
          start: { entityId: 'a', portId: 'L1' },
          end: { entityId: 'b', portId: 'L1' },
        }),
      },
      ['a', 'b', 'wire'],
    )
    const moved: ComposeDocument = {
      ...value,
      entities: {
        ...value.entities,
        a: deviceEntity('a', 60, 40),
        b: deviceEntity('b', 400, 300),
      },
    }
    const after = resolveComposeWires(moved, snapshotOf(moved))
    const points = vertices(after.document, after.snapshot, 'wire')

    expect(points[0]).toMatchObject({ x: 60, y: 40 })
    expect(points[3]).toMatchObject({ x: 400, y: 300 })
    // 中间的拐点仍然一个都不动。
    expect(points[1]).toMatchObject({ x: 200, y: 100 })
    expect(points[2]).toMatchObject({ x: 200, y: 200 })
  })

  it('绕实例自己的旋转基点转', () => {
    // 端口在左上角，盒 40×40，基点缺席即中心 (20,20)：转 90° 之后落在 (中心 + (20,−20))。
    const value = documentFixture(
      {
        device: deviceEntity('device', 100, 100, 90),
        wire: wireEntity('wire', { start: { entityId: 'device', portId: 'L1' } }),
      },
      ['device', 'wire'],
    )
    const resolved = resolveComposeWires(value, snapshotOf(value))
    const { start } = endpoints(resolved.document, resolved.snapshot, 'wire')
    expect(start.x).toBeCloseTo(140, 6)
    expect(start.y).toBeCloseTo(100, 6)
  })

  it('解算失败保留作者几何', () => {
    const value = documentFixture(
      { wire: wireEntity('wire', { start: { entityId: 'gone', portId: 'L1' } }) },
      ['wire'],
    )
    const resolved = resolveComposeWires(value, snapshotOf(value))
    // 引用不变：没有任何导线解算成功时原样返回，订阅方的记忆化因此不会失效。
    expect(resolved.document).toBe(value)
  })

  it('没有导线时原样返回', () => {
    const value = documentFixture({ device: deviceEntity('device', 10, 10) }, ['device'])
    const snapshot = snapshotOf(value)
    const resolved = resolveComposeWires(value, snapshot)
    expect(resolved.document).toBe(value)
    expect(resolved.snapshot).toBe(snapshot)
  })
})
