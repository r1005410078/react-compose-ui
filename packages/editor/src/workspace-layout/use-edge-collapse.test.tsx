import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createRef } from 'react'
import type { DockviewApi } from 'dockview-react'
import { useWorkspaceEdgeCollapse, type ComposeWorkspaceDocumentKind } from './use-edge-collapse'

/** 一个只实现 collapse/expand/isCollapsed 与订阅的最小边缘组。 */
function fakeEdgeGroup(initial = false) {
  let collapsed = initial
  const listeners = new Set<(event: { isCollapsed: boolean }) => void>()
  return {
    isCollapsed: () => collapsed,
    collapse() {
      collapsed = true
      listeners.forEach((listener) => { listener({ isCollapsed: true }) })
    },
    expand() {
      collapsed = false
      listeners.forEach((listener) => { listener({ isCollapsed: false }) })
    },
    onDidCollapsedChange(listener: (event: { isCollapsed: boolean }) => void) {
      listeners.add(listener)
      return { dispose: () => { listeners.delete(listener) } }
    },
  }
}

function fakeApi() {
  const left = fakeEdgeGroup()
  const right = fakeEdgeGroup()
  const api = {
    getEdgeGroup: (position: 'left' | 'right') => (position === 'left' ? left : right),
  } as unknown as DockviewApi
  return { api, left, right }
}

function renderWith(kind: ComposeWorkspaceDocumentKind) {
  const { api, left, right } = fakeApi()
  const ref = createRef<DockviewApi | null>() as { current: DockviewApi | null }
  ref.current = api
  const view = renderHook(
    ({ activeKind }: { activeKind: ComposeWorkspaceDocumentKind }) =>
      useWorkspaceEdgeCollapse(ref, activeKind, true),
    { initialProps: { activeKind: kind } },
  )
  return { ...view, left, right }
}

describe('边缘面板按文档类型记忆展开状态', () => {
  it('OpenSpec: editor-workspace-layout / 边缘面板按文档类型记忆展开状态 / CAD 默认收起', () => {
    const { rerender, left, right } = renderWith('page')
    expect(left.isCollapsed()).toBe(false)
    expect(right.isCollapsed()).toBe(false)

    rerender({ activeKind: 'cad' })
    expect(left.isCollapsed()).toBe(true)
    expect(right.isCollapsed()).toBe(true)

    rerender({ activeKind: 'page' })
    expect(left.isCollapsed()).toBe(false)
    expect(right.isCollapsed()).toBe(false)
  })

  it('OpenSpec: editor-workspace-layout / 边缘面板按文档类型记忆展开状态 / 用户选择被记住', () => {
    const { rerender, left, right } = renderWith('cad')
    expect(left.isCollapsed()).toBe(true)

    // 用户在 CAD 标签里展开左侧面板。
    left.expand()

    rerender({ activeKind: 'page' })
    expect(left.isCollapsed()).toBe(false)

    rerender({ activeKind: 'cad' })
    // 恢复用户的选择，而不是重置回 CAD 的初值。
    expect(left.isCollapsed()).toBe(false)
    // 右侧未被用户动过，仍是 CAD 的初值。
    expect(right.isCollapsed()).toBe(true)
  })

  it('页面标签的展开状态不受 CAD 中的操作影响', () => {
    const { rerender, right } = renderWith('page')
    // 用户在页面标签里收起右侧。
    right.collapse()

    rerender({ activeKind: 'cad' })
    expect(right.isCollapsed()).toBe(true)

    rerender({ activeKind: 'page' })
    expect(right.isCollapsed()).toBe(true)
  })
})
