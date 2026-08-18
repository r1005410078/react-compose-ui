import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import {
  createDefaultCanvasSettings,
  createDefaultComposeLayoutItem,
  createComposeFrameEntity,
  createTransactionRuntime,
  type ComposeDocument,
} from '@compose-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComposeUIProvider } from '@compose-ui/ui-context'
import * as commandPanelPackage from '../index'

type Action = {
  id: string
  title: string
  category?: string
  keywords?: readonly string[]
  shortcut?: readonly { code: string; primary?: boolean; shift?: boolean }[]
  disabledReason?: string
  run(): void
}

const ComposeCommandPanel = (
  commandPanelPackage as unknown as {
    ComposeCommandPanel(props: {
      runtime: ReturnType<typeof createTransactionRuntime>
      actions?: readonly Action[]
    }): React.ReactNode
  }
).ComposeCommandPanel

afterEach(cleanup)

function fixture(): ComposeDocument {
  return {
    schemaVersion: 7,
    canvas: createDefaultCanvasSettings(),
    rootIds: ['frame-root'],
    entities: {
      'frame-root': createComposeFrameEntity({ id: 'frame-root', childIds: ['container'] }),
      container: {
        id: 'container',
        name: 'Container',
        components: {
          Composition: {
            presetId: 'container',
            baseComponentKeys: [
              'Transform',
              'LayoutItem',
              'Visibility',
              'Lock',
              'Hierarchy',
              'Clip',
            ],
            capabilityIds: [],
          },
          Transform: { rotation: 0 },
          LayoutItem: createDefaultComposeLayoutItem(1920, 1080),
          Visibility: { visible: true },
          Lock: { locked: false },
          Hierarchy: { childIds: [] },
          Clip: { enabled: false },
        },
      },
    },
  }
}

function actions(overrides: Partial<Record<string, Action>> = {}) {
  const base: Action[] = [
    { id: 'stage.zoomIn', title: '放大', category: '舞台', keywords: ['zoom in'], run: () => {} },
    { id: 'stage.zoomOut', title: '缩小', category: '舞台', run: () => {} },
    {
      id: 'edit.group',
      title: '编组',
      category: '编辑',
      shortcut: [{ code: 'KeyG', primary: true }],
      run: () => {},
    },
    { id: 'misc.about', title: '关于', run: () => {} },
  ]
  return base.map((action) => overrides[action.id] ?? action)
}

function renderPanel(list: readonly Action[] = actions(), locale?: 'en-US') {
  const runtime = createTransactionRuntime({ document: fixture() })
  const tree = <ComposeCommandPanel actions={list} runtime={runtime} />
  render(locale ? <ComposeUIProvider locale={locale}>{tree}</ComposeUIProvider> : tree)
  return screen.getByRole('combobox', { name: locale === 'en-US' ? 'Search commands' : '检索命令' })
}

describe('CommandSearch', () => {
  it('OpenSpec: command-panel / 命令动作检索与执行 / 空查询保持调试台形态', () => {
    const input = renderPanel()

    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    // 事件日志仍是面板主体，检索区不得抢占空态提示。
    expect(screen.getByText('暂无命令事件')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: '放大' } })
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: '' } })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('OpenSpec: command-panel / 命令动作检索与执行 / 斜杠列出全部动作', () => {
    const input = renderPanel()
    fireEvent.change(input, { target: { value: '/' } })

    const options = screen.getAllByRole('option')
    expect(options.map((option) => option.getAttribute('data-action-id'))).toEqual([
      'stage.zoomIn',
      'stage.zoomOut',
      'edit.group',
      'misc.about',
    ])
    expect(screen.getByRole('group', { name: '舞台' })).toBeInTheDocument()
    // 未提供 category 的动作归入本地化的未分组区，而不是散落在有名分组之间。
    expect(screen.getByRole('group', { name: '其他' })).toBeInTheDocument()
  })

  it('OpenSpec: command-panel / 命令检索可访问性 / 键盘遍历并执行', () => {
    const run = vi.fn()
    const input = renderPanel(actions({ 'stage.zoomOut': {
      id: 'stage.zoomOut',
      title: '缩小',
      category: '舞台',
      run,
    } }))
    fireEvent.change(input, { target: { value: '/' } })

    const first = screen.getAllByRole('option')[0]
    expect(input).toHaveAttribute('aria-activedescendant', first?.id)
    expect(first).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const second = screen.getAllByRole('option')[1]
    expect(input).toHaveAttribute('aria-activedescendant', second?.id)

    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input).toHaveAttribute('aria-activedescendant', first?.id)

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('OpenSpec: command-panel / 命令检索可访问性 / 取消检索', () => {
    const input = renderPanel()
    fireEvent.change(input, { target: { value: '/' } })
    input.focus()

    fireEvent.keyDown(input, { key: 'Escape' })

    expect(input).toHaveValue('')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    // 焦点必须留在输入框，不能逃逸到面板之外。
    expect(document.activeElement).toBe(input)
  })

  it('OpenSpec: command-panel / 命令动作检索与执行 / 执行动作', () => {
    const run = vi.fn()
    const input = renderPanel(actions({ 'edit.group': {
      id: 'edit.group',
      title: '编组',
      category: '编辑',
      run,
    } }))
    fireEvent.change(input, { target: { value: '编组' } })

    fireEvent.click(screen.getByRole('option', { name: /编组/ }))

    expect(run).toHaveBeenCalledTimes(1)
    // 执行后查询清空并收起结果，符合命令面板「执行即完成」的预期。
    expect(input).toHaveValue('')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('OpenSpec: command-panel / 命令动作检索与执行 / 不可用动作', () => {
    const run = vi.fn()
    const input = renderPanel(actions({ 'edit.group': {
      id: 'edit.group',
      title: '编组',
      category: '编辑',
      disabledReason: '至少选中两个对象',
      run,
    } }))
    fireEvent.change(input, { target: { value: '编组' } })

    const option = screen.getByRole('option', { name: /编组/ })
    expect(option).toHaveAttribute('aria-disabled', 'true')
    expect(within(option).getByText('至少选中两个对象')).toBeInTheDocument()

    fireEvent.click(option)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(run).not.toHaveBeenCalled()
  })

  it('OpenSpec: command-panel / 命令动作检索与执行 / 无匹配返回空结果', () => {
    const input = renderPanel()
    fireEvent.change(input, { target: { value: '不存在的动作' } })

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByText('没有匹配的命令')).toBeInTheDocument()
  })

  it('OpenSpec: command-panel / 命令检索可访问性 / 检索区本地化', () => {
    const input = renderPanel(actions(), 'en-US')
    expect(input).toHaveAttribute('placeholder', 'Type / to list every command')

    fireEvent.change(input, { target: { value: 'nothing' } })
    expect(screen.getByText('No matching command')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: '/' } })
    expect(screen.getByRole('group', { name: 'Other' })).toBeInTheDocument()
    // 动作 title 由宿主提供，面板不得改写。
    expect(screen.getByRole('option', { name: /放大/ })).toBeInTheDocument()
  })
})
