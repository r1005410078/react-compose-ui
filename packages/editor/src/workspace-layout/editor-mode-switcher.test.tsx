import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditorModeSwitcher } from './editor-mode-switcher'

afterEach(() => { cleanup() })

describe('EditorModeSwitcher', () => {
  it('OpenSpec: editor-workspace-layout / 设计与动画模式切换器 / radiogroup 语义', () => {
    render(<EditorModeSwitcher mode="design" onModeChange={() => undefined} />)
    const group = screen.getByRole('radiogroup', { name: '编辑模式' })
    expect(group).toBeInTheDocument()
    const design = screen.getByRole('radio', { name: '设计' })
    const animation = screen.getByRole('radio', { name: '动画' })
    expect(design).toHaveAttribute('aria-checked', 'true')
    expect(animation).toHaveAttribute('aria-checked', 'false')
    // 绘图段已删除：它提供的四样没有一样需要模式承载，能力全部恒开。
    expect(screen.queryByRole('radio', { name: '绘图' })).toBeNull()
    expect(screen.getAllByRole('radio')).toHaveLength(2)
    // 复合控件的 Tab 停靠点只有选中项，方向键负责组内移动。
    expect(design).toHaveAttribute('tabindex', '0')
    expect(animation).toHaveAttribute('tabindex', '-1')
  })

  it('点击非选中项切换模式，点击选中项不重复回调', () => {
    const onModeChange = vi.fn()
    render(<EditorModeSwitcher mode="design" onModeChange={onModeChange} />)
    fireEvent.click(screen.getByRole('radio', { name: '设计' }))
    expect(onModeChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('radio', { name: '动画' }))
    expect(onModeChange).toHaveBeenCalledWith('animation')
  })

  it('方向键按索引移动且选择跟随焦点', () => {
    const onModeChange = vi.fn()
    render(<EditorModeSwitcher mode="animation" onModeChange={onModeChange} />)
    const group = screen.getByRole('radiogroup', { name: '编辑模式' })
    // 段数是会变的——这里就从三段减回过两段。按索引循环写一次，段数再变时不用跟着改。
    fireEvent.keyDown(group, { key: 'ArrowLeft' })
    expect(onModeChange).toHaveBeenLastCalledWith('design')
  })

  it('方向键在首尾之间循环', () => {
    const onModeChange = vi.fn()
    render(<EditorModeSwitcher mode="design" onModeChange={onModeChange} />)
    const group = screen.getByRole('radiogroup', { name: '编辑模式' })
    fireEvent.keyDown(group, { key: 'ArrowLeft' })
    expect(onModeChange).toHaveBeenLastCalledWith('animation')
  })
})
