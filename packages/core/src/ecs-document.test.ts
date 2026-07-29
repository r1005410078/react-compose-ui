import { describe, expect, it } from 'vitest'
import { validateComposeDocument } from './document'

function rectangleDocument() {
  return {
    schemaVersion: 5,
    canvas: {
      grid: {
        stepX: 8,
        stepY: 8,
        offsetX: 0,
        offsetY: 0,
        primaryLineEvery: 8,
        snapEnabled: true,
      },
      smartSnap: { nodes: true, guides: true },
      guides: [],
    },
    output: { width: 1280, height: 720, backgroundColor: 'transparent' },
    rootIds: ['rectangle-1'],
    entities: {
      'rectangle-1': {
        id: 'rectangle-1',
        name: 'Rectangle',
        components: {
          Composition: {
            presetId: 'rectangle',
            baseComponentKeys: [
              'Transform',
              'Visibility',
              'Lock',
              'Appearance',
              'Renderer',
            ],
            capabilityIds: [],
          },
          Transform: {
            position: { x: 100, y: 80 },
            size: { width: 320, height: 180 },
            rotation: 0,
          },
          Visibility: { visible: true },
          Lock: { locked: false },
          Appearance: { backgroundPaint: { kind: 'solid', color: '#3b82f6' }, opacity: 1 },
          Renderer: { type: 'rectangle', props: {} },
          HostMetadata: { stable: true },
        },
      },
    },
  }
}

describe('ComposeDocument v5 ECS', () => {
  it('OpenSpec: compose-document / 版本化 ECS JSON 文档 / 接受 v5 并拒绝 v4', () => {
    expect(validateComposeDocument(rectangleDocument()).valid).toBe(true)
    expect(validateComposeDocument({
      schemaVersion: 4,
      canvas: rectangleDocument().canvas,
      output: rectangleDocument().output,
      rootIds: [],
      nodes: {},
    }).valid).toBe(false)
  })

  it('OpenSpec: compose-document / 统一 Entity 与 PascalCase Components / 保存未知 Component', () => {
    const result = validateComposeDocument(rectangleDocument())
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.document.entities['rectangle-1']?.components.HostMetadata).toEqual({
        stable: true,
      })
    }
  })

  it('OpenSpec: compose-document / 场景 Entity 最小组合 / 可渲染容器', () => {
    const input = structuredClone(rectangleDocument())
    const components = input.entities['rectangle-1']!.components as Record<string, unknown>
    components.Hierarchy = { childIds: [] }
    components.Clip = { enabled: true }
    expect(validateComposeDocument(input).valid).toBe(true)
  })
})
