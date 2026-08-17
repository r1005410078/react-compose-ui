import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { ComposeUIProvider } from '@compose-ui/ui-context'
import {
  ComposeAnimationInspector,
  ComposeAnimationPanelProvider,
  ComposeAnimationTimeline,
  createDefaultComposeAnimationPanelValue,
  createEmptyComposeAnimationPanelValue,
} from '../index'
import type { ComposeAnimationPanelAction } from '../index'

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
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
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
    // 颜色轨道的值控件是共享 ComposeColorPicker 的触发器。
    expect(screen.getByRole('button', { name: '选择值颜色' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '缓动预设' })).toHaveValue('linear')
  })

  it('OpenSpec: animation-panel / 本地时间线与关键帧交互 / 选择并编辑关键帧', () => {
    render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
        <ComposeAnimationTimeline />
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: '关键帧 100 ms：背景填充' }))
    expect(screen.getByRole('button', { name: '关键帧 100 ms：背景填充' }))
      .toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('textbox', { name: '时间' })).toHaveValue('100')
    expect(screen.getByRole('slider', { name: '当前时间' })).toHaveValue('200')
    // 100 ms 关键帧本来是缓入；改选缓出后控制点数值行同步。
    expect(screen.getByRole('combobox', { name: '缓动预设' })).toHaveValue('ease-in')
    fireEvent.change(screen.getByRole('combobox', { name: '缓动预设' }), {
      target: { value: 'ease-out' },
    })
    expect(screen.getByRole('combobox', { name: '缓动预设' })).toHaveValue('ease-out')
    expect(screen.getByRole('textbox', { name: '控制点' })).toHaveValue('0, 0, 0.58, 1')
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
                  interpolation: keyframe.timeMs === 100
                    ? { kind: 'cubic' as const, control: [0.42, 0, 1, 1] as const }
                    : keyframe.interpolation,
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
    // 取色器触发器的色块反映该关键帧自己的颜色值。
    expect(
      screen.getByRole('button', { name: '选择值颜色' }).querySelector('.compose-color-picker__swatch'),
    ).toHaveStyle({ backgroundColor: '#00aa11' })
    expect(screen.getByRole('combobox', { name: '缓动预设' })).toHaveValue('ease-in')
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
    const totalKeyframes = createDefaultComposeAnimationPanelValue().model.tracks
      .flatMap((track) => track.properties)
      .flatMap((property) => property.keyframes)
      .length
    expect(screen.getByText(`— / ${totalKeyframes}`)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '时间' })).toHaveValue('')
  })

  it('OpenSpec: animation-panel / 关键帧间插值曲线段 / 选择曲线段会联动右侧曲线属性', () => {
    render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
        <ComposeAnimationTimeline />
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )

    // 会话默认选中 200 ms 关键帧，它已经是 200→300 段的起点；换一段验证联动。
    const segment = screen.getByRole('button', {
      name: '编辑 100 ms 至 200 ms 的背景填充动画曲线',
    })
    expect(segment).not.toHaveAttribute('aria-current')

    fireEvent.click(segment)

    // 插值挂出向段：这一段由 100 ms 的起点关键帧控制，选中的必须是它。
    expect(segment).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: '关键帧 100 ms：背景填充' }))
      .toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('textbox', { name: '时间' })).toHaveValue('100')
    expect(screen.getByDisplayValue('100 ms → 200 ms')).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: '当前时间' })).toHaveValue('200')
  })

  it('OpenSpec: animation-panel / 关键帧时间调整 / 拖动或键盘移动关键帧并同步属性面板', () => {
    render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
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
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
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
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
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
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
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
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
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

  it('OpenSpec: animation-panel / 由宿主提供的轨道文案 / 受控状态与宿主文案原样显示', () => {
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

    // 属性名来自会话数据，en-US 下也不做替换——包内不再内置任何按 ID 匹配的文案映射。
    fireEvent.click(screen.getByRole('button', { name: 'Keyframe 100 ms: 背景填充' }))
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

  it('OpenSpec: animation-panel / 参考图一致的可访问视觉结构 / 播放中的暂停图标可见', () => {
    render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '播放动画' }))

    // 播放/暂停共用的这个按钮位被样式设成 fill: currentColor / stroke: none，
    // 描边型图形在那里画不出任何像素，暂停图标必须由填充图形组成。
    const pause = screen.getByRole('button', { name: '暂停动画' })
    expect(pause.querySelectorAll('svg rect, svg polygon, svg circle').length).toBeGreaterThan(0)
    expect(pause.querySelector('svg path')).toBeNull()
  })

  it('OpenSpec: animation-panel / 播放模式 / 允许选择播放一次、循环和往返', () => {
    render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    const once = screen.getByRole('radio', { name: '播放一次' })
    const loop = screen.getByRole('radio', { name: '循环' })
    const pingPong = screen.getByRole('radio', { name: '往返' })
    expect(once).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(loop)
    expect(loop).toHaveAttribute('aria-checked', 'true')
    expect(once).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(pingPong)
    expect(pingPong).toHaveAttribute('aria-checked', 'true')
    expect(loop).toHaveAttribute('aria-checked', 'false')
  })

  it('OpenSpec: animation-panel / 参考图一致的可访问视觉结构 / 头部、物体、属性与右侧三行对齐', () => {
    render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )

    const toolbar = screen.getByRole('group', { name: '时间线操作栏' })
    expect(toolbar).toHaveAttribute('data-timeline-header', 'true')
    expect(toolbar).toHaveClass('compose-animation-timeline__tracks-header')
    // 工具栏和标尺同属独立于纵向滚动区域之外的头部行，而不是 .tracks 的子节点——
    // 这样纵向滚动 board-scroll 时头部行天然不会被带走，不需要 sticky 或 JS 校正。
    expect(toolbar.parentElement).toHaveClass('compose-animation-timeline__header-row')
    expect(screen.getByRole('button', { name: '播放动画' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '自动记录属性' })).toBeNull()
    expect(screen.queryByRole('button', { name: '放大时间线' })).toBeNull()
    expect(document.querySelector('.compose-animation-timeline__ruler')).not.toBeNull()
    expect(screen.getByRole('button', { name: '选择对象轨道 Fault' }))
      .toHaveAttribute('data-object-row', 'fault')
    expect(document.querySelector('[data-object-lane="fault"]')).not.toBeNull()
    expect(screen.getByRole('button', { name: '选择属性轨道 背景填充' }))
      .toHaveAttribute('data-property-row', 'background-fill')
    expect(document.querySelector('[data-property-lane="background-fill"]')).not.toBeNull()
    // 演示会话含多物体多属性：展开轨道的属性 lane + 每个物体一行 clip-row
    const defaultValue = createDefaultComposeAnimationPanelValue()
    const expandedPropertyCount = defaultValue.model.tracks
      .filter((track) => track.expanded)
      .flatMap((track) => track.properties)
      .length
    expect(document.querySelectorAll('.compose-animation-timeline__property-lane'))
      .toHaveLength(expandedPropertyCount)
    expect(document.querySelectorAll('.compose-animation-timeline__clip-row'))
      .toHaveLength(defaultValue.model.tracks.length)
  })

  it('OpenSpec: animation-panel / 本地时间线与关键帧交互 / 选择物体轨道并与动画片段对齐', () => {
    render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
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
    // 对象行与片段是不同的选择目标：片段代表"动画本身"（宿主据此切换动画检查器），
    // 点对象行不连带选中片段；片段 → 轨道的联动方向保留。
    expect(screen.getByRole('button', { name: '动画片段 Fault：0 ms 至 300 ms' }))
      .not.toHaveAttribute('aria-current')
    expect(propertyRow).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('slider', { name: '当前时间' })).toHaveValue('200')

    fireEvent.click(screen.getByRole('button', { name: '动画片段 Fault：0 ms 至 300 ms' }))
    expect(screen.getByRole('button', { name: '动画片段 Fault：0 ms 至 300 ms' }))
      .toHaveAttribute('aria-current', 'true')
    expect(objectRow).toHaveAttribute('aria-current', 'true')
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

  it('OpenSpec: animation-panel / 复用共享交互组件 / 颜色字段使用共享取色器', () => {
    render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
        <ComposeAnimationTimeline />
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )

    // 触发器打开共享 ComposeColorPicker 的 Popover。
    fireEvent.click(screen.getByRole('button', { name: '选择值颜色' }))
    expect(screen.getByRole('dialog', { name: '值颜色' })).toBeInTheDocument()

    // 点击常用色即提交为会话值，触发器色块随之更新。
    fireEvent.click(screen.getByRole('button', { name: '#22c55e' }))
    expect(
      screen.getByRole('button', { name: '选择值颜色' }).querySelector('.compose-color-picker__swatch'),
    ).toHaveStyle({ backgroundColor: '#22c55e' })
  })

  it('OpenSpec: animation-panel / 关键帧时间调整 / 时间字段在提交前不移动关键帧', () => {
    render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
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
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
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
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    // 播放头 range 覆盖整块 scale 时会盖住所有轨道，让 lane 的点击永远到不了。
    expect(screen.getByRole('slider', { name: '当前时间' }))
      .toHaveClass('compose-animation-timeline__playhead-input--ruler')
  })

  it('OpenSpec: animation-panel / 参考图一致的可访问视觉结构 / 选中态与开关态使用不同的 ARIA 属性', () => {
    render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    // 播放模式是 radiogroup；关键帧与片段选中用 aria-current，不用 aria-pressed。
    expect(screen.getByRole('radio', { name: '播放一次' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: '关键帧 200 ms：背景填充' })).not.toHaveAttribute('aria-pressed')
    expect(screen.getByRole('button', { name: '调整动画片段 Fault 的结束时间' })).not.toHaveAttribute('aria-pressed')
    expect(screen.getByRole('button', { name: '调整动画片段 Fault 的结束时间' })).not.toHaveAttribute('aria-current')
  })

  it('OpenSpec: animation-panel / 参考图一致的可访问视觉结构 / 缓动区不出现协议外的编辑器标签', () => {
    render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )
    // 协议没有 spring 插值：缓动区只有预设、曲线与控制点，不再有曲线/弹簧标签页。
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(screen.getByRole('combobox', { name: '缓动预设' })).toBeInTheDocument()
  })

  it('OpenSpec: animation-panel / 分置嵌入动画区域 / 同页多个属性面板不产生重复 DOM id', () => {
    render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
        <ComposeAnimationInspector />
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )
    // 两个属性面板各自 useId：缓动区的键盘说明等带 id 元素不能撞车。
    const ids = [...document.querySelectorAll('.compose-animation-inspector [id]')]
      .map((element) => element.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('OpenSpec: animation-panel / 参考图一致的可访问视觉结构 / 不暴露没有行为的控件', async () => {
    render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    // 行上不再挂「更多操作」按钮：右键是唯一入口，行尾那一格还给数值区。
    expect(screen.queryByRole('button', { name: 'Fault 的更多操作' })).toBeNull()
    fireEvent.contextMenu(
      screen.getByRole('button', { name: '选择对象轨道 Fault' })
        .closest('.compose-animation-timeline__track-row') as HTMLElement,
    )
    expect((await screen.findAllByRole('menuitem')).length).toBeGreaterThan(0)
  })

  it('OpenSpec: animation-panel / 关键帧时间调整 / 时间冲突时给出可见且可访问的反馈', () => {
    render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
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
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
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
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    expect(screen.getByLabelText('当前时间', { selector: 'output' })).toHaveAttribute('aria-live', 'off')
  })

  it('OpenSpec: animation-panel / 时间线滚轮缩放与平移 / 按住修饰键滚动缩放会撑宽时间线', () => {
    stubTimelineContainerWidth(700)
    render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    const scaleScroll = document.querySelector<HTMLElement>('.compose-animation-timeline__scale-scroll')!
    const scale = document.querySelector<HTMLElement>('.compose-animation-timeline__scale')!
    const widthBefore = Number.parseFloat(scale.style.width)
    // `.scale` 左右各 margin 10px：700 px 可视宽度扣掉 20 px 后，铺满默认值是 680。
    expect(widthBefore).toBeCloseTo(680)

    fireEvent.wheel(scaleScroll, { clientX: 350, ctrlKey: true, deltaY: -100 })

    expect(Number.parseFloat(scale.style.width)).toBeGreaterThan(widthBefore)
  })

  it('OpenSpec: animation-panel / 时间线滚轮缩放与平移 / 缩小后不产生小于可视宽度的空白', () => {
    stubTimelineContainerWidth(700)
    render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    const scaleScroll = document.querySelector<HTMLElement>('.compose-animation-timeline__scale-scroll')!
    const scale = document.querySelector<HTMLElement>('.compose-animation-timeline__scale')!

    // 已经贴着下限，继续缩小不应把宽度压到可视宽度（扣除左右 gutter 后 680）以下。
    fireEvent.wheel(scaleScroll, { clientX: 350, ctrlKey: true, deltaY: 500 })

    expect(Number.parseFloat(scale.style.width)).toBeCloseTo(680)
  })

  it('OpenSpec: animation-panel / 时间线滚轮缩放与平移 / 横向滚轮平移时间轴且不改变缩放', () => {
    stubTimelineContainerWidth(700)
    render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    const scaleScroll = document.querySelector<HTMLElement>('.compose-animation-timeline__scale-scroll')!
    const scale = document.querySelector<HTMLElement>('.compose-animation-timeline__scale')!

    // 先放大出可平移的空间；纵向留给 board-scroll，横向 deltaX 平移时间轴。
    fireEvent.wheel(scaleScroll, { clientX: 350, ctrlKey: true, deltaY: -300, bubbles: true })
    const widthAfterZoom = scale.style.width
    fireEvent.wheel(scaleScroll, { clientX: 350, deltaX: 40, deltaY: 0, bubbles: true })

    expect(scale.style.width).toBe(widthAfterZoom)
    expect(scaleScroll.scrollLeft).toBeGreaterThan(0)
  })

  it('OpenSpec: animation-panel / 缩放不改变片段与关键帧的视觉尺寸 / 放大后片段条与关键帧只有位置随比例变化', () => {
    stubTimelineContainerWidth(700)
    render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    const scaleScroll = document.querySelector<HTMLElement>('.compose-animation-timeline__scale-scroll')!
    fireEvent.wheel(scaleScroll, { clientX: 350, ctrlKey: true, deltaY: -300 })

    const clip = document.querySelector<HTMLElement>('.compose-animation-timeline__clip')!
    const clipBody = document.querySelector<HTMLElement>('.compose-animation-timeline__clip-body')!
    const keyframe = screen.getByRole('button', { name: '关键帧 200 ms：背景填充' })
    // 片段位置写在 .clip 上；缩放不改变圆角/手柄尺寸等样式表属性。
    expect(clip.style.left).not.toBe('')
    expect(clip.style.width).not.toBe('')
    expect(clipBody.style.height).toBe('')
    expect(clipBody.style.borderRadius).toBe('')
    expect(keyframe.style.width).toBe('')
    expect(keyframe.style.height).toBe('')
  })

  it('OpenSpec: animation-panel / 时间线滚轮缩放与平移 / 放大后标尺主刻度按可读间距变密', () => {
    stubTimelineContainerWidth(700)
    render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    const scaleScroll = document.querySelector<HTMLElement>('.compose-animation-timeline__scale-scroll')!
    const markersBefore = document.querySelectorAll('.compose-animation-timeline__ruler b').length

    fireEvent.wheel(scaleScroll, { clientX: 350, ctrlKey: true, deltaY: -300 })

    const markersAfter = document.querySelectorAll('.compose-animation-timeline__ruler b').length
    expect(markersAfter).toBeGreaterThan(markersBefore)
  })

  it('OpenSpec: animation-panel / 时间线滚轮缩放与平移 / 次刻度间距随主刻度步长换算，而不是固定 30 等分', () => {
    stubTimelineContainerWidth(700)
    render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    const ruler = document.querySelector<HTMLElement>('.compose-animation-timeline__ruler')!
    const stepBefore = ruler.style.getPropertyValue('--ruler-minor-step')
    expect(stepBefore).not.toBe('')

    const scaleScroll = document.querySelector<HTMLElement>('.compose-animation-timeline__scale-scroll')!
    fireEvent.wheel(scaleScroll, { clientX: 350, ctrlKey: true, deltaY: -300 })

    // 放大后主刻度步长变细，换算出的次刻度百分比间距必须跟着变——不能停留在固定的 3.333%。
    const stepAfter = document.querySelector<HTMLElement>('.compose-animation-timeline__ruler')!
      .style.getPropertyValue('--ruler-minor-step')
    expect(stepAfter).not.toBe(stepBefore)
  })

  it('OpenSpec: animation-panel / 双栏共用垂直滚动 / 左右两栏同属一个纵向滚动容器', () => {
    const view = render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    const board = view.container.querySelector('.compose-animation-timeline__board-scroll')
    const trackList = view.container.querySelector('.compose-animation-timeline__track-list')
    const scaleScroll = view.container.querySelector('.compose-animation-timeline__scale-scroll')
    expect(board).toBeTruthy()
    // 两栏都必须住在同一个纵向滚动容器里；各自再开一条纵向滚动就会出现行错位。
    expect(board?.contains(trackList as Node)).toBe(true)
    expect(board?.contains(scaleScroll as Node)).toBe(true)
    // jsdom 不做布局，真实对齐由 Playwright 覆盖；这里守住的是结构前提。
    expect(view.container.querySelectorAll('.compose-animation-timeline__board-scroll'))
      .toHaveLength(1)
  })
})

