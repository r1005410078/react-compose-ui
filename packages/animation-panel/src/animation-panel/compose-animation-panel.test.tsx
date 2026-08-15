import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { ComposeUIProvider } from '@compose-ui/ui-context'
import {
  ComposeAnimationInspector,
  ComposeAnimationPanelProvider,
  ComposeAnimationTimeline,
  createDefaultComposeAnimationPanelValue,
} from '../index'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ComposeAnimationPanel', () => {
  it('OpenSpec: animation-panel / 默认关键帧演示时间线 / 初次渲染动画时间线', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )

    expect(screen.getByRole('button', { name: '播放动画' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: '当前时间' })).toHaveValue('200')
    expect(screen.getByRole('button', { name: '关键帧 200 ms：背景填充' }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Fault / 背景填充')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '时间' })).toHaveValue('200')
    expect(screen.getByRole('textbox', { name: '值' })).toHaveValue('#FF6B6B')
    expect(screen.getByRole('combobox', { name: '插值' })).toHaveValue('linear')
  })

  it('OpenSpec: animation-panel / 本地时间线与关键帧交互 / 选择并编辑关键帧', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: '关键帧 100 ms：背景填充' }))
    expect(screen.getByRole('button', { name: '关键帧 100 ms：背景填充' }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('textbox', { name: '时间' })).toHaveValue('100')
    expect(screen.getByRole('slider', { name: '当前时间' })).toHaveValue('200')
    fireEvent.change(screen.getByRole('combobox', { name: '插值' }), {
      target: { value: 'ease-out' },
    })
    expect(screen.getByRole('combobox', { name: '插值' })).toHaveValue('ease-out')
    fireEvent.change(screen.getByRole('slider', { name: '当前时间' }), { target: { value: '150' } })
    expect(screen.getByRole('slider', { name: '当前时间' })).toHaveValue('150')
  })

  it('OpenSpec: animation-panel / 关键帧选择与属性同步 / 每个关键帧在属性面板显示自己的数据', () => {
    const initial = createDefaultComposeAnimationPanelValue()
    const defaultProperty = initial.model.tracks[0]?.properties[0]
    const value = {
      ...initial,
      model: {
        ...initial.model,
        tracks: initial.model.tracks.map((track) => ({
          ...track,
          properties: track.properties.map((property) => property.id !== defaultProperty?.id
            ? property
            : {
                ...property,
                keyframes: property.keyframes.map((keyframe) => ({
                  ...keyframe,
                  value: keyframe.timeMs === 100 ? '#00AA11' : keyframe.value,
                  interpolation: keyframe.timeMs === 100 ? 'ease-in' : keyframe.interpolation,
                })),
              }),
        })),
      },
    }
    render(
      <ComposeAnimationPanelProvider defaultValue={value}>
        <ComposeAnimationTimeline />
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: '关键帧 100 ms：背景填充' }))
    expect(screen.getByRole('textbox', { name: '时间' })).toHaveValue('100')
    expect(screen.getByRole('textbox', { name: '值' })).toHaveValue('#00AA11')
    expect(screen.getByRole('combobox', { name: '插值' })).toHaveValue('ease-in')
  })

  it('OpenSpec: animation-panel / 关键帧间插值曲线段 / 选择曲线段会联动右侧曲线属性', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )

    const segment = screen.getByRole('button', {
      name: '编辑 200 ms 至 300 ms 的背景填充动画曲线',
    })
    expect(segment).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(segment)

    expect(segment).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '关键帧 300 ms：背景填充' }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('textbox', { name: '时间' })).toHaveValue('300')
    expect(screen.getByDisplayValue('200 ms → 300 ms')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '曲线' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('slider', { name: '当前时间' })).toHaveValue('200')
  })

  it('OpenSpec: animation-panel / 关键帧时间调整 / 拖动或键盘移动关键帧并同步属性面板', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )
    const scale = document.querySelector<HTMLElement>('.compose-animation-timeline__scale')
    expect(scale).not.toBeNull()
    Object.defineProperty(scale, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, width: 300 }),
    })
    const keyframe = screen.getByRole('button', { name: '关键帧 200 ms：背景填充' })
    fireEvent.pointerDown(keyframe, { button: 0, clientX: 200, pointerId: 8 })
    fireEvent.pointerMove(keyframe, { clientX: 250, pointerId: 8 })
    fireEvent.pointerUp(keyframe, { clientX: 250, pointerId: 8 })
    expect(screen.getByRole('button', { name: '关键帧 250 ms：背景填充' }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('textbox', { name: '时间' })).toHaveValue('250')
    expect(screen.getByRole('slider', { name: '当前时间' })).toHaveValue('200')

    fireEvent.keyDown(screen.getByRole('button', { name: '关键帧 250 ms：背景填充' }), { key: 'ArrowLeft' })
    expect(screen.getByRole('textbox', { name: '时间' })).toHaveValue('240')
    expect(screen.getByRole('slider', { name: '当前时间' })).toHaveValue('200')
  })

  it('OpenSpec: animation-panel / 尾帧时长 / 编辑尾帧时长会移动最后一个关键帧', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    const duration = screen.getByRole('spinbutton', { name: '尾帧时长' })
    fireEvent.change(duration, { target: { value: '500' } })
    fireEvent.blur(duration)

    expect(duration).toHaveValue(500)
    expect(screen.getByRole('slider', { name: '当前时间' })).toHaveAttribute('max', '500')
    expect(screen.getByRole('button', { name: '关键帧 500 ms：背景填充' })).toBeInTheDocument()
  })

  it('OpenSpec: animation-panel / 尾帧时长 / 延长后为每个百毫秒主刻度显示标注', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    const duration = screen.getByRole('spinbutton', { name: '尾帧时长' })
    fireEvent.change(duration, { target: { value: '600' } })
    fireEvent.blur(duration)

    expect([...document.querySelectorAll('.compose-animation-timeline__ruler b')]
      .map((marker) => marker.textContent))
      .toEqual(['0', '100', '200', '300', '400', '500', '600'])
  })

  it('OpenSpec: animation-panel / 可调整动画片段 / 选择并拖动片段末端与主体', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    const scale = document.querySelector<HTMLElement>('.compose-animation-timeline__scale')
    expect(scale).not.toBeNull()
    Object.defineProperty(scale, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, width: 300 }),
    })

    fireEvent.click(screen.getByRole('button', { name: '动画片段 Fault：0 ms 至 300 ms' }))
    expect(screen.getByRole('button', { name: '动画片段 Fault：0 ms 至 300 ms' }))
      .toHaveAttribute('aria-pressed', 'true')

    const endHandle = screen.getByRole('button', { name: '调整动画片段 Fault 的结束时间' })
    fireEvent.pointerDown(endHandle, { button: 0, clientX: 300, pointerId: 12 })
    fireEvent.pointerMove(endHandle, { clientX: 250, pointerId: 12 })
    fireEvent.pointerUp(endHandle, { clientX: 250, pointerId: 12 })
    expect(screen.getByRole('button', { name: '动画片段 Fault：0 ms 至 250 ms' }))
      .toHaveAttribute('aria-pressed', 'true')

    fireEvent.keyDown(screen.getByRole('button', { name: '动画片段 Fault：0 ms 至 250 ms' }), {
      key: 'ArrowRight',
    })
    expect(screen.getByRole('button', { name: '动画片段 Fault：10 ms 至 260 ms' }))
      .toHaveAttribute('aria-pressed', 'true')
  })

  it('OpenSpec: animation-panel / 参考图一致的可访问视觉结构 / 键盘调整播放头', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )

    const playhead = screen.getByRole('slider', { name: '当前时间' })
    fireEvent.keyDown(playhead, { key: 'ArrowRight' })
    expect(playhead).toHaveValue('210')
    fireEvent.keyDown(playhead, { key: 'Home' })
    expect(playhead).toHaveValue('0')
    fireEvent.keyDown(playhead, { key: 'End' })
    expect(playhead).toHaveValue('300')
  })

  it('OpenSpec: animation-panel / 默认关键帧演示时间线 / 支持受控状态与共享国际化', () => {
    const value = createDefaultComposeAnimationPanelValue()
    const onValueChange = vi.fn()
    render(
      <ComposeUIProvider locale="en-US" theme="light">
        <ComposeAnimationPanelProvider value={value} onValueChange={onValueChange}>
          <ComposeAnimationTimeline />
          <ComposeAnimationInspector />
        </ComposeAnimationPanelProvider>
      </ComposeUIProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Keyframe 100 ms: Background fill' }))
    expect(onValueChange).toHaveBeenCalledWith(expect.objectContaining({
      currentTimeMs: 200,
      selectedKeyframeId: 'fault-background-fill-100',
    }))
    expect(screen.getByRole('slider', { name: 'Current time' })).toHaveValue('200')
    expect(screen.getByRole('region', { name: 'Animation editor' }))
      .toHaveAttribute('data-compose-theme', 'light')
  })

  it('OpenSpec: animation-panel / 播放模式 / 播放一次与循环', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback)
      return callbacks.length
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const endValue = { ...createDefaultComposeAnimationPanelValue(), currentTimeMs: 280 }
    const { unmount } = render(
      <ComposeAnimationPanelProvider defaultValue={endValue}>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: '播放动画' }))
    act(() => callbacks.shift()?.(0))
    act(() => callbacks.shift()?.(30))
    expect(screen.getByRole('slider', { name: '当前时间' })).toHaveValue('300')
    expect(screen.getByRole('button', { name: '播放动画' })).toBeInTheDocument()
    unmount()

    const loopValue = {
      ...createDefaultComposeAnimationPanelValue(),
      currentTimeMs: 280,
      playbackMode: 'loop' as const,
    }
    render(
      <ComposeAnimationPanelProvider defaultValue={loopValue}>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '播放动画' }))
    act(() => callbacks.shift()?.(0))
    act(() => callbacks.shift()?.(30))
    expect(screen.getByRole('slider', { name: '当前时间' })).toHaveValue('10')
    expect(screen.getByRole('button', { name: '暂停动画' })).toBeInTheDocument()
  })

  it('OpenSpec: animation-panel / 播放模式 / 允许选择播放一次、循环和往返', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    const mode = screen.getByRole('combobox', { name: '播放模式' })
    expect(mode).toHaveValue('play-once')
    fireEvent.change(mode, { target: { value: 'loop' } })
    expect(mode).toHaveValue('loop')
    fireEvent.change(mode, { target: { value: 'ping-pong' } })
    expect(mode).toHaveValue('ping-pong')
  })

  it('OpenSpec: animation-panel / 参考图一致的可访问视觉结构 / 头部、物体、属性与右侧三行对齐', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )

    const toolbar = screen.getByRole('toolbar', { name: '时间线操作栏' })
    expect(toolbar).toHaveAttribute('data-timeline-header', 'true')
    expect(toolbar.parentElement).toHaveClass('compose-animation-timeline__tracks')
    expect(screen.getByRole('button', { name: '播放动画' })).toBeInTheDocument()
    expect(document.querySelector('.compose-animation-timeline__ruler')).not.toBeNull()
    expect(screen.getByRole('button', { name: '选择对象轨道 Fault' }))
      .toHaveAttribute('data-object-row', 'fault')
    expect(document.querySelector('[data-object-lane="fault"]')).not.toBeNull()
    expect(screen.getByRole('button', { name: '选择属性轨道 背景填充' }))
      .toHaveAttribute('data-property-row', 'background-fill')
    expect(document.querySelector('[data-property-lane="background-fill"]')).not.toBeNull()
    expect(document.querySelectorAll('.compose-animation-timeline__property-lane')).toHaveLength(1)
    expect(document.querySelectorAll('.compose-animation-timeline__clip-row')).toHaveLength(1)
  })

  it('OpenSpec: animation-panel / 本地时间线与关键帧交互 / 选择物体轨道并与动画片段对齐', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )

    const objectRow = screen.getByRole('button', { name: '选择对象轨道 Fault' })
    const propertyRow = screen.getByRole('button', { name: '选择属性轨道 背景填充' })
    expect(objectRow).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '动画片段 Fault：0 ms 至 300 ms' }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(propertyRow).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(document.querySelector('.compose-animation-timeline__property-row .compose-animation-timeline__row-hit')!)
    expect(propertyRow).toHaveAttribute('aria-pressed', 'true')
    expect(objectRow).toHaveAttribute('aria-pressed', 'false')
    expect(document.querySelector('[data-property-lane="background-fill"]'))
      .toHaveAttribute('aria-pressed', 'true')
    expect(document.querySelector('.compose-animation-timeline__property-row'))
      .toHaveAttribute('data-selected', 'true')
    expect(document.querySelector('[data-property-lane="background-fill"]'))
      .toHaveAttribute('data-selected', 'true')
    expect(document.querySelector('.compose-animation-timeline__track-row'))
      .not.toHaveAttribute('data-selected')
    expect(document.querySelector('[data-object-lane="fault"]'))
      .not.toHaveAttribute('data-selected')

    fireEvent.click(document.querySelector('.compose-animation-timeline__track-row .compose-animation-timeline__row-hit')!)
    expect(objectRow).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '动画片段 Fault：0 ms 至 300 ms' }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(propertyRow).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('slider', { name: '当前时间' })).toHaveValue('200')
  })

  it('OpenSpec: animation-panel / 三种播放模式 / 受控宿主回传会话值时播放头继续推进', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback)
      return callbacks.length
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    function ControlledHost() {
      const [value, setValue] = useState({
        ...createDefaultComposeAnimationPanelValue(),
        currentTimeMs: 0,
      })
      return (
        <ComposeAnimationPanelProvider value={value} onValueChange={setValue}>
          <ComposeAnimationTimeline />
        </ComposeAnimationPanelProvider>
      )
    }
    render(<ControlledHost />)

    fireEvent.click(screen.getByRole('button', { name: '播放动画' }))
    // 首帧只记录时间戳；之后每帧推进 50 ms。
    act(() => callbacks.shift()?.(0))
    act(() => callbacks.shift()?.(50))
    act(() => callbacks.shift()?.(100))

    expect(screen.getByRole('slider', { name: '当前时间' })).toHaveValue('100')
    expect(screen.getByRole('button', { name: '暂停动画' })).toBeInTheDocument()
  })

  it('OpenSpec: animation-panel / 本地时间线与关键帧交互 / 颜色字段允许输入中间态并在提交时生效', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )
    const color = screen.getByRole('textbox', { name: '值' })

    // 半成品颜色必须能停留在输入框里，而不是被立即回滚。
    fireEvent.change(color, { target: { value: '#FF6B6' } })
    expect(color).toHaveValue('#FF6B6')

    fireEvent.change(color, { target: { value: '#00aa11' } })
    fireEvent.blur(color)
    expect(screen.getByRole('textbox', { name: '值' })).toHaveValue('#00AA11')

    const committed = screen.getByRole('textbox', { name: '值' })
    fireEvent.change(committed, { target: { value: '不是颜色' } })
    fireEvent.blur(committed)
    expect(screen.getByRole('textbox', { name: '值' })).toHaveValue('#00AA11')
  })

  it('OpenSpec: animation-panel / 关键帧时间调整 / 时间字段在提交前不移动关键帧', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )
    const time = screen.getByRole('textbox', { name: '时间' })
    expect(time).toHaveValue('200')

    fireEvent.change(time, { target: { value: '25' } })
    expect(screen.getByRole('button', { name: '关键帧 200 ms：背景填充' })).toBeInTheDocument()

    fireEvent.keyDown(time, { key: 'Enter' })
    expect(screen.getByRole('button', { name: '关键帧 25 ms：背景填充' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '时间' })).toHaveValue('25')

    // Escape 丢弃草稿并回到会话值。
    const reselected = screen.getByRole('textbox', { name: '时间' })
    fireEvent.change(reselected, { target: { value: '90' } })
    fireEvent.keyDown(reselected, { key: 'Escape' })
    expect(reselected).toHaveValue('25')
  })
})
