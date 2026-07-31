import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentType } from 'react'
import type {
  ComposeComponentDefinition,
  ComposeComponentInspectorProps,
} from '@compose-ui/component-registry'
import {
  BUILTIN_COMMAND_TYPES,
  createDefaultCanvasSettings,
  createDefaultComposeFlexLayout,
  createDefaultComposeLayoutItem,
  createDefaultOutputSettings,
  type ComposeDocument,
  type ComposeEntity,
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

afterEach(cleanup)

describe('内建 Component inspectors', () => {
  it('OpenSpec: 基础物料 / 内建 Component 定义自带 Inspector', () => {
    const definitions = createComposeBuiltinComponentDefinitions(() => 'id')
    for (const key of ['Transform', 'LayoutItem', 'Visibility', 'Lock', 'Appearance', 'Hierarchy', 'Layout', 'GeometryConstraints']) {
      expect(definitions.find((item) => item.key === key)?.inspector, key).toBeDefined()
    }
    expect(definitions.find((item) => item.key === 'Composition')?.hidden).toBe(true)
    expect(definitions.find((item) => item.key === 'Renderer')?.hidden).toBe(true)
  })

  it('OpenSpec: layout-runtime-v6 / Transform Inspector 只编辑旋转并跟随外部值', () => {
    const dispatch = vi.fn()
    const Inspector = inspectorOf('Transform')
    const target = entity()
    const { rerender } = render(
      <Inspector
        componentKey="Transform"
        dispatch={dispatch}
        entity={target}
        readOnly={false}
        value={target.components.Transform!}
      />,
    )
    const rotation = screen.getByRole('spinbutton', { name: '旋转' })
    expect(rotation).toHaveValue(0)

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

    const moved = entity({
      Transform: { rotation: 99 },
    })
    rerender(
      <Inspector
        componentKey="Transform"
        dispatch={dispatch}
        entity={moved}
        readOnly={false}
        value={moved.components.Transform!}
      />,
    )
    expect(screen.getByRole('spinbutton', { name: '旋转' })).toHaveValue(99)
  })

  it('OpenSpec: layout-runtime-v6 / Flow 转 Absolute 时从 Snapshot 烘焙 offset', () => {
    const dispatch = vi.fn()
    const Inspector = inspectorOf('LayoutItem')
    const child = entity({
      LayoutItem: {
        ...createDefaultComposeLayoutItem(80, 40),
        positioning: 'flow',
        offset: { x: 7, y: 8 },
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
          revision: 3,
          boxes: {
            [child.id]: { x: 30, y: 40, width: 80, height: 40, positioning: 'flow' },
          },
          diagnostics: [],
        }}
        readOnly={false}
        value={child.components.LayoutItem!}
      />,
    )

    fireEvent.change(screen.getByRole('combobox', { name: '定位' }), {
      target: { value: 'absolute' },
    })
    const command = dispatch.mock.lastCall?.[0] as EditorCommand
    expect(command.payload).toMatchObject({
      entityId: child.id,
      key: 'LayoutItem',
      value: { positioning: 'absolute', offset: { x: 30, y: 40 } },
    })
    expect(screen.getByRole('spinbutton', { name: '计算宽度' })).toHaveValue(80)
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
      'row-gap',
      'column-gap',
      'padding',
      'padding',
      'padding',
      'padding',
      'align-content',
      'justify-content',
      'align-items',
    ])
    expect(screen.getByText('flex-direction')).toBeInTheDocument()
    expect(screen.getByText('flex-wrap')).toBeInTheDocument()
    expect(screen.getByText('row-gap')).toBeInTheDocument()
    expect(screen.getByText('column-gap')).toBeInTheDocument()
    expect(screen.getAllByText('padding')).toHaveLength(4)
    expect(screen.getByText('align-content')).toBeInTheDocument()
    expect(screen.getByText('justify-content')).toBeInTheDocument()
    expect(screen.getByText('align-items')).toBeInTheDocument()

    const direction = within(panel).getByRole('radiogroup', { name: '方向' })
    expect(within(direction).getAllByRole('radio')).toHaveLength(4)
    expect(within(direction).getAllByRole('radio').map((item) => item.getAttribute('aria-label')))
      .toEqual(['横向', '纵向', '反向横向', '反向纵向'])
    expect(within(direction).getByRole('radio', { name: '横向' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    const multiLine = within(panel).getByRole('radiogroup', { name: '多行' })
    expect(within(multiLine).getAllByRole('radio')).toHaveLength(6)
    expect(within(multiLine).getAllByRole('radio').map((item) => item.getAttribute('aria-label')))
      .toEqual(['居中', '起始', '末端', '环绕', '两端', '拉伸'])
    expect(within(multiLine).getByRole('radio', { name: '拉伸' }))
      .toHaveAttribute('aria-checked', 'true')
    const mainAxis = within(panel).getByRole('radiogroup', { name: '主轴' })
    expect(within(mainAxis).getAllByRole('radio').map((item) => item.getAttribute('aria-label')))
      .toEqual(['居中', '起始', '末端', '两端', '环绕', '均匀'])
    const crossAxis = within(panel).getByRole('radiogroup', { name: '交叉轴' })
    expect(within(crossAxis).getAllByRole('radio').map((item) => item.getAttribute('aria-label')))
      .toEqual(['居中', '起始', '末端', '拉伸', '基线'])

    const rowGap = within(panel).getByRole('spinbutton', { name: '行间距' })
    const columnGap = within(panel).getByRole('spinbutton', { name: '列间距' })
    expect(rowGap).toHaveValue(0)
    expect(columnGap).toHaveValue(0)
    expect(screen.queryByText('px')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /绑定|变量/ })).not.toBeInTheDocument()

    const preview = screen.getByTestId('flex-layout-preview')
    expect(preview.querySelectorAll('[data-flex-preview-node]')).toHaveLength(3)
    expect(within(preview).getByText('Flex 容器')).toBeInTheDocument()
    expect(within(preview).getByText('row · nowrap · 0/0')).toBeInTheDocument()
    expect(within(preview).getByText('主轴')).toBeInTheDocument()
    expect(within(preview).getByText('交叉轴')).toBeInTheDocument()
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
    const rowGap = screen.getByRole('spinbutton', { name: '行间距' })
    fireEvent.change(rowGap, { target: { value: '-1' } })
    fireEvent.blur(rowGap)
    expect(dispatch).not.toHaveBeenCalled()

    fireEvent.change(rowGap, { target: { value: '12' } })
    fireEvent.blur(rowGap)
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
    expect(screen.getByRole('spinbutton', { name: '行间距' })).toHaveValue(0)

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

    expect(screen.getByText('display: flex')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重置布局' })).toBeDisabled()

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

  it('OpenSpec: layout-runtime-v6 / 直接子项通过一个 batch 转为 Flow', () => {
    const dispatch = vi.fn()
    const HeaderActions = inspectorHeaderActionsOf('Layout')
    const child = entity()
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
        readOnly={false}
        value={container.components.Layout!}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '将直接子项转换为自动布局' }))
    const command = dispatch.mock.lastCall?.[0] as EditorCommand
    expect(command.type).toBe(BUILTIN_COMMAND_TYPES.batch)
    expect(command.payload.commands).toEqual([
      expect.objectContaining({
        type: BUILTIN_COMMAND_TYPES.updateComponent,
        payload: expect.objectContaining({
          entityId: child.id,
          value: expect.objectContaining({ positioning: 'flow' }),
        }),
      }),
    ])
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
      ['多行', '居中', 'alignContent'],
      ['主轴', '末端', 'justifyContent'],
      ['交叉轴', '拉伸', 'alignItems'],
    ] as const
    for (const [groupName, optionName, field] of cases) {
      dispatch.mockClear()
      fireEvent.click(within(screen.getByRole('radiogroup', { name: groupName }))
        .getByRole('radio', { name: optionName }))
      const command = dispatch.mock.lastCall?.[0] as EditorCommand
      expect(command.payload).toEqual({
        entityId: 'entity-a',
        key: 'Layout',
        value: { ...layout, [field]: layout[field] },
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
    expect(screen.getByRole('spinbutton', { name: 'Row gap' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Column gap' })).toBeInTheDocument()
    const preview = screen.getByTestId('flex-layout-preview')
    expect(within(preview).getByText('Main axis')).toBeInTheDocument()
    expect(within(preview).getByText('Cross axis')).toBeInTheDocument()
    expect(screen.queryByText('方向')).not.toBeInTheDocument()
    expect(screen.queryByText('行间距')).not.toBeInTheDocument()
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
