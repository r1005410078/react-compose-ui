import { describe, expect, it } from 'vitest'
import {
  anchorKey,
  createStageDraftingCurveCommand,
  wireBindingsFor,
  type StageDraftingCommitContext,
} from './drafting-entity'
import type { ComposeCurve, ComposeWireBinding } from '@compose-ui/core'

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

/*
 * Registry 与场景索引都用窄替身：`stage` 不依赖 `materials`，搭一套真实 Preset 要把整包物料
 * 拖进来，而这里要断言的只有一件事——落地时按哪个 id 取 seed。
 */
function commitContext(created: string[]): StageDraftingCommitContext {
  let serial = 0
  return {
    document: { schema: 'ComposeDocument', version: 7, rootIds: [], entities: {} } as never,
    layoutSnapshot: { entities: {} } as never,
    index: { containerAtPoint: () => null } as never,
    registry: {
      createSeed(presetId: string) {
        created.push(presetId)
        // `wire` 缺席的分支要能被单独试出来，因此这里按 id 决定成功与否。
        if (presetId === 'missing') return { ok: false, error: { message: '缺失' } }
        return {
          ok: true,
          seed: {
            name: presetId,
            components: {
              Composition: { presetId },
              LayoutItem: {
                width: { mode: 'fixed', value: 0 },
                height: { mode: 'fixed', value: 0 },
              },
            },
          },
        }
      },
    } as never,
    idFactory: () => `id-${++serial}`,
  }
}

const line: ComposeCurve = { kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 50 } }

describe('createStageDraftingCurveCommand 的 Preset 选择', () => {
  it('OpenSpec: stage / 导线落地使用导线 Preset / 画出的导线走 wire Preset', () => {
    const created: string[] = []
    // 两端都没接到端口时也走 `wire`：一条谁也没接的导线仍然是主回路。
    expect(createStageDraftingCurveCommand(commitContext(created), line, { wire: {} }))
      .not.toBeNull()
    expect(created).toEqual(['wire'])
  })

  it('OpenSpec: stage / 导线落地使用导线 Preset / LINE 仍用普通曲线 Preset', () => {
    const created: string[] = []
    createStageDraftingCurveCommand(commitContext(created), line)
    createStageDraftingCurveCommand(commitContext(created), line, { arrow: true })
    expect(created).toEqual(['curve', 'arrow'])
  })

  it('OpenSpec: stage / 导线落地使用导线 Preset / Preset 缺失时不回退', () => {
    const context = commitContext([])
    const registry = {
      createSeed: () => ({ ok: false, error: { message: '缺失' } }),
    } as never
    // 静默回退到 `curve` 会画出一条看起来像标注线的导线，而它是主回路且带着看不见的绑定。
    expect(createStageDraftingCurveCommand({ ...context, registry }, line, { wire: {} }))
      .toBeNull()
  })
})
