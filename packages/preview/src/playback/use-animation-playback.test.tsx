import { createComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  type ComposeAnimationBindings,
  type ComposeDocument,
  type ComposeEntity,
  type JsonObject,
} from '@compose-ui/core'
import { createComposePageScriptScope, type ComposeState } from '@compose-ui/script-runtime'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComposePreview } from '../compose-preview'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** 手动驱动 rAF：flush(now) 执行当前排队回调，pending() 返回排队数。 */
function stubAnimationFrames() {
  const callbacks = new Map<number, FrameRequestCallback>()
  let id = 0
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callbacks.set(++id, callback)
    return id
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => {
    callbacks.delete(handle)
  })
  return {
    flush(now: number) {
      const batch = [...callbacks.values()]
      callbacks.clear()
      batch.forEach((callback) => callback(now))
    },
    pending: () => callbacks.size,
  }
}

const registry = createComposeEntityRegistry()

function animatedDocument(
  bindings?: ComposeAnimationBindings,
  autoplay = false,
): ComposeDocument {
  const box: ComposeEntity = {
    id: 'box',
    name: 'Box',
    components: {
      Composition: { presetId: null, baseComponentKeys: [], capabilityIds: [] },
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: 0, y: 0 },
        width: { mode: 'fixed', value: 100, min: 1, max: null },
        height: { mode: 'fixed', value: 100, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      Hierarchy: { childIds: [] },
      Animation: {
        clips: {
          intro: [{
            path: ['LayoutItem', 'offset'],
            valueKind: 'vector2',
            keyframes: [
              { id: 'a', timeMs: 0, value: { x: 0, y: 0 }, interpolation: { kind: 'linear' } },
              { id: 'b', timeMs: 400, value: { x: 200, y: 0 }, interpolation: { kind: 'linear' } },
            ],
          }],
        },
      } as unknown as JsonObject,
    },
  }
  return {
    schemaVersion: 6,
    canvas: createDefaultCanvasSettings(),
    output: { ...createDefaultOutputSettings(), width: 640, height: 360 },
    rootIds: ['box'],
    entities: { box },
    animations: [{
      id: 'intro',
      name: '入场',
      durationMs: 400,
      playbackMode: 'play-once',
      ...(autoplay ? { autoplay: true } : {}),
      ...(bindings ? { bindings } : {}),
    }],
  }
}

function booleanScope(initial = false) {
  let playing!: ComposeState<boolean>
  const scope = createComposePageScriptScope((context) => {
    playing = context.state(initial)
    return { playing }
  })
  return { scope, setPlaying: (value: boolean) => { playing.value = value } }
}

