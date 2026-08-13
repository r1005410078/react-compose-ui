import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  BUILTIN_COMMAND_TYPES,
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  getComposeComposition,
  getComposeHierarchy,
  getComposeWidgetSwitcher,
  type ComposeDocument,
  type ComposeEntity,
} from '@compose-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComposeBasicMaterials } from '../create-basic-materials'
import { createWidgetSwitcherInspector } from './inspector'

function seed(
  materials: ReturnType<typeof createComposeBasicMaterials>,
  presetId: string,
  id: string,
): ComposeEntity {
  const result = materials.registry.createSeed(presetId)
  if (!result.ok) throw new Error(result.error.message)
  return { id, ...result.seed }
}

function documentOf(entities: readonly ComposeEntity[]): ComposeDocument {
  return {
    schemaVersion: 6,
    canvas: createDefaultCanvasSettings(),
    output: createDefaultOutputSettings(),
    rootIds: [entities[0]!.id],
    entities: Object.fromEntries(entities.map((entity) => [entity.id, entity])),
  }
}

describe('WidgetSwitcher 物料', () => {
  afterEach(cleanup)

  it('OpenSpec: WidgetSwitcher 物料与切换能力 / 创建 WidgetSwitcher', () => {
    const materials = createComposeBasicMaterials()
    const entity = seed(materials, 'widget-switcher', 'switcher')
    expect(getComposeHierarchy(entity)?.childIds).toEqual([])
    expect(getComposeWidgetSwitcher(entity)).toEqual({ activeIndex: 0 })
    const composition = getComposeComposition(entity)
    expect(composition.presetId).toBe('widget-switcher')
    expect(composition.baseComponentKeys).toContain('WidgetSwitcher')
  })

  it('Preset 出现在默认 Palette 中', () => {
    const materials = createComposeBasicMaterials()
    const preset = materials.presets.find(({ id }) => id === 'widget-switcher')
    expect(preset?.paletteHidden ?? false).toBe(false)
  })

  it('OpenSpec: WidgetSwitcher 物料与切换能力 / 给已有容器追加切换能力', () => {
    const materials = createComposeBasicMaterials()
    const base = seed(materials, 'container', 'container')
    const container: ComposeEntity = {
      ...base,
      components: {
        ...base.components,
        Hierarchy: { childIds: ['a', 'b'] },
      },
    }
    const plan = materials.registry.planAddCapability(
      documentOf([container]),
      'container',
      'widget-switcher',
      (() => {
        let next = 0
        return () => `cmd-${next++}`
      })(),
    )
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    // 能力只创建 WidgetSwitcher，既有 Hierarchy/Clip 不会被判为冲突，childIds 也不被改写。
    const children = plan.command.payload.commands as readonly { type: string; payload: {
      key?: string
      value?: unknown
    } }[]
    const added = children.filter(({ type }) => type === BUILTIN_COMMAND_TYPES.addComponent)
    expect(added.map(({ payload }) => payload.key)).toEqual(['WidgetSwitcher'])
    expect(added[0]!.payload.value).toEqual({ activeIndex: 0 })
  })

  it('OpenSpec: WidgetSwitcher 物料与切换能力 / Inspector 切换活动索引', () => {
    const materials = createComposeBasicMaterials()
    const base = seed(materials, 'widget-switcher', 'switcher')
    const entity: ComposeEntity = {
      ...base,
      name: 'Switcher',
      components: { ...base.components, Hierarchy: { childIds: ['a', 'b'] } },
    }
    const dispatch = vi.fn()
    const Inspector = createWidgetSwitcherInspector(() => 'cmd-1')
    render(
      <Inspector
        componentKey="WidgetSwitcher"
        dispatch={dispatch}
        document={documentOf([entity])}
        entity={entity}
        readOnly={false}
        value={getComposeWidgetSwitcher(entity)!}
      />,
    )
    const input = screen.getByRole('spinbutton', { name: '活动索引' })
    fireEvent.change(input, { target: { value: '1' } })
    fireEvent.blur(input)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      type: BUILTIN_COMMAND_TYPES.updateComponent,
      payload: { entityId: 'switcher', key: 'WidgetSwitcher', value: { activeIndex: 1 } },
    })
  })
})
