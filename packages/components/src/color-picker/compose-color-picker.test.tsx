import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComposeI18nProvider, ComposeThemeProvider } from '@compose-ui/ui-context'
import { ComposeColorPicker } from '../index'

afterEach(cleanup)

function ControlledPicker({ initial = '#336699' }: { readonly initial?: string }) {
  const [value, setValue] = useState(initial)
  return <ComposeColorPicker label="背景" value={value} onValueChange={setValue} />
}

describe('OpenSpec: components / 共享 Color Picker', () => {
  it('以可访问色块触发器打开无字符串值的颜色面板', () => {
    render(<ControlledPicker />)

    const trigger = screen.getByRole('button', { name: '选择背景颜色' })
    expect(trigger).not.toHaveTextContent('#336699')
    fireEvent.click(trigger)

    expect(screen.getByRole('dialog', { name: '背景颜色' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByLabelText('背景色盘')).toBeInTheDocument()
    expect(screen.getByLabelText('背景色相')).toHaveAttribute('type', 'range')
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
})
