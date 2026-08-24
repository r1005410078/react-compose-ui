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
  it('OpenSpec: editor-workspace-layout / 边缘面板按文档类型记忆展开状态 / 初值一致为展开', () => {
    const { rerender, left, right } = renderWith('page')
    expect(left.isCollapsed()).toBe(false)
    expect(right.isCollapsed()).toBe(false)

    // 曾经有过一个初值收起的类型（CAD），随那套文档一起删除；余下三种初值一致。
    rerender({ activeKind: 'component' })
    expect(left.isCollapsed()).toBe(false)
    expect(right.isCollapsed()).toBe(false)

    rerender({ activeKind: 'asset' })
    expect(left.isCollapsed()).toBe(false)
    expect(right.isCollapsed()).toBe(false)
  })

  it('OpenSpec: editor-workspace-layout / 边缘面板按文档类型记忆展开状态 / 用户选择被记住', () => {
    const { rerender, left, right } = renderWith('component')

    // 用户在组件标签里收起左侧面板。
    left.collapse()

    rerender({ activeKind: 'page' })
    // 页面标签是另一种类型，用的是它自己的初值。
    expect(left.isCollapsed()).toBe(false)

    rerender({ activeKind: 'component' })
    // 恢复用户的选择，而不是重置回初值。
    expect(left.isCollapsed()).toBe(true)
    // 右侧未被用户动过，仍是初值。
    expect(right.isCollapsed()).toBe(false)
  })

  it('一种标签里的收起不影响另一种', () => {
    // 初值一致之后，这条才是「按类型记忆」唯一还看得出来的地方：状态若是工作区级的
    // 单一全局值，切过去就会串台。
    const { rerender, right } = renderWith('page')
    right.collapse()

    rerender({ activeKind: 'component' })
    expect(right.isCollapsed()).toBe(false)

    rerender({ activeKind: 'page' })
    expect(right.isCollapsed()).toBe(true)
  })
})
