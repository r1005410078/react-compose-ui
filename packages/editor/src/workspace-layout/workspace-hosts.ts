import { WORKSPACE_COMPONENT_IDS } from './workspace-ids'

/** 面板内容的宿主元素，按面板组件名索引。 @internal */
export type WorkspaceHostElements = Readonly<Record<WorkspaceHostKey, HTMLElement>>

/** 有宿主元素的面板：Dockview 里注册的每一种。 @internal */
export type WorkspaceHostKey = (typeof WORKSPACE_COMPONENT_IDS)[keyof typeof WORKSPACE_COMPONENT_IDS]

/** 所有面板组件名。 @internal */
export const WORKSPACE_HOST_KEYS: readonly WorkspaceHostKey[] = Object.values(WORKSPACE_COMPONENT_IDS)

/**
 * 为每种面板造一个长期存活的宿主元素。
 *
 * @remarks
 * 每个编辑器实例一套；React 不关心容器在 DOM 的哪里，因此它们可以在 Dockview 之外先建好、
 * 面板挂载时再搬进去。没有 DOM 的环境（SSR）造不出来，这个编辑器本来也只在浏览器里跑。
 * @internal
 */
export function createWorkspaceHostElements(): WorkspaceHostElements {
  return Object.fromEntries(WORKSPACE_HOST_KEYS.map((key) => {
    const element = document.createElement('div')
    element.className = 'compose-editor__host'
    element.dataset.workspaceHost = key
    return [key, element]
  })) as unknown as WorkspaceHostElements
}
