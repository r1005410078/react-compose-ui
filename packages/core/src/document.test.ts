import { describe, expect, it } from 'vitest'
import { validateComposeDocument } from './document'
import { containerEntity, documentFixture, rendererEntity, transform } from './test-fixtures'

describe('ComposeDocument v6 validation', () => {
  it('OpenSpec: compose-document / 版本化 ECS JSON 文档 / 接受 v6 并拒绝旧版本', () => {
    expect(validateComposeDocument(documentFixture()).valid).toBe(true)
    expect(validateComposeDocument({
      ...documentFixture(),
      schemaVersion: 5,
      nodes: {},
    }).valid).toBe(false)
  })

  it('OpenSpec: compose-document / 统一 Entity 与 PascalCase Components / 保存未知 Component', () => {
    const entity = rendererEntity('host', {
      components: { HostMetadata: { enabled: true, nested: { value: 1 } } },
    })
    const result = validateComposeDocument(documentFixture({ host: entity }))
    expect(result).toEqual({ valid: true, document: documentFixture({ host: entity }) })
  })

  it('OpenSpec: compose-document / 统一 Entity 与 PascalCase Components / 拒绝非法 Component Key', () => {
    const input = structuredClone(documentFixture()) as unknown as {
      entities: Record<string, { components: Record<string, unknown> }>
    }
    input.entities.rectangle!.components.transformPolicy = {}
    const result = validateComposeDocument(input)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: 'component.invalid-key',
        path: ['entities', 'rectangle', 'components', 'transformPolicy'],
      }))
    }
  })

  it('OpenSpec: compose-document / 场景 Entity 最小组合 / 可渲染容器', () => {
    expect(validateComposeDocument(documentFixture({
      combined: containerEntity('combined', [], { renderer: true }),
    })).valid).toBe(true)
  })

  it('OpenSpec: compose-document / 场景 Entity 最小组合 / 拒绝不完整组合', () => {
    const input = structuredClone(documentFixture()) as unknown as {
      entities: Record<string, { components: Record<string, unknown> }>
    }
    delete input.entities.rectangle!.components.Renderer
    const result = validateComposeDocument(input)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: 'component.invalid-combination',
      }))
    }
  })

  it('OpenSpec: compose-document / Composition 归属数据 / 保存 Preset 和能力归属', () => {
    const input = structuredClone(documentFixture()) as unknown as {
      entities: Record<string, { components: Record<string, {
        capabilityIds: string[]
      }> }>
    }
    input.entities.rectangle!.components.Composition!.capabilityIds.push('geometry-constraints')
    ;(input.entities.rectangle!.components as Record<string, unknown>).GeometryConstraints = {
      movable: true,
      resize: 'free',
      rotatable: true,
    }
    expect(validateComposeDocument(input).valid).toBe(true)
  })

  it('OpenSpec: compose-document / Transform 与几何限制 / 保存独立几何限制', () => {
    const entity = rendererEntity('limited', {
      components: {
        GeometryConstraints: {
          movable: true,
          resize: 'horizontal',
          rotatable: false,
        },
      },
    })
    expect(validateComposeDocument(documentFixture({ limited: entity })).valid).toBe(true)
  })

  it('OpenSpec: compose-document / Transform 与几何限制 / 拒绝非法尺寸限制', () => {
    const entity = rendererEntity('limited', {
      transform: transform(0, 0, 20, 20),
      components: {
        LayoutItem: {
          positioning: 'absolute',
          offset: { x: 0, y: 0 },
          width: { mode: 'fixed', value: 20, min: 100, max: 50 },
          height: { mode: 'fixed', value: 20, min: 100, max: 50 },
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          alignSelf: 'auto',
        },
      },
    })
    const result = validateComposeDocument(documentFixture({ limited: entity }))
    expect(result.valid).toBe(false)
  })

  it('OpenSpec: compose-document / ECS 层级拓扑 / 使用 Renderer 与 Hierarchy 组合树', () => {
    const leaf = rendererEntity('leaf')
    const parent = containerEntity('parent', ['leaf'], { renderer: true })
    expect(validateComposeDocument(
      documentFixture({ parent, leaf }, ['parent']),
    ).valid).toBe(true)
  })

  it('OpenSpec: compose-document / ECS 层级拓扑 / 拒绝非法 ECS 拓扑', () => {
    const leaf = rendererEntity('leaf')
    const first = containerEntity('first', ['leaf'])
    const second = containerEntity('second', ['leaf'])
    const result = validateComposeDocument(
      documentFixture({ first, second, leaf }, ['first', 'second']),
    )
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: 'document.multiple-parents',
      }))
    }
  })

  it('OpenSpec: compose-document / 可选 Flex Layout Component / 保存合法 Flex 布局', () => {
    const entity = containerEntity('layout')
    ;(entity.components as Record<string, unknown>).Layout = {
      type: 'flex',
      flexDirection: 'column-reverse',
      flexWrap: 'wrap-reverse',
      alignContent: 'space-between',
      justifyContent: 'space-evenly',
      alignItems: 'baseline',
      padding: { top: 1, right: 2, bottom: 3, left: 4 },
      rowGap: 12.5,
      columnGap: 6,
    }
    expect(validateComposeDocument(documentFixture({ layout: entity }))).toEqual({
      valid: true,
      document: documentFixture({ layout: entity }),
    })
  })

  it('OpenSpec: compose-document / 可选 Flex Layout Component / 拒绝非法 Layout', () => {
    const invalidEnum = containerEntity('invalid-enum')
    ;(invalidEnum.components as Record<string, unknown>).Layout = {
      type: 'flex',
      flexDirection: 'diagonal',
      flexWrap: 'nowrap',
      alignContent: 'stretch',
      justifyContent: 'flex-start',
      alignItems: 'stretch',
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      rowGap: 0,
      columnGap: 0,
    }
    const invalidGap = containerEntity('invalid-gap')
    ;(invalidGap.components as Record<string, unknown>).Layout = {
      type: 'flex',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      alignContent: 'stretch',
      justifyContent: 'flex-start',
      alignItems: 'stretch',
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      rowGap: -1,
      columnGap: 0,
    }
    const withoutHierarchy = rendererEntity('without-hierarchy', {
      components: {
        Layout: {
          type: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          alignContent: 'stretch',
          justifyContent: 'flex-start',
          alignItems: 'stretch',
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          rowGap: 0,
          columnGap: 0,
        },
      },
    })
    for (const [id, entity] of [
      ['invalid-enum', invalidEnum],
      ['invalid-gap', invalidGap],
      ['without-hierarchy', withoutHierarchy],
    ] as const) {
      const result = validateComposeDocument(documentFixture({ [id]: entity }))
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.issues).toContainEqual(expect.objectContaining({
          code: id === 'without-hierarchy'
            ? 'component.invalid-combination'
            : 'layout.invalid',
          path: expect.arrayContaining(['entities', id, 'components', 'Layout']),
        }))
      }
    }
  })

  it('OpenSpec: compose-document / 可选 Flex Layout Component / 兼容缺少 Layout 的旧文档', () => {
    const legacy = containerEntity('legacy')
    expect(legacy.components.Layout).toBeUndefined()
    expect(validateComposeDocument(documentFixture({ legacy })).valid).toBe(true)
  })
})
