import { useEffect, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { DockviewApi } from 'dockview-react'
import type { ComposeWorkspaceDocumentSession } from './workspace-context'

/** 中央文档标签的种类。 @internal */
export type ComposeWorkspaceDocumentKind = ComposeWorkspaceDocumentSession['kind']

/** 一侧边缘面板的收起状态。 @internal */
interface EdgeCollapsedState {
  left: boolean
  right: boolean
}

/**
 * 各文档类型的边缘面板初值。
 *
 * @remarks
 * CAD 参考 AutoCAD：命令行驱动、无限图纸，左右面板存在但默认收起。其余文档类型保持既有的
 * 展开行为。
 */
const DEFAULT_COLLAPSED: Readonly<Record<ComposeWorkspaceDocumentKind, EdgeCollapsedState>> = {
  asset: { left: false, right: false },
  page: { left: false, right: false },
  component: { left: false, right: false },
  cad: { left: true, right: true },
}

/**
 * 让左右边缘面板的展开状态成为「当前激活文档类型」的函数。
 *
 * @remarks
 * 边缘组是工作区级的，而文档标签在中央——若展开状态也是工作区级的单一全局值，在 CAD 里收起
 * 面板会连带影响页面标签，反之亦然。因此这里按**文档类型**记忆：初值来自
 * {@link DEFAULT_COLLAPSED}，用户手动展开或收起记入当前类型，切走再切回同类型时恢复用户的
 * 选择而不是重置。
 *
 * 记忆放在 ref 而不是 state：它只在 Dockview 事件与切换 effect 中读写，不参与渲染输出，
 * 进 state 只会多一轮无意义的重渲染。
 *
 * @internal
 */
export function useWorkspaceEdgeCollapse(
  apiRef: RefObject<DockviewApi | null>,
  activeKind: ComposeWorkspaceDocumentKind | null,
  ready: boolean,
) {
  const remembered = useRef(new Map<ComposeWorkspaceDocumentKind, EdgeCollapsedState>())
  const activeKindRef = useRef(activeKind)
  // 事件回调必须读**事件发生当刻**的活动类型，而不是订阅时捕获的那一份：订阅只建立一次，
  // 而用户会在多个标签之间来回切换。
  useLayoutEffect(() => {
    activeKindRef.current = activeKind
  })

  useEffect(() => {
    const api = apiRef.current
    if (!ready || !api || !activeKind) return
    const left = api.getEdgeGroup?.('left')
    const right = api.getEdgeGroup?.('right')
    if (!left || !right) return

    const target = remembered.current.get(activeKind) ?? { ...DEFAULT_COLLAPSED[activeKind] }
    remembered.current.set(activeKind, target)

    const apply = (group: typeof left, collapsed: boolean) => {
      if (group.isCollapsed() === collapsed) return
      if (collapsed) group.collapse()
      else group.expand()
    }
    apply(left, target.left)
    apply(right, target.right)

    const record = (side: 'left' | 'right', collapsed: boolean) => {
      const kind = activeKindRef.current
      if (!kind) return
      const current = remembered.current.get(kind) ?? { ...DEFAULT_COLLAPSED[kind] }
      remembered.current.set(kind, { ...current, [side]: collapsed })
    }
    const subscriptions = [
      left.onDidCollapsedChange?.(({ isCollapsed }) => { record('left', isCollapsed) }),
      right.onDidCollapsedChange?.(({ isCollapsed }) => { record('right', isCollapsed) }),
    ]
    return () => { subscriptions.forEach((subscription) => { subscription?.dispose() }) }
  }, [activeKind, apiRef, ready])
}
