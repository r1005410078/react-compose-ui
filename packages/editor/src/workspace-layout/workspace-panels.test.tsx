import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ComposeAnimationPanelProvider } from '@compose-ui/animation-panel'
import type { IDockviewPanelProps } from 'dockview-react'
import { ComposeUIProvider } from '@compose-ui/ui-context'
import type {
  ComposeWorkspaceDocumentSession,
  WorkspaceContent,
} from './workspace-context'
import { WorkspaceContentContext } from './workspace-context'
import { ComponentDocumentPanel, InspectorPanel } from './workspace-panels'

// 本仓库没有开 RTL 自动清理：不显式 cleanup，前一条用例的 DOM 会留在文档里，
// 「不应该出现」这类断言就会读到上一条渲染的结果。
afterEach(cleanup)

describe('InspectorPanel', () => {
  it('OpenSpec: animation-panel / 编辑器中可见的动画区 / 底部动画标签不改变右侧属性区内容', () => {
    const content = {
      inspectorPanel: <div>场景属性</div>,
    } as WorkspaceContent

    render(
      <ComposeUIProvider locale="zh-CN">
        <ComposeAnimationPanelProvider>
          <WorkspaceContentContext.Provider value={content}>
            <InspectorPanel />
          </WorkspaceContentContext.Provider>
        </ComposeAnimationPanelProvider>
      </ComposeUIProvider>,
    )

    expect(screen.getByText('场景属性')).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: '关键帧属性' })).not.toBeInTheDocument()
  })
})

describe('ComponentDocumentPanel', () => {
  /** Dockview 面板 props 只用到 `api.id`；其余字段本组件不读。 */
  const panelProps = { api: { id: 'component-panel' } } as unknown as IDockviewPanelProps

  function componentSession(): ComposeWorkspaceDocumentSession {
    return {
      kind: 'component',
      assetKey: 'Components/Switch.component.json',
      displayName: '刀闸',
      sourceKind: 'base',
      asset: { kind: 'base' },
      dirty: false,
    } as unknown as ComposeWorkspaceDocumentSession
  }

  function renderPanel(extra: Record<string, unknown>) {
    const content = {
      documents: new Map([['component-panel', componentSession()]]),
      saveDocument: () => undefined,
      ...extra,
    } as unknown as WorkspaceContent
    return render(
      <ComposeUIProvider locale="zh-CN">
        <WorkspaceContentContext.Provider value={content}>
          <ComponentDocumentPanel {...panelProps} />
        </WorkspaceContentContext.Provider>
      </ComposeUIProvider>,
    )
  }

  it('OpenSpec: editor-workspace-layout / 设计与动画模式切换器 / 组件文档也提供入口', () => {
    renderPanel({ editorMode: 'design', onEditorModeChange: () => undefined })

    /*
     * 原先这里没有切换器，理由是「动画绑定是页面级概念」。`add-instance-animation` 之后
     * 绑定住在宿主页面上那个实例 Entity 的 `Bindings` 上，组件文档里只剩清单与轨道，
     * 那条理由自己失效了。
     */
    const group = screen.getByRole('radiogroup')
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '动画' })).toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / 设计与动画模式切换器 / 未接入模式的宿主仍不提供', () => {
    // 未启用页面系统的嵌入宿主不传这两个 prop，那条限制与组件无关，本刀不碰。
    renderPanel({})

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  })
})
