import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    fireEvent.click(screen.getByRole('button', { name: '线性' }))
    expect(onValueChange).toHaveBeenLastCalledWith(expect.objectContaining({
      kind: 'linear-gradient',
      stops: expect.arrayContaining([expect.objectContaining({ color: 'transparent', position: 1 })]),
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

    fireEvent.click(screen.getByRole('button', { name: '线性' }))
    expect(screen.getByLabelText('渐变色标轨道')).toBeInTheDocument()
    expect(screen.getByLabelText('0%色盘')).toBeInTheDocument()
    expect(screen.getAllByRole('dialog', { name: '背景填充' })).toHaveLength(1)
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
})
