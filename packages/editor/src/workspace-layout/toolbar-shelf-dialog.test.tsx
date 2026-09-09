import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToolbarShelfDialog } from './toolbar-shelf-dialog'
import type { ToolbarShelfCatalogEntry } from './toolbar-shelf-dialog'

const CATALOG: readonly ToolbarShelfCatalogEntry[] = [
  { id: 'select', label: '选择', via: 'V' },
  { id: 'grid', label: '显示网格', via: '命令面板' },
  { id: 'LINE', label: '直线', via: 'LINE' },
  { id: 'ARC', label: '圆弧', via: 'ARC' },
  { id: 'CIRCLE', label: '圆', via: 'CIRCLE' },
]

const SHELF = ['select', 'grid', 'LINE', 'ARC']

afterEach(cleanup)

function open(overrides: Partial<Parameters<typeof ToolbarShelfDialog>[0]> = {}) {
  const onSubmit = vi.fn()
  render(
    <ToolbarShelfDialog
      catalog={CATALOG}
      shelf={SHELF}
      onClose={() => {}}
      onReset={() => {}}
      onSubmit={onSubmit}
      {...overrides}
    />,
  )
  return { onSubmit, listbox: screen.getByTestId('compose-shelf-arrange') }
}

/** 「完成」提交草稿；断言重排结果都走它，而不是读组件内部状态。 */
function submit() {
  fireEvent.click(screen.getByRole('button', { name: '完成' }))
}

describe('OpenSpec: editor-workspace-layout / 自定义工具栏 / 编排区', () => {
  it('打开时不再有一排常驻的移动按钮', () => {
    open()
    // 那种布局必然有「没有选中」的一档，而那一档里每颗按钮都是灰的——这正是重画的起点。
    expect(screen.queryByRole('button', { name: '上移' })).toBeNull()
    expect(screen.queryByRole('button', { name: '下移' })).toBeNull()
    expect(screen.queryByRole('button', { name: '加入货架' })).toBeNull()
  })

  it('货架排成一条横栏，每一格是一个 option', () => {
    const { listbox } = open()
    expect(listbox).toHaveAttribute('data-shelf-orientation', 'wrap')
    expect(listbox.querySelectorAll('[data-shelf-item]')).toHaveLength(SHELF.length)
  })

  it('来源列印出每一条的第二条入口', () => {
    open()
    const source = screen.getByTestId('compose-shelf-source')
    // 说明文案承诺「拿掉一格不会拿掉那项能力」；印出来这句承诺才是可核对的。
    expect(source).toHaveTextContent('圆')
    expect(source).toHaveTextContent('CIRCLE')
  })

  it('「选择」标为固定', () => {
    const { listbox } = open()
    expect(listbox.querySelector('[data-shelf-id="select"]')).toHaveAttribute('data-shelf-fixed')
  })
})

describe('OpenSpec: editor-workspace-layout / 货架编排的拖拽与键盘 / 键盘抓放', () => {
  it('抓起、移动两次、放下之后前移两位', () => {
    const { listbox, onSubmit } = open()
    fireEvent.keyDown(listbox, { key: 'ArrowRight' })
    fireEvent.keyDown(listbox, { key: 'ArrowRight' })
    fireEvent.keyDown(listbox, { key: 'ArrowRight' }) // 焦点落在 ARC（第 4 格）
    fireEvent.keyDown(listbox, { key: ' ' })
    expect(screen.getByRole('status')).toHaveTextContent('已抓起 圆弧')
    fireEvent.keyDown(listbox, { key: 'ArrowLeft' })
    fireEvent.keyDown(listbox, { key: 'ArrowLeft' })
    fireEvent.keyDown(listbox, { key: ' ' })
    submit()
    expect(onSubmit).toHaveBeenCalledWith(['select', 'ARC', 'grid', 'LINE'])
  })

  it('Escape 放弃，顺序与抓起之前逐项相同', () => {
    const { listbox, onSubmit } = open()
    fireEvent.keyDown(listbox, { key: 'ArrowRight' })
    fireEvent.keyDown(listbox, { key: ' ' })
    fireEvent.keyDown(listbox, { key: 'ArrowRight' })
    fireEvent.keyDown(listbox, { key: 'Escape' })
    expect(screen.getByRole('status')).toHaveTextContent('已放弃移动')
    submit()
    expect(onSubmit).toHaveBeenCalledWith(SHELF)
  })

  it('Delete 移出，反斜杠在其后插入分隔', () => {
    const { listbox, onSubmit } = open()
    fireEvent.keyDown(listbox, { key: 'ArrowRight' })
    fireEvent.keyDown(listbox, { key: '\\' })
    fireEvent.keyDown(listbox, { key: 'ArrowRight' })
    fireEvent.keyDown(listbox, { key: 'ArrowRight' })
    fireEvent.keyDown(listbox, { key: 'Delete' })
    submit()
    expect(onSubmit).toHaveBeenCalledWith(['select', 'grid', 'separator', 'ARC'])
  })

  it('「选择」抓不起来也删不掉', () => {
    const { listbox, onSubmit } = open()
    fireEvent.keyDown(listbox, { key: ' ' })
    // 判别性：抓得起来的那一档会播报「已抓起」，这一档必须什么都没播报。
    expect(screen.getByRole('status').textContent).toBe('')
    fireEvent.keyDown(listbox, { key: 'Delete' })
    submit()
    expect(onSubmit).toHaveBeenCalledWith(SHELF)
  })
})

describe('OpenSpec: editor-workspace-layout / 自定义工具栏 / 溢出切口', () => {
  it('量得到就画在被收走的第一格之前', () => {
    open({ overflowFrom: 'LINE' })
    expect(screen.getByTestId('compose-shelf-cut')).toBeInTheDocument()
    const listbox = screen.getByTestId('compose-shelf-arrange')
    expect(listbox.querySelector('[data-shelf-id="LINE"]')).toHaveAttribute('data-shelf-overflowed')
    expect(listbox.querySelector('[data-shelf-id="grid"]')).not.toHaveAttribute('data-shelf-overflowed')
  })

  it('量不到就不画，也不猜一个位置', () => {
    open({ overflowFrom: null })
    expect(screen.queryByTestId('compose-shelf-cut')).toBeNull()
  })
})
