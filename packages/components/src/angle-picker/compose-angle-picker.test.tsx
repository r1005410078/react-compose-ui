import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentType } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as components from '../index'

interface AnglePickerContract {
  readonly value: number
  readonly label?: string
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly onValueCommit?: (value: number) => void
}

const ComposeAnglePicker = (
  components as unknown as { readonly ComposeAnglePicker?: ComponentType<AnglePickerContract> }
).ComposeAnglePicker

afterEach(cleanup)

describe('OpenSpec: components / 通用角度快捷选择器', () => {
  it('OpenSpec: components / 通用角度快捷选择器 / 输入任意角度', () => {
    expect(ComposeAnglePicker).toBeDefined()
    if (!ComposeAnglePicker) return
    const onValueCommit = vi.fn()
    const view = render(
      <ComposeAnglePicker label="旋转" value={-450} onValueCommit={onValueCommit} />,
    )
    const input = screen.getByRole('spinbutton', { name: '旋转' })

    fireEvent.change(input, { target: { value: '725' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onValueCommit).toHaveBeenLastCalledWith(725)

    onValueCommit.mockClear()
    view.rerender(<ComposeAnglePicker label="旋转" value={725} onValueCommit={onValueCommit} />)
    fireEvent.change(screen.getByRole('spinbutton', { name: '旋转' }), {
      target: { value: 'not-a-number' },
    })
    fireEvent.blur(screen.getByRole('spinbutton', { name: '旋转' }))
    expect(onValueCommit).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByRole('spinbutton', { name: '旋转' }), { key: 'Escape' })
    expect(screen.getByRole('spinbutton', { name: '旋转' })).toHaveValue(725)
  })

  it('OpenSpec: components / 通用角度快捷选择器 / 使用转盘和快捷角', () => {
    expect(ComposeAnglePicker).toBeDefined()
    if (!ComposeAnglePicker) return
    const onValueCommit = vi.fn()
    render(<ComposeAnglePicker label="旋转" value={-90} onValueCommit={onValueCommit} />)
    fireEvent.click(screen.getByRole('button', { name: '快捷设置旋转' }))

    const dial = screen.getByRole('slider', { name: '旋转转盘' })
    expect(dial).toHaveAttribute('aria-valuenow', '270')
    fireEvent.keyDown(dial, { key: 'ArrowRight' })
    expect(onValueCommit).toHaveBeenLastCalledWith(271)
    fireEvent.keyDown(dial, { key: 'ArrowLeft', shiftKey: true })
    expect(onValueCommit).toHaveBeenLastCalledWith(256)

    onValueCommit.mockClear()
    vi.spyOn(dial, 'getBoundingClientRect').mockReturnValue({
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      toJSON: () => ({}),
      top: 0,
      width: 100,
      x: 0,
      y: 0,
    })
    fireEvent.pointerDown(dial, { clientX: 100, clientY: 50, pointerId: 1 })
    fireEvent.pointerMove(dial, { clientX: 50, clientY: 100, pointerId: 1 })
    expect(onValueCommit).not.toHaveBeenCalled()
    fireEvent.pointerUp(dial, { clientX: 50, clientY: 100, pointerId: 1 })
    expect(onValueCommit).toHaveBeenCalledOnce()
    expect(onValueCommit).toHaveBeenLastCalledWith(180)

    fireEvent.click(screen.getByRole('button', { name: '设置旋转为 180°' }))
    expect(onValueCommit).toHaveBeenLastCalledWith(180)
  })

  it('OpenSpec: components / 通用角度快捷选择器 / 取消并恢复焦点', async () => {
    expect(ComposeAnglePicker).toBeDefined()
    if (!ComposeAnglePicker) return
    const onValueCommit = vi.fn()
    const trigger = render(
      <ComposeAnglePicker label="旋转" value={45} onValueCommit={onValueCommit} />,
    )
    const button = screen.getByRole('button', { name: '快捷设置旋转' })
    fireEvent.click(button)
    expect(screen.getByRole('dialog', { name: '旋转快捷设置' })).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('slider', { name: '旋转转盘' }), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '旋转快捷设置' }))
      .not.toBeInTheDocument())
    expect(onValueCommit).not.toHaveBeenCalled()
    expect(button).toHaveFocus()

    trigger.rerender(<ComposeAnglePicker disabled label="旋转" value={45} onValueCommit={onValueCommit} />)
    expect(screen.getByRole('button', { name: '快捷设置旋转' })).toBeDisabled()
  })
})
