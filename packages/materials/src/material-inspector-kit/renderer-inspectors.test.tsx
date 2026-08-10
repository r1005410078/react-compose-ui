import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type {
  ComposeEntity,
  EditorCommand,
  JsonObject,
} from '@compose-ui/core'
import type { ComposeRendererInspectorBindingPort } from '@compose-ui/component-registry'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTextRendererInspector } from './renderer-inspectors'

/*
 * 属性行的操作列默认只有一个直接槽位。属性同时拥有绑定入口和重置动作时，两者都会收进
 * “更多”聚合菜单，因此断言必须同时接受直接按钮和菜单项两种呈现。
 */
function propertyAction(ownerLabel: string, actionLabel: string | RegExp): HTMLElement {
  const direct = screen.queryByRole('button', { name: actionLabel })
  if (direct) return direct
  fireEvent.click(screen.getByRole('button', { name: `更多 ${ownerLabel} 操作` }))
  const item = screen.getByRole('menuitem', { name: actionLabel })
  return item
}

function entity(components: Readonly<Record<string, JsonObject>> = {}): ComposeEntity {
  return {
    id: 'entity-a',
    name: 'Title',
    components: {
      Composition: {
        presetId: null,
        baseComponentKeys: ['Transform', 'Visibility', 'Lock'],
        capabilityIds: [],
      },
      Transform: {
        position: { x: 10, y: 20 },
        size: { width: 180, height: 40 },
        rotation: 0,
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      ...components,
    },
  }
}

afterEach(cleanup)

describe('Text Renderer Inspector', () => {
  it('OpenSpec: editor-workspace-layout / Renderer Props 分类 / 只渲染当前分类字段', () => {
    const Inspector = createTextRendererInspector(() => 'command-id')
    const target = entity({
      Renderer: {
        type: 'text',
        props: {
          text: 'Hello',
          color: '#172033',
          fontSize: 24,
          fontFamily: 'Inter',
          fontWeight: 600,
          letterSpacing: 1,
          lineHeight: 32,
          textAlign: 'center',
          verticalAlign: 'middle',
          textCase: 'uppercase',
          textDecoration: 'underline',
        },
      },
    })
    const authoredProps = target.components.Renderer!.props as JsonObject
    const view = render(
      <Inspector
        authoredProps={authoredProps}
        dispatch={vi.fn()}
        entity={target}
        propCategory={{ id: 'text', label: '文本' }}
        props={authoredProps}
        readOnly={false}
        renderer={{ type: 'text', props: authoredProps }}
      />,
    )

    expect(screen.getByRole('textbox', { name: '文本' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择文字颜色' })).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: '字号' })).not.toBeInTheDocument()

    view.rerender(
      <Inspector
        authoredProps={authoredProps}
        dispatch={vi.fn()}
        entity={target}
        propCategory={{ id: 'typography', label: '排版' }}
        props={authoredProps}
        readOnly={false}
        renderer={{ type: 'text', props: authoredProps }}
      />,
    )

    expect(screen.queryByRole('textbox', { name: '文本' })).not.toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: '字号' })).toHaveValue(24)
    expect(screen.getByRole('textbox', { name: '字体' })).toHaveValue('Inter')
    expect(screen.getByRole('textbox', { name: '字重' })).toHaveValue('600')
    expect(screen.getByRole('spinbutton', { name: '字间距' })).toHaveValue(1)
    expect(screen.getByRole('spinbutton', { name: '行高' })).toHaveValue(32)
    expect(screen.getByRole('combobox', { name: '水平对齐' })).toHaveValue('center')
    expect(screen.getByRole('combobox', { name: '垂直对齐' })).toHaveValue('middle')
    expect(screen.getByRole('combobox', { name: '大小写' })).toHaveValue('uppercase')
    expect(screen.getByRole('combobox', { name: '文字装饰' })).toHaveValue('underline')
  })

  it('OpenSpec: 基础物料 / 编辑 Text 内容保留 schema 之外的 props', () => {
    const dispatch = vi.fn()
    const Inspector = createTextRendererInspector(() => 'command-id')
    const withExtra = entity({
      Renderer: {
        type: 'text',
        props: { text: 'Hello', color: '#172033', fontSize: 24, hostTag: 'kpi' },
      },
    })
    const authoredProps = withExtra.components.Renderer!.props as JsonObject
    render(
      <Inspector
        authoredProps={authoredProps}
        dispatch={dispatch}
        entity={withExtra}
        props={authoredProps}
        readOnly={false}
        renderer={{ type: 'text', props: authoredProps }}
      />,
    )
    const text = screen.getByRole('textbox', { name: '文本' })
    fireEvent.change(text, { target: { value: 'World' } })
    fireEvent.blur(text)
    const command = dispatch.mock.lastCall?.[0] as EditorCommand
    expect(command.payload).toMatchObject({
      entityId: 'entity-a',
      props: {
        text: 'World',
        color: '#172033',
        fontSize: 24,
        hostTag: 'kpi',
      },
    })
  })

  it('OpenSpec: property-panel / 受控属性变量绑定 / 绑定类型兼容变量', () => {
    const Inspector = createTextRendererInspector(() => 'command-id')
    const target = entity({
      Renderer: {
        type: 'text',
        props: {
          text: 'Authored',
          color: '#172033',
          fontSize: 24,
          fontFamily: 'Inter',
          fontWeight: 600,
          letterSpacing: 1,
          lineHeight: 32,
        },
      },
    })
    const authoredProps = target.components.Renderer!.props as JsonObject
    const setField = vi.fn()
    const propsBinding: ComposeRendererInspectorBindingPort = {
      variables: [
        { id: 'count', label: 'Count', kind: 'value', value: 12 },
        { id: 'color', label: 'Color', kind: 'value', value: '#ff0000' },
      ],
      fields: {
        text: { exportName: 'count' },
        color: { exportName: null },
        fontSize: { exportName: null },
        fontFamily: { exportName: null },
        fontWeight: { exportName: null },
        letterSpacing: { exportName: null },
        lineHeight: { exportName: null },
      },
      inspectorPropNames: [
        'text',
        'color',
        'fontSize',
        'fontFamily',
        'fontWeight',
        'letterSpacing',
        'lineHeight',
      ],
      baseProps: {
        text: 'Authored',
        color: '#172033',
        fontSize: 30,
        fontFamily: 'Inter',
        fontWeight: 600,
        letterSpacing: 1,
        lineHeight: 32,
      },
      props: {
        text: 12,
        color: '#172033',
        fontSize: 30,
        fontFamily: 'Inter',
        fontWeight: 600,
        letterSpacing: 1,
        lineHeight: 32,
      },
      setField,
    }

    render(
      <Inspector
        authoredProps={authoredProps}
        dispatch={vi.fn()}
        entity={target}
        props={propsBinding.props}
        propsBinding={propsBinding}
        readOnly={false}
        renderer={{ type: 'text', props: authoredProps }}
      />,
    )

    expect(screen.queryByRole('textbox', { name: '文本' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /更换绑定 文本.*Count/u })).toBeEnabled()
    expect(propertyAction('文本', '解绑 文本')).toBeEnabled()
    expect(screen.getByRole('button', { name: '选择文字颜色' })).toBeEnabled()
    expect(screen.getByRole('button', { name: /绑定\s*文字颜色/u })).toBeEnabled()
    expect(screen.getByRole('textbox', { name: '字体' })).toHaveValue('Inter')
    expect(screen.getByRole('textbox', { name: '字重' })).toHaveValue('600')
    expect(screen.getByRole('spinbutton', { name: '字间距' })).toHaveValue(1)
    expect(screen.getByRole('spinbutton', { name: '行高' })).toHaveValue(32)
    expect(propertyAction('字体', /绑定\s*字体/u)).toBeEnabled()
    expect(propertyAction('字重', /绑定\s*字重/u)).toBeEnabled()
    expect(propertyAction('字间距', /绑定\s*字间距/u)).toBeEnabled()
    expect(propertyAction('行高', /绑定\s*行高/u)).toBeEnabled()
  })
})
