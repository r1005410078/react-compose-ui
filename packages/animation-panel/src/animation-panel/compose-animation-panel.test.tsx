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
  vi.restoreAllMocks()
})

/**
 * 让 `.scale-scroll`/`.scale` 在挂载测量阶段就拿到一个非零可视宽度，
 * 否则缩放测试依赖的初始 `pixelsPerMs` 会因 jsdom 默认 0 尺寸而全程为 0。
 */
function stubTimelineContainerWidth(widthPx: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const measured = this.classList.contains('compose-animation-timeline__scale-scroll')
      || this.classList.contains('compose-animation-timeline__scale')
    const width = measured ? widthPx : 0
    return {
      bottom: 0, height: 0, left: 0, right: width, top: 0, width, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect
  })
}

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
      .toHaveAttribute('aria-current', 'true')
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
      .toHaveAttribute('aria-current', 'true')
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

  it('OpenSpec: animation-panel / 关键帧选择与属性同步 / 无选中关键帧时不显示虚假序号', () => {
    render(
      <ComposeAnimationPanelProvider
        defaultValue={{ ...createDefaultComposeAnimationPanelValue(), selectedKeyframeId: null }}
      >
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )
    expect(screen.getByText('未选中关键帧')).toBeInTheDocument()
    expect(screen.getByText('— / 4')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '时间' })).toHaveValue('')
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
    expect(segment).not.toHaveAttribute('aria-current')

    fireEvent.click(segment)

    expect(segment).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: '关键帧 300 ms：背景填充' }))
      .toHaveAttribute('aria-current', 'true')
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
      .toHaveAttribute('aria-current', 'true')
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
      .toHaveAttribute('aria-current', 'true')

    const endHandle = screen.getByRole('button', { name: '调整动画片段 Fault 的结束时间' })
    fireEvent.pointerDown(endHandle, { button: 0, clientX: 300, pointerId: 12 })
    fireEvent.pointerMove(endHandle, { clientX: 250, pointerId: 12 })
    fireEvent.pointerUp(endHandle, { clientX: 250, pointerId: 12 })
    expect(screen.getByRole('button', { name: '动画片段 Fault：0 ms 至 250 ms' }))
      .toHaveAttribute('aria-current', 'true')

    fireEvent.keyDown(screen.getByRole('button', { name: '动画片段 Fault：0 ms 至 250 ms' }), {
      key: 'ArrowRight',
    })
    expect(screen.getByRole('button', { name: '动画片段 Fault：10 ms 至 260 ms' }))
      .toHaveAttribute('aria-current', 'true')
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

    const toolbar = screen.getByRole('group', { name: '时间线操作栏' })
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
    expect(objectRow).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: '动画片段 Fault：0 ms 至 300 ms' }))
      .toHaveAttribute('aria-current', 'true')
    expect(propertyRow).not.toHaveAttribute('aria-current')

    fireEvent.click(document.querySelector('.compose-animation-timeline__property-row .compose-animation-timeline__row-hit')!)
    expect(propertyRow).toHaveAttribute('aria-current', 'true')
    expect(objectRow).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: '选择 背景填充 关键帧轨道' }))
      .toHaveAttribute('aria-current', 'true')
    expect(document.querySelector('.compose-animation-timeline__property-row'))
      .toHaveAttribute('data-selected', 'true')
    expect(document.querySelector('[data-property-lane="background-fill"]'))
      .toHaveAttribute('data-selected', 'true')
    expect(document.querySelector('.compose-animation-timeline__track-row'))
      .not.toHaveAttribute('data-selected')
    expect(document.querySelector('[data-object-lane="fault"]'))
      .not.toHaveAttribute('data-selected')

    fireEvent.click(document.querySelector('.compose-animation-timeline__track-row .compose-animation-timeline__row-hit')!)
    expect(objectRow).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: '动画片段 Fault：0 ms 至 300 ms' }))
      .toHaveAttribute('aria-current', 'true')
    expect(propertyRow).not.toHaveAttribute('aria-current')
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

  it('OpenSpec: animation-panel / 本地时间线与关键帧交互 / 点击关键帧轨道空白处选中属性轨道', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    const lane = document.querySelector('[data-property-lane="background-fill"]')!
    // 容器不能既是 button 又包着 button：嵌套交互元素在 AT 中无法寻址。
    expect(lane).not.toHaveAttribute('role')
    expect(lane).not.toHaveAttribute('tabindex')

    const laneHit = screen.getByRole('button', { name: '选择 背景填充 关键帧轨道' })
    expect(laneHit.parentElement).toBe(lane)
    fireEvent.click(laneHit)

    expect(screen.getByRole('button', { name: '选择属性轨道 背景填充' }))
      .toHaveAttribute('aria-current', 'true')
    expect(lane).toHaveAttribute('data-selected', 'true')
  })

  it('OpenSpec: animation-panel / 参考图一致的可访问视觉结构 / 播放头擦洗区限定在标尺带', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    // 播放头 range 覆盖整块 scale 时会盖住所有轨道，让 lane 的点击永远到不了。
    expect(screen.getByRole('slider', { name: '当前时间' }))
      .toHaveClass('compose-animation-timeline__playhead-input--ruler')
  })

  it('OpenSpec: animation-panel / 参考图一致的可访问视觉结构 / 选中态与开关态使用不同的 ARIA 属性', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    // 自动记录是真正的开关，保留 aria-pressed；集合内的选中项一律用 aria-current。
    expect(screen.getByRole('button', { name: '自动记录属性' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '关键帧 200 ms：背景填充' })).not.toHaveAttribute('aria-pressed')
    expect(screen.getByRole('button', { name: '调整动画片段 Fault 的结束时间' })).not.toHaveAttribute('aria-pressed')
    expect(screen.getByRole('button', { name: '调整动画片段 Fault 的结束时间' })).not.toHaveAttribute('aria-current')
  })

  it('OpenSpec: animation-panel / 参考图一致的可访问视觉结构 / 缓动标签实现 Tabs 键盘模式', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )
    const curve = screen.getByRole('tab', { name: '曲线' })
    const spring = screen.getByRole('tab', { name: '弹簧' })
    expect(curve).toHaveAttribute('tabindex', '0')
    expect(spring).toHaveAttribute('tabindex', '-1')
    expect(curve).toHaveAttribute('aria-controls', screen.getByRole('tabpanel').id)
    // 未渲染的面板不能被 aria-controls 引用。
    expect(spring).not.toHaveAttribute('aria-controls')

    curve.focus()
    fireEvent.keyDown(curve, { key: 'ArrowRight' })
    expect(spring).toHaveAttribute('aria-selected', 'true')
    expect(spring).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', spring.id)
  })

  it('OpenSpec: animation-panel / 分置嵌入动画区域 / 同页多个属性面板不产生重复 DOM id', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationInspector />
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )
    const ids = [
      ...screen.getAllByRole('tab').map((tab) => tab.id),
      ...screen.getAllByRole('tabpanel').map((panel) => panel.id),
    ]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('OpenSpec: animation-panel / 参考图一致的可访问视觉结构 / 不暴露没有行为的控件', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    expect(screen.queryByRole('button', { name: /更多操作/ })).not.toBeInTheDocument()
  })

  it('OpenSpec: animation-panel / 关键帧时间调整 / 时间冲突时给出可见且可访问的反馈', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )
    const time = screen.getByRole('textbox', { name: '时间' })
    fireEvent.change(time, { target: { value: '100' } })
    fireEvent.keyDown(time, { key: 'Enter' })

    // 100 ms 已被占用：关键帧不能移动，且必须说明原因。
    expect(screen.getByRole('button', { name: '关键帧 200 ms：背景填充' })).toBeInTheDocument()
    const timelineNotice = document.querySelector('.compose-animation-timeline__notice')
    expect(timelineNotice).toHaveTextContent('该属性轨道已存在同一时间的关键帧')
    // 编辑器实际只挂载时间线，Inspector 的 sr-only live region 不会出现在真实产品中；
    // 时间线自身的提示必须是可见的，而不仅仅是屏幕阅读器可达。
    expect(timelineNotice).not.toHaveClass('compose-animation-panel__sr-only')
    expect(screen.getByRole('textbox', { name: '时间' }))
      .toHaveAccessibleDescription('该属性轨道已存在同一时间的关键帧')
    expect(screen.getByRole('textbox', { name: '时间' })).toHaveValue('200')
  })

  it('OpenSpec: animation-panel / 关键帧时间调整 / 提交被钳制回未变化的值时草稿仍会同步', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )

    // 选中尾帧（300 ms，等于时长）：超出时长的提交会被钳回同一个值，字符串表示不变，
    // 调用方的 key（由 id + timeMs 拼成）也不会变化，草稿必须靠组件内部机制自行同步。
    fireEvent.click(screen.getByRole('button', { name: '关键帧 300 ms：背景填充' }))
    const time = screen.getByRole('textbox', { name: '时间' })
    expect(time).toHaveValue('300')

    fireEvent.change(time, { target: { value: '400' } })
    fireEvent.keyDown(time, { key: 'Enter' })

    expect(screen.getByRole('textbox', { name: '时间' })).toHaveValue('300')
    expect(screen.getByRole('button', { name: '关键帧 300 ms：背景填充' })).toBeInTheDocument()
  })

  it('OpenSpec: animation-panel / 参考图一致的可访问视觉结构 / 当前时间读数不在播放时反复播报', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    expect(screen.getByLabelText('当前时间', { selector: 'output' })).toHaveAttribute('aria-live', 'off')
  })

  it('OpenSpec: animation-panel / 时间线滚轮缩放与平移 / 按住修饰键滚动缩放会撑宽时间线', () => {
    stubTimelineContainerWidth(700)
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    const scaleScroll = document.querySelector<HTMLElement>('.compose-animation-timeline__scale-scroll')!
    const scale = document.querySelector<HTMLElement>('.compose-animation-timeline__scale')!
    const widthBefore = Number.parseFloat(scale.style.width)
    // `.scale` 的 margin: 0 10px 会从 700 px 的可视宽度里扣掉 20 px，铺满宽度的默认值是 680。
    expect(widthBefore).toBeCloseTo(680)

    fireEvent.wheel(scaleScroll, { clientX: 350, ctrlKey: true, deltaY: -100 })

    expect(Number.parseFloat(scale.style.width)).toBeGreaterThan(widthBefore)
  })

  it('OpenSpec: animation-panel / 时间线滚轮缩放与平移 / 缩小后不产生小于可视宽度的空白', () => {
    stubTimelineContainerWidth(700)
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    const scaleScroll = document.querySelector<HTMLElement>('.compose-animation-timeline__scale-scroll')!
    const scale = document.querySelector<HTMLElement>('.compose-animation-timeline__scale')!

    // 已经贴着下限，继续缩小不应把宽度压到可视宽度（扣除 margin 后 680）以下。
    fireEvent.wheel(scaleScroll, { clientX: 350, ctrlKey: true, deltaY: 500 })

    expect(Number.parseFloat(scale.style.width)).toBeCloseTo(680)
  })

  it('OpenSpec: animation-panel / 时间线滚轮缩放与平移 / 不带修饰键的滚动做横向平移', () => {
    stubTimelineContainerWidth(700)
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    const scaleScroll = document.querySelector<HTMLElement>('.compose-animation-timeline__scale-scroll')!
    const scale = document.querySelector<HTMLElement>('.compose-animation-timeline__scale')!

    // 先放大出可平移的空间，再验证普通滚轮改变 scrollLeft 而不改变宽度。
    fireEvent.wheel(scaleScroll, { clientX: 350, ctrlKey: true, deltaY: -300 })
    const widthAfterZoom = scale.style.width
    fireEvent.wheel(scaleScroll, { clientX: 350, deltaY: 40 })

    expect(scale.style.width).toBe(widthAfterZoom)
    expect(scaleScroll.scrollLeft).toBeGreaterThan(0)
  })

  it('OpenSpec: animation-panel / 不依赖滚轮的缩放入口 / 通过工具栏按钮放大缩小', () => {
    stubTimelineContainerWidth(700)
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    const scale = document.querySelector<HTMLElement>('.compose-animation-timeline__scale')!
    const widthBefore = Number.parseFloat(scale.style.width)

    fireEvent.click(screen.getByRole('button', { name: '放大时间线' }))
    expect(Number.parseFloat(scale.style.width)).toBeGreaterThan(widthBefore)

    const widthAfterZoomIn = Number.parseFloat(scale.style.width)
    fireEvent.click(screen.getByRole('button', { name: '缩小时间线' }))
    expect(Number.parseFloat(scale.style.width)).toBeLessThan(widthAfterZoomIn)
  })

  it('OpenSpec: animation-panel / 缩放不改变片段与关键帧的视觉尺寸 / 放大后片段条与关键帧只有位置随比例变化', () => {
    stubTimelineContainerWidth(700)
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    const scaleScroll = document.querySelector<HTMLElement>('.compose-animation-timeline__scale-scroll')!
    fireEvent.wheel(scaleScroll, { clientX: 350, ctrlKey: true, deltaY: -300 })

    const clipBody = document.querySelector<HTMLElement>('.compose-animation-timeline__clip-body')!
    const keyframe = screen.getByRole('button', { name: '关键帧 200 ms：背景填充' })
    // 缩放只应该写入位置相关的行内样式；圆角、边框、菱形尺寸完全来自样式表，不受缩放影响。
    expect(clipBody.style.left).not.toBe('')
    expect(clipBody.style.width).not.toBe('')
    expect(clipBody.style.height).toBe('')
    expect(clipBody.style.borderRadius).toBe('')
    expect(keyframe.style.width).toBe('')
    expect(keyframe.style.height).toBe('')
  })
})
