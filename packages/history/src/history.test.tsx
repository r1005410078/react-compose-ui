import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HistoryPanel,
  useHistory,
  useHistoryShortcuts,
} from './index'
import type { HistoryNavigationController } from './index'

afterEach(cleanup)

it('OpenSpec: history / 独立历史记录包 / 独立消费历史能力', () => {
  expect(HistoryPanel).toBeTypeOf('function')
  expect(useHistory).toBeTypeOf('function')
  expect(useHistoryShortcuts).toBeTypeOf('function')
})

describe('useHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-23T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('OpenSpec: history / 不可变会话时间线 / 提交与逐步导航', () => {
    const { result } = renderHook(() => useHistory({ count: 0 }))

    expect(result.current.entries.map((entry) => entry.label)).toEqual(['开始'])
    expect(result.current.value).toEqual({ count: 0 })
    expect(result.current.canUndo).toBe(false)

    act(() => result.current.commit({ count: 1 }, { label: '第一次' }))
    act(() => result.current.commit((current) => ({ count: current.count + 1 }), {
      label: '第二次',
    }))

    expect(result.current.entries.map((entry) => entry.label)).toEqual([
      '开始',
      '第一次',
      '第二次',
    ])
    expect(result.current.value).toEqual({ count: 2 })
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)

    act(() => result.current.undo())
    expect(result.current.value).toEqual({ count: 1 })
    expect(result.current.canRedo).toBe(true)

    act(() => result.current.redo())
    expect(result.current.value).toEqual({ count: 2 })

    const beginningId = result.current.entries[0]!.id
    act(() => result.current.navigate(beginningId))
    expect(result.current.value).toEqual({ count: 0 })
    expect(result.current.entries).toHaveLength(3)
  })

  it('OpenSpec: history / 不可变会话时间线 / 忽略无变化提交', () => {
    const { result } = renderHook(() => useHistory(
      { count: 0 },
      { isEqual: (left, right) => left.count === right.count },
    ))
    const initialId = result.current.activeEntryId

    act(() => result.current.commit({ count: 0 }, { label: '无变化' }))

    expect(result.current.entries).toHaveLength(1)
    expect(result.current.activeEntryId).toBe(initialId)
  })

  it('OpenSpec: history / 不可变会话时间线 / 重置时间线', () => {
    const { result } = renderHook(() => useHistory(0))
    act(() => result.current.commit(1, { label: '增加' }))
    act(() => result.current.reset(10, '新文档'))

    expect(result.current.value).toBe(10)
    expect(result.current.entries.map((entry) => entry.label)).toEqual(['新文档'])
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('OpenSpec: history / 合并、分支与容量限制 / 合并连续输入', () => {
    const { result } = renderHook(() => useHistory('', { mergeWindowMs: 750 }))

    act(() => result.current.commit('a', { label: '修改文本', mergeKey: 'node:text' }))
    vi.advanceTimersByTime(500)
    act(() => result.current.commit('ab', { label: '修改文本', mergeKey: 'node:text' }))

    expect(result.current.entries.map((entry) => entry.label)).toEqual(['开始', '修改文本'])
    expect(result.current.value).toBe('ab')
    act(() => result.current.undo())
    expect(result.current.value).toBe('')

    act(() => result.current.redo())
    vi.advanceTimersByTime(751)
    act(() => result.current.commit('abc', { label: '再次修改', mergeKey: 'node:text' }))
    expect(result.current.entries).toHaveLength(3)
  })

  it('OpenSpec: history / 合并、分支与容量限制 / 从过去状态创建新分支', () => {
    const { result } = renderHook(() => useHistory(0))
    act(() => result.current.commit(1, { label: '一' }))
    act(() => result.current.commit(2, { label: '二' }))
    act(() => result.current.undo())
    act(() => result.current.commit(3, { label: '三' }))

    expect(result.current.value).toBe(3)
    expect(result.current.entries.map((entry) => entry.label)).toEqual(['开始', '一', '三'])
    expect(result.current.canRedo).toBe(false)
  })

  it('OpenSpec: history / 合并、分支与容量限制 / 超出容量限制', () => {
    const { result } = renderHook(() => useHistory(0, { limit: 2 }))
    act(() => result.current.commit(1, { label: '一' }))
    act(() => result.current.commit(2, { label: '二' }))
    act(() => result.current.commit(3, { label: '三' }))

    expect(result.current.entries.map((entry) => entry.label)).toEqual([
      '较早状态',
      '二',
      '三',
    ])
    const earliestId = result.current.entries[0]!.id
    act(() => result.current.navigate(earliestId))
    expect(result.current.value).toBe(1)
    expect(result.current.canUndo).toBe(false)
  })

  it('uses 100 actions as the default capacity', () => {
    const { result } = renderHook(() => useHistory(0))

    act(() => {
      for (let value = 1; value <= 101; value += 1) {
        result.current.commit(value, { label: `动作 ${value}` })
      }
    })

    expect(result.current.entries).toHaveLength(101)
    expect(result.current.entries[0]?.label).toBe('较早状态')
    expect(result.current.entries[result.current.entries.length - 1]?.label).toBe('动作 101')
  })

  it('keeps one baseline under Strict Mode replay', () => {
    const { result } = renderHook(() => useHistory('initial'), { wrapper: StrictMode })
    expect(result.current.entries.map((entry) => entry.label)).toEqual(['开始'])
  })
})

