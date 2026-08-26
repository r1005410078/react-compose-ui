import { describe, expect, it } from 'vitest'
import { anchorKey, sameParentWireEnds, wireBindingsFor } from './drafting-entity'
import type { ComposeDocument, ComposeWireBinding } from '@compose-ui/core'

describe('wireBindingsFor', () => {
  const port: ComposeWireBinding = { entityId: 'device', portId: 'L1' }
  const anchors = new Map([[anchorKey({ x: 10, y: 20 }), port]])

  it('只有被记下来源的那一端才绑定', () => {
    const wire = wireBindingsFor(anchors, {
      kind: 'line',
      start: { x: 10, y: 20 },
      end: { x: 200, y: 300 },
    })

    expect(wire).toEqual({ start: port })
  })

  it('坐标相同但没有记录时不绑定', () => {
    // 绑定来自取点，不是事后按坐标反查：反查会让一条恰好路过端口的普通线莫名其妙地绑上。
    expect(wireBindingsFor(new Map(), {
      kind: 'line',
      start: { x: 10, y: 20 },
      end: { x: 200, y: 300 },
    })).toEqual({})
  })

  it('非直线没有绑定', () => {
    expect(wireBindingsFor(anchors, {
      kind: 'arc',
      center: { x: 10, y: 20 },
      radius: 5,
      startAngle: 0,
      sweep: 90,
    })).toBeUndefined()
  })
})

describe('sameParentWireEnds', () => {
  const port: ComposeWireBinding = { entityId: 'device', portId: 'L1' }

  /** 两块场景，`device` 在 `frame-a` 里。 */
  const document = {
    schemaVersion: 7,
    canvas: { grid: {}, smartSnap: {} },
    rootIds: ['frame-a', 'frame-b'],
    entities: {
      'frame-a': { id: 'frame-a', components: { Hierarchy: { childIds: ['device'] } } },
      'frame-b': { id: 'frame-b', components: { Hierarchy: { childIds: [] } } },
      device: { id: 'device', components: {} },
    },
  } as unknown as ComposeDocument

  it('OpenSpec: stage-engine / LINE 取点落在端口上即绑定 / 同父级的绑定原样保留', () => {
    expect(sameParentWireEnds(document, { start: port }, 'frame-a')).toEqual({
      dropped: [],
      wire: { start: port },
    })
  })

  it('OpenSpec: stage-engine / LINE 取点落在端口上即绑定 / 跨父级那一端被丢掉并报出来', () => {
    // 判别点：`wire.parent-mismatch` 是**文档非法**而不是警告，而落地父级按线段包围盒中心
    // 判定，因此「从帧内符号的端口拉一条线到帧外」这个平常手势绑上就会让整份文档校验失败。
    // 不绑是可见的降级（Inspector 显示该端自由），非法文档是不可见的。
    expect(sameParentWireEnds(document, { start: port }, 'frame-b')).toEqual({
      dropped: ['start'],
      wire: undefined,
    })
  })

  it('OpenSpec: stage-engine / LINE 取点落在端口上即绑定 / 只丢跨父级的那一端', () => {
    const other: ComposeWireBinding = { entityId: 'frame-a', portId: 'X' }
    expect(sameParentWireEnds(document, { start: port, end: other }, 'frame-a')).toEqual({
      dropped: ['end'],
      wire: { start: port },
    })
  })
})