describe('ComposePreview 动画播放（脚本绑定驱动）', () => {
  it('OpenSpec: compose-preview / 预览按脚本绑定驱动动画 / 无绑定不自动播放', async () => {
    const raf = stubAnimationFrames()
    render(<ComposePreview document={animatedDocument()} registry={registry} />)
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    // 无绑定：显示 0 ms 采样结果且不推进——没有任何 rAF 排队。
    expect(raf.pending()).toBe(0)
  })

  it('OpenSpec: compose-preview / 动画自动播放 / 勾选自动播放无需绑定即从头播放', async () => {
    const raf = stubAnimationFrames()
    render(<ComposePreview document={animatedDocument(undefined, true)} registry={registry} />)
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    // autoplay：挂载首帧即触发上升沿，rAF 循环启动；play-once 播完后停止。
    expect(raf.pending()).toBe(1)
    act(() => raf.flush(0))
    act(() => raf.flush(1000))
    expect(raf.pending()).toBe(0)
  })

  it('OpenSpec: compose-preview / 动画自动播放 / playing 绑定存在时自动播放被忽略', async () => {
    const raf = stubAnimationFrames()
    const { scope } = booleanScope(false)
    render(
      <ComposePreview
        document={animatedDocument({ playing: { scope: 'page', exportName: 'playing' } }, true)}
        registry={registry}
        scriptScope={scope}
      />,
    )
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    // 绑定接管：导出为 false，autoplay 不生效，无任何帧排队。
    expect(raf.pending()).toBe(0)
  })

  it('OpenSpec: compose-preview / 预览按脚本绑定驱动动画 / 绑定驱动预览播放并在播完后停止', async () => {
    const raf = stubAnimationFrames()
    const { scope, setPlaying } = booleanScope(false)
    render(
      <ComposePreview
        document={animatedDocument({ playing: { scope: 'page', exportName: 'playing' } })}
        registry={registry}
        scriptScope={scope}
      />,
    )
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    expect(raf.pending()).toBe(0)

    // 上升沿：布尔导出变 true，从头开始推进（rAF 循环启动）。
    await act(async () => setPlaying(true))
    expect(raf.pending()).toBe(1)
    // play-once 播到末尾后循环停止，不再产生逐帧回调。
    act(() => raf.flush(0))
    act(() => raf.flush(1000))
    expect(raf.pending()).toBe(0)

    // 重新触发可重播：false → true 再次启动循环。
    await act(async () => setPlaying(false))
    await act(async () => setPlaying(true))
    expect(raf.pending()).toBe(1)
  })

  it('OpenSpec: compose-preview / 预览按脚本绑定驱动动画 / 卸载释放资源', async () => {
    const raf = stubAnimationFrames()
    const { scope, setPlaying } = booleanScope(false)
    const view = render(
      <ComposePreview
        document={animatedDocument({ playing: { scope: 'page', exportName: 'playing' } })}
        registry={registry}
        scriptScope={scope}
      />,
    )
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    await act(async () => setPlaying(true))
    expect(raf.pending()).toBe(1)

    view.unmount()
    // 推进循环停止，导出订阅取消：后续导出变化不再引发任何帧排队。
    expect(raf.pending()).toBe(0)
    await act(async () => setPlaying(false))
    await act(async () => setPlaying(true))
    expect(raf.pending()).toBe(0)
  })

  it('OpenSpec: page-script-runtime / 播放控制绑定的失效处理 / 类型不匹配按未绑定处理并产生诊断', async () => {
    const raf = stubAnimationFrames()
    let label!: ComposeState<string>
    const scope = createComposePageScriptScope((context) => {
      label = context.state('hello')
      return { label }
    })
    render(
      <ComposePreview
        document={animatedDocument({ playing: { scope: 'page', exportName: 'label' } })}
        registry={registry}
        scriptScope={scope}
      />,
    )
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    // 不做真值转换：不播放、页面正常渲染。
    expect(raf.pending()).toBe(0)
    expect(scope.getSnapshot().diagnostics).toContainEqual(expect.objectContaining({
      code: 'script.binding-type-mismatch',
      exportName: 'label',
    }))
  })

  it('OpenSpec: page-script-runtime / 播放控制绑定的失效处理 / 绑定到不存在的导出', async () => {
    const raf = stubAnimationFrames()
    const { scope } = booleanScope(false)
    render(
      <ComposePreview
        document={animatedDocument({ playing: { scope: 'page', exportName: 'missing' } })}
        registry={registry}
        scriptScope={scope}
      />,
    )
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    expect(raf.pending()).toBe(0)
    expect(scope.getSnapshot().diagnostics).toContainEqual(expect.objectContaining({
      code: 'script.binding-missing-export',
      exportName: 'missing',
    }))
  })

  it('OpenSpec: page-script-runtime / 动画播放控制的脚本驱动语义 / currentTime 完全接管时间轴', async () => {
    const raf = stubAnimationFrames()
    let time!: ComposeState<number>
    let playing!: ComposeState<boolean>
    const scope = createComposePageScriptScope((context) => {
      time = context.state(150)
      playing = context.state(true)
      return { time, playing }
    })
    render(
      <ComposePreview
        document={animatedDocument({
          playing: { scope: 'page', exportName: 'playing' },
          currentTime: { scope: 'page', exportName: 'time' },
        })}
        registry={registry}
        scriptScope={scope}
      />,
    )
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    // playing 为 true 也不自行推进：脚本完全接管，没有 rAF 循环。
    expect(raf.pending()).toBe(0)
    await act(async () => { time.value = 900 })
    // 越界写入不推进也不报错；播放头钳到时长（渲染层采样，结构断言仍是无循环）。
    expect(raf.pending()).toBe(0)
  })
})