function createNavigationController(
  overrides: Partial<HistoryNavigationController> = {},
): HistoryNavigationController {
  return {
    entries: [
      { id: 'beginning', label: '开始' },
      { id: 'past', label: '新增节点' },
      { id: 'current', label: '修改文本' },
      { id: 'future', label: '移动节点' },
    ],
    activeEntryId: 'current',
    canUndo: true,
    canRedo: true,
    undo: vi.fn(),
    redo: vi.fn(),
    navigate: vi.fn(),
    ...overrides,
  }
}

describe('HistoryPanel', () => {
  it('OpenSpec: history / 受控历史面板 / 显示并跳转历史', () => {
    const controller = createNavigationController()
    render(<HistoryPanel controller={controller} />)

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      '移动节点',
      '修改文本',
      '新增节点',
      '开始',
    ])
    expect(screen.getByRole('button', { name: '修改文本' })).toHaveAttribute(
      'aria-current',
      'step',
    )
    expect(screen.getByRole('button', { name: '移动节点' })).toHaveAttribute(
      'data-history-state',
      'future',
    )

    fireEvent.click(screen.getByRole('button', { name: '新增节点' }))
    expect(controller.navigate).toHaveBeenCalledWith('past')
    fireEvent.click(screen.getByRole('button', { name: '移动节点' }))
    expect(controller.navigate).toHaveBeenCalledWith('future')
    expect(screen.getByRole('button', { name: '修改文本' })).toHaveAttribute(
      'title',
      '修改文本',
    )
  })

  it('OpenSpec: history / 受控历史面板 / 空历史面板', () => {
    render(<HistoryPanel controller={createNavigationController({
      entries: [],
      activeEntryId: null,
      canUndo: false,
      canRedo: false,
    })} />)

    expect(screen.getByRole('status')).toHaveTextContent('开始编辑后会显示历史记录')
  })

  it('preserves standard div attributes', () => {
    render(
      <HistoryPanel
        aria-label="Customer history"
        className="host-history"
        controller={createNavigationController()}
        data-customer="history"
      />,
    )
    const panel = screen.getByLabelText('Customer history')
    expect(panel).toHaveClass('history-panel', 'host-history')
    expect(panel).toHaveAttribute('data-compose-ui', 'history')
    expect(panel).toHaveAttribute('data-customer', 'history')
  })
})

function ShortcutFixture({ controller }: { controller: HistoryNavigationController }) {
  const onKeyDownCapture = useHistoryShortcuts(controller)
  return (
    <div onKeyDownCapture={onKeyDownCapture}>
      <input aria-label="属性输入" />
    </div>
  )
}

describe('useHistoryShortcuts', () => {
  it('OpenSpec: history / 历史快捷键 / 输入框内撤销编辑器历史', () => {
    const controller = createNavigationController()
    render(<ShortcutFixture controller={controller} />)
    const input = screen.getByLabelText('属性输入')

    expect(fireEvent.keyDown(input, { key: 'z', ctrlKey: true })).toBe(false)
    expect(controller.undo).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(input, { key: 'Z', metaKey: true, shiftKey: true })
    fireEvent.keyDown(input, { key: 'y', ctrlKey: true })
    expect(controller.redo).toHaveBeenCalledTimes(2)
  })

  it('OpenSpec: history / 历史快捷键 / 组合输入期间按键', () => {
    const controller = createNavigationController()
    render(<ShortcutFixture controller={controller} />)
    const input = screen.getByLabelText('属性输入')

    expect(fireEvent.keyDown(input, {
      key: 'z',
      ctrlKey: true,
      isComposing: true,
    })).toBe(true)
    expect(controller.undo).not.toHaveBeenCalled()
  })

  it('consumes recognized shortcuts without calling unavailable actions', () => {
    const controller = createNavigationController({ canUndo: false, canRedo: false })
    render(<ShortcutFixture controller={controller} />)
    const input = screen.getByLabelText('属性输入')

    expect(fireEvent.keyDown(input, { key: 'z', ctrlKey: true })).toBe(false)
    expect(fireEvent.keyDown(input, { key: 'y', ctrlKey: true })).toBe(false)
    expect(controller.undo).not.toHaveBeenCalled()
    expect(controller.redo).not.toHaveBeenCalled()
  })
})
