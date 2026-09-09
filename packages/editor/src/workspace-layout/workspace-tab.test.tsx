import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IDockviewPanelHeaderProps } from 'dockview-react'
import { WorkspaceContentContext } from './workspace-context'
import type { WorkspaceContent } from './workspace-context'
import { WORKSPACE_PANEL_IDS } from './workspace-layout'
import { WorkspaceTab } from './workspace-tab'

afterEach(cleanup)

function renderTab(panelId: string) {
  const openDialog = vi.fn()
  const content = {
    workspace: { openDialog },
  } as unknown as WorkspaceContent
  const props = {
    api: { id: panelId, title: undefined, onDidTitleChange: undefined },
  } as unknown as IDockviewPanelHeaderProps
  render(
    <WorkspaceContentContext.Provider value={content}>
      <WorkspaceTab {...props} />
    </WorkspaceContentContext.Provider>,
  )
  // 标签名由面板 id 与语言决定；这两条用例要的是那个元素，因此按 `data-workspace-tab` 取。
  return { openDialog, tab: document.querySelector<HTMLElement>(`[data-workspace-tab="${panelId}"]`)! }
}

describe('OpenSpec: editor-workspace-layout / 自定义物料面板 / 标签右键', () => {
  it('右键组件面板的标签打开对话框', () => {
    const { openDialog, tab } = renderTab(WORKSPACE_PANEL_IDS.componentLibrary)
    fireEvent.contextMenu(tab)
    fireEvent.click(screen.getByRole('menuitem', { name: '自定义物料面板…' }))
    expect(openDialog).toHaveBeenCalledWith('palette')
  })

  /*
   * 判别性：这一项只属于组件面板。挂在每个标签上会让「自定义物料面板…」出现在场景树、
   * 属性与日志的右键里，而那三处它什么也管不着。
   */
  it('别的面板标签没有这一项', () => {
    const { tab } = renderTab(WORKSPACE_PANEL_IDS.scene)
    fireEvent.contextMenu(tab)
    expect(screen.queryByRole('menuitem', { name: '自定义物料面板…' })).toBeNull()
  })
})
