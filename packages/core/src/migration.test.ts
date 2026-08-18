import { describe, expect, it } from 'vitest'
import * as core from './index'

function legacyV5() {
  return {
    schemaVersion: 5,
    canvas: {
      grid: {
        stepX: 8,
        stepY: 8,
        offsetX: 0,
        offsetY: 0,
        primaryLineEvery: 5,
        snapEnabled: true,
      },
      smartSnap: { nodes: true, guides: true },
      guides: [],
    },
    output: {
      width: 1280,
      height: 720,
      backgroundPaint: { kind: 'solid', color: 'transparent' },
    },
    rootIds: ['container'],
    entities: {
      container: {
        id: 'container',
        name: 'Container',
        components: {
          Composition: {
            presetId: 'container',
            baseComponentKeys: ['Transform', 'Visibility', 'Lock', 'Hierarchy', 'Layout'],
            capabilityIds: [],
          },
          Transform: {
            position: { x: 40, y: 60 },
            size: { width: 320, height: 180 },
            rotation: 5,
          },
          Visibility: { visible: true },
          Lock: { locked: false },
          Hierarchy: { childIds: ['child'] },
          Layout: {
            type: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            alignContent: 'normal',
            justifyContent: 'normal',
            alignItems: 'normal',
            gap: 12,
          },
          HostMetadata: { stable: true },
        },
      },
      child: {
        id: 'child',
        name: 'Child',
        components: {
          Composition: {
            presetId: 'rectangle',
            baseComponentKeys: ['Transform', 'Visibility', 'Lock', 'Renderer'],
            capabilityIds: ['geometry-constraints'],
          },
          Transform: {
            position: { x: 24, y: 32 },
            size: { width: 80, height: 48 },
            rotation: 15,
          },
          TransformConstraints: {
            movable: true,
            resize: 'horizontal',
            rotatable: false,
            minSize: { width: 20, height: 10 },
            maxSize: { width: 200, height: 100 },
          },
          Visibility: { visible: true },
          Lock: { locked: false },
          Renderer: { type: 'rectangle', props: {} },
        },
      },
    },
  }
}

