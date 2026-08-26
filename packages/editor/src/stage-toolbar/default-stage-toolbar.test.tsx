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
  activeCommandId: string | null = null,
) {
  const setTool = vi.fn()
  const setGridSize = vi.fn()
  const startCommand = vi.fn()
  const toggleSnap = vi.fn()
  render(
    <DefaultStageToolbar
      activeCommandId={activeCommandId}
      canvasSettingsOpen={false}
      dispatch={vi.fn()}
      document={document()}
      gridVisible
      nextId={() => 'toolbar-id'}
      setCanvasSettingsOpen={vi.fn()}
      setGridSize={setGridSize}
      setGridVisible={vi.fn()}
      setTool={setTool}
      shortcuts={createDefaultComposeEditorPreferences().shortcuts}
      startCommand={startCommand}
      toggleSnap={toggleSnap}
      tool={tool}
    />,
  )
  return { setGridSize, setTool, startCommand, toggleSnap }
}

describe('DefaultStageToolbar', () => {
  afterEach(cleanup)

  it('OpenSpec: editor-workspace-layout / 扁平工具栏 / 按产品顺序暴露所有工具', () => {
    renderToolbar()

    for (const label of ['选择', '缩放', '旋转', '吸附', '显示网格', '创建容器', '文字']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
    // 三个与既有手势完全重复的工具位已删除：`select` 空白拖拽即框选、`MOVE` 命令能键入
    // 精确位移、空格与中键是随时可用的临时平移覆盖。
    for (const label of ['框选', '移动', '平移']) {
      expect(screen.queryByRole('button', { name: label })).toBeNull()
    }
  })

  it('OpenSpec: editor-workspace-layout / 平铺式默认画布工具栏 / 选择没有判定模式菜单', () => {
    const { setTool } = renderToolbar()

    // 框选判定恒由拖拽方向决定，方向本身就是切换器；再给一个菜单等于给同一件事造第二个、
    // 更慢的入口。
    fireEvent.click(screen.getByRole('button', { name: '选择' }))
    expect(setTool).toHaveBeenCalledWith('select')
    expect(screen.queryByRole('button', { name: '框选模式' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择' })).not.toHaveAttribute('data-active-marquee-mode')
  })

  it('OpenSpec: editor-workspace-layout / 绘图工具 / 入口切换受控工具状态', () => {
    const { setTool } = renderToolbar()

    fireEvent.click(screen.getByRole('button', { name: '旋转' }))
    fireEvent.click(screen.getByRole('button', { name: '创建容器' }))
    fireEvent.click(screen.getByRole('button', { name: '文字' }))

    expect(setTool).toHaveBeenNthCalledWith(1, 'rotate')
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
    const trigger = screen.getByRole('button', { name: '网格大小' })
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    const menu = screen.getByRole('menu', { name: '网格大小' })
    expect(menu).toBeInTheDocument()
    fireEvent.keyDown(menu, { key: 'Escape' })

    expect(screen.queryByRole('menu', { name: '网格大小' })).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('OpenSpec: editor-workspace-layout / 绘图命令组 / 七条命令各一个按钮且点击即启动', () => {
    const { startCommand } = renderToolbar()

    // 形状 split button 已删除：制图几何一律由命令产出，绘图入口因此只有一套。
    expect(screen.queryByRole('button', { name: '形状' })).toBeNull()
    for (const label of ['直线', '多段线', '矩形', '圆', '圆弧', '箭头']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
    // 导线按钮已删除：`WIRE` 合并进 `LINE` 之后两者画的时候一模一样，而选错的后果在屏幕上
    // 完全不可见——用不绑定的那条画出来的接线像素级正确却从未接上。
    expect(screen.queryByRole('button', { name: '导线' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '矩形' }))
    // 按钮不自己走一条路径：它只说出命令的名字，解析、可用性与会话全在 Stage 那一侧。
    expect(startCommand).toHaveBeenCalledWith('RECTANGLE')
  })

  it('OpenSpec: editor-workspace-layout / 绘图命令组 / 图标标记的数量等于命令的取点数', () => {
    renderToolbar()

    // 每个方块是这条命令要你点的一个点：直线两点、三点弧三点、矩形两个对角、整圆圆心加
    // 半径点。判别点在**矩形是 2 而不是 4**——画完之后它有四个顶点夹点，但要你点的只有
    // 两个对角，图标说的是「按下去之后会发生什么」。
    //
    // 形状取方块是另一条：顶点夹点是方块，圆点在这里说的是另一件事，混用会让图标与画布
    // 对不上。
    for (const [label, marks] of [['直线', 2], ['多段线', 4], ['圆弧', 3], ['矩形', 2], ['圆', 2]] as const) {
      const icon = screen.getByRole('button', { name: label }).querySelector('svg')
      expect(icon?.querySelectorAll('rect')).toHaveLength(marks)
    }

    // 这两个图形本身不含 circle，因此这里的零证明标记不是圆点。
    for (const label of ['直线', '多段线']) {
      const icon = screen.getByRole('button', { name: label }).querySelector('svg')
      expect(icon?.querySelectorAll('circle')).toHaveLength(0)
    }
  })

  it('OpenSpec: editor-workspace-layout / 绘图命令组 / 按下态读上报的命令 id', () => {
    renderToolbar('select', 'CIRCLE')

    expect(screen.getByRole('button', { name: '圆' })).toHaveAttribute('aria-pressed', 'true')
    // 判别点：工具栏没有第二份「我刚点了哪个」，上报什么就是什么。
    expect(screen.getByRole('button', { name: '矩形' })).toHaveAttribute('aria-pressed', 'false')
  })
})
