import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComposeComponentShelf } from '@compose-ui/component-library'
import { PaletteShelfDialog } from './palette-shelf-dialog'

const SHELF: ComposeComponentShelf = {
  sections: [
    { kind: 'presets', id: 'basics' },
    { kind: 'folder', id: 'components', folderPath: [] },
  ],
}

const PRESETS = [
  { id: 'container', label: 'Container' },
  { id: 'rect', label: 'Rect' },
]

const FOLDERS: readonly (readonly string[])[] = [['Symbols'], ['Symbols', '变电站']]

afterEach(cleanup)

function open(overrides: Partial<Parameters<typeof PaletteShelfDialog>[0]> = {}) {
  const onSubmit = vi.fn()
  render(
    <PaletteShelfDialog
      folders={FOLDERS}
      presets={PRESETS}
      shelf={SHELF}
      onClose={() => {}}
      onReset={() => {}}
      onSubmit={onSubmit}
      {...overrides}
    />,
  )
  return { onSubmit, listbox: screen.getByTestId('compose-shelf-arrange') }
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: '完成' }))
}

describe('OpenSpec: editor-workspace-layout / 自定义物料面板 / 编排区', () => {
  it('与工具栏共用骨架，但编排区是纵的', () => {
    const { listbox } = open()
    expect(listbox).toHaveAttribute('data-shelf-orientation', 'vertical')
    // 同一列来源、同一条页脚：共用骨架的可执行形式是这几样。
    expect(screen.getByTestId('compose-shelf-source')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重置为默认' })).toBeInTheDocument()
  })

  it('段卡直接带选项，不需要先选中它', () => {
    const { listbox } = open()
    const folderCard = listbox.querySelector<HTMLElement>('[data-palette-section="components"]')!
    // 「按子文件夹分组」就在这张卡上——面板级的两项在编排区之外，层级由位置表达。
    expect(within(folderCard).getByLabelText('按子文件夹分组')).toBeInTheDocument()
    expect(within(folderCard).queryByLabelText('列出的基础组件')).toBeNull()
  })

  it('改段卡上的开关直接写草稿', () => {
    const { listbox, onSubmit } = open()
    const folderCard = listbox.querySelector<HTMLElement>('[data-palette-section="components"]')!
    fireEvent.click(within(folderCard).getByLabelText('按子文件夹分组'))
    submit()
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      sections: [
        { kind: 'presets', id: 'basics' },
        { kind: 'folder', id: 'components', folderPath: [], groupBy: 'subfolder' },
      ],
    }))
  })

  it('面板标题与搜索框开关排在编排区之外', () => {
    const { listbox } = open()
    const title = screen.getByLabelText('面板标题', { selector: 'input' })
    expect(listbox.contains(title)).toBe(false)
  })

  it('来源列列出还没上架的文件夹，不另做一棵资源树', () => {
    open()
    const source = screen.getByTestId('compose-shelf-source')
    expect(source).toHaveTextContent('Symbols')
    expect(source).toHaveTextContent('Symbols / 变电站')
    // 根文件夹已经在货架上，因此不再出现在来源列里。
    expect(source).not.toHaveTextContent('全部项目组件')
  })

  it('键盘抓放改段的顺序', () => {
    const { listbox, onSubmit } = open()
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    fireEvent.keyDown(listbox, { key: ' ' })
    expect(screen.getByRole('status')).toHaveTextContent('已抓起 全部项目组件')
    fireEvent.keyDown(listbox, { key: 'ArrowUp' })
    fireEvent.keyDown(listbox, { key: ' ' })
    submit()
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      sections: [
        { kind: 'folder', id: 'components', folderPath: [] },
        { kind: 'presets', id: 'basics' },
      ],
    }))
  })

  it('一段都不剩时仍能从来源列加回来', () => {
    const { onSubmit } = open({ shelf: { sections: [] } })
    const source = screen.getByTestId('compose-shelf-source')
    // 空面板正是最需要配置的那一档；来源列此时反而更满。
    expect(within(source).getByText('基础组件')).toBeInTheDocument()
    expect(within(source).getByText('全部项目组件')).toBeInTheDocument()
    submit()
    expect(onSubmit).toHaveBeenCalledWith({ sections: [] })
  })
})
