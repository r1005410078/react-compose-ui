import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComposePaint } from '@compose-ui/core'
import { ComposeI18nProvider, ComposeThemeProvider } from '@compose-ui/ui-context'
import { ComposeColorHistoryProvider, ComposeColorPicker, ComposePaintPicker } from '../index'

afterEach(cleanup)

function ControlledPicker({ initial = '#336699' }: { readonly initial?: string }) {
  const [value, setValue] = useState(initial)
  return <ComposeColorPicker label="背景" value={value} onValueChange={setValue} />
}

describe('OpenSpec: components / 共享 Color Picker', () => {
  it('以可访问色块触发器打开含 Alpha、常用色与折叠精确输入的颜色面板', () => {
    render(<ControlledPicker />)

    const trigger = screen.getByRole('button', { name: '选择背景颜色' })
    expect(trigger).not.toHaveTextContent('#336699')
    fireEvent.click(trigger)

    expect(screen.getByRole('dialog', { name: '背景颜色' })).toBeInTheDocument()
    expect(screen.getByText('精确').closest('details')).not.toHaveAttribute('open')
    expect(screen.getByLabelText('HEX')).toBeInTheDocument()
    expect(screen.getByLabelText('背景色盘')).toBeInTheDocument()
    expect(screen.getByLabelText('背景色相')).toHaveAttribute('type', 'range')
    expect(screen.getByRole('slider', { name: '背景不透明度' })).toHaveAttribute('type', 'range')
    expect(screen.getByRole('region', { name: '常用' })).toBeInTheDocument()
  })

  it('通过色盘键盘操作提交小写 HEX，并支持完全透明', () => {
    const onValueChange = vi.fn()
    render(<ComposeColorPicker label="边框" value="#336699" onValueChange={onValueChange} />)

    fireEvent.click(screen.getByRole('button', { name: '选择边框颜色' }))
    fireEvent.keyDown(screen.getByLabelText('边框色盘'), { key: 'ArrowRight' })
    expect(onValueChange).toHaveBeenLastCalledWith(expect.stringMatching(/^#[0-9a-f]{6}$/))

    fireEvent.click(screen.getByRole('button', { name: '透明' }))
    expect(onValueChange).toHaveBeenLastCalledWith('transparent')
  })

  it('为非 HEX 初值保留可预览的触发色，并从安全回退色开始编辑', () => {
    render(<ControlledPicker initial="rgb(1 2 3)" />)

    const trigger = screen.getByRole('button', { name: '选择背景颜色' })
    expect(trigger).toHaveAttribute('data-color-fallback', 'true')
    fireEvent.click(trigger)
    expect(screen.getByLabelText('背景色相')).toHaveValue('0')
  })

  it('在只读时禁用修改，并在 Escape 后恢复触发器焦点', async () => {
    const { rerender } = render(<ControlledPicker />)
    const trigger = screen.getByRole('button', { name: '选择背景颜色' })
    trigger.focus()
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: '背景颜色' })).toBeInTheDocument()

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '背景颜色' })).not.toBeInTheDocument()
      expect(trigger).toHaveFocus()
    })

    rerender(<ComposeColorPicker label="背景" readOnly value="#336699" onValueChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '选择背景颜色' })).toBeDisabled()

    rerender(<ComposeColorPicker disabled label="背景" value="#336699" onValueChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '选择背景颜色' })).toBeDisabled()
  })

  it('让 Portal 继承 Compose Theme 与 I18n', () => {
    render(
      <ComposeThemeProvider overrides={{ light: { accent: '#7c3aed' } }} theme="light">
        <ComposeI18nProvider locale="en-US">
          <ComposeColorPicker label="Background" value="#336699" onValueChange={vi.fn()} />
        </ComposeI18nProvider>
      </ComposeThemeProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Select Background color' }))
    expect(screen.getByRole('dialog', { name: 'Background color' }))
      .toHaveAttribute('data-compose-theme', 'light')
    expect(screen.getByRole('dialog', { name: 'Background color' }))
      .toHaveStyle({ '--compose-accent': '#7c3aed' })
    expect(screen.getByRole('button', { name: 'Transparent' })).toBeInTheDocument()
  })

  it('Alpha、历史颜色和原生吸管不可用降级都保持会话内行为', async () => {
    const fallback = vi.fn()
    function HistoryPicker() {
      const [value, setValue] = useState('#336699')
      return (
        <ComposeColorHistoryProvider>
          <ComposeColorPicker
            label="背景"
            value={value}
            onEyedropperFallback={fallback}
            onValueChange={setValue}
          />
        </ComposeColorHistoryProvider>
      )
    }
    render(<HistoryPicker />)
    const trigger = screen.getByRole('button', { name: '选择背景颜色' })
    fireEvent.click(trigger)
    fireEvent.change(screen.getByRole('slider', { name: '背景不透明度' }), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: '吸管' }))
    expect(fallback).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '背景颜色' })).not.toBeInTheDocument())
    fireEvent.click(trigger)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '#33669980' })).toBeInTheDocument()
    })
  })

  it('指针拖动只本地预览，松手时同步提交最终颜色', () => {
    const onValueChange = vi.fn()
    render(<ComposeColorPicker label="背景" value="#336699" onValueChange={onValueChange} />)
    fireEvent.click(screen.getByRole('button', { name: '选择背景颜色' }))
    const plane = screen.getByLabelText('背景色盘')
    vi.spyOn(plane, 'getBoundingClientRect').mockReturnValue({
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    fireEvent.pointerDown(plane, { clientX: 10, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(plane, { buttons: 1, clientX: 40, clientY: 40, pointerId: 1 })
    fireEvent.pointerMove(plane, { buttons: 1, clientX: 80, clientY: 80, pointerId: 1 })

    expect(onValueChange).not.toHaveBeenCalled()

    fireEvent.pointerUp(plane, { pointerId: 1 })
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenLastCalledWith(expect.stringMatching(/^#[0-9a-f]{6}$/))
  })

  it('在安全上下文优先调用原生 EyeDropper，并把采样结果规范化为 ComposeColor', async () => {
    const onValueChange = vi.fn()
    const originalSecureContext = Object.getOwnPropertyDescriptor(globalThis, 'isSecureContext')
    const originalEyeDropper = Object.getOwnPropertyDescriptor(globalThis, 'EyeDropper')
    const open = vi.fn().mockResolvedValue({ sRGBHex: '#ABCDEF' })
    Object.defineProperty(globalThis, 'isSecureContext', { configurable: true, value: true })
    Object.defineProperty(globalThis, 'EyeDropper', {
      configurable: true,
      value: class { open = open },
    })
    try {
      render(<ComposeColorPicker label="背景" value="#112233" onValueChange={onValueChange} />)
      fireEvent.click(screen.getByRole('button', { name: '选择背景颜色' }))
      fireEvent.click(screen.getByRole('button', { name: '吸管' }))
      await waitFor(() => expect(open).toHaveBeenCalledTimes(1))
      expect(onValueChange).toHaveBeenLastCalledWith('#abcdef')
    }
    finally {
      if (originalSecureContext) Object.defineProperty(globalThis, 'isSecureContext', originalSecureContext)
      else Reflect.deleteProperty(globalThis, 'isSecureContext')
      if (originalEyeDropper) Object.defineProperty(globalThis, 'EyeDropper', originalEyeDropper)
      else Reflect.deleteProperty(globalThis, 'EyeDropper')
    }
  })

  it('渐变 Picker 在切换类型时生成透明终点，并支持轨道色标键盘操作', () => {
    const onValueChange = vi.fn()
    render(
      <ComposePaintPicker
        label="背景填充"
        value={{ kind: 'solid', color: '#336699' }}
        onValueChange={onValueChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '背景填充' }))
    fireEvent.click(screen.getByRole('button', { name: '渐变' }))
    fireEvent.click(screen.getByRole('button', { name: '线性' }))
    expect(onValueChange).toHaveBeenLastCalledWith(expect.objectContaining({
      kind: 'linear-gradient',
      stops: expect.arrayContaining([expect.objectContaining({ color: 'transparent', position: 1 })]),
    }))
  })

  it('透明纯色切换为渐变时使用可见的设计强调色作为起点', () => {
    const onValueChange = vi.fn()
    render(
      <ComposePaintPicker
        label="背景填充"
        value={{ kind: 'solid', color: 'transparent' }}
        onValueChange={onValueChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '背景填充' }))
    fireEvent.click(screen.getByRole('button', { name: '渐变' }))

    expect(onValueChange).toHaveBeenLastCalledWith(expect.objectContaining({
      kind: 'linear-gradient',
      stops: expect.arrayContaining([
        expect.objectContaining({ color: '#8b5cf6', position: 0 }),
        expect.objectContaining({ color: 'transparent', position: 1 }),
      ]),
    }))
  })

  it('Paint Picker 将纯色与渐变色标编辑合并在同一张色彩面板内', () => {
    function ControlledPaintPicker() {
      const [value, setValue] = useState<ComposePaint>({ kind: 'solid', color: '#336699' })
      return <ComposePaintPicker label="背景填充" value={value} onValueChange={setValue} />
    }

    render(<ControlledPaintPicker />)
    fireEvent.click(screen.getByRole('button', { name: '背景填充' }))

    expect(screen.getAllByRole('dialog', { name: '背景填充' })).toHaveLength(1)
    expect(screen.getByLabelText('纯色色盘')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '选择纯色颜色' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '渐变' }))
    fireEvent.click(screen.getByRole('button', { name: '线性' }))
    expect(screen.getByLabelText('渐变色标轨道')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '0%' })).toBeInTheDocument()
    expect(screen.getByText('色标')).toBeInTheDocument()
    expect(screen.getAllByRole('dialog', { name: '背景填充' })).toHaveLength(1)
  })

  it('OpenSpec: components / Compose Color/Paint Picker 与会话颜色历史 / 完整管理渐变色标', () => {
    function ControlledPaintPicker() {
      const [value, setValue] = useState<ComposePaint>({
        kind: 'linear-gradient',
        start: { x: 0, y: 0.5 },
        end: { x: 1, y: 0.5 },
        stops: [
          { id: 'paint-stop-0', position: 0, color: '#8b5cf6' },
          { id: 'paint-stop-end', position: 1, color: '#000000' },
        ],
      })
      return <ComposePaintPicker label="背景填充" value={value} onValueChange={setValue} />
    }

    render(<ControlledPaintPicker />)
    fireEvent.click(screen.getByRole('button', { name: '背景填充' }))
    const addStop = screen.getByRole('button', { name: /添加色标/ })
    fireEvent.click(addStop)
    fireEvent.click(addStop)

    const track = screen.getByLabelText('渐变色标轨道')
    expect(within(track).getByRole('button', { name: '25%' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(track).getAllByRole('button').map((button) => button.getAttribute('aria-label')))
      .toEqual(['0%', '25%', '50%', '100%'])
  })

  it('OpenSpec: components / Compose Color/Paint Picker 与会话颜色历史 / 编辑三类渐变几何 - 方向盘只在松手时提交', () => {
    const onValueChange = vi.fn()
    render(
      <ComposePaintPicker
        label="背景填充"
        value={{
          kind: 'linear-gradient',
          start: { x: 0, y: 0.5 },
          end: { x: 1, y: 0.5 },
          stops: [
            { id: 'start', position: 0, color: '#8b5cf6' },
            { id: 'end', position: 1, color: '#000000' },
          ],
        }}
        onValueChange={onValueChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '背景填充' }))
    const dial = screen.getByRole('slider', { name: '方向角度' })
    vi.spyOn(dial, 'getBoundingClientRect').mockReturnValue({
      bottom: 70,
      height: 70,
      left: 0,
      right: 70,
      top: 0,
      width: 70,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    fireEvent.pointerDown(dial, { clientX: 70, clientY: 35, pointerId: 1 })
    fireEvent.pointerMove(dial, { buttons: 1, clientX: 35, clientY: 70, pointerId: 1 })
    expect(onValueChange).not.toHaveBeenCalled()
    fireEvent.pointerUp(dial, { clientX: 35, clientY: 70, pointerId: 1 })

    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenLastCalledWith(expect.objectContaining({
      kind: 'linear-gradient',
      start: { x: 0.5, y: 0 },
      end: { x: 0.5, y: 1 },
    }))
  })

  it('OpenSpec: components / Compose Color/Paint Picker 与会话颜色历史 / 编辑三类渐变几何 - 径向使用中心半径字段', () => {
    const onValueChange = vi.fn()
    render(
      <ComposePaintPicker
        label="背景填充"
        value={{
          kind: 'radial-gradient',
          center: { x: 0.5, y: 0.5 },
          radiusX: 0.5,
          radiusY: 0.5,
          stops: [
            { id: 'start', position: 0, color: '#8b5cf6' },
            { id: 'end', position: 1, color: '#000000' },
          ],
        }}
        onValueChange={onValueChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '背景填充' }))
    expect(screen.queryByRole('slider', { name: '方向角度' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('spinbutton', { name: '中心 X' }), { target: { value: '65' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: '垂直半径' }), { target: { value: '35' } })

    expect(onValueChange).toHaveBeenNthCalledWith(1, expect.objectContaining({
      kind: 'radial-gradient',
      center: { x: 0.65, y: 0.5 },
    }))
    expect(onValueChange).toHaveBeenNthCalledWith(2, expect.objectContaining({
      kind: 'radial-gradient',
      radiusY: 0.35,
    }))
  })

  it('拖动色标时只预览，松手提交一次，取消手势不提交', () => {
    const onValueChange = vi.fn()
    render(
      <ComposePaintPicker
        label="背景填充"
        value={{
          kind: 'linear-gradient',
          start: { x: 0, y: 0.5 },
          end: { x: 1, y: 0.5 },
          stops: [
            { id: 'start', position: 0, color: '#000000' },
            { id: 'middle', position: 0.5, color: '#808080' },
            { id: 'end', position: 1, color: '#ffffff' },
          ],
        }}
        onValueChange={onValueChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '背景填充' }))
    const track = screen.getByLabelText('渐变色标轨道')
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      bottom: 10,
      height: 10,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    const middle = within(track).getByRole('button', { name: '50%' })

    fireEvent.pointerDown(middle, { clientX: 50, pointerId: 9 })
    fireEvent.pointerUp(middle, { clientX: 50, pointerId: 9 })
    expect(onValueChange).not.toHaveBeenCalled()

    fireEvent.pointerDown(middle, { clientX: 50, pointerId: 1 })
    fireEvent.pointerMove(middle, { buttons: 1, clientX: 70, pointerId: 1 })
    expect(onValueChange).not.toHaveBeenCalled()
    expect(within(track).getByRole('button', { name: '70%' })).toBeInTheDocument()
    fireEvent.pointerUp(middle, { clientX: 70, pointerId: 1 })
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenLastCalledWith(expect.objectContaining({
      stops: expect.arrayContaining([expect.objectContaining({ id: 'middle', position: 0.7 })]),
    }))

    onValueChange.mockClear()
    const revertedMiddle = within(track).getByRole('button', { name: '50%' })
    fireEvent.pointerDown(revertedMiddle, { clientX: 50, pointerId: 2 })
    fireEvent.pointerMove(revertedMiddle, { buttons: 1, clientX: 80, pointerId: 2 })
    fireEvent.pointerCancel(revertedMiddle, { pointerId: 2 })
    expect(onValueChange).not.toHaveBeenCalled()
    expect(within(track).getByRole('button', { name: '50%' })).toBeInTheDocument()
  })

  it('色标键盘支持移动、首尾定位和删除后选择相邻色标', () => {
    function ControlledGradient() {
      const [paint, setPaint] = useState<ComposePaint>({
        kind: 'linear-gradient',
        start: { x: 0, y: 0.5 },
        end: { x: 1, y: 0.5 },
        stops: [
          { id: 'start', position: 0, color: '#000000' },
          { id: 'middle', position: 0.5, color: '#808080' },
          { id: 'end', position: 1, color: '#ffffff' },
        ],
      })
      return <ComposePaintPicker label="背景填充" value={paint} onValueChange={setPaint} />
    }

    render(<ControlledGradient />)
    fireEvent.click(screen.getByRole('button', { name: '背景填充' }))
    const track = screen.getByLabelText('渐变色标轨道')
    const middle = within(track).getByRole('button', { name: '50%' })
    fireEvent.keyDown(middle, { key: 'ArrowRight', shiftKey: true })
    const moved = within(track).getByRole('button', { name: '60%' })
    fireEvent.keyDown(moved, { key: 'Home' })
    const atStart = within(track).getAllByRole('button', { name: '0%' })[1]!
    fireEvent.keyDown(atStart, { key: 'Delete' })

    expect(within(track).getAllByRole('button')).toHaveLength(2)
    expect(within(track).getByRole('button', { name: '100%' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('径向预览中心手柄拖动只在 pointerup 提交一次', () => {
    const onValueChange = vi.fn()
    render(
      <ComposePaintPicker
        label="背景填充"
        value={{
          kind: 'radial-gradient',
          center: { x: 0.5, y: 0.5 },
          radiusX: 0.5,
          radiusY: 0.5,
          stops: [
            { id: 'start', position: 0, color: '#8b5cf6' },
            { id: 'end', position: 1, color: '#000000' },
          ],
        }}
        onValueChange={onValueChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '背景填充' }))
    const center = screen.getByRole('slider', { name: '径向中心' })
    const preview = center.parentElement!
    vi.spyOn(preview, 'getBoundingClientRect').mockReturnValue({
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    fireEvent.pointerDown(center, { clientX: 50, clientY: 50, pointerId: 3 })
    fireEvent.pointerMove(center, { buttons: 1, clientX: 68.4, clientY: 32.8, pointerId: 3 })
    expect(onValueChange).not.toHaveBeenCalled()
    fireEvent.pointerUp(center, { clientX: 68.4, clientY: 32.8, pointerId: 3 })
    expect(onValueChange).toHaveBeenCalledTimes(1)
    const committed = onValueChange.mock.calls[0]![0] as Extract<ComposePaint, { kind: 'radial-gradient' }>
    expect(committed.center.x).toBeCloseTo(0.7)
    expect(committed.center.y).toBeCloseTo(0.3)
  })

  it('角向方向输入、快捷方向和中心键盘操作保持双向同步', () => {
    function ControlledAngular() {
      const [paint, setPaint] = useState<ComposePaint>({
        kind: 'angular-gradient',
        center: { x: 0.5, y: 0.5 },
        angle: 0,
        stops: [
          { id: 'start', position: 0, color: '#8b5cf6' },
          { id: 'end', position: 1, color: '#000000' },
        ],
      })
      return <ComposePaintPicker label="背景填充" value={paint} onValueChange={setPaint} />
    }

    render(<ControlledAngular />)
    fireEvent.click(screen.getByRole('button', { name: '背景填充' }))
    fireEvent.change(screen.getByRole('spinbutton', { name: '角度' }), { target: { value: '135' } })
    expect(screen.getByRole('slider', { name: '方向角度' })).toHaveAttribute('aria-valuenow', '135')
    fireEvent.click(screen.getByRole('button', { name: '45°' }))
    expect(screen.getByRole('slider', { name: '方向角度' })).toHaveAttribute('aria-valuenow', '45')

    const center = screen.getByRole('slider', { name: '角向中心' })
    fireEvent.keyDown(center, { key: 'ArrowRight' })
    expect(center).toHaveAttribute('aria-valuetext', '51%, 50%')
  })

  it('Paint Picker 在画布外部 pointer press 时保持打开，Escape 仍明确关闭', async () => {
    render(
      <ComposePaintPicker
        label="背景填充"
        value={{ kind: 'solid', color: '#336699' }}
        onValueChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '背景填充' }))
    expect(screen.getByRole('dialog', { name: '背景填充' })).toBeInTheDocument()

    fireEvent.pointerDown(document.body)
    expect(screen.getByRole('dialog', { name: '背景填充' })).toBeInTheDocument()

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '背景填充' })).not.toBeInTheDocument()
    })
  })

  it('Paint Picker 在紧凑 Popover 内从最近图片创建 Image Paint', () => {
    const onValueChange = vi.fn()
    render(
      <ComposePaintPicker
        imageLibrary={{
          recent: [{
            asset: { providerId: 'library', assetKey: 'nebula', scope: 'persistent' },
            label: '星云',
            previewUrl: 'https://example.test/nebula.png',
          }],
        }}
        label="背景填充"
        value={{ kind: 'solid', color: '#336699' }}
        onValueChange={onValueChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '背景填充' }))
    fireEvent.click(screen.getByRole('button', { name: '图片' }))
    fireEvent.click(screen.getByRole('button', { name: '星云' }))
    expect(onValueChange).toHaveBeenLastCalledWith(expect.objectContaining({
      kind: 'image',
      asset: { providerId: 'library', assetKey: 'nebula', scope: 'persistent' },
      fit: 'cover',
      opacity: 1,
      overlay: { color: '#8b5cf6', opacity: 0.4 },
    }))
  })

  it('OpenSpec: redesign-color-image-picker / Popover 图片资源页 / 每页展示八张完整图片', () => {
    const images = Array.from({ length: 10 }, (_, index) => ({
      asset: {
        providerId: 'library',
        assetKey: `image-${index + 1}`,
        scope: 'persistent' as const,
      },
      label: `图片 ${index + 1}`,
      previewUrl: `https://example.test/image-${index + 1}.png`,
    }))
    const onValueChange = vi.fn()

    render(
      <ComposePaintPicker
        imageLibrary={{ images, status: 'ready' }}
        label="背景填充"
        value={{ kind: 'solid', color: '#336699' }}
        onValueChange={onValueChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '背景填充' }))
    fireEvent.click(screen.getByRole('button', { name: '图片' }))
    expect(screen.getByLabelText('最近使用').querySelectorAll('button')).toHaveLength(5)

    fireEvent.click(screen.getByRole('button', { name: '选择图片' }))
    expect(screen.getByRole('heading', { name: '图片资源' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '图片 8' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '图片 9' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    fireEvent.click(screen.getByRole('button', { name: '图片 9' }))
    expect(onValueChange).toHaveBeenLastCalledWith(expect.objectContaining({
      kind: 'image',
      asset: expect.objectContaining({ assetKey: 'image-9' }),
    }))
  })

  it('OpenSpec: redesign-color-image-picker / 替换图片并保留设置 / 只替换稳定引用', () => {
    const onValueChange = vi.fn()
    render(
      <ComposePaintPicker
        imageLibrary={{
          recent: [{
            asset: { providerId: 'library', assetKey: 'replacement', scope: 'persistent' },
            label: '替换图片',
            previewUrl: 'https://example.test/replacement.png',
          }],
        }}
        label="背景填充"
        value={{
          kind: 'image',
          asset: { providerId: 'library', assetKey: 'current', scope: 'persistent' },
          fit: 'contain',
          opacity: 0.42,
          overlay: { color: '#123456', opacity: 0.35 },
        }}
        onValueChange={onValueChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '背景填充' }))
    fireEvent.click(screen.getByRole('button', { name: '替换图片' }))
    expect(onValueChange).toHaveBeenLastCalledWith({
      kind: 'image',
      asset: { providerId: 'library', assetKey: 'replacement', scope: 'persistent' },
      fit: 'contain',
      opacity: 0.42,
      overlay: { color: '#123456', opacity: 0.35 },
    })
  })

  it('OpenSpec: redesign-color-image-picker / 图片设置卡 / 使用紧凑百分比字段编辑叠加颜色', () => {
    const onValueChange = vi.fn()
    render(
      <ComposePaintPicker
        imageLibrary={{ recent: [] }}
        label="背景填充"
        value={{
          kind: 'image',
          asset: { providerId: 'library', assetKey: 'current', scope: 'persistent' },
          fit: 'cover',
          opacity: 1,
          overlay: { color: '#8b5cf6', opacity: 0.4 },
        }}
        onValueChange={onValueChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '背景填充' }))
    expect(screen.getByText('添加图片')).toBeInTheDocument()
    const fitSelector = screen.getByRole('group', { name: '图片设置' })
    expect(within(fitSelector).getByRole('button', { name: '填充' }))
      .toHaveClass('compose-paint-picker__image-fit-option')
    expect(screen.getByRole('textbox', { name: '叠加颜色 HEX' })).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('叠加颜色 色标').closest('label'))
      .toHaveClass('compose-paint-picker__overlay-color')
    expect(screen.getByRole('slider', { name: '不透明度' }))
      .toHaveStyle({ '--compose-image-opacity': '100%' })
    const overlayOpacity = screen.getByRole('spinbutton', { name: '叠加颜色 不透明度' })
    expect(overlayOpacity).toHaveValue(40)
    fireEvent.change(overlayOpacity, { target: { value: '65' } })
    fireEvent.blur(overlayOpacity)
    expect(onValueChange).toHaveBeenLastCalledWith(expect.objectContaining({
      overlay: { color: '#8b5cf6', opacity: 0.65 },
    }))
  })

  it('OpenSpec: redesign-color-image-picker / 图片加载状态 / 失败后可以重试', () => {
    const onRetry = vi.fn()
    render(
      <ComposePaintPicker
        imageLibrary={{ images: [], status: 'error', onRetry }}
        label="背景填充"
        value={{ kind: 'solid', color: '#336699' }}
        onValueChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '背景填充' }))
    fireEvent.click(screen.getByRole('button', { name: '图片' }))
    fireEvent.click(screen.getByRole('button', { name: '选择图片' }))
    expect(screen.getByRole('alert')).toHaveTextContent('图片加载失败')
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