describe('宿主驱动的关键帧值与插值模型', () => {
  it('OpenSpec: animation-panel / 宿主驱动的关键帧值与插值模型 / 数值轨道显示数值输入', () => {
    render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
        <ComposeAnimationTimeline />
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '关键帧 240 ms：Rotation' }))
    const field = screen.getByRole('textbox', { name: '值' })
    expect(field).toHaveValue('28.404')
    // 数值输入不是十六进制颜色输入：非法数字被拒绝，合法数字被接受。
    fireEvent.change(field, { target: { value: '45.5' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(screen.getByRole('textbox', { name: '值' })).toHaveValue('45.5')
  })

  it('OpenSpec: animation-panel / 宿主驱动的关键帧值与插值模型 / 二维向量轨道显示两个分量', () => {
    render(
      <ComposeAnimationPanelProvider defaultValue={createDefaultComposeAnimationPanelValue()}>
        <ComposeAnimationTimeline />
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '关键帧 120 ms：Position' }))
    expect(screen.getByRole('textbox', { name: '值 X' })).toHaveValue('520')
    expect(screen.getByRole('textbox', { name: '值 Y' })).toHaveValue('430')
    const yField = screen.getByRole('textbox', { name: '值 Y' })
    fireEvent.change(yField, { target: { value: '444' } })
    fireEvent.keyDown(yField, { key: 'Enter' })
    expect(screen.getByRole('textbox', { name: '值 Y' })).toHaveValue('444')
    // 编辑单个分量不能丢掉另一个分量。
    expect(screen.getByRole('textbox', { name: '值 X' })).toHaveValue('520')
  })

  it('OpenSpec: animation-panel / 宿主驱动的关键帧值与插值模型 / 选择 cubic 插值后可编辑控制点', () => {
    const actions: ComposeAnimationPanelAction[] = []
    render(
      <ComposeAnimationPanelProvider
        defaultValue={createDefaultComposeAnimationPanelValue()}
        onAction={(action) => actions.push(action)}
      >
        <ComposeAnimationTimeline />
        <ComposeAnimationInspector />
      </ComposeAnimationPanelProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '关键帧 240 ms：Rotation' }))
    const control = screen.getByRole('textbox', { name: '控制点' })
    expect(control).toHaveValue('0.42, 0, 1, 1')
    fireEvent.change(control, { target: { value: '0.5, 0, 1, 1' } })
    fireEvent.keyDown(control, { key: 'Enter' })
    const last = actions[actions.length - 1]
    expect(last).toEqual({
      kind: 'set-interpolation',
      propertyId: 'rotation',
      keyframeId: 'rectangle-rotation-240',
      interpolation: { kind: 'cubic', control: [0.5, 0, 1, 1] },
    })
  })
})

