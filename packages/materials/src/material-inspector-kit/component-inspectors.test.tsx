import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentType } from 'react'
import type {
  ComposeComponentDefinition,
  ComposeComponentInspectorProps,
  ComposeMissingComponentInspectorProps,
} from '@compose-ui/component-registry'
import {
  BUILTIN_COMMAND_TYPES,
  createDefaultCanvasSettings,
  createDefaultComposeFlexLayout,
  createDefaultComposeLayoutItem,
  createDefaultOutputSettings,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeFlexLayout,
  type EditorCommand,
  type JsonObject,
} from '@compose-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComposeUIProvider } from '@compose-ui/ui-context'
import { createComposeBuiltinComponentDefinitions } from '../builtin-components'

function entity(components: Readonly<Record<string, JsonObject>> = {}): ComposeEntity {
  return {
    id: 'entity-a',
    name: 'Title',
    components: {
      Composition: {
        presetId: null,
        baseComponentKeys: ['Transform', 'LayoutItem', 'Visibility', 'Lock'],
        capabilityIds: [],
      },
      Transform: { rotation: 0 },
      LayoutItem: createDefaultComposeLayoutItem(180, 40, { x: 10, y: 20 }),
      Visibility: { visible: true },
      Lock: { locked: false },
      ...components,
    },
  }
}

function inspectorOf(key: string) {
  let commandIndex = 0
  const definitions = createComposeBuiltinComponentDefinitions(() => `id-${commandIndex++}`)
  const definition = definitions.find((item) => item.key === key)
  if (!definition?.inspector) throw new Error(`${key} 缺少 inspector`)
  return definition.inspector
}

function inspectorHeaderActionsOf(key: string) {
  let commandIndex = 0
  const definitions = createComposeBuiltinComponentDefinitions(() => `id-${commandIndex++}`)
  const definition = definitions.find((item) => item.key === key) as
    | (ComposeComponentDefinition & {
      readonly inspectorHeaderActions?: ComponentType<ComposeComponentInspectorProps>
    })
    | undefined
  if (!definition?.inspectorHeaderActions) throw new Error(`${key} 缺少 inspectorHeaderActions`)
  return definition.inspectorHeaderActions
}

function missingInspectorActionsOf(key: string) {
  const definitions = createComposeBuiltinComponentDefinitions(() => 'missing-layout-command')
  const definition = definitions.find((item) => item.key === key) as
    | (ComposeComponentDefinition & {
      readonly missingInspector?: {
        readonly actions: ComponentType<ComposeMissingComponentInspectorProps>
      }
    })
    | undefined
  if (!definition?.missingInspector) throw new Error(`${key} 缺少 missingInspector`)
  return definition.missingInspector.actions
}

function missingInspectorContentOf(key: string) {
  const definitions = createComposeBuiltinComponentDefinitions(() => 'missing-layout-command')
  const definition = definitions.find((item) => item.key === key) as
    | (ComposeComponentDefinition & {
      readonly missingInspector?: {
        readonly content?: ComponentType<ComposeMissingComponentInspectorProps>
      }
    })
    | undefined
  if (!definition?.missingInspector?.content) throw new Error(`${key} 缺少 missingInspector content`)
  return definition.missingInspector.content
}

afterEach(cleanup)

