import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  createDefaultCanvasSettings,
} from '@compose-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultComposeEditorPreferences } from '../editor-preferences'
import { DefaultStageToolbar } from './default-stage-toolbar'

function document() {
  return {
    schemaVersion: 7 as const,
    canvas: createDefaultCanvasSettings(),
    rootIds: [],
    entities: {},
  }
}

function renderToolbar(
  tool: import('@compose-ui/stage').ComposeStageTool = 'select',
  lastShapeTool: 'draw-rectangle' | 'draw-line' | 'draw-arrow' | 'draw-circle' = 'draw-rectangle',
  marqueeMode: import('@compose-ui/stage').ComposeStageMarqueeMode = 'intersect',
) {
  const setTool = vi.fn()
  const setGridSize = vi.fn()
  const setMarqueeMode = vi.fn()
  const toggleSnap = vi.fn()
  render(
    <DefaultStageToolbar
      canvasSettingsOpen={false}
      dispatch={vi.fn()}
      document={document()}
      gridVisible
      lastShapeTool={lastShapeTool}
      marqueeMode={marqueeMode}
      nextId={() => 'toolbar-id'}
      setCanvasSettingsOpen={vi.fn()}
      setGridSize={setGridSize}
      setGridVisible={vi.fn()}
      setMarqueeMode={setMarqueeMode}
      setTool={setTool}
      shortcuts={createDefaultComposeEditorPreferences().shortcuts}
      toggleSnap={toggleSnap}
      tool={tool}
    />,
  )
  return { setGridSize, setMarqueeMode, setTool, toggleSnap }
}

describe('DefaultStageToolbar', () => {
  afterEach(cleanup)

  it('OpenSpec: editor-workspace-layout / 扁平工具栏 / 按产品顺序暴露所有工具', () => {
    renderToolbar()

    for (const label of ['选择', '移动', '缩放', '旋转', '平移', '吸附', '显示网格', '创建容器', '文字']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: '框选' })).toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / 框选工具 / 主按钮切换到 marquee 工具', () => {
    const { setMarqueeMode, setTool } = renderToolbar()

    fireEvent.click(screen.getByRole('button', { name: '框选' }))

    expect(setTool).toHaveBeenCalledWith('marquee')
    expect(setMarqueeMode).not.toHaveBeenCalled()
  })

  it('OpenSpec: editor-workspace-layout / 框选模式菜单 / 切换模式不改变当前工具', () => {
    const { setMarqueeMode, setTool } = renderToolbar()

    fireEvent.click(screen.getByRole('button', { name: '框选模式' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: '完全包含' }))

    expect(setMarqueeMode).toHaveBeenCalledWith('contain')
    expect(setTool).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu', { name: '框选模式' })).not.toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / 框选模式菜单 / 键盘导航与 Escape 归还焦点', async () => {
    renderToolbar()
    const trigger = screen.getByRole('button', { name: '框选模式' })
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    const menu = screen.getByRole('menu', { name: '框选模式' })
    expect(menu).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('menuitemradio', { name: '相交选中' })).toHaveFocus())
    fireEvent.keyDown(menu, { key: 'Escape' })

    expect(screen.queryByRole('menu', { name: '框选模式' })).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('OpenSpec: editor-workspace-layout / 框选主按钮 / 图标跟随当前模式且不展开菜单也可辨认', () => {
    renderToolbar('marquee', 'draw-rectangle', 'directional')

    const primary = screen.getByRole('button', { name: '框选' })
    expect(primary).toHaveAttribute('data-active-marquee-mode', 'directional')
    expect(primary).toHaveAttribute('aria-pressed', 'true')
    // 方向决定图标独有的左右箭头基线。
    expect(primary.querySelector('path[d="M4.5 19h15"]')).toBeInTheDocument()

    cleanup()
    renderToolbar('marquee', 'draw-rectangle', 'contain')
    expect(screen.getByRole('button', { name: '框选' }))
      .toHaveAttribute('data-active-marquee-mode', 'contain')
  })

  it('OpenSpec: editor-workspace-layout / 专属移动与绘图工具 / 入口切换受控工具状态', () => {
    const { setTool } = renderToolbar()

    fireEvent.click(screen.getByRole('button', { name: '移动' }))
    fireEvent.click(screen.getByRole('button', { name: '创建容器' }))
    fireEvent.click(screen.getByRole('button', { name: '文字' }))

    expect(setTool).toHaveBeenNthCalledWith(1, 'move')
    expect(setTool).toHaveBeenNthCalledWith(2, 'draw-container')
    expect(setTool).toHaveBeenNthCalledWith(3, 'draw-text')
  })

  it('OpenSpec: editor-workspace-layout / 网格大小下拉与总吸附开关 / 操作独立可达', () => {
    const { setGridSize, toggleSnap } = renderToolbar()

    fireEvent.click(screen.getByRole('button', { name: '吸附' }))
    fireEvent.click(screen.getByRole('button', { name: '网格大小' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: '16 px 网格' }))

    expect(toggleSnap).toHaveBeenCalledOnce()
    expect(setGridSize).toHaveBeenCalledWith(16)
  })

  it('OpenSpec: editor-workspace-layout / menu button / 键盘导航、Escape 与快捷键提示', async () => {
    renderToolbar()
    const trigger = screen.getAllByRole('button', { name: '形状' })[1]!
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    const menu = screen.getByRole('menu', { name: '形状' })
    expect(menu).toBeInTheDocument()
    expect(screen.getByText('L', { selector: 'kbd' })).toBeInTheDocument()
    fireEvent.keyDown(menu, { key: 'Escape' })

    expect(screen.queryByRole('menu', { name: '形状' })).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('OpenSpec: editor-workspace-layout / 形状主按钮 / 同步当前形状图标与重入工具', () => {
    renderToolbar('select', 'draw-arrow')

    const primary = screen.getAllByRole('button', { name: '形状' })[0]!
    expect(primary).toHaveAttribute('data-active-shape', 'draw-arrow')
    expect(primary.querySelector('path[d="M4 19 19 4"]')).toBeInTheDocument()
  })
})
