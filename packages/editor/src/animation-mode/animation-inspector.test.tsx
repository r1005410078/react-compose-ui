import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createComposeAnimationCommandHandlers } from '@compose-ui/animation'
import {
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  createTransactionRuntime,
  getComposeAnimations,
} from '@compose-ui/core'
import type { ComposeDocument } from '@compose-ui/core'
import { createComposePageScriptScope } from '@compose-ui/script-runtime'
import { AnimationInspector } from './animation-inspector'
import type { AnimationInspectorMessages } from './animation-inspector'

afterEach(cleanup)

const messages: AnimationInspectorMessages = {
  inspectorLabel: '动画属性',
  inspectorName: '名称',
  inspectorDuration: '时长',
  inspectorPlaybackMode: '播放模式',
  inspectorPlaying: '播放',
  inspectorCurrentTime: '当前时间',
  playingTakenOver: '时间轴已由脚本接管：解除当前时间绑定后才能绑定播放',
}

function documentWith(bindings?: Record<string, unknown>): ComposeDocument {
  return {
    schemaVersion: 6,
    canvas: createDefaultCanvasSettings(),
    output: createDefaultOutputSettings(),
    rootIds: [],
    entities: {},
    animations: [{
      id: 'intro',
      name: '入场',
      durationMs: 400,
      playbackMode: 'play-once',
      ...(bindings ? { bindings } : {}),
    }],
  } as ComposeDocument
}

function setup(document: ComposeDocument) {
  const runtime = createTransactionRuntime({
    document,
    handlers: createComposeAnimationCommandHandlers(),
  })
  let sequence = 0
  const scope = createComposePageScriptScope((context) => {
    const running = context.state(false)
    const progress = context.state(0)
    const title = context.state('hello')
    return { running, progress, title }
  })
  const renderInspector = () => {
    const animation = getComposeAnimations(runtime.document)[0]!
    return (
      <AnimationInspector
        animation={animation}
        dispatch={(command) => runtime.dispatch(command)}
        idFactory={() => `inspector-${sequence += 1}`}
        messages={messages}
        scope={scope}
      />
    )
  }
  return { runtime, scope, renderInspector }
}

describe('AnimationInspector', () => {
  it('OpenSpec: editor-workspace-layout / 动画检查器 / 修改动画参数可撤销', () => {
    const { runtime, renderInspector } = setup(documentWith())
    const view = render(renderInspector())
    expect(screen.getByRole('textbox', { name: '名称' })).toHaveValue('入场')

    fireEvent.change(screen.getByRole('combobox', { name: '播放模式' }), {
      target: { value: 'loop' },
    })
    expect(getComposeAnimations(runtime.document)[0]!.playbackMode).toBe('loop')
    // 修改经 animation.configure 进入文档与撤销历史。
    runtime.undo()
    expect(getComposeAnimations(runtime.document)[0]!.playbackMode).toBe('play-once')
    view.rerender(renderInspector())
    expect(screen.getByRole('combobox', { name: '播放模式' })).toHaveValue('play-once')
  })

  it('OpenSpec: editor-workspace-layout / 播放控制绑定编辑 / 绑定播放到布尔导出且候选按语义过滤', () => {
    const { runtime, renderInspector } = setup(documentWith())
    render(renderInspector())

    fireEvent.click(screen.getByRole('button', { name: /绑定\s*播放/u }))
    const picker = screen.getByRole('dialog')
    // 页面同时导出布尔、数值与字符串成员：playing 的候选只有布尔。
    expect(within(picker).getByText('running')).toBeInTheDocument()
    expect(within(picker).queryByText('progress')).not.toBeInTheDocument()
    expect(within(picker).queryByText('title')).not.toBeInTheDocument()

    fireEvent.click(within(picker).getByText('running'))
    expect(getComposeAnimations(runtime.document)[0]!.bindings).toEqual({
      playing: { scope: 'page', exportName: 'running' },
    })
  })

  it('OpenSpec: editor-workspace-layout / 播放控制绑定编辑 / 绑定当前时间后播放绑定禁用', () => {
    const { renderInspector } = setup(documentWith({
      currentTime: { scope: 'page', exportName: 'progress' },
    }))
    render(renderInspector())

    // playing 不再开放绑定入口，检查器渲染始终可见的接管说明。
    expect(screen.queryByRole('button', { name: /绑定\s*播放/u })).not.toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(messages.playingTakenOver)
  })

  it('OpenSpec: editor-workspace-layout / 播放控制绑定编辑 / 解绑可撤销', () => {
    const { runtime, renderInspector } = setup(documentWith({
      playing: { scope: 'page', exportName: 'running' },
    }))
    const view = render(renderInspector())

    // 已绑定状态提供解绑入口；解除后 bindings 整个命名空间清空。
    fireEvent.click(screen.getByRole('button', { name: '解绑 播放' }))
    expect(getComposeAnimations(runtime.document)[0]!.bindings).toBeUndefined()

    runtime.undo()
    expect(getComposeAnimations(runtime.document)[0]!.bindings).toEqual({
      playing: { scope: 'page', exportName: 'running' },
    })
    view.rerender(renderInspector())
    expect(screen.getByText('running')).toBeInTheDocument()
  })
})
