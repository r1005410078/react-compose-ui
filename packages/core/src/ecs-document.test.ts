import { describe, expect, it } from 'vitest'
import { validateComposeDocument } from './document'
import { resolveComposeOverflow } from './entity'

function rectangleDocument() {
  return {
    schemaVersion: 6,
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
    output: { width: 1280, height: 720, backgroundPaint: { kind: 'solid', color: 'transparent' } },
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
              'LayoutItem',
              'Visibility',
              'Lock',
              'Appearance',
              'Renderer',
            ],
            capabilityIds: [],
          },
          Transform: {
            rotation: 0,
          },
          LayoutItem: {
            positioning: 'absolute',
            offset: { x: 100, y: 80 },
            width: { mode: 'fixed', value: 320, min: 1, max: null },
            height: { mode: 'fixed', value: 180, min: 1, max: null },
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            alignSelf: 'auto',
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

describe('ComposeDocument v6 ECS', () => {
  it('OpenSpec: compose-document / 版本化 ECS JSON 文档 / 接受 v6 并拒绝 v5', () => {
    expect(validateComposeDocument(rectangleDocument()).valid).toBe(true)
    expect(validateComposeDocument({
      schemaVersion: 5,
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

  it('OpenSpec: Container 分轴溢出协议 / 读取旧 Clip 文档', () => {
    const input = structuredClone(rectangleDocument())
    const entity = input.entities['rectangle-1']!
    const components = entity.components as Record<string, unknown>
    components.Hierarchy = { childIds: [] }
    components.Clip = { enabled: true }
    expect(resolveComposeOverflow(entity)).toEqual({ horizontal: 'clip', vertical: 'clip' })
    components.Clip = { enabled: false }
    expect(resolveComposeOverflow(entity)).toEqual({ horizontal: 'visible', vertical: 'visible' })
  })

  it('拒绝缺少配对轴或 scroll 与 visible 混合的 Clip', () => {
    const input = structuredClone(rectangleDocument())
    const components = input.entities['rectangle-1']!.components as Record<string, unknown>
    components.Hierarchy = { childIds: [] }
    components.Clip = { enabled: true, horizontal: 'scroll' }
    expect(validateComposeDocument(input).valid).toBe(false)
    components.Clip = { enabled: true, horizontal: 'scroll', vertical: 'visible' }
    expect(validateComposeDocument(input).valid).toBe(false)
    components.Clip = { enabled: true, horizontal: 'scroll', vertical: 'clip' }
    expect(validateComposeDocument(input).valid).toBe(true)
  })

  it('OpenSpec: compose-document / 固定原点输出设置 / 校验结构化输出背景', () => {
    const gradientOutput = {
      ...rectangleDocument(),
      output: {
        width: 1280,
        height: 720,
        backgroundPaint: {
          kind: 'linear-gradient',
          start: { x: 0, y: 0.5 },
          end: { x: 1, y: 0.5 },
          stops: [
            { id: 'start', position: 0, color: '#0cdeab' },
            { id: 'end', position: 1, color: '#06785c' },
          ],
        },
      },
    }

    const legacyOutput = {
      ...rectangleDocument(),
      output: { width: 1280, height: 720, backgroundColor: 'transparent' },
    }

    expect(validateComposeDocument(gradientOutput).valid).toBe(true)
    expect(validateComposeDocument(legacyOutput).valid).toBe(false)
  })
})
