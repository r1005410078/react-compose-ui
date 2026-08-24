import { describe, expect, it } from 'vitest'
import { anchorKey, wireBindingsFor } from './drafting-entity'
import type { ComposeWireBinding } from '@compose-ui/core'

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
