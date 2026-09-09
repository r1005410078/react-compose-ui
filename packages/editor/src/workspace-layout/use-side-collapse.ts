import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { DockviewApi } from 'dockview-react'
import { WORKSPACE_SIDE_GROUP_PREFIX } from './workspace-ids'

/**
 * 可收起的三侧。
 *
 * @remarks
 * 左右是按 id 前缀识别的普通组，收起 = 把那一侧的组 `setVisible(false)`；底部是 Dockview 的
 * 原生边缘组，收起 = 它自己的 `collapse()`。两条机制不同但**对用户是同一个动作**，因此收在
 * 同一个控制器里——顶栏那三颗开关读的是同一份状态，各写一份必然在其中一颗上漂移。
 * @internal
 */
export type ComposeWorkspaceSide = 'left' | 'right' | 'bottom'

/** 三侧的收起状态。 @internal */
export type ComposeWorkspaceSideCollapsed = Readonly<Record<ComposeWorkspaceSide, boolean>>

/** 两侧收起状态的控制器。 @internal */
export interface ComposeWorkspaceSideCollapse {
  readonly collapsed: ComposeWorkspaceSideCollapsed
  readonly setCollapsed: (side: ComposeWorkspaceSide, collapsed: boolean) => void
  readonly toggle: (side: ComposeWorkspaceSide) => void
}

const EXPANDED: ComposeWorkspaceSideCollapsed = { left: false, right: false, bottom: false }

/** 底部边缘组；宿主测试替身可能没有 `getEdgeGroup`。 */
function bottomGroup(api: DockviewApi) {
  const read = (api as Partial<DockviewApi>).getEdgeGroup
  return typeof read === 'function' ? read.call(api, 'bottom') : undefined
}

/** 一侧的组：按 id 前缀识别，用户拖出来的新组不算。底部不走这条路。 */
function sideGroups(api: DockviewApi, side: 'left' | 'right') {
  const groups = (api as Partial<DockviewApi>).groups
  if (!Array.isArray(groups)) return []
  return groups.filter((group) => group.id.startsWith(WORKSPACE_SIDE_GROUP_PREFIX[side]))
}

/** 一侧算「收起」：那一侧至少有一个组，且全都藏着。 */
function readCollapsed(api: DockviewApi): ComposeWorkspaceSideCollapsed {
  const read = (side: 'left' | 'right') => {
    const groups = sideGroups(api, side)
    return groups.length > 0 && groups.every((group) => group.api.isVisible === false)
  }
  const bottom = bottomGroup(api)
  return {
    left: read('left'),
    right: read('right'),
    bottom: typeof bottom?.isCollapsed === 'function' ? bottom.isCollapsed() : false,
  }
}

/**
 * 左右两侧的收起状态，从 Dockview 的组可见性派生。
 *
 * @remarks
 * 收起一侧就是把那一侧的组 `setVisible(false)`：网格随之把那一列收成 0，编辑器再在旁边留一条
 * 把手用于展开（见 `WorkspaceSideHandle`）。这条不走 Dockview 的边缘组：左右两侧若是边缘组，
 * 底部就横跨不了全宽，见 `WORKSPACE_GROUP_IDS` 上的注释。
 *
 * 状态**不自己记**：隐藏是布局的一部分，随工作区的快照进偏好、随 `fromJSON` 回来。这里只在
 * 每次布局变化后从组的可见性读一遍，因此按工作区切换、重置、另存都不需要再同步一份。
 *
 * @internal
 */
export function useWorkspaceSideCollapse(
  apiRef: RefObject<DockviewApi | null>,
  ready: boolean,
): ComposeWorkspaceSideCollapse {
  const [collapsed, setCollapsedState] = useState<ComposeWorkspaceSideCollapsed>(EXPANDED)

  const refresh = useCallback(() => {
    const api = apiRef.current
    if (!api) return
    const next = readCollapsed(api)
    setCollapsedState((current) => (
      current.left === next.left
      && current.right === next.right
      && current.bottom === next.bottom
        ? current
        : next
    ))
  }, [apiRef])

  useEffect(() => {
    const api = apiRef.current
    if (!ready || !api) return
    refresh()
    // 宿主测试替身可能只实现部分 api：订阅逐个防御。
    const subscriptions = [
      (api as Partial<DockviewApi>).onDidLayoutChange?.(() => { refresh() }),
      (api as Partial<DockviewApi>).onDidLayoutFromJSON?.(() => { refresh() }),
    ]
    return () => { subscriptions.forEach((subscription) => { subscription?.dispose() }) }
  }, [apiRef, ready, refresh])

  const setCollapsed = useCallback((side: ComposeWorkspaceSide, value: boolean) => {
    const api = apiRef.current
    if (!api) return
    if (side === 'bottom') {
      const group = bottomGroup(api)
      if (value) group?.collapse?.()
      else group?.expand?.()
    } else {
      for (const group of sideGroups(api, side)) {
        if (typeof group.api.setVisible === 'function') group.api.setVisible(!value)
      }
    }
    setCollapsedState((current) => ({ ...current, [side]: value }))
  }, [apiRef])

  const toggle = useCallback((side: ComposeWorkspaceSide) => {
    setCollapsed(side, !collapsed[side])
  }, [collapsed, setCollapsed])

  return { collapsed, setCollapsed, toggle }
}