describe('语义化面板动作回调', () => {
  it('OpenSpec: animation-panel / 语义化面板动作回调 / 拖动关键帧产生移动动作', () => {
    const actions: ComposeAnimationPanelAction[] = []
    render(
      <ComposeAnimationPanelProvider
        defaultValue={createDefaultComposeAnimationPanelValue()}
        onAction={(action) => actions.push(action)}
      >
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    const scale = document.querySelector<HTMLElement>('.compose-animation-timeline__scale')
    Object.defineProperty(scale, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, width: 300 }),
    })
    const keyframe = screen.getByRole('button', { name: '关键帧 200 ms：背景填充' })
    fireEvent.pointerDown(keyframe, { button: 0, clientX: 200, pointerId: 8 })
    fireEvent.pointerMove(keyframe, { clientX: 250, pointerId: 8 })
    fireEvent.pointerUp(keyframe, { clientX: 250, pointerId: 8 })
    const moves = actions.filter((action) => action.kind === 'move-keyframe')
    expect(moves[moves.length - 1]).toEqual({
      kind: 'move-keyframe',
      propertyId: 'background-fill',
      keyframeId: 'fault-background-fill-200',
      timeMs: 250,
    })
  })

  it('OpenSpec: animation-panel / 语义化面板动作回调 / 播放不产生编辑动作', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback)
      return callbacks.length
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const actions: ComposeAnimationPanelAction[] = []
    render(
      <ComposeAnimationPanelProvider
        defaultValue={{ ...createDefaultComposeAnimationPanelValue(), currentTimeMs: 0 }}
        onAction={(action) => actions.push(action)}
      >
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '播放动画' }))
    act(() => callbacks[0]?.(0))
    act(() => callbacks[1]?.(32))
    act(() => callbacks[2]?.(64))
    const playbackActions = actions.filter((action) => action.kind !== 'set-current-time')
    // 播放期间只出现播放头动作，绝不混入编辑动作。
    expect(playbackActions).toEqual([])
    expect(actions.some((action) => action.kind === 'set-current-time')).toBe(true)
  })
})

