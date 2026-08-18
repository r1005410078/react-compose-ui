import { describe, expect, it } from 'vitest'
import { validateComposeDocument } from './document'
import { getComposeBindings, resolveComposeOverflow } from './entity'

function rectangleDocument() {
  return {
    schemaVersion: 7,
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
    },
    rootIds: ['frame-root'],
    entities: {
      'frame-root': {
        id: 'frame-root',
        name: '画板',
        components: {
          Composition: {
            presetId: 'frame',
            baseComponentKeys: [
              'Transform',
              'LayoutItem',
              'Visibility',
              'Lock',
              'Hierarchy',
              'Frame',
              'Appearance',
            ],
            capabilityIds: [],
          },
          Transform: { rotation: 0 },
          LayoutItem: {
            positioning: 'absolute',
            offset: { x: 0, y: 0 },
            width: { mode: 'fixed', value: 1280, min: 1, max: null },
            height: { mode: 'fixed', value: 720, min: 1, max: null },
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            alignSelf: 'auto',
          },
          Visibility: { visible: true },
          Lock: { locked: false },
          Hierarchy: { childIds: ['rectangle-1'] },
          Frame: { size: { width: 1280, height: 720 }, guides: [] },
          Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' } },
        },
      },
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

describe('ComposeDocument v7 ECS', () => {
  it('OpenSpec: compose-document / 版本化 ECS JSON 文档 / 接受 v7 并拒绝 v6', () => {
    expect(validateComposeDocument(rectangleDocument()).valid).toBe(true)
    expect(validateComposeDocument({
      ...rectangleDocument(),
      schemaVersion: 6,
      output: { width: 1280, height: 720, backgroundPaint: { kind: 'solid', color: 'transparent' } },
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

  it('OpenSpec: compose-document / Frame Component 与隔离边界 / 校验结构化 Frame 背景', () => {
    const gradient = structuredClone(rectangleDocument())
    const frameComponents = gradient.entities['frame-root']!.components as Record<string, unknown>
    frameComponents.Appearance = {
      backgroundPaint: {
        kind: 'linear-gradient',
        start: { x: 0, y: 0.5 },
        end: { x: 1, y: 0.5 },
        stops: [
          { id: 'start', position: 0, color: '#0cdeab' },
          { id: 'end', position: 1, color: '#06785c' },
        ],
      },
    }
    expect(validateComposeDocument(gradient).valid).toBe(true)

    const legacy = structuredClone(rectangleDocument())
    const legacyComponents = legacy.entities['frame-root']!.components as Record<string, unknown>
    legacyComponents.Appearance = { backgroundColor: 'transparent' }
    expect(validateComposeDocument(legacy).valid).toBe(false)
  })

  it('OpenSpec: compose-document / Frame Component 与隔离边界 / 拒绝无 Hierarchy 的 Frame', () => {
    const input = structuredClone(rectangleDocument())
    const components = input.entities['rectangle-1']!.components as Record<string, unknown>
    components.Frame = { size: { width: 100, height: 100 } }
    const result = validateComposeDocument(input)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: 'component.invalid-combination',
        path: ['entities', 'rectangle-1', 'components', 'Frame'],
      }))
    }
  })

  it('OpenSpec: compose-document / Frame 动画清单 Component / 拒绝无 Frame 的 Animations', () => {
    const input = structuredClone(rectangleDocument())
    const components = input.entities['rectangle-1']!.components as Record<string, unknown>
    components.Animations = { items: [] }
    const result = validateComposeDocument(input)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: 'component.invalid-combination',
        path: ['entities', 'rectangle-1', 'components', 'Animations'],
      }))
    }
  })

  it('OpenSpec: compose-document / 根层级 Frame 约束 / 拒绝根层级的非 Frame Entity', () => {
    const input = structuredClone(rectangleDocument())
    input.rootIds = ['frame-root', 'rectangle-1']
    const frameComponents = input.entities['frame-root']!.components as Record<string, unknown>
    frameComponents.Hierarchy = { childIds: [] }
    const result = validateComposeDocument(input)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: 'document.root-not-frame',
        path: ['rootIds', 1],
      }))
    }
  })

  it('OpenSpec: compose-document / 根层级 Frame 约束 / 多画板文档', () => {
    const input = structuredClone(rectangleDocument()) as unknown as {
      rootIds: string[]
      entities: Record<string, { id: string; name: string; components: Record<string, unknown> }>
    }
    const second = structuredClone(input.entities['frame-root']!)
    const secondComponents = second.components as Record<string, unknown>
    second.id = 'frame-second'
    secondComponents.Hierarchy = { childIds: [] }
    secondComponents.Frame = { size: { width: 375, height: 812 }, guides: [] }
    input.entities['frame-second'] = second
    input.rootIds = ['frame-root', 'frame-second']
    const result = validateComposeDocument(input)
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.document.rootIds).toEqual(['frame-root', 'frame-second'])
  })

  it('OpenSpec: compose-document / Frame 局部辅助线 / 拒绝重复 guide ID', () => {
    const input = structuredClone(rectangleDocument())
    const components = input.entities['frame-root']!.components as Record<string, unknown>
    components.Frame = {
      size: { width: 1280, height: 720 },
      guides: [
        { id: 'g1', axis: 'x', position: -40 },
        { id: 'g1', axis: 'y', position: 12 },
      ],
    }
    const result = validateComposeDocument(input)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: 'frame.duplicate-guide',
        path: ['entities', 'frame-root', 'components', 'Frame', 'guides', 1, 'id'],
      }))
    }
  })

  it('OpenSpec: compose-document / 版本化 ECS JSON 文档 / 拒绝 Frame 上的 Hug', () => {
    const input = structuredClone(rectangleDocument())
    const components = input.entities['frame-root']!.components as Record<string, unknown>
    const layoutItem = components.LayoutItem as Record<string, unknown>
    layoutItem.height = { mode: 'hug', value: 720, min: 1, max: null }
    const result = validateComposeDocument(input)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: 'layout-item.invalid',
        path: ['entities', 'frame-root', 'components', 'LayoutItem', 'height', 'mode'],
      }))
    }
  })

  it('OpenSpec: compose-document / Renderer Props 绑定 Component / 保存顶层字段绑定', () => {
    const input = structuredClone(rectangleDocument())
    const entity = input.entities['rectangle-1']!
    const components = entity.components as Record<string, unknown>
    components.Bindings = {
      version: 1,
      rendererProps: {
        fields: {
          text: { scope: 'page', exportName: 'num' },
          onClick: { scope: 'page', exportName: 'onAdd' },
          unknownFutureProp: { scope: 'page', exportName: 'futureValue' },
        },
      },
    }

    const result = validateComposeDocument(JSON.parse(JSON.stringify(input)))
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(getComposeBindings(result.document.entities['rectangle-1']!)).toEqual(components.Bindings)
    }
  })

  it('OpenSpec: compose-document / Renderer Props 绑定 Component / 拒绝非法形状与组合', () => {
    const cases: Array<{ input: ReturnType<typeof rectangleDocument>; path: readonly (string | number)[] }> = []

    const withoutRenderer = structuredClone(rectangleDocument())
    const withoutRendererComponents = withoutRenderer.entities['rectangle-1']!.components as Record<string, unknown>
    delete withoutRendererComponents.Renderer
    withoutRendererComponents.Hierarchy = { childIds: [] }
    withoutRendererComponents.Bindings = {
      version: 1,
      rendererProps: { fields: { text: { scope: 'page', exportName: 'num' } } },
    }
    cases.push({
      input: withoutRenderer,
      path: ['entities', 'rectangle-1', 'components', 'Bindings'],
    })

    const malformed = structuredClone(rectangleDocument())
    const malformedComponents = malformed.entities['rectangle-1']!.components as Record<string, unknown>
    malformedComponents.Bindings = {
      version: 2,
      rendererProps: {
        fields: {
          '': { scope: 'page', exportName: 'num' },
          onClick: { scope: 'global', exportName: '' },
        },
      },
    }
    cases.push({
      input: malformed,
      path: ['entities', 'rectangle-1', 'components', 'Bindings', 'version'],
    })

    for (const testCase of cases) {
      const result = validateComposeDocument(testCase.input)
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.issues).toContainEqual(expect.objectContaining({
          code: 'bindings.invalid',
          path: testCase.path,
        }))
      }
    }
  })

  it('OpenSpec: compose-document / Renderer Props 绑定 Component / 拒绝已撤回的整个 Props 字段', () => {
    const input = structuredClone(rectangleDocument())
    const components = input.entities['rectangle-1']!.components as Record<string, unknown>
    components.Bindings = {
      version: 1,
      rendererProps: {
        object: { scope: 'page', exportName: 'textProps' },
        fields: { text: { scope: 'page', exportName: 'num' } },
      },
    }
    const result = validateComposeDocument(input)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: 'bindings.invalid',
        path: ['entities', 'rectangle-1', 'components', 'Bindings', 'rendererProps', 'object'],
      }))
    }
  })

  it('OpenSpec: compose-document / Renderer Props 绑定 Component / 拒绝空 Bindings', () => {
    const input = structuredClone(rectangleDocument())
    const components = input.entities['rectangle-1']!.components as Record<string, unknown>
    components.Bindings = {
      version: 1,
      rendererProps: { fields: {} },
    }
    const result = validateComposeDocument(input)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: 'bindings.invalid',
        path: ['entities', 'rectangle-1', 'components', 'Bindings', 'rendererProps'],
      }))
    }
  })
})