describe('内建 Component inspectors', () => {
  it('OpenSpec: basic-materials / Auto Layout 按需启用 / 展开未启用布局引导', () => {
    const dispatch = vi.fn()
    const Content = missingInspectorContentOf('Layout')
    const container = entity({ Hierarchy: { childIds: [] } })
    const document: ComposeDocument = {
      schemaVersion: 6,
      canvas: createDefaultCanvasSettings(),
      output: createDefaultOutputSettings(),
      rootIds: [container.id],
      entities: { [container.id]: container },
    }
    const view = render(
      <Content
        componentKey="Layout"
        dispatch={dispatch}
        document={document}
        entity={container}
        readOnly={false}
      />,
    )

    expect(screen.getByText('使用自动布局')).toBeInTheDocument()
    expect(screen.getByText('自动排列子项，并统一控制方向、间距、换行与对齐。'))
      .toBeInTheDocument()
    expect(screen.getByText('添加后可随时移除')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '添加自动布局' }))
    expect((dispatch.mock.lastCall?.[0] as EditorCommand).type).toBe(BUILTIN_COMMAND_TYPES.batch)

    view.rerender(
      <Content
        componentKey="Layout"
        dispatch={dispatch}
        document={document}
        entity={container}
        readOnly
      />,
    )
    expect(screen.getByRole('button', { name: '添加自动布局' })).toBeDisabled()
  })

  it('OpenSpec: 自动布局显式启用 / 布局加号只提供 Auto Layout 菜单项', () => {
    const dispatch = vi.fn()
    const Actions = missingInspectorActionsOf('Layout')
    const container = entity({ Hierarchy: { childIds: [] } })
    const document: ComposeDocument = {
      schemaVersion: 6,
      canvas: createDefaultCanvasSettings(),
      output: createDefaultOutputSettings(),
      rootIds: [container.id],
      entities: { [container.id]: container },
    }
    render(
      <Actions
        componentKey="Layout"
        dispatch={dispatch}
        document={document}
        entity={container}
        readOnly={false}
      />,
    )

    const trigger = screen.getByRole('button', { name: '添加布局' })
    expect(trigger).toHaveTextContent('+')
    fireEvent.click(trigger)
    const menu = screen.getByRole('menu', { name: '布局类型' })
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(1)
    expect(within(menu).getByRole('menuitem', { name: 'Auto Layout display: flex' }))
      .toBeInTheDocument()
    expect(screen.queryByText(/Grid/)).not.toBeInTheDocument()

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Auto Layout display: flex' }))
    expect((dispatch.mock.lastCall?.[0] as EditorCommand).type).toBe(BUILTIN_COMMAND_TYPES.batch)
  })

  it('OpenSpec: component-registry / Component Inspector 分组与默认展开协议 / 内建几何 Inspector 只贡献基础分组', () => {
    const definitions = createComposeBuiltinComponentDefinitions(() => 'id')
    for (const key of ['LayoutItem', 'Visibility', 'Lock', 'Appearance', 'Hierarchy', 'Layout', 'GeometryConstraints']) {
      expect(definitions.find((item) => item.key === key)?.inspector, key).toBeDefined()
    }
    expect(definitions.find((item) => item.key === 'Transform')?.inspector).toBeUndefined()
    expect(definitions.find((item) => item.key === 'LayoutItem')?.inspectorGroup).toBe('basic')
    expect(definitions.find((item) => item.key === 'Layout')?.inspectorDefaultExpanded).toBe(true)
    expect(definitions.find((item) => item.key === 'Composition')?.hidden).toBe(true)
    expect(definitions.find((item) => item.key === 'Renderer')?.hidden).toBe(true)
  })

  it('OpenSpec: basic-materials / 紧凑 Auto Layout Inspector / Absolute 位置与 Angle 属性分别提交', () => {
    const dispatch = vi.fn()
    const Inspector = inspectorOf('LayoutItem')
    const target = entity()
    render(
      <Inspector
        componentKey="LayoutItem"
        dispatch={dispatch}
        entity={target}
        readOnly={false}
        value={target.components.LayoutItem!}
      />,
    )

    expect(screen.queryByRole('radiogroup', { name: '定位' })).not.toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: '位置 X' })).toHaveValue(10)
    expect(screen.getByRole('spinbutton', { name: '位置 Y' })).toHaveValue(20)
    expect(screen.getByRole('spinbutton', { name: '旋转' })).toHaveValue(0)
    expect(document.querySelector('[data-property-path="position"] .layout-item-inspector__position'))
      .toBeInTheDocument()
    expect(document.querySelector('[data-property-path="rotation"] [data-semantic-editor="angle"]'))
      .toBeInTheDocument()
    expect(screen.queryByText('position')).not.toBeInTheDocument()
    expect(screen.queryByText('width')).not.toBeInTheDocument()
    expect(screen.queryByText('height')).not.toBeInTheDocument()
    expect(screen.queryByText('margin')).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('spinbutton', { name: '位置 X' }), {
      target: { value: '111' },
    })
    expect(dispatch).not.toHaveBeenCalled()
    fireEvent.blur(screen.getByRole('spinbutton', { name: '位置 X' }))
    expect((dispatch.mock.lastCall?.[0] as EditorCommand).payload).toMatchObject({
      entityId: 'entity-a',
      key: 'LayoutItem',
      value: { offset: { x: 111, y: 20 } },
    })

    dispatch.mockClear()
    const rotation = screen.getByRole('spinbutton', { name: '旋转' })
    fireEvent.change(rotation, { target: { value: '42' } })
    fireEvent.blur(rotation)
    const command = dispatch.mock.lastCall?.[0] as EditorCommand
    expect(command.type).toBe(BUILTIN_COMMAND_TYPES.setTransform)
    expect(command.meta?.mergeKey).toBe(`inspector:entity-a:${BUILTIN_COMMAND_TYPES.setTransform}`)
    expect(command.payload).toMatchObject({
      operation: 'set',
      updates: [{
        entityId: 'entity-a',
        transform: expect.objectContaining({
          position: { x: 10, y: 20 },
          size: { width: 180, height: 40 },
          rotation: 42,
        }),
      }],
    })
  })

  it('OpenSpec: basic-materials / 紧凑 Auto Layout Inspector / Flow 显示自身对齐与融合尺寸', () => {
    const dispatch = vi.fn()
    const Inspector = inspectorOf('LayoutItem')
    const child = entity({
      Renderer: { type: 'rectangle', props: {} },
      LayoutItem: {
        ...createDefaultComposeLayoutItem(80, 40),
        positioning: 'flow',
        offset: { x: 7, y: 8 },
        width: { mode: 'fill', value: 80, min: null, max: null },
      },
    })
    const parent = { ...entity({
      Hierarchy: { childIds: [child.id] },
      Layout: createDefaultComposeFlexLayout(),
    }), id: 'parent', name: 'Parent' }
    const document: ComposeDocument = {
      schemaVersion: 6,
      canvas: createDefaultCanvasSettings(),
      output: createDefaultOutputSettings(),
      rootIds: [parent.id],
      entities: { [parent.id]: parent, [child.id]: child },
    }
    render(
      <Inspector
        componentKey="LayoutItem"
        dispatch={dispatch}
        document={document}
        entity={child}
        layoutSnapshot={{
          revision: 4,
          boxes: {
            [child.id]: { x: 30, y: 40, width: 240, height: 40, positioning: 'flow' },
          },
          diagnostics: [],
        }}
        readOnly={false}
        value={child.components.LayoutItem!}
      />,
    )

    expect(screen.queryByRole('spinbutton', { name: '位置 X' })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '自身对齐' })).toHaveValue('auto')
    expect(screen.getByRole('spinbutton', { name: '旋转' })).toHaveValue(0)
    expect(globalThis.document.querySelector('[data-property-path="position"]')).not.toBeInTheDocument()
    const alignSelfRow = screen.getByRole('combobox', { name: '自身对齐' })
      .closest('.property-panel__field')
    expect(alignSelfRow).toHaveAttribute('data-property-path', 'alignSelf')
    expect(alignSelfRow?.querySelector(':scope > label')).toHaveTextContent('自身对齐')
    expect(globalThis.document.querySelector('[data-property-path="rotation"] [data-semantic-editor="angle"]'))
      .toBeInTheDocument()
    const widthInput = screen.getByRole('combobox', { name: '尺寸宽度' })
    const heightInput = screen.getByRole('combobox', { name: '尺寸高度' })
    expect(widthInput).toHaveValue('Fill')
    expect(heightInput).toHaveValue('40')
    expect(screen.queryByRole('combobox', { name: '宽度模式' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: '高度模式' })).not.toBeInTheDocument()
    expect(screen.queryByText('固定')).not.toBeInTheDocument()
    const widthSizing = screen.getByRole('group', { name: '宽度尺寸' })
    const heightSizing = screen.getByRole('group', { name: '高度尺寸' })
    expect(within(widthSizing).getByRole('combobox', { name: '尺寸宽度' }))
      .toBeInTheDocument()
    expect(within(heightSizing).getByRole('combobox', { name: '尺寸高度' }))
      .toBeInTheDocument()

    fireEvent.focus(widthInput)
    const suggestions = screen.getByRole('listbox', { name: '宽度尺寸选项' })
    expect(within(suggestions).getAllByRole('option').map((option) => option.textContent))
      .toEqual(['Fill', 'Hug'])
    expect(within(suggestions).queryByText('Fixed')).not.toBeInTheDocument()
    expect(within(suggestions).queryByText('填充')).not.toBeInTheDocument()

    fireEvent.mouseDown(within(suggestions).getByRole('option', { name: 'Hug' }))
    expect((dispatch.mock.lastCall?.[0] as EditorCommand).payload).toMatchObject({
      value: { width: { mode: 'hug', value: 80 } },
    })

    dispatch.mockClear()
    fireEvent.change(widthInput, { target: { value: 'fIlL' } })
    fireEvent.keyDown(widthInput, { key: 'Enter' })
    expect((dispatch.mock.lastCall?.[0] as EditorCommand).payload).toMatchObject({
      value: { width: { mode: 'fill', value: 80 } },
    })

    dispatch.mockClear()
    fireEvent.change(widthInput, { target: { value: '320' } })
    expect(dispatch).not.toHaveBeenCalled()
    fireEvent.blur(widthInput)
    expect((dispatch.mock.lastCall?.[0] as EditorCommand).payload).toMatchObject({
      value: { width: { mode: 'fixed', value: 320 } },
    })

    dispatch.mockClear()
    fireEvent.focus(heightInput)
    expect(screen.getByRole('listbox', { name: '高度尺寸选项' })).toBeInTheDocument()
    fireEvent.change(heightInput, { target: { value: 'unknown' } })
    fireEvent.blur(heightInput)
    expect(dispatch).not.toHaveBeenCalled()
    expect(heightInput).toHaveValue('40')

    dispatch.mockClear()
    fireEvent.change(screen.getByRole('combobox', { name: '自身对齐' }), {
      target: { value: 'center' },
    })
    expect((dispatch.mock.lastCall?.[0] as EditorCommand).payload).toMatchObject({
      value: { alignSelf: 'center' },
    })
  })

  it('OpenSpec: basic-materials / 紧凑 Auto Layout Inspector / 外边距展开并以 top 重新联动', () => {
    const dispatch = vi.fn()
    const Inspector = inspectorOf('LayoutItem')
    const target = entity()
    const view = render(
      <Inspector
        componentKey="LayoutItem"
        dispatch={dispatch}
        entity={target}
        readOnly={false}
        value={target.components.LayoutItem!}
      />,
    )

    expect(screen.getByRole('spinbutton', { name: '外边距' })).toHaveValue(0)
    fireEvent.click(screen.getByRole('button', { name: '展开外边距' }))
    expect(screen.getByRole('spinbutton', { name: '外边距 top' })).toHaveValue(0)
    expect(screen.getByRole('spinbutton', { name: '外边距 right' })).toHaveValue(0)

    fireEvent.change(screen.getByRole('spinbutton', { name: '外边距 top' }), {
      target: { value: '12' },
    })
    expect(dispatch).not.toHaveBeenCalled()
    fireEvent.blur(screen.getByRole('spinbutton', { name: '外边距 top' }))
    expect((dispatch.mock.lastCall?.[0] as EditorCommand).payload).toMatchObject({
      value: { margin: { top: 12, right: 0, bottom: 0, left: 0 } },
    })

    const changed = entity({
      LayoutItem: {
        ...createDefaultComposeLayoutItem(180, 40, { x: 10, y: 20 }),
        margin: { top: 12, right: 0, bottom: 0, left: 0 },
      },
    })
    view.rerender(
      <Inspector
        componentKey="LayoutItem"
        dispatch={dispatch}
        entity={changed}
        readOnly={false}
        value={changed.components.LayoutItem!}
      />,
    )
    dispatch.mockClear()
    fireEvent.click(screen.getByRole('button', { name: '收起并联动外边距' }))
    expect((dispatch.mock.lastCall?.[0] as EditorCommand).payload).toMatchObject({
      value: { margin: { top: 12, right: 12, bottom: 12, left: 12 } },
    })
  })

  it('基础位置、Angle、Size 与 Margin 使用各自标准属性行并共享标签列', () => {
    const Inspector = inspectorOf('LayoutItem')
    const target = entity()
    render(
      <Inspector
        componentKey="LayoutItem"
        dispatch={vi.fn()}
        entity={target}
        readOnly={false}
        value={target.components.LayoutItem!}
      />,
    )

    for (const path of ['position', 'rotation', 'size', 'margin']) {
      const field = document.querySelector(`[data-property-path="${path}"]`)
      expect(field).toHaveAttribute('data-property-layout', 'inline')
      expect(field).toHaveClass('property-panel__field')
      expect(field).not.toHaveClass('property-panel__field--full-width')
      expect(field?.querySelector(':scope > .property-panel__actions')).toBeInTheDocument()
    }
    expect(document.querySelector('[data-property-path="position"] .property-panel__label'))
      .toHaveTextContent('位置')
    expect(document.querySelector('[data-property-path="rotation"] .property-panel__label'))
      .toHaveTextContent('旋转')
    expect(screen.queryByRole('group', { name: '尺寸' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: '外边距' })).not.toBeInTheDocument()
  })

  it('OpenSpec: 基础物料 / Lock Inspector 在 readOnly 上下文仍可解除锁定', () => {
    const dispatch = vi.fn()
    const Inspector = inspectorOf('Lock')
    const locked = entity({ Lock: { locked: true } })
    render(
      <Inspector
        componentKey="Lock"
        dispatch={dispatch}
        entity={locked}
        readOnly
        value={locked.components.Lock!}
      />,
    )
    const checkbox = screen.getByRole('checkbox', { name: '锁定' })
    expect(checkbox).not.toBeDisabled()
    fireEvent.click(checkbox)
    const command = dispatch.mock.lastCall?.[0] as EditorCommand
    expect(command.type).toBe(BUILTIN_COMMAND_TYPES.setLock)
    expect(command.payload).toEqual({ entityIds: ['entity-a'], locked: false })
  })

  it('OpenSpec: 基础物料 / Hierarchy Inspector 展示子项数量并切换 Clip', () => {
    const dispatch = vi.fn()
    const Inspector = inspectorOf('Hierarchy')
    const container = entity({
      Hierarchy: { childIds: ['a', 'b'] },
      Clip: { enabled: true },
    })
    render(
      <Inspector
        componentKey="Hierarchy"
        dispatch={dispatch}
        entity={container}
        readOnly={false}
        value={container.components.Hierarchy!}
      />,
    )
    expect(screen.getByRole('spinbutton', { name: '子项数量' })).toHaveValue(2)
    fireEvent.click(screen.getByRole('checkbox', { name: '裁剪内容' }))
    const command = dispatch.mock.lastCall?.[0] as EditorCommand
    expect(command.type).toBe(BUILTIN_COMMAND_TYPES.setClip)
    expect(command.payload).toEqual({ entityIds: ['entity-a'], enabled: false })
  })

  it('OpenSpec: basic-materials / Flex 布局 Component 与紧凑 Inspector / 显示实际面板密度的 Flex 属性', () => {
    const dispatch = vi.fn()
    const Inspector = inspectorOf('Layout')
    const layout = createDefaultComposeFlexLayout()
    const container = entity({
      Hierarchy: { childIds: [] },
      Layout: layout,
    })
    render(
      <Inspector
        componentKey="Layout"
        dispatch={dispatch}
        entity={container}
        readOnly={false}
        value={container.components.Layout!}
      />,
    )

    const panel = screen.getByRole('group', { name: '布局属性' })
    expect([...panel.querySelectorAll('[data-flex-layout-field]')].map((item) => (
      item.getAttribute('data-flex-layout-field')
    ))).toEqual([
      'flex-direction',
      'flex-wrap',
      'gap',
      'align-content',
      'justify-content',
      'align-items',
      'padding',
    ])
    expect(screen.getByText('flex-direction')).toBeInTheDocument()
    expect(screen.getByText('flex-wrap')).toBeInTheDocument()
    expect(screen.getByText('gap')).toBeInTheDocument()
    expect(screen.getByText('align-content')).toBeInTheDocument()
    expect(screen.getByText('justify-content')).toBeInTheDocument()
    expect(screen.getByText('align-items')).toBeInTheDocument()
    expect(panel.querySelector('[data-property-path="padding"] code')).toHaveTextContent('padding')

    const direction = within(panel).getByRole('radiogroup', { name: '方向' })
    expect(within(direction).getAllByRole('radio')).toHaveLength(4)
    expect(within(direction).getAllByRole('radio').map((item) => item.getAttribute('aria-label')))
      .toEqual(['横向', '纵向', '反向横向', '反向纵向'])
    expect(within(direction).getByRole('radio', { name: '横向' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(within(direction).getByRole('radio', { name: '横向' }))
      .toHaveAttribute('data-initial-value')
    const multiLine = within(panel).getByRole('radiogroup', { name: '多行' })
    expect(within(multiLine).getAllByRole('radio')).toHaveLength(6)
    expect(within(multiLine).getAllByRole('radio').map((item) => item.getAttribute('aria-label')))
      .toEqual(['起始', '居中', '末端', '两端', '环绕', '拉伸'])
    expect(within(multiLine).getByRole('radio', { name: '拉伸' }))
      .toHaveAttribute('aria-checked', 'true')
    const mainAxis = within(panel).getByRole('radiogroup', { name: '主轴' })
    expect(within(mainAxis).getAllByRole('radio').map((item) => item.getAttribute('aria-label')))
      .toEqual(['起始', '居中', '末端', '两端', '环绕', '均匀'])
    const crossAxis = within(panel).getByRole('radiogroup', { name: '交叉轴' })
    expect(within(crossAxis).getAllByRole('radio').map((item) => item.getAttribute('aria-label')))
      .toEqual(['起始', '居中', '末端', '拉伸', '基线'])

    expect(within(panel).getByRole('spinbutton', { name: '项间距' })).toHaveValue(0)
    expect(within(panel).queryByRole('spinbutton', { name: '行间距' })).not.toBeInTheDocument()
    expect(screen.getByTitle('仅在换行产生多行时生效')).toBeInTheDocument()
    expect(screen.queryByText('px')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /绑定|变量/ })).not.toBeInTheDocument()

    expect(within(panel).getByRole('spinbutton', { name: '内边距' })).toHaveValue(0)
    expect(within(panel).getByRole('button', { name: '展开内边距' })).toBeInTheDocument()
    expect(panel.querySelector('[data-property-path="padding"]'))
      .toHaveAttribute('data-property-layout', 'full-width')

    const preview = screen.getByTestId('flex-layout-preview')
    expect(preview.querySelectorAll('[data-flex-preview-node]')).toHaveLength(3)
    expect(within(preview).getByText('Flex 容器')).toBeInTheDocument()
    expect(within(preview).getByText('row · nowrap · gap 0')).toBeInTheDocument()
    expect(within(preview).getByTestId('flex-preview-main-axis')).toHaveTextContent('主轴')
    expect(within(preview).getByTestId('flex-preview-cross-axis')).toHaveTextContent('交叉轴')
    expect(within(preview).queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(within(preview).queryByRole('button')).not.toBeInTheDocument()
    expect(preview).toHaveAttribute('data-align-items', 'stretch')
    expect(screen.getByText('实时预览')).toBeInTheDocument()
  })

  it('OpenSpec: basic-materials / Flex 布局 Component 与紧凑 Inspector / 可访问地修改 Layout', () => {
    const dispatch = vi.fn()
    const Inspector = inspectorOf('Layout')
    const layout = createDefaultComposeFlexLayout()
    const container = entity({
      Hierarchy: { childIds: [] },
      Layout: layout,
    })
    const { rerender } = render(
      <Inspector
        componentKey="Layout"
        dispatch={dispatch}
        entity={container}
        readOnly={false}
        value={container.components.Layout!}
      />,
    )

    const row = screen.getByRole('radio', { name: '横向' })
    row.focus()
    fireEvent.keyDown(row, { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: '纵向' })).toHaveFocus()
    const command = dispatch.mock.lastCall?.[0] as EditorCommand
    expect(command.type).toBe(BUILTIN_COMMAND_TYPES.updateComponent)
    expect(command.payload).toEqual({
      entityId: 'entity-a',
      key: 'Layout',
      value: { ...layout, flexDirection: 'column' },
    })

    dispatch.mockClear()
    const gap = screen.getByRole('spinbutton', { name: '项间距' })
    fireEvent.change(gap, { target: { value: '-1' } })
    fireEvent.blur(gap)
    expect(dispatch).not.toHaveBeenCalled()

    fireEvent.change(gap, { target: { value: '12' } })
    fireEvent.blur(gap)
    expect(dispatch).toHaveBeenCalledOnce()

    const verticalLayout = { ...layout, flexDirection: 'column' as const, rowGap: 12 }
    const verticalContainer = entity({
      Hierarchy: { childIds: [] },
      Layout: verticalLayout,
    })
    rerender(
      <Inspector
        componentKey="Layout"
        dispatch={dispatch}
        entity={verticalContainer}
        readOnly
        value={verticalContainer.components.Layout!}
      />,
    )
    expect(screen.getByRole('radio', { name: '纵向' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: '重新联动项间距' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: '行间距' })).toHaveValue(12)

    rerender(
      <Inspector
        componentKey="Layout"
        dispatch={dispatch}
        entity={container}
        readOnly={false}
        value={container.components.Layout!}
      />,
    )
    expect(screen.getByRole('spinbutton', { name: '项间距' })).toHaveValue(0)

    rerender(
      <Inspector
        componentKey="Layout"
        dispatch={dispatch}
        entity={verticalContainer}
        readOnly
        value={verticalContainer.components.Layout!}
      />,
    )
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
    expect(screen.getByRole('spinbutton', { name: '行间距' })).toBeDisabled()
    expect(screen.getByRole('spinbutton', { name: '内边距' })).toBeDisabled()
  })

  it('OpenSpec: basic-materials / 紧凑 Auto Layout Inspector / 再次点击已选 Flex 选项恢复显式默认值', () => {
    const dispatch = vi.fn()
    const Inspector = inspectorOf('Layout')
    const defaults = createDefaultComposeFlexLayout()
    const { rerender } = render(
      <Inspector
        componentKey="Layout"
        dispatch={dispatch}
        entity={entity({ Hierarchy: { childIds: [] }, Layout: defaults })}
        readOnly={false}
        value={defaults}
      />,
    )

    const resetSelected = (
      layout: ComposeFlexLayout,
      groupName: string,
      selectedName: string,
      expectedValue: Partial<ComposeFlexLayout>,
    ) => {
      const container = entity({ Hierarchy: { childIds: [] }, Layout: layout })
      rerender(
        <Inspector
          componentKey="Layout"
          dispatch={dispatch}
          entity={container}
          readOnly={false}
          value={layout}
        />,
      )
      dispatch.mockClear()
      fireEvent.click(within(screen.getByRole('radiogroup', { name: groupName }))
        .getByRole('radio', { name: selectedName }))
      expect((dispatch.mock.lastCall?.[0] as EditorCommand).payload).toMatchObject({
        value: expectedValue,
      })
    }

    resetSelected(
      { ...defaults, flexDirection: 'column' },
      '方向',
      '纵向',
      { flexDirection: 'row' },
    )
    resetSelected(
      { ...defaults, flexWrap: 'wrap' },
      '换行',
      '换行',
      { flexWrap: 'nowrap' },
    )
    resetSelected(
      { ...defaults, alignContent: 'center' },
      '多行',
      '居中',
      { alignContent: 'stretch' },
    )
    resetSelected(
      { ...defaults, justifyContent: 'center' },
      '主轴',
      '居中',
      { justifyContent: 'flex-start' },
    )
    resetSelected(
      { ...defaults, alignItems: 'center' },
      '交叉轴',
      '居中',
      { alignItems: 'stretch' },
    )

    const defaultContainer = entity({ Hierarchy: { childIds: [] }, Layout: defaults })
    rerender(
      <Inspector
        componentKey="Layout"
        dispatch={dispatch}
        entity={defaultContainer}
        readOnly={false}
        value={defaults}
      />,
    )
    dispatch.mockClear()
    fireEvent.click(within(screen.getByRole('radiogroup', { name: '方向' }))
      .getByRole('radio', { name: '横向' }))
    expect(dispatch).not.toHaveBeenCalled()
    expect(within(screen.getByRole('radiogroup', { name: '方向' }))
      .getByRole('radio', { name: '横向' })).toHaveAttribute('aria-checked', 'true')
  })

  it('OpenSpec: gap 与独立内边距 / 分轴间距和四边 padding 联动', () => {
    const dispatch = vi.fn()
    const Inspector = inspectorOf('Layout')
    const layout = createDefaultComposeFlexLayout()
    const container = entity({ Hierarchy: { childIds: [] }, Layout: layout })
    const { rerender } = render(
      <Inspector
        componentKey="Layout"
        dispatch={dispatch}
        entity={container}
        readOnly={false}
        value={container.components.Layout!}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '拆分项间距' }))
    expect(screen.getByRole('spinbutton', { name: '行间距' })).toHaveValue(0)
    expect(screen.getByRole('spinbutton', { name: '列间距' })).toHaveValue(0)

    dispatch.mockClear()
    fireEvent.change(screen.getByRole('spinbutton', { name: '内边距' }), {
      target: { value: '16' },
    })
    expect(dispatch).not.toHaveBeenCalled()
    fireEvent.blur(screen.getByRole('spinbutton', { name: '内边距' }))
    expect((dispatch.mock.lastCall?.[0] as EditorCommand).payload).toMatchObject({
      value: { padding: { top: 16, right: 16, bottom: 16, left: 16 } },
    })

    const unequal = {
      ...layout,
      rowGap: 12,
      columnGap: 4,
      padding: { top: 8, right: 16, bottom: 24, left: 32 },
    }
    const unequalContainer = entity({ Hierarchy: { childIds: [] }, Layout: unequal })
    rerender(
      <Inspector
        componentKey="Layout"
        dispatch={dispatch}
        entity={unequalContainer}
        readOnly={false}
        value={unequalContainer.components.Layout!}
      />,
    )
    expect(screen.getByRole('button', { name: '重新联动项间距' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: '内边距 top' })).toHaveValue(8)
    expect(screen.getByRole('spinbutton', { name: '内边距 right' })).toHaveValue(16)
    expect(screen.getByRole('button', { name: '收起并联动内边距' })).toBeInTheDocument()
    dispatch.mockClear()
    fireEvent.click(screen.getByRole('button', { name: '收起并联动内边距' }))
    expect((dispatch.mock.lastCall?.[0] as EditorCommand).payload).toMatchObject({
      value: { padding: { top: 8, right: 8, bottom: 8, left: 8 } },
    })
  })

  it('OpenSpec: basic-materials / Flex 布局 Component 与紧凑 Inspector / 显示状态并重置完整布局', () => {
    const dispatch = vi.fn()
    const HeaderActions = inspectorHeaderActionsOf('Layout')
    const defaults = createDefaultComposeFlexLayout()
    const defaultContainer = entity({
      Hierarchy: { childIds: [] },
      Layout: defaults,
    })
    const { rerender } = render(
      <HeaderActions
        componentKey="Layout"
        dispatch={dispatch}
        entity={defaultContainer}
        readOnly={false}
        value={defaultContainer.components.Layout!}
      />,
    )

    expect(screen.getByText('Auto Layout')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重置布局' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '更多布局操作' })).toHaveAttribute(
      'aria-haspopup',
      'menu',
    )

    const changed = { ...defaults, flexDirection: 'column' as const, rowGap: 12 }
    const changedContainer = entity({
      Hierarchy: { childIds: [] },
      Layout: changed,
    })
    rerender(
      <HeaderActions
        componentKey="Layout"
        dispatch={dispatch}
        entity={changedContainer}
        readOnly={false}
        value={changedContainer.components.Layout!}
      />,
    )
    const reset = screen.getByRole('button', { name: '重置布局' })
    expect(reset).toBeEnabled()
    fireEvent.click(reset)
    const command = dispatch.mock.lastCall?.[0] as EditorCommand
    expect(command.type).toBe(BUILTIN_COMMAND_TYPES.updateComponent)
    expect(command.payload).toEqual({
      entityId: 'entity-a',
      key: 'Layout',
      value: defaults,
    })

    rerender(
      <HeaderActions
        componentKey="Layout"
        dispatch={dispatch}
        entity={changedContainer}
        readOnly
        value={changedContainer.components.Layout!}
      />,
    )
    expect(screen.getByRole('button', { name: '重置布局' })).toBeDisabled()
  })

  it('OpenSpec: 移除 Auto Layout 的视觉保持 / 标题栏菜单派发单个烘焙 batch', () => {
    const dispatch = vi.fn()
    const HeaderActions = inspectorHeaderActionsOf('Layout')
    const child = entity({
      LayoutItem: { ...createDefaultComposeLayoutItem(), positioning: 'flow' },
    })
    const container = { ...entity({
      Hierarchy: { childIds: [child.id] },
      Layout: createDefaultComposeFlexLayout(),
    }), id: 'parent', name: 'Parent' }
    const document: ComposeDocument = {
      schemaVersion: 6,
      canvas: createDefaultCanvasSettings(),
      output: createDefaultOutputSettings(),
      rootIds: [container.id],
      entities: { [container.id]: container, [child.id]: child },
    }
    render(
      <HeaderActions
        componentKey="Layout"
        dispatch={dispatch}
        document={document}
        entity={container}
        layoutSnapshot={{
          revision: 2,
          boxes: {
            [container.id]: { x: 0, y: 0, width: 180, height: 40, positioning: 'absolute' },
            [child.id]: { x: 12, y: 8, width: 100, height: 100, positioning: 'flow' },
          },
          diagnostics: [],
        }}
        readOnly={false}
        value={container.components.Layout!}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '更多布局操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '移除自动布局' }))
    const command = dispatch.mock.lastCall?.[0] as EditorCommand
    expect(command.type).toBe(BUILTIN_COMMAND_TYPES.batch)
    expect(command.payload.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: BUILTIN_COMMAND_TYPES.updateComponent,
        payload: expect.objectContaining({
          entityId: child.id,
          value: expect.objectContaining({ positioning: 'absolute' }),
        }),
      }),
      expect.objectContaining({
        type: BUILTIN_COMMAND_TYPES.removeComponent,
        payload: { entityId: container.id, key: 'Layout' },
      }),
    ]))
  })

  it('OpenSpec: layout-runtime-v6 / Flex 对齐保持显式值而不恢复 normal', () => {
    const dispatch = vi.fn()
    const Inspector = inspectorOf('Layout')
    const layout = {
      ...createDefaultComposeFlexLayout(),
      alignContent: 'center' as const,
      justifyContent: 'flex-end' as const,
      alignItems: 'stretch' as const,
    }
    const container = entity({
      Hierarchy: { childIds: [] },
      Layout: layout,
    })
    render(
      <Inspector
        componentKey="Layout"
        dispatch={dispatch}
        entity={container}
        readOnly={false}
        value={container.components.Layout!}
      />,
    )

    const cases = [
      ['多行', '起始', 'alignContent', 'flex-start'],
      ['主轴', '居中', 'justifyContent', 'center'],
      ['交叉轴', '居中', 'alignItems', 'center'],
    ] as const
    for (const [groupName, optionName, field, expected] of cases) {
      dispatch.mockClear()
      fireEvent.click(within(screen.getByRole('radiogroup', { name: groupName }))
        .getByRole('radio', { name: optionName }))
      const command = dispatch.mock.lastCall?.[0] as EditorCommand
      expect(command.payload).toEqual({
        entityId: 'entity-a',
        key: 'Layout',
        value: { ...layout, [field]: expected },
      })
    }
  })

  it('OpenSpec: basic-materials / Flex Inspector 的 en-US 文案保持单语', () => {
    const Inspector = inspectorOf('Layout')
    const layout = createDefaultComposeFlexLayout()
    const container = entity({
      Hierarchy: { childIds: [] },
      Layout: layout,
    })
    render(
      <ComposeUIProvider locale="en-US">
        <Inspector
          componentKey="Layout"
          dispatch={vi.fn()}
          entity={container}
          readOnly={false}
          value={container.components.Layout!}
        />
      </ComposeUIProvider>,
    )

    expect(screen.getByRole('radiogroup', { name: 'Direction' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Item gap' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Padding' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand padding' })).toBeInTheDocument()
    const preview = screen.getByTestId('flex-layout-preview')
    expect(within(preview).queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(within(preview).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText('方向')).not.toBeInTheDocument()
    expect(screen.queryByText('项间距')).not.toBeInTheDocument()
  })

  it('OpenSpec: 基础物料 / Appearance Inspector 保留未编辑的 shadow 数据', () => {
    const dispatch = vi.fn()
    const Inspector = inspectorOf('Appearance')
    const shadowed = entity({
      Appearance: {
        backgroundPaint: { kind: 'solid', color: '#111111' },
        shadow: { color: '#00000040', offsetX: 0, offsetY: 4, blur: 12, spread: 0 },
      },
    })
    render(
      <Inspector
        componentKey="Appearance"
        dispatch={dispatch}
        entity={shadowed}
        readOnly={false}
        value={shadowed.components.Appearance!}
      />,
    )
    const opacity = screen.getByRole('spinbutton', { name: '透明度' })
    fireEvent.change(opacity, { target: { value: '0.5' } })
    fireEvent.blur(opacity)
    const command = dispatch.mock.lastCall?.[0] as EditorCommand
    expect(command.type).toBe(BUILTIN_COMMAND_TYPES.setAppearance)
    expect(command.payload).toMatchObject({
      entityId: 'entity-a',
      appearance: expect.objectContaining({
        opacity: 0.5,
        shadow: { color: '#00000040', offsetX: 0, offsetY: 4, blur: 12, spread: 0 },
      }),
    })
  })

  it('OpenSpec: stage-paint-tools / 背景填充打开时通过共享 Paint edit port 驱动画布控制柄', () => {
    const dispatch = vi.fn()
    const open = vi.fn()
    const close = vi.fn()
    const sample = vi.fn()
    const Inspector = inspectorOf('Appearance')
    const target = entity({
      Appearance: { backgroundPaint: { kind: 'solid', color: '#2563eb' } },
    })
    render(
      <Inspector
        componentKey="Appearance"
        dispatch={dispatch}
        entity={target}
        paintEditPort={{ open, close, sample }}
        readOnly={false}
        value={target.components.Appearance!}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '背景填充' }))
    expect(open).toHaveBeenCalledWith({ entityId: 'entity-a' })
  })
})