describe('空会话状态', () => {
  it('OpenSpec: animation-panel / 空会话状态 / 宿主提供创建引导', () => {
    render(
      <ComposeAnimationPanelProvider defaultValue={createEmptyComposeAnimationPanelValue()}>
        <ComposeAnimationTimeline emptyState={<button type="button">创建动画</button>} />
      </ComposeAnimationPanelProvider>,
    )
    expect(screen.getByRole('button', { name: '创建动画' })).toBeTruthy()
    // 不渲染播放控件、标尺或占位轨道。
    expect(screen.queryByRole('button', { name: '播放动画' })).toBeNull()
    expect(screen.queryByRole('slider', { name: '当前时间' })).toBeNull()
    expect(screen.queryByRole('list', { name: '轨道列表' })).toBeNull()
  })

  it('OpenSpec: animation-panel / 空会话状态 / 不回退到演示数据', () => {
    render(
      <ComposeAnimationPanelProvider>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    // 非受控且未提供 defaultValue：空会话 + 中性提示，而不是 Fault 演示轨道。
    expect(screen.queryByText('Fault')).toBeNull()
    expect(screen.getByText('当前没有动画数据')).toBeTruthy()
  })

  it('OpenSpec: editor-workspace-layout / 空动画的创建引导 / 受控 empty=false 时零轨道显示正常时间线', () => {
    stubTimelineContainerWidth(700)
    render(
      <ComposeAnimationPanelProvider value={createEmptyComposeAnimationPanelValue()} onValueChange={() => {}}>
        <ComposeAnimationTimeline empty={false} />
      </ComposeAnimationPanelProvider>,
    )
    // 宿主把空态定义为「页面没有绑定动画」：已绑定但零轨道时仍显示播放控件与标尺，
    // 并在轨道列表位置给出无轨道提示。
    expect(screen.getByRole('slider', { name: '当前时间' })).toBeTruthy()
    expect(screen.getByText('还没有轨道，选中组件打下第一个关键帧')).toBeTruthy()
  })

  it('受控 empty=true 时即使会话有轨道也显示空状态', () => {
    render(
      <ComposeAnimationPanelProvider value={createDefaultComposeAnimationPanelValue()} onValueChange={() => {}}>
        <ComposeAnimationTimeline empty emptyState={<button type="button">创建动画</button>} />
      </ComposeAnimationPanelProvider>,
    )
    expect(screen.getByRole('button', { name: '创建动画' })).toBeTruthy()
    expect(screen.queryByRole('slider', { name: '当前时间' })).toBeNull()
  })

  it('空会话切到首条轨道后标尺重新测量宽度（回归：观察器只在挂载时附着）', () => {
    stubTimelineContainerWidth(700)
    const view = render(
      <ComposeAnimationPanelProvider value={createEmptyComposeAnimationPanelValue()} onValueChange={() => {}}>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    expect(screen.queryByRole('slider', { name: '当前时间' })).toBeNull()

    view.rerender(
      <ComposeAnimationPanelProvider value={createDefaultComposeAnimationPanelValue()} onValueChange={() => {}}>
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    const slider = screen.getByRole('slider', { name: '当前时间' })
    // 空态挂载时时间轴不存在；切到完整时间线后测量 effect 必须重挂，
    // 否则标尺宽度停在 0，播放头 seek input 不可交互。
    expect(slider.closest('.compose-animation-timeline__ruler')).not.toHaveStyle({ width: '0px' })
  })
})

describe('更多操作菜单', () => {
  function renderTimeline(onAction = vi.fn()) {
    render(
      <ComposeAnimationPanelProvider
        defaultValue={createDefaultComposeAnimationPanelValue()}
        onAction={onAction}
      >
        <ComposeAnimationTimeline />
      </ComposeAnimationPanelProvider>,
    )
    return { onAction }
  }

  /** 默认夹具第一条属性行：Fault 的背景填充。 */
  const propertyRow = () => screen.getByRole('button', { name: '选择属性轨道 背景填充' })
    .closest('.compose-animation-timeline__property-row') as HTMLElement

  it('OpenSpec: animation-panel / 更多操作菜单 / 行上不存在更多操作按钮', () => {
    renderTimeline()
    expect(screen.queryAllByRole('button', { name: /的更多操作$/u })).toHaveLength(0)
  })

  it('OpenSpec: animation-panel / 更多操作菜单 / 右键打开行菜单并能删除属性轨道', async () => {
    renderTimeline()
    fireEvent.contextMenu(propertyRow())
    const items = (await screen.findAllByRole('menuitem')).map((item) => item.textContent)

    expect(items).toContain('删除轨道')
  })

  it('OpenSpec: animation-panel / 更多操作菜单 / 删除轨道只发出语义动作', async () => {
    const { onAction } = renderTimeline()
    fireEvent.contextMenu(propertyRow())
    fireEvent.click(await screen.findByRole('menuitem', { name: '删除轨道' }))

    expect(onAction).toHaveBeenCalledWith({
      kind: 'remove-track',
      propertyId: 'background-fill',
    })
  })

  it('OpenSpec: animation-panel / 更多操作菜单 / 对象行删除整个对象的动画', async () => {
    const { onAction } = renderTimeline()
    const trackRow = screen.getByRole('button', { name: '选择对象轨道 Fault' })
      .closest('.compose-animation-timeline__track-row') as HTMLElement
    fireEvent.contextMenu(trackRow)
    fireEvent.click(await screen.findByRole('menuitem', { name: '删除该对象的全部动画' }))

    expect(onAction).toHaveBeenCalledWith({ kind: 'remove-track-group', trackId: 'fault' })
  })

  it('OpenSpec: animation-panel / 更多操作菜单 / 跳到下一个关键帧只移动播放头', async () => {
    const { onAction } = renderTimeline()
    fireEvent.contextMenu(propertyRow())
    fireEvent.click(await screen.findByRole('menuitem', { name: '跳到下一个关键帧' }))

    // 背景填充轨道的关键帧在 0/100/200/300 ms，夹具播放头初始为 200：下一个是 300。
    expect(onAction).toHaveBeenCalledWith({ kind: 'set-current-time', timeMs: 300 })
    expect(onAction).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'add-keyframe-at-time' }),
    )
  })

  it('OpenSpec: animation-panel / 更多操作菜单 / 行菜单不含依赖时间位置的条目', async () => {
    renderTimeline()
    fireEvent.contextMenu(propertyRow())
    const items = (await screen.findAllByRole('menuitem')).map((item) => item.textContent)
    // 行不表达时间位置；"在光标所在时间打点"只能来自车道右键。
    expect(items).not.toContain('在光标所在时间打点')
    expect(items).toContain('在播放头处打点')
  })

  it('OpenSpec: animation-panel / 更多操作菜单 / 键盘用 Shift+F10 打开同一份菜单并恢复焦点', async () => {
    renderTimeline()
    // 面板自己接管这两个按键，不依赖浏览器把它们翻译成 contextmenu：Chromium 只对
    // 独立的 ContextMenu 键这么做，Mac 键盘上没有该键。
    const hit = screen.getByRole('button', { name: '选择属性轨道 背景填充' })
    hit.focus()
    fireEvent.keyDown(hit, { key: 'F10', shiftKey: true })
    const fromKeyboard = (await screen.findAllByRole('menuitem')).map((item) => item.textContent)
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })

    fireEvent.contextMenu(propertyRow())
    const fromPointer = (await screen.findAllByRole('menuitem')).map((item) => item.textContent)
    expect(fromKeyboard).toEqual(fromPointer)
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })

    // 焦点恢复的目标是行内的命中按钮：行本身是不可聚焦的 div，
    // resolveFocusTarget 会退回到 event.target.closest('button')。
    await vi.waitFor(() => { expect(document.activeElement).toBe(hit) })
  })
})
