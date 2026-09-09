import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComposeAnimationPanelProvider } from '@compose-ui/animation-panel'
import { ComposeUIProvider } from '@compose-ui/ui-context'
import type {
  ComposeWorkspaceDocumentSession,
  WorkspaceContent,
} from './workspace-context'
import { WorkspaceContentContext } from './workspace-context'
import { AnimationPanel, ComponentDocumentSurface, InspectorPanel } from './workspace-panels'

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

describe('AnimationPanel', () => {
  function renderPanel(content: Partial<WorkspaceContent>) {
    render(
      <ComposeUIProvider locale="zh-CN">
        <ComposeAnimationPanelProvider>
          <WorkspaceContentContext.Provider value={content as WorkspaceContent}>
            <AnimationPanel />
          </WorkspaceContentContext.Provider>
        </ComposeAnimationPanelProvider>
      </ComposeUIProvider>,
    )
  }

  it('OpenSpec: editor-workspace-layout / 动画编辑开关 / chrome 上的开关是 aria-pressed 的开关', () => {
    const toggle = vi.fn()
    renderPanel({ animationEditing: false, toggleAnimationEditing: toggle })
    const button = screen.getByRole('button', { name: '动画编辑' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(button)
    expect(toggle).toHaveBeenCalledOnce()
    // 关着时时间线照常渲染：看得见要编辑的东西，第一次交互即进入。
    expect(screen.getByRole('region', { name: '动画编辑器' })).toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / 动画编辑开关 / 开着时按钮按下', () => {
    renderPanel({ animationEditing: true, toggleAnimationEditing: vi.fn() })
    expect(screen.getByRole('button', { name: '动画编辑' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('OpenSpec: editor-workspace-layout / 动画编辑开关 / 没有文档时没有开关', () => {
    renderPanel({ animationEditing: false })
    expect(screen.queryByRole('button', { name: '动画编辑' })).not.toBeInTheDocument()
  })
})

describe('ComponentDocumentSurface', () => {
  function componentSession(): ComposeWorkspaceDocumentSession {
    return {
      kind: 'component',
      panelId: 'component-panel',
      assetKey: 'Components/Switch.component.json',
      displayName: '刀闸',
      sourceKind: 'base',
      asset: { kind: 'base' },
      dirty: false,
    } as unknown as ComposeWorkspaceDocumentSession
  }

  it('OpenSpec: editor-workspace-layout / 动画编辑开关 / 组件表面的工具栏行尾没有模式切换器', () => {
    const content = {
      documents: new Map([['component-panel', componentSession()]]),
      animationEditing: false,
      toggleAnimationEditing: () => undefined,
      saveDocument: () => undefined,
      stageHostPanelId: 'component-panel',
      stageToolbar: <div>工具栏</div>,
      children: <div>舞台</div>,
    } as unknown as WorkspaceContent
    render(
      <ComposeUIProvider locale="zh-CN">
        <WorkspaceContentContext.Provider value={content}>
          <ComponentDocumentSurface session={componentSession() as never} />
        </WorkspaceContentContext.Provider>
      </ComposeUIProvider>,
    )

    expect(screen.getByText('工具栏')).toBeInTheDocument()
    expect(screen.getByText('舞台')).toBeInTheDocument()
    expect(screen.getByLabelText('主组件 刀闸')).toBeInTheDocument()
    /*
     * 模式切换器已经没有了：动画编辑是时间线 chrome 上的开关，与工具栏行无关。
     * 保存也没有按钮——它是 `document.save` 动作。
     */
    expect(screen.queryByRole('radiogroup', { name: '编辑模式' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /保存/ })).not.toBeInTheDocument()
  })
})
