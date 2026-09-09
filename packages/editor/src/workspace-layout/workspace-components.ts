import { createElement, useCallback } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import { useWorkspaceContent } from './workspace-context'
import type { WorkspaceHostKey } from './workspace-hosts'
import { WORKSPACE_HOST_KEYS } from './workspace-hosts'

/**
 * Dockview 面板的组件：只把该面板的稳定宿主元素搬进自己的盒子。
 *
 * @remarks
 * 内容由 `WorkspacePortals` 经 portal 渲染进宿主元素，与 Dockview 面板的生命周期无关。面板
 * 卸载时**不**把元素摘下来：`fromJSON` 先销毁旧面板再建新面板，新面板挂载时 `appendChild` 会把
 * 元素从旧盒子搬过来，中间没有一帧是空的。
 */
function WorkspaceHostMount({ host }: { readonly host: WorkspaceHostKey }) {
  const { hosts } = useWorkspaceContent()
  // 回调 ref 在提交时拿到盒子：那一刻把宿主元素搬进来，不需要再等一个 effect。
  const mount = useCallback((container: HTMLDivElement | null) => {
    const element = hosts[host]
    if (container && element.parentElement !== container) container.appendChild(element)
  }, [host, hosts])
  return createElement('div', { className: 'compose-editor__host-mount', ref: mount })
}

/** 单一 Dockview 实例的面板组件表：每一种面板都是同一个宿主挂载组件。 @internal */
export const workspaceComponents = Object.fromEntries(
  WORKSPACE_HOST_KEYS.map((key) => [
    key,
    function WorkspacePanel() {
      return createElement(WorkspaceHostMount, { host: key })
    },
  ]),
) as unknown as Record<WorkspaceHostKey, React.FunctionComponent<IDockviewPanelProps>>
