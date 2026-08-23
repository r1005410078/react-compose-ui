import { cleanup, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  ComposeRegistryEntityRenderer,
  ComposeRegistryRendererInspector,
} from '@compose-ui/component-registry'
import {
  BUILTIN_COMMAND_TYPES,
  COMPOSE_DEFAULT_FRAME_SIZE,
  COMPOSE_DEFAULT_SCENE_APPEARANCE,
  createDefaultCanvasSettings,
  createComposeFrameEntity,
  createTransactionRuntime,
  getComposeClip,
  getComposeFrame,
  getComposeComposition,
  getComposeCurve,
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
    // 工具栏已有 text/line/arrow/circle 绘制工具，因此它们默认不进 Palette；曲线相反——
    // 它的创建路径就是「点击添加」，绘制手势属于后续的绘图模式。
    expect(paletteVisible).toEqual(['container', 'widget-switcher', 'rectangle', 'curve'])
    // 隐藏只影响 Palette 呈现，Registry 仍然注册全部 Preset。
    expect(materials.registry.getPreset('text')).toBeDefined()
    expect(materials.registry.getPreset('circle')).toBeDefined()
    expect(materials.registry.getPreset('component-instance')).toMatchObject({
      paletteHidden: true,
    })
    expect(materials.registry.getPreset('group')).toMatchObject({
      id: 'group',
      paletteHidden: true,
    })
  })

  it('OpenSpec: basic-materials / 场景 Entity Preset / 场景与容器同图标同外观', () => {
    const materials = createComposeBasicMaterials()
    const frame = materials.registry.getPreset('frame')
    const container = materials.registry.getPreset('container')
    expect(frame).toMatchObject({ id: 'frame', paletteHidden: true })
    // 图标必须是同一个元素类型：场景就是放在顶层的容器，两者在场景树里不该有视觉差异。
    expect((frame?.icon as { type?: unknown } | undefined)?.type)
      .toBe((container?.icon as { type?: unknown } | undefined)?.type)
    const sceneAppearance = seedEntity(materials, 'frame').components.Appearance
    const containerAppearance = seedEntity(materials, 'container').components.Appearance
    // 这条断言把 core 的场景默认外观与 materials 的容器默认外观锁在一起：任何一侧改了
    // 背景色都会让这里立刻变红，而不是等到用户看见场景和容器颜色不一样。
    expect(sceneAppearance).toMatchObject({
      backgroundPaint: containerAppearance!.backgroundPaint,
    })
    expect(sceneAppearance).toEqual(COMPOSE_DEFAULT_SCENE_APPEARANCE)
    // 唯一的例外：场景不带默认边框。布局求解把边框计入内容盒，而场景是绝对坐标的原点，
    // 1px 边框会把每个直接子级整体推离网格 1px。
    expect(sceneAppearance).toMatchObject({ borderWidth: 0 })
    expect(containerAppearance).toMatchObject({ borderWidth: 1 })
    expect(getComposeFrame(seedEntity(materials, 'frame'))?.size)
      .toEqual(COMPOSE_DEFAULT_FRAME_SIZE)
  })

  it('OpenSpec: Entity Presets / 基础与绘图物料写入明确基础组合', () => {
    const materials = createComposeBasicMaterials()
    expect(materials.presets.map(({ id }) => id)).toEqual([
      'group',
      'frame',
      'container',
      'widget-switcher',
      'rectangle',
      'text',
      'image',
      'svg',
      'component-instance',
      'curve',
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

    for (const id of ['rectangle', 'text', 'image', 'svg', 'arrow', 'circle', 'curve']) {
      const entity = seedEntity(materials, id)
      // Arrow 与 Circle 是曲线的两个起点，不是两种物料。
      expect(getComposeRenderer(entity)?.type).toBe(
        ['arrow', 'circle'].includes(id) ? 'curve' : id,
      )
      expect(getComposeLayoutItem(entity).width.value).toBeGreaterThan(0)
      expect(getComposeComposition(entity).baseComponentKeys).toContain('Renderer')
    }
  })

  it('OpenSpec: 物料统一 / Curve、Arrow 与 Circle 共用一个 Renderer', () => {
    const materials = createComposeBasicMaterials()
    const arrow = seedEntity(materials, 'arrow')
    const circle = seedEntity(materials, 'circle')
    render(
      <ComposeRegistryEntityRenderer
        entity={arrow}
        mode="editor"
        registry={materials.registry}
      />,
    )
    expect(screen.getByTestId(`compose-material-curve-${arrow.id}`)).toBeInTheDocument()
    expect(getComposeRenderer(arrow)?.props).toEqual(expect.objectContaining({
      markerStart: 'none',
      markerEnd: 'arrow',
      strokeDasharray: 'none',
    }))
    // 椭圆不是新 kind：整圆放进非正方盒，`viewBox` 就把它拉成椭圆。
    expect(getComposeCurve(circle)).toMatchObject({ kind: 'arc', sweep: 360 })
    expect(getComposeRenderer(circle)?.type).toBe('curve')
    // 仓库里不再有第二个画线的 Renderer。
    expect(materials.registry.getRenderer('shape')).toBeUndefined()
  })

  it('OpenSpec: 物料统一 / 箭头 marker 附在终点，描边不随非等比盒变形', () => {
    const materials = createComposeBasicMaterials()
    const arrow = seedEntity(materials, 'arrow')
    const renderer = getComposeRenderer(arrow)!
    const dashedArrow: ComposeEntity = {
      ...arrow,
      components: {
        ...arrow.components,
        Renderer: {
          ...renderer,
          props: { ...renderer.props, strokeDasharray: '8 4', strokeWidth: 6 },
        },
      },
    }
    render(
      <ComposeRegistryEntityRenderer
        entity={dashedArrow}
        mode="editor"
        registry={materials.registry}
      />,
    )

    const stroke = screen.getByTestId('compose-material-curve-stroke')
    const hit = screen.getByTestId('compose-material-curve-hit')
    const marker = screen.getByTestId(`compose-material-curve-${arrow.id}`).querySelector('marker')!
    expect(stroke.getAttribute('marker-end')).toMatch(/^url\(#compose-curve-arrow-/)
    expect(stroke).not.toHaveAttribute('marker-start')
    expect(marker).toHaveAttribute('markerUnits', 'strokeWidth')
    // 描边中和 viewBox 变换，marker 不中和——marker 是几何。
    expect(stroke).toHaveAttribute('vector-effect', 'non-scaling-stroke')
    expect(stroke).toHaveAttribute('stroke-dasharray', '24 12')
    // 没填色时命中只覆盖描边。
    expect(hit).toHaveAttribute('pointer-events', 'stroke')
    expect(hit).toHaveAttribute('fill', 'none')
  })

  it('OpenSpec: 物料统一 / 填色画在几何上而不是宿主盒上', () => {
    const materials = createComposeBasicMaterials()
    const circle = seedEntity(materials, 'circle')
    const filled: ComposeEntity = {
      ...circle,
      components: {
        ...circle.components,
        Appearance: {
          ...(circle.components.Appearance as Record<string, unknown>),
          backgroundPaint: { kind: 'solid', color: '#ff3366' },
        },
      },
    }
    render(
      <ComposeRegistryEntityRenderer
        entity={filled}
        mode="editor"
        registry={materials.registry}
      />,
    )

    expect(screen.getByTestId('compose-material-curve-stroke')).toHaveAttribute('fill', '#ff3366')
    // 填过色的面积也要接住点击：那是用户看见的墨。
    expect(screen.getByTestId('compose-material-curve-hit')).toHaveAttribute('pointer-events', 'all')
  })

  it('OpenSpec: 物料统一 / Inspector 暴露描边与首尾箭头', () => {
    const materials = createComposeBasicMaterials({ idFactory: () => 'curve-command' })
    const curve = seedEntity(materials, 'curve')
    const dispatch = vi.fn()
    render(
      <ComposeRegistryRendererInspector
        dispatch={dispatch}
        entity={curve}
        propCategory={{ id: 'stroke', label: '描边' }}
        readOnly={false}
        registry={materials.registry}
      />,
    )

    expect(screen.getByRole('button', { name: '选择线条颜色' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: '线条粗细' })).toHaveValue(1)
    expect(screen.getByRole('combobox', { name: '线条样式' })).toHaveValue('none')
    expect(screen.getByRole('combobox', { name: '起点箭头' })).toHaveValue('none')
    expect(screen.getByRole('combobox', { name: '终点箭头' })).toHaveValue('none')
  })

  it('OpenSpec: 无 style fallback / Rectangle 视觉由 Appearance 明确表达', () => {
    const materials = createComposeBasicMaterials()
    const rectangle = seedEntity(materials, 'rectangle')
    expect(rectangle.components.Appearance).toEqual(expect.objectContaining({
      backgroundPaint: { kind: 'solid', color: '#2f7df6' },
      borderRadius: 0,
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

  it('OpenSpec: 内建 Text 物料 / 声明内容高度随宽度重排', () => {
    const materials = createComposeBasicMaterials()
    const text = seedEntity(materials, 'text')
    const rectangle = seedEntity(materials, 'rectangle')

    // 文字换行：拖窄后行数增加、内容变高。声明它之后缩放不会把 Hug 高度钉成 Fixed，
    // 长出来的部分也就不会被自己的框裁掉。八向手柄照常保留。
    expect(getComposeLayoutItem(text).height.mode).toBe('hug')
    expect(materials.registry.getContentReflowsWithWidth(text)).toBe(true)
    expect(materials.registry.getContentReflowsWithWidth(rectangle)).toBe(false)
    expect(text.components.GeometryConstraints).toBeUndefined()
  })

  it('OpenSpec: 内建 Text 物料 / 编辑态原地渲染并保持排版一致', async () => {
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
    // 聚焦推迟一帧，避开本次 pointerdown 默认动作对焦点的重置。
    await waitFor(() => { expect(editable).toHaveFocus() })
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
      'widget-switcher',
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
      schemaVersion: 7,
      canvas: createDefaultCanvasSettings(),
      rootIds: ['frame-root'],
      entities: {
        [legacyContainer.id]: legacyContainer,
        'frame-root': createComposeFrameEntity({
          id: 'frame-root',
          childIds: [legacyContainer.id],
        }),
      },
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