describe('ComposeDocument 显式迁移', () => {
  it('OpenSpec: compose-document / 显式 v5 到 v7 迁移 / 迁移合法 v5 文档', () => {
    const migrate = Reflect.get(core, 'migrateComposeDocumentV5ToV7')
    expect(typeof migrate).toBe('function')
    if (typeof migrate !== 'function') return
    const input = legacyV5()
    const before = structuredClone(input)
    const result = migrate(input)
    expect(input).toEqual(before)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.schemaVersion).toBe(7)
    expect(result.document.entities.child?.components.Transform).toEqual({ rotation: 15 })
    expect(result.document.entities.child?.components.LayoutItem).toEqual({
      positioning: 'absolute',
      offset: { x: 24, y: 32 },
      width: { mode: 'fixed', value: 80, min: 20, max: 200 },
      height: { mode: 'fixed', value: 48, min: 10, max: 100 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      alignSelf: 'auto',
    })
    expect(result.document.entities.child?.components.GeometryConstraints).toEqual({
      movable: true,
      resize: 'horizontal',
      rotatable: false,
    })
    expect(result.document.entities.container?.components.Layout).toEqual({
      type: 'flex',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      alignContent: 'stretch',
      justifyContent: 'flex-start',
      alignItems: 'stretch',
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      rowGap: 12,
      columnGap: 12,
    })
    expect(result.document.entities.container?.components.HostMetadata).toEqual({ stable: true })
    expect(core.validateComposeDocument(result.document).valid).toBe(true)
  })

  it('OpenSpec: compose-document / 版本化 ECS JSON 文档 / 拒绝旧版本', () => {
    expect(core.validateComposeDocument(legacyV5()).valid).toBe(false)
  })

  it('OpenSpec: compose-document / ComposeDocument v6 到 v7 显式迁移 / 迁移完整 v6 文档', () => {
    const v6 = core.migrateComposeDocumentV5ToV7(legacyV5())
    expect(v6.ok).toBe(true)
    if (!v6.ok) return
    // 用一份由 v5 迁移得到的 v7 反推出等价 v6 输入，确保夹具与真实数据同源。
    const legacyV6 = {
      schemaVersion: 6,
      canvas: { ...v6.document.canvas, guides: [{ id: 'g1', axis: 'x' as const, position: 120 }] },
      output: { width: 1440, height: 900, backgroundPaint: { kind: 'solid' as const, color: '#101014' } },
      rootIds: ['container'],
      entities: Object.fromEntries(
        Object.entries(v6.document.entities).filter(([id]) => id !== 'frame-root'),
      ),
      animations: [{ id: 'intro', name: '入场', durationMs: 300, playbackMode: 'loop' as const }],
    }
    const before = structuredClone(legacyV6)
    const result = core.migrateComposeDocumentV6ToV7(legacyV6)
    expect(legacyV6).toEqual(before)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const document = result.document
    expect(document.schemaVersion).toBe(7)
    expect(document.rootIds).toHaveLength(1)
    const frameId = document.rootIds[0]!
    const frame = document.entities[frameId]!
    expect(frame.components.Frame).toEqual({
      size: { width: 1440, height: 900 },
      // 输出原点固定在世界 (0,0)，因此 guides 的坐标变换是恒等的。
      guides: [{ id: 'g1', axis: 'x', position: 120 }],
    })
    expect(frame.components.Appearance).toEqual({
      backgroundPaint: { kind: 'solid', color: '#101014' },
    })
    expect(frame.components.Animations).toEqual({
      items: [{ id: 'intro', name: '入场', durationMs: 300, playbackMode: 'loop' }],
    })
    expect((frame.components.Hierarchy as { childIds: string[] }).childIds).toEqual(['container'])
    // 既有 Entity 逐字段保持不变。
    expect(document.entities.child).toEqual(v6.document.entities.child)
    expect(document.canvas).not.toHaveProperty('guides')
    // 纯函数：同一输入两次迁移结果一致。
    const again = core.migrateComposeDocumentV6ToV7(legacyV6)
    expect(again.ok && again.document).toEqual(document)
  })

  it('OpenSpec: compose-document / ComposeDocument v6 到 v7 显式迁移 / 拒绝隐式升级', () => {
    const v6 = core.migrateComposeDocumentV5ToV7(legacyV5())
    if (!v6.ok) throw new Error('夹具准备失败')
    const legacyV6 = {
      schemaVersion: 6,
      canvas: v6.document.canvas,
      output: { width: 800, height: 600, backgroundPaint: { kind: 'solid' as const, color: 'transparent' } },
      rootIds: ['container'],
      entities: Object.fromEntries(
        Object.entries(v6.document.entities).filter(([id]) => id !== 'frame-root'),
      ),
    }
    const result = core.validateComposeDocument(legacyV6)
    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'document.unsupported-version',
      path: ['schemaVersion'],
    }))
  })

  it('OpenSpec: compose-document / ComposeDocument v6 到 v7 显式迁移 / 无动画与无辅助线的最小文档', () => {
    const v6 = core.migrateComposeDocumentV5ToV7(legacyV5())
    if (!v6.ok) throw new Error('夹具准备失败')
    const result = core.migrateComposeDocumentV6ToV7({
      schemaVersion: 6,
      canvas: v6.document.canvas,
      output: { width: 375, height: 812, backgroundPaint: { kind: 'solid' as const, color: 'transparent' } },
      rootIds: ['container'],
      entities: Object.fromEntries(
        Object.entries(v6.document.entities).filter(([id]) => id !== 'frame-root'),
      ),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const frame = result.document.entities[result.document.rootIds[0]!]!
    expect(frame.components.Animations).toBeUndefined()
    expect(frame.components.Frame).toEqual({ size: { width: 375, height: 812 }, guides: [] })
  })
})
