import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { ComposeEasingCurveEditor } from './easing-curve-editor'
import type { ComposeAnimationInterpolation } from '../animation-panel/types'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** 受控包装：组件不保存插值，测试里由这里承担事实来源。 */
function EditorHarness({
  initial,
  onChange,
  presetSelector,
}: {
  readonly initial: ComposeAnimationInterpolation
  readonly onChange?: (next: ComposeAnimationInterpolation, transient: boolean) => void
  readonly presetSelector?: boolean
}) {
  const [value, setValue] = useState(initial)
  return (
    <ComposeEasingCurveEditor
      presetSelector={presetSelector}
      value={value}
      onChange={(next, meta) => {
        setValue(next)
        onChange?.(next, meta.transient)
      }}
    />
  )
}

/** 让曲线画布在 jsdom 里有一个确定的 200×150 命中区域。 */
function stubCanvasRect() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const measured = this.classList.contains('compose-easing-editor__canvas')
    const width = measured ? 200 : 0
    const height = measured ? 150 : 0
    return {
      bottom: height, height, left: 0, right: width, top: 0, width, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect
  })
}

describe('ComposeEasingCurveEditor', () => {
  it('OpenSpec: animation-panel / 缓动预设与曲线编辑器 / 选择预设写入对应控制点', () => {
    const onChange = vi.fn()
    render(<EditorHarness initial={{ kind: 'linear' }} onChange={onChange} />)

    fireEvent.change(screen.getByRole('combobox', { name: '缓动预设' }), {
      target: { value: 'ease-in-out' },
    })

    expect(onChange).toHaveBeenCalledWith(
      { kind: 'cubic', control: [0.42, 0, 0.58, 1] },
      false,
    )
    expect(screen.getByRole('textbox', { name: '控制点' })).toHaveValue('0.42, 0, 0.58, 1')
  })

  it('OpenSpec: animation-panel / 缓动预设与曲线编辑器 / 拖拽控制柄落到自定义并钳制 x', () => {
    stubCanvasRect()
    const onChange = vi.fn()
    render(
      <EditorHarness initial={{ kind: 'cubic', control: [0.42, 0, 1, 1] }} onChange={onChange} />,
    )

    const handle = screen.getByRole('slider', { name: '控制点 1' })
    fireEvent.pointerDown(handle, { button: 0, clientX: 84, clientY: 150, pointerId: 3 })
    // 指针拖到画布左侧之外：x 必须钳回 0，y 取画布中点对应的 0.5。
    fireEvent.pointerMove(handle, { clientX: -40, clientY: 75, pointerId: 3 })
    fireEvent.pointerUp(handle, { clientX: -40, clientY: 75, pointerId: 3 })

    expect(onChange).toHaveBeenCalledWith({ kind: 'cubic', control: [0, 0.5, 1, 1] }, true)
    expect(screen.getByRole('combobox', { name: '缓动预设' })).toHaveValue('custom')
  })

  it('OpenSpec: animation-panel / 缓动预设与曲线编辑器 / 方向键按步进调整控制点', () => {
    const onChange = vi.fn()
    render(
      <EditorHarness initial={{ kind: 'cubic', control: [0.5, 0, 0.5, 1] }} onChange={onChange} />,
    )

    const handle = screen.getByRole('slider', { name: '控制点 1' })
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'cubic', control: [0.51, 0, 0.5, 1] }, true)

    fireEvent.keyDown(handle, { key: 'ArrowUp', shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'cubic', control: [0.51, 0.1, 0.5, 1] }, true)
  })

  it('OpenSpec: animation-panel / 缓动预设与曲线编辑器 / 非法数值回滚且不报告改动', () => {
    const onChange = vi.fn()
    render(
      <EditorHarness initial={{ kind: 'cubic', control: [0.5, 0, 0.5, 1] }} onChange={onChange} />,
    )

    const input = screen.getByRole('textbox', { name: '控制点' })
    fireEvent.change(input, { target: { value: '0.5, 0, abc' } })
    fireEvent.blur(input)

    expect(onChange).not.toHaveBeenCalled()
    expect(input).toHaveValue('0.5, 0, 0.5, 1')
  })

  it('OpenSpec: animation-panel / 缓动预设与曲线编辑器 / 提交数值产生非中间态改动', () => {
    const onChange = vi.fn()
    render(
      <EditorHarness initial={{ kind: 'cubic', control: [0.5, 0, 0.5, 1] }} onChange={onChange} />,
    )

    const input = screen.getByRole('textbox', { name: '控制点' })
    fireEvent.change(input, { target: { value: '0.3, -0.2, 0.7, 1.4' } })
    fireEvent.blur(input)

    expect(onChange).toHaveBeenCalledWith(
      { kind: 'cubic', control: [0.3, -0.2, 0.7, 1.4] },
      false,
    )
  })

  it('OpenSpec: animation-panel / 缓动预设与曲线编辑器 / hold 没有控制柄与数值行', () => {
    render(<EditorHarness initial={{ kind: 'hold' }} />)

    expect(screen.queryByRole('slider')).toBeNull()
    expect(screen.queryByRole('textbox', { name: '控制点' })).toBeNull()
    expect(screen.getByText('该插值没有可调整的控制点')).toBeInTheDocument()
  })

  it('OpenSpec: animation-panel / 缓动预设与曲线编辑器 / 宿主可关闭内置预设选择器', () => {
    render(
      <EditorHarness initial={{ kind: 'cubic', control: [0.5, 0, 0.5, 1] }} presetSelector={false} />,
    )

    expect(screen.queryByRole('combobox', { name: '缓动预设' })).toBeNull()
    expect(screen.getByRole('slider', { name: '控制点 1' })).toBeInTheDocument()
  })
})
