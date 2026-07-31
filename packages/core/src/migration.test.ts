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

describe('ComposeDocument v5 → v6 migration', () => {
  it('OpenSpec: compose-document / 显式 v5 到 v6 迁移 / 迁移合法 v5 文档', () => {
    const migrate = Reflect.get(core, 'migrateComposeDocumentV5ToV6')
    expect(typeof migrate).toBe('function')
    if (typeof migrate !== 'function') return
    const input = legacyV5()
    const before = structuredClone(input)
    const result = migrate(input)
    expect(input).toEqual(before)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.schemaVersion).toBe(6)
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

  it('OpenSpec: compose-document / 版本化 ECS JSON 文档 / 接受 v6 并拒绝旧版本', () => {
    expect(core.validateComposeDocument(legacyV5()).valid).toBe(false)
  })
})
