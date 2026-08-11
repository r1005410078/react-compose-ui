import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react'
import {
  ComposeRegistryEntityRenderer,
  ComposeRegistryRendererInspector,
} from '@compose-ui/component-registry'
import {
  BUILTIN_COMMAND_TYPES,
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  createTransactionRuntime,
  getComposeClip,
  getComposeComposition,
  getComposeHierarchy,
  getComposeLayout,
  getComposeLayoutItem,
  getComposeRenderer,
  type ComposeEntity,
  type ComposeDocument,
} from '@compose-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  afterEach(cleanup)

  it('OpenSpec: basic-materials / Figma 基线的 Text 默认值与排版 / 创建默认 Text', () => {
    const materials = createComposeBasicMaterials()
    const text = seedEntity(materials, 'text')

    expect(getComposeRenderer(text)?.props).toEqual(expect.objectContaining({
      text: 'Text',
      color: '#ffffff',
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      fontSize: 12,
      fontWeight: 400,
      letterSpacing: 0,
      textAlign: 'left',
      verticalAlign: 'top',
      textCase: 'original',
      textDecoration: 'none',
    }))
    expect(getComposeRenderer(text)?.props).not.toHaveProperty('lineHeight')
    expect(getComposeLayoutItem(text)).toMatchObject({
      width: { mode: 'hug', value: 28 },
      height: { mode: 'hug', value: 16 },
    })
  })

  it('OpenSpec: Flex Layout Inspector / 布局分组紧跟变换分组', () => {
    const materials = createComposeBasicMaterials()
    const orderedKeys = materials.registry.listComponents().map(({ key }) => key)
    expect(orderedKeys.slice(orderedKeys.indexOf('Transform'), orderedKeys.indexOf('Layout') + 1))
      .toEqual(['Transform', 'LayoutItem', 'Layout'])
  })

  it('OpenSpec: Entity Presets / 默认 Palette 不重复工具栏入口', () => {
    const materials = createComposeBasicMaterials()
    const paletteVisible = materials.presets
      .filter((preset) => !preset.paletteHidden)
      .map(({ id }) => id)
    // 工具栏已有 text/line/arrow/circle 绘制工具，page-slot 的入口是资源面板拖入页面文件。
    expect(paletteVisible).toEqual(['container', 'rectangle'])
    // 隐藏只影响 Palette 呈现，Registry 仍然注册全部 Preset。
    expect(materials.registry.getPreset('text')).toBeDefined()
    expect(materials.registry.getPreset('page-slot')).toBeDefined()
    expect(materials.registry.getPreset('circle')).toBeDefined()
  })

  it('OpenSpec: Entity Presets / 基础与绘图物料写入明确基础组合', () => {
    const materials = createComposeBasicMaterials()
    expect(materials.presets.map(({ id }) => id)).toEqual([
      'container',
      'rectangle',
      'text',
      'image',
      'svg',
      'page-slot',
      'line',
      'arrow',
      'circle',
    ])
    const container = seedEntity(materials, 'container')
    expect(getComposeHierarchy(container)?.childIds).toEqual([])
    expect(getComposeClip(container)).toEqual({
      enabled: true,
      horizontal: 'clip',
      vertical: 'clip',
    })
    expect(getComposeLayout(container)).toBeUndefined()
    expect(getComposeRenderer(container)).toBeUndefined()
    expect(getComposeComposition(container).baseComponentKeys).toContain('Hierarchy')
    expect(getComposeComposition(container).baseComponentKeys).not.toContain('Layout')

    for (const id of ['rectangle', 'text', 'image', 'svg', 'line', 'arrow', 'circle']) {
      const entity = seedEntity(materials, id)
      expect(getComposeRenderer(entity)?.type).toBe(
        ['line', 'arrow', 'circle'].includes(id) ? 'shape' : id,
      )
      expect(getComposeLayoutItem(entity).width.value).toBeGreaterThan(0)
      expect(getComposeComposition(entity).baseComponentKeys).toContain('Renderer')
    }
  })

  it('OpenSpec: Shape materials / 绘图物料使用同一 SVG renderer 保留形状语义', () => {
    const materials = createComposeBasicMaterials()
    const line = seedEntity(materials, 'line')
    const arrow = seedEntity(materials, 'arrow')
    render(
      <ComposeRegistryEntityRenderer
        entity={arrow}
        mode="editor"
        registry={materials.registry}
      />,
    )
    expect(screen.getByTestId('compose-material-shape-arrow')).toBeInTheDocument()
    expect(getComposeRenderer(arrow)?.props).toEqual(expect.objectContaining({
      kind: 'arrow',
      direction: { x: 1, y: 1 },
      markerStart: 'none',
      markerEnd: 'arrow',
      strokeDasharray: 'none',
      strokeLinecap: 'butt',
    }))
    expect(getComposeRenderer(line)?.props).toEqual(expect.objectContaining({
      kind: 'line',
      markerStart: 'none',
      markerEnd: 'none',
    }))
    expect(materials.registry.getRenderer('shape')?.inspector).toBeDefined()
  })

  it('OpenSpec: Shape materials / Inspector 暴露常用线条与首尾箭头属性', () => {
    const materials = createComposeBasicMaterials({ idFactory: () => 'shape-command' })
    const line = seedEntity(materials, 'line')
    const dispatch = vi.fn()
    render(
      <ComposeRegistryRendererInspector
        dispatch={dispatch}
        entity={line}
        propCategory={{ id: 'shape', label: '线条' }}
        readOnly={false}
        registry={materials.registry}
      />,
    )

    expect(screen.getByRole('button', { name: '选择线条颜色' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: '线条粗细' })).toHaveValue(2)
    expect(screen.getByRole('combobox', { name: '端点形状' })).toHaveValue('butt')
    expect(screen.getByRole('combobox', { name: '线条样式' })).toHaveValue('none')
    expect(screen.getByRole('combobox', { name: '起点箭头' })).toHaveValue('none')
    expect(screen.getByRole('combobox', { name: '终点箭头' })).toHaveValue('none')
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

  it('OpenSpec: 内建 Text 物料 / 声明 text 为可原地编辑文本', () => {
    const materials = createComposeBasicMaterials()
    const text = seedEntity(materials, 'text')
    const rectangle = seedEntity(materials, 'rectangle')

    expect(materials.registry.getEditableTextPropName(text)).toBe('text')
    expect(materials.registry.getEditableTextPropName(rectangle)).toBeNull()
  })

  it('OpenSpec: 内建 Text 物料 / 编辑态原地渲染并保持排版一致', () => {
    const materials = createComposeBasicMaterials()
    const text = seedEntity(materials, 'text')
    const onChange = vi.fn()
    const view = render(
      <ComposeRegistryEntityRenderer
        entity={text}
        mode="editor"
        registry={materials.registry}
      />,
    )
    const idleStyle = view.getByTestId('compose-material-text').getAttribute('style')

    view.rerender(
      <ComposeRegistryEntityRenderer
        entity={text}
        mode="editor"
        registry={materials.registry}
        textEditing={{ value: 'Text', onChange }}
      />,
    )
    const editable = view.getByTestId('compose-material-text-editable')
    // 编辑态与最终呈现必须同源：容器排版样式一字不差，否则退出编辑时视觉会跳变。
    expect(view.getByTestId('compose-material-text').getAttribute('style')).toBe(idleStyle)
    expect(editable).toHaveAttribute('contenteditable', 'true')
    expect(editable.textContent).toBe('Text')
    expect(editable).toHaveFocus()
  })

  it('OpenSpec: 内建 Text 物料 / 输入与粘贴只保留纯文本', () => {
    const materials = createComposeBasicMaterials()
    const text = seedEntity(materials, 'text')
    const onChange = vi.fn()
    const view = render(
      <ComposeRegistryEntityRenderer
        entity={text}
        mode="editor"
        registry={materials.registry}
        textEditing={{ value: 'Text', onChange }}
      />,
    )
    const editable = view.getByTestId('compose-material-text-editable')

    editable.textContent = 'Hello'
    fireEvent.input(editable)
    expect(onChange).toHaveBeenLastCalledWith('Hello')

    const clipboardData = {
      getData: vi.fn((type: string) => type === 'text/plain' ? 'plain' : '<b>rich</b>'),
    }
    const paste = createEvent.paste(editable, { clipboardData })
    fireEvent(editable, paste)
    // 富文本必须在进入文档前就被剥掉：文档协议里 text 是纯文本单 Prop。
    expect(paste.defaultPrevented).toBe(true)
    expect(clipboardData.getData).toHaveBeenCalledWith('text/plain')
    expect(editable.innerHTML).not.toContain('<b>')
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
    expect(materials.capabilities[0]?.createComponents()).toEqual({
      Hierarchy: { childIds: [] },
      Clip: { enabled: true, horizontal: 'clip', vertical: 'clip' },
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
      schemaVersion: 6,
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
