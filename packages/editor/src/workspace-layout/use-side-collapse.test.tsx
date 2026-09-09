import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { DockviewApi } from 'dockview-react'
import { useWorkspaceSideCollapse } from './use-side-collapse'

/** 一个只有组可见性与布局事件的最小 Dockview 替身。 */
function fakeApi(groupIds: readonly string[]) {
  const listeners = new Set<() => void>()
  const groups = groupIds.map((id) => {
    const group = {
      id,
      api: {
        isVisible: true,
        setVisible(value: boolean) {
          group.api.isVisible = value
          listeners.forEach((listener) => { listener() })
        },
      },
    }
    return group
  })
  // 底部是原生边缘组：它自己有 collapse / expand，不走组可见性那条路。
  const bottom = {
    collapsed: false,
    isCollapsed() { return bottom.collapsed },
    collapse() { bottom.collapsed = true; listeners.forEach((listener) => { listener() }) },
    expand() { bottom.collapsed = false; listeners.forEach((listener) => { listener() }) },
  }
  const api = {
    groups,
    getEdgeGroup: (side: string) => (side === 'bottom' ? bottom : undefined),
    onDidLayoutChange: (listener: () => void) => {
      listeners.add(listener)
      return { dispose: () => { listeners.delete(listener) } }
    },
  }
  return {
    api: api as unknown as DockviewApi,
    bottom,
    isCollapsed: (id: string) => groups.find((group) => group.id === id)?.api.isVisible === false,
    hide: (id: string) => groups.find((group) => group.id === id)?.api.setVisible(false),
  }
}

function renderWith(groupIds: readonly string[]) {
  const fake = fakeApi(groupIds)
  const ref = { current: fake.api as DockviewApi | null }
  const view = renderHook(() => useWorkspaceSideCollapse(ref, true))
  return { ...view, ...fake }
}

describe('两侧收起状态从 Dockview 派生', () => {
  it('OpenSpec: editor-workspace-layout / 边缘工具区 / 收起再展开', () => {
    const { result, isCollapsed } = renderWith(['compose-left-0', 'compose-left-1', 'compose-canvas-group', 'compose-right-0'])
    expect(result.current.collapsed).toEqual({ left: false, right: false, bottom: false })

    act(() => { result.current.toggle('left') })
    expect(result.current.collapsed.left).toBe(true)
    // 左栏是两个组：一个按钮一起藏掉，画布与右栏不动。
    expect(isCollapsed('compose-left-0')).toBe(true)
    expect(isCollapsed('compose-left-1')).toBe(true)
    expect(isCollapsed('compose-canvas-group')).toBe(false)
    expect(isCollapsed('compose-right-0')).toBe(false)

    act(() => { result.current.setCollapsed('left', false) })
    expect(result.current.collapsed).toEqual({ left: false, right: false, bottom: false })
    expect(isCollapsed('compose-left-0')).toBe(false)
  })

  it('OpenSpec: editor-workspace-layout / 工作区布局快照 / 隐藏是布局的一部分', () => {
    // 布局从别处（快照、fromJSON）把组藏起来：状态跟着布局事件走，而不是自己记一份。
    const { result, hide } = renderWith(['compose-left-0', 'compose-right-0'])
    act(() => { hide('compose-right-0') })
    expect(result.current.collapsed).toEqual({ left: false, right: true, bottom: false })
  })

  it('OpenSpec: editor-workspace-layout / 顶栏布局开关 / 底栏第一次有显式入口', () => {
    /*
     * 底部走的是 Dockview 边缘组自己的折叠，与左右两侧的组可见性是两条机制；收在同一个
     * 控制器里是因为**对用户是同一个动作**，顶栏那三颗开关读的必须是同一份状态。
     */
    const { result, bottom } = renderWith(['compose-left-0', 'compose-right-0'])

    act(() => { result.current.toggle('bottom') })
    expect(bottom.collapsed).toBe(true)
    expect(result.current.collapsed.bottom).toBe(true)

    act(() => { result.current.toggle('bottom') })
    expect(bottom.collapsed).toBe(false)
    expect(result.current.collapsed).toEqual({ left: false, right: false, bottom: false })
  })

  it('用户拖出来的组不属于任何一侧', () => {
    const { result, hide } = renderWith(['compose-left-0', 'group-xyz'])
    act(() => { hide('group-xyz') })
    expect(result.current.collapsed).toEqual({ left: false, right: false, bottom: false })
  })
})
