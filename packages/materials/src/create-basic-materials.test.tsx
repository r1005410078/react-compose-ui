import { render, screen } from '@testing-library/react'
import {
  ComposeRegistryEntityRenderer,
  ComposeRegistryRendererInspector,
} from '@compose-ui/component-registry'
import {
  BUILTIN_COMMAND_TYPES,
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  createTransactionRuntime,
  getComposeComposition,
  getComposeHierarchy,
  getComposeLayout,
  getComposeRenderer,
  getComposeTransform,
  type ComposeEntity,
  type ComposeDocument,
} from '@compose-ui/core'
import { describe, expect, it, vi } from 'vitest'
import { createComposeBasicMaterials } from './create-basic-materials'

function seedEntity(
  materials: ReturnType<typeof createComposeBasicMaterials>,
  presetId: string,
): ComposeEntity {
  const result = materials.registry.createSeed(presetId)
  if (!result.ok) throw new Error(result.error.message)
  return { id: `${presetId}-1`, ...result.seed }
}

describe('Basic ECS materials', () => {
  it('OpenSpec: Flex Layout Inspector / 布局分组紧跟变换分组', () => {
    const materials = createComposeBasicMaterials()
    const orderedKeys = materials.registry.listComponents().map(({ key }) => key)
    expect(orderedKeys.indexOf('Layout')).toBe(orderedKeys.indexOf('Transform') + 1)
  })

  it('OpenSpec: Entity Presets / 六种物料写入明确基础组合', () => {
    const materials = createComposeBasicMaterials()
    expect(materials.presets.map(({ id }) => id)).toEqual([
      'container',
      'rectangle',
      'text',
      'image',
      'svg',
      'page-slot',
    ])
    const container = seedEntity(materials, 'container')
    expect(getComposeHierarchy(container)?.childIds).toEqual([])
    expect(getComposeLayout(container)).toEqual({
      type: 'flex',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      alignContent: 'normal',
      justifyContent: 'normal',
      alignItems: 'normal',
      gap: 0,
    })
    expect(getComposeRenderer(container)).toBeUndefined()
    expect(getComposeComposition(container).baseComponentKeys).toContain('Hierarchy')
    expect(getComposeComposition(container).baseComponentKeys).toContain('Layout')

    for (const id of ['rectangle', 'text', 'image', 'svg']) {
      const entity = seedEntity(materials, id)
      expect(getComposeRenderer(entity)?.type).toBe(id)
      expect(getComposeTransform(entity).size.width).toBeGreaterThan(0)
      expect(getComposeComposition(entity).baseComponentKeys).toContain('Renderer')
    }
  })

  it('OpenSpec: 无 style fallback / Rectangle 视觉由 Appearance 明确表达', () => {
    const materials = createComposeBasicMaterials()
    const rectangle = seedEntity(materials, 'rectangle')
    expect(rectangle.components.Appearance).toEqual(expect.objectContaining({
      backgroundPaint: { kind: 'solid', color: '#2f7df6' },
      borderRadius: 12,
    }))
    expect(getComposeRenderer(rectangle)?.props).toEqual({})
  })

  it('OpenSpec: Renderer / Text 使用 Renderer Component 属性', () => {
    const materials = createComposeBasicMaterials()
    const text = seedEntity(materials, 'text')
    render(
      <ComposeRegistryEntityRenderer
        entity={text}
        mode="editor"
        registry={materials.registry}
      />,
    )
    expect(screen.getByText('Text')).toBeInTheDocument()
  })

  it('OpenSpec: Renderer Inspector / 内容更新派发 entity.renderer.props.set', () => {
    let nextId = 0
    const materials = createComposeBasicMaterials({
      idFactory: () => `command-${++nextId}`,
    })
    const text = seedEntity(materials, 'text')
    const dispatch = vi.fn()
    render(
      <ComposeRegistryRendererInspector
        dispatch={dispatch}
        entity={text}
        readOnly={false}
        registry={materials.registry}
      />,
    )
    const input = screen.getByDisplayValue('Text')
    input.focus()
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: '!',
    }))
    expect(materials.registry.getRenderer('text')?.inspector).toBeDefined()
    expect(BUILTIN_COMMAND_TYPES.setRendererProps).toBe('entity.renderer.props.set')
  })

  it('OpenSpec: Capability / 发布容器与几何限制两个能力', () => {
    const materials = createComposeBasicMaterials()
    expect(materials.capabilities.map(({ id }) => id)).toEqual([
      'container',
      'geometry-constraints',
    ])
    expect(materials.capabilities[0]?.createComponents()).toMatchObject({
      Hierarchy: { childIds: [] },
      Layout: {
        type: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignContent: 'normal',
        justifyContent: 'normal',
        alignItems: 'normal',
        gap: 0,
      },
    })
  })

  it('OpenSpec: basic-materials / 旧容器能力缺少 Layout 时仍可原子移除', () => {
    const materials = createComposeBasicMaterials()
    const base = seedEntity(materials, 'rectangle')
    const legacyContainer: ComposeEntity = {
      ...base,
      components: {
        ...base.components,
        Composition: {
          ...base.components.Composition!,
          capabilityIds: ['container'],
        },
        Hierarchy: { childIds: [] },
        Clip: { enabled: true },
      },
    }
    const document: ComposeDocument = {
      schemaVersion: 5,
      canvas: createDefaultCanvasSettings(),
      output: createDefaultOutputSettings(),
      rootIds: [legacyContainer.id],
      entities: { [legacyContainer.id]: legacyContainer },
    }
    let commandIndex = 0
    const plan = materials.registry.planRemoveCapability(
      document,
      legacyContainer.id,
      'container',
      () => `remove-${commandIndex++}`,
    )
    expect(plan.ok).toBe(true)
    if (!plan.ok) return

    const runtime = createTransactionRuntime({ document })
    expect(runtime.dispatch(plan.command).status).toBe('committed')
    expect(runtime.document.entities[legacyContainer.id]?.components.Hierarchy).toBeUndefined()
    expect(runtime.document.entities[legacyContainer.id]?.components.Layout).toBeUndefined()
    expect(runtime.document.entities[legacyContainer.id]?.components.Clip).toBeUndefined()
    expect(runtime.document.entities[legacyContainer.id]?.components.Composition?.capabilityIds)
      .toEqual([])
  })
})
