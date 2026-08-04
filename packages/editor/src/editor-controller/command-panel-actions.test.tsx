import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  createDefaultCanvasSettings,
  createDefaultComposeLayoutItem,
  createDefaultOutputSettings,
  createTransactionRuntime,
  type ComposeDocument,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import { ComposeUIProvider } from '@compose-ui/ui-context'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommandPanelWithActions } from './command-panel-actions'
import { isEditableKeyboardTarget } from '../editor-preferences'

afterEach(cleanup)

function fixture(): ComposeDocument {
  return {
    schemaVersion: 6,
    canvas: createDefaultCanvasSettings(),
    output: createDefaultOutputSettings(),
    rootIds: ['a'],
    entities: {
      a: {
        id: 'a',
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
          LayoutItem: createDefaultComposeLayoutItem(100, 100),
          Visibility: { visible: true },
          Lock: { locked: false },
          Hierarchy: { childIds: [] },
          Clip: { enabled: false },
        },
      },
    },
  }
}

const snapshot: ComposeLayoutSnapshot = {
  revision: 1,
  boxes: { a: { x: 0, y: 0, width: 100, height: 100, positioning: 'absolute' } },
  diagnostics: [],
}

function renderPanel(
  overrides: Partial<Parameters<typeof CommandPanelWithActions>[0]['actionContext']> = {},
  locale?: 'en-US',
) {
  const runtime = createTransactionRuntime({ document: fixture() })
  const spies = {
    setTool: vi.fn(),
    zoomBy: vi.fn(),
    setSelectedIds: vi.fn(),
  }
  const tree = (
    <CommandPanelWithActions
      actionContext={{
        canRedo: runtime.getState().canRedo,
        canUndo: runtime.getState().canUndo,
        dispatch: runtime.dispatch,
        document: runtime.getState().document,
        fitContainer: () => {},
        fitSelection: () => {},
        idFactory: () => `id-${Math.random().toString(36).slice(2)}`,
        layoutSnapshot: snapshot,
        redo: runtime.redo,
        selectedIds: [],
        setSelectedIds: spies.setSelectedIds,
        setTool: spies.setTool,
        toggleGridSnap: () => {},
        toggleSmartSnap: () => {},
        undo: runtime.undo,
        zoomBy: spies.zoomBy,
        zoomReset: () => {},
        ...overrides,
      }}
      runtime={runtime}
    />
  )
  render(locale ? <ComposeUIProvider locale={locale}>{tree}</ComposeUIProvider> : tree)
  const input = screen.getByRole('combobox', {
    name: locale === 'en-US' ? 'Search commands' : '检索命令',
  })
  return { input, runtime, spies }
}

describe('CommandPanelWithActions', () => {
  it('OpenSpec: editor-preferences / 快捷键输入隔离 / 在命令检索框内输入', () => {
    const { input } = renderPanel()

    // 编辑器全局按键处理用这个判定跳过可编辑目标。检索框必须被它识别，
    // 否则在框里输入 v / Delete 会切换工具或删除实体。
    expect(isEditableKeyboardTarget(input)).toBe(true)

    fireEvent.change(input, { target: { value: 'v' } })
    expect(input).toHaveValue('v')
  })

  it('OpenSpec: editor-preferences / 编辑器动作目录 / 视口动作不进入历史', () => {
    const { input, runtime, spies } = renderPanel()
    const before = runtime.getState().entries.length

    fireEvent.change(input, { target: { value: '/' } })
    fireEvent.click(screen.getByRole('option', { name: /放大/ }))

    expect(spies.zoomBy).toHaveBeenCalledTimes(1)
    // 核心契约：视口动作走会话状态，事务历史条目数不变。
    expect(runtime.getState().entries).toHaveLength(before)
  })

  it('OpenSpec: editor-preferences / 编辑器动作目录 / 文档动作进入历史', () => {
    const { input, runtime } = renderPanel({ selectedIds: ['a'] })
    const before = runtime.getState().entries.length

    fireEvent.change(input, { target: { value: '删除' } })
    fireEvent.click(screen.getByRole('option', { name: /删除/ }))

    expect(runtime.getState().entries.length).toBe(before + 1)
    expect(runtime.getState().document.entities.a).toBeUndefined()
  })

  it('OpenSpec: editor-preferences / 编辑器动作目录 / 不可用动作在面板中展示原因', () => {
    const { input, runtime } = renderPanel()
    const before = runtime.getState().entries.length

    fireEvent.change(input, { target: { value: '删除' } })
    const option = screen.getByRole('option', { name: /删除/ })

    expect(option).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(option)
    expect(runtime.getState().entries).toHaveLength(before)
  })

  it('OpenSpec: editor-preferences / 编辑器动作目录 / 动作跟随界面语言', () => {
    const { input } = renderPanel({}, 'en-US')
    fireEvent.change(input, { target: { value: '/' } })

    expect(screen.getByRole('option', { name: /Zoom in/ })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Stage' })).toBeInTheDocument()
  })
})
