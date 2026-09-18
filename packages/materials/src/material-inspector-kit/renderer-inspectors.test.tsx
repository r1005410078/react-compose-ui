import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createDefaultCanvasSettings } from '@compose-ui/core'
import type {
  ComposeEntity,
  EditorCommand,
  JsonObject,
} from '@compose-ui/core'
import type { ComposeRendererInspectorBindingPort } from '@compose-ui/component-registry'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createComponentInstanceAnimationInspector,
  createCurveRendererInspector,
  createTextRendererInspector,
} from './renderer-inspectors'

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

  it('OpenSpec: 基础物料 / 行高缺席即自动 / 面板不顶替一个数，关掉它是删字段', () => {
    const Inspector = createTextRendererInspector(() => 'command-id')
    const dispatch = vi.fn()
    const authoredProps: JsonObject = { text: 'Hello', fontSize: 28 }
    const target = entity({ Renderer: { type: 'text', props: authoredProps } })
    const view = render(
      <Inspector
        authoredProps={authoredProps}
        dispatch={dispatch}
        entity={target}
        propCategory={{ id: 'typography', label: '排版' }}
        props={authoredProps}
        readOnly={false}
        renderer={{ type: 'text', props: authoredProps }}
      />,
    )
    /*
     * 判别性的那一半：面板此前在缺席时顶替 `字号 × 1.2`，28px 上写着 33.6——而渲染与测量
     * 走的是 CSS `normal`，那一行真实高度 40。用户照面板上的数微调，文字会反而变矮。
     */
    expect(screen.queryByRole('spinbutton', { name: '行高' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '行高 存在' })).not.toBeChecked()

    // 勾上它取的是按当前字号推出来的起始值——面板自己造的初值是 0，而 `line-height: 0`
    // 会把每一行压进同一个像素。
    fireEvent.click(screen.getByRole('checkbox', { name: '行高 存在' }))
    const seeded = dispatch.mock.calls[dispatch.mock.calls.length - 1]![0] as EditorCommand
    expect(seeded.payload).toMatchObject({ props: { lineHeight: 33.6 } })

    // 关掉存在性写回的是**删掉这个字段**，而不是把「自动」固化成一个数。
    const present: JsonObject = { text: 'Hello', fontSize: 28, lineHeight: 40 }
    view.rerender(
      <Inspector
        authoredProps={present}
        dispatch={dispatch}
        entity={entity({ Renderer: { type: 'text', props: present } })}
        propCategory={{ id: 'typography', label: '排版' }}
        props={present}
        readOnly={false}
        renderer={{ type: 'text', props: present }}
      />,
    )
    expect(screen.getByRole('spinbutton', { name: '行高' })).toHaveValue(40)
    fireEvent.click(screen.getByRole('checkbox', { name: '行高 存在' }))
    const command = dispatch.mock.calls[dispatch.mock.calls.length - 1]![0] as EditorCommand
    expect((command.payload as { props: JsonObject }).props)
      .toEqual({ text: 'Hello', fontSize: 28 })
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

describe('Component Instance Animation Inspector', () => {
  /** 组件快照的最小形状：Inspector 只从里面读根 Frame 的动画清单。 */
  function snapshot(items: readonly JsonObject[]): JsonObject {
    return {
      componentId: 'switch',
      kind: 'base',
      revision: '1',
      appliedLineage: [],
      document: {
        schemaVersion: 7,
        rootIds: ['root'],
        entities: {
          root: {
            id: 'root',
            name: 'Switch',
            components: { Animations: { items } },
          },
        },
      },
    } as unknown as JsonObject
  }

  function instance(props: JsonObject) {
    const target = entity({ Renderer: { type: 'component-instance', props } })
    return { target, authoredProps: target.components.Renderer!.props as JsonObject }
  }

  const SWITCH: JsonObject = {
    id: 'switch',
    name: '合分闸',
    durationMs: 1000,
    playbackMode: 'play-once',
  }

  it('OpenSpec: basic-materials / 组件实例的动画播放头 / 下拉列出组件自己的动画', () => {
    const Inspector = createComponentInstanceAnimationInspector(() => 'command-id')
    const { target, authoredProps } = instance({
      resolvedSnapshot: snapshot([SWITCH]),
      animation: 'switch',
      animationTime: 250,
    })
    render(
      <Inspector
        authoredProps={authoredProps}
        dispatch={vi.fn()}
        entity={target}
        props={authoredProps}
        readOnly={false}
        renderer={{ type: 'component-instance', props: authoredProps }}
      />,
    )

    expect(screen.getByRole('combobox', { name: '动画' })).toHaveValue('switch')
    expect(screen.getByRole('option', { name: '合分闸' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: '播放头' })).toHaveValue(250)
  })

  it('OpenSpec: basic-materials / 组件实例的动画播放头 / 失效 id 与未选择可判别', () => {
    const Inspector = createComponentInstanceAnimationInspector(() => 'command-id')
    const stale = instance({
      resolvedSnapshot: snapshot([SWITCH]),
      animation: 'removed-clip',
      animationTime: 0,
    })
    const view = render(
      <Inspector
        authoredProps={stale.authoredProps}
        dispatch={vi.fn()}
        entity={stale.target}
        props={stale.authoredProps}
        readOnly={false}
        renderer={{ type: 'component-instance', props: stale.authoredProps }}
      />,
    )

    // 保留原值而不是静默回落到「未选择」：组件作者临时改错一个 id，不该在用户那边表现成
    // 「我的配置被吃掉了」。
    const select = screen.getByRole('combobox', { name: '动画' })
    expect(select).toHaveValue('removed-clip')
    expect(screen.getByRole('option', { name: '已失效：removed-clip' })).toBeInTheDocument()

    const unset = instance({ resolvedSnapshot: snapshot([SWITCH]), animation: null })
    view.rerender(
      <Inspector
        authoredProps={unset.authoredProps}
        dispatch={vi.fn()}
        entity={unset.target}
        props={unset.authoredProps}
        readOnly={false}
        renderer={{ type: 'component-instance', props: unset.authoredProps }}
      />,
    )

    expect(screen.getByRole('combobox', { name: '动画' })).toHaveValue('')
    expect(screen.getByRole('option', { name: '未选择' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /已失效/ })).not.toBeInTheDocument()
  })

  it('OpenSpec: basic-materials / 组件实例的动画播放头 / 选回未选择写 null', () => {
    const dispatch = vi.fn()
    const Inspector = createComponentInstanceAnimationInspector(() => 'command-id')
    const { target, authoredProps } = instance({
      resolvedSnapshot: snapshot([SWITCH]),
      animation: 'switch',
      animationTime: 250,
      // schema 之外的 props 必须原样保留。
      hostTag: 'switch-3',
    })
    render(
      <Inspector
        authoredProps={authoredProps}
        dispatch={dispatch}
        entity={target}
        props={authoredProps}
        readOnly={false}
        renderer={{ type: 'component-instance', props: authoredProps }}
      />,
    )

    fireEvent.change(screen.getByRole('combobox', { name: '动画' }), { target: { value: '' } })

    // 面板里「未选择」是空串，文档里必须是 null——空串不是一个动画 id。
    const command = dispatch.mock.calls[0]?.[0] as EditorCommand
    expect(command.payload).toMatchObject({
      entityId: 'entity-a',
      props: { animation: null, animationTime: 250, hostTag: 'switch-3' },
    })
  })
})

describe('Curve Renderer Inspector 的多作用对象写入', () => {
  function curveEntity(id: string, props: JsonObject): ComposeEntity {
    return {
      id,
      name: id,
      components: {
        Composition: { presetId: 'curve', baseComponentKeys: ['Lock'], capabilityIds: [] },
        Lock: { locked: false },
        Renderer: { type: 'curve', props },
      },
    }
  }

  function documentOf(entities: readonly ComposeEntity[]) {
    return {
      schemaVersion: 7 as const,
      canvas: createDefaultCanvasSettings(),
      rootIds: entities.map((item) => item.id),
      entities: Object.fromEntries(entities.map((item) => [item.id, item])),
    }
  }

  it('OpenSpec: compose-document / patch 合到各自的 props，不相干的字段不受影响', () => {
    const Inspector = createCurveRendererInspector(() => 'command-id')
    const a = curveEntity('a', { stroke: '#ffffff', strokeWidth: 2 })
    const b = curveEntity('b', { stroke: '#ffffff', strokeWidth: 5 })
    const dispatch = vi.fn<(command: EditorCommand) => unknown>()
    render(
      <Inspector
        authoredProps={a.components.Renderer!.props as JsonObject}
        dispatch={dispatch}
        document={documentOf([a, b])}
        entities={[a, b]}
        entity={a}
        props={a.components.Renderer!.props as JsonObject}
        readOnly={false}
        renderer={a.components.Renderer as never}
      />,
    )

    fireEvent.change(screen.getByLabelText('线条粗细'), { target: { value: '3' } })
    fireEvent.blur(screen.getByLabelText('线条粗细'))

    const command = dispatch.mock.calls[0]?.[0]
    expect(command?.type).toBe('transaction.batch')
    const commands = (command?.payload as unknown as {
      commands: readonly EditorCommand[]
    }).commands
    /*
     * 判别性断言在 b 上：拿 a 的整份 props 去写全部目标时，b 的 stroke 与 strokeWidth 也会变成
     * a 的值——而颜色那一项两条本来就相同，只有线宽读得出区别。
     */
    expect(commands.map((item) => (item.payload as unknown as { entityId: string }).entityId))
      .toEqual(['a', 'b'])
    for (const item of commands) {
      expect((item.payload as unknown as { props: JsonObject }).props)
        .toMatchObject({ strokeWidth: 3 })
    }
  })

  it('OpenSpec: compose-document / 单个作用对象仍走原来那条单条命令', () => {
    const Inspector = createCurveRendererInspector(() => 'command-id')
    const a = curveEntity('a', { stroke: '#ffffff', strokeWidth: 2 })
    const dispatch = vi.fn<(command: EditorCommand) => unknown>()
    render(
      <Inspector
        authoredProps={a.components.Renderer!.props as JsonObject}
        dispatch={dispatch}
        document={documentOf([a])}
        entity={a}
        props={a.components.Renderer!.props as JsonObject}
        readOnly={false}
        renderer={a.components.Renderer as never}
      />,
    )
    fireEvent.change(screen.getByLabelText('线条粗细'), { target: { value: '3' } })
    fireEvent.blur(screen.getByLabelText('线条粗细'))
    expect(dispatch.mock.calls[0]?.[0]?.type).toBe('entity.renderer.props.set')
  })
})
