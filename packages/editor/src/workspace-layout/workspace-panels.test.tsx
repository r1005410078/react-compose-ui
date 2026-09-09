import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ComposeAnimationPanelProvider } from '@compose-ui/animation-panel'
import { ComposeUIProvider } from '@compose-ui/ui-context'
import type {
  ComposeWorkspaceDocumentSession,
  WorkspaceContent,
} from './workspace-context'
import { WorkspaceContentContext } from './workspace-context'
import { ComponentDocumentSurface, InspectorPanel } from './workspace-panels'

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

  it('OpenSpec: editor-workspace-layout / 设计与动画模式切换器 / 组件表面的工具栏行尾没有它', () => {
    const content = {
      documents: new Map([['component-panel', componentSession()]]),
      editorMode: 'design',
      onEditorModeChange: () => undefined,
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
     * 模式切换器搬去了文档标签行的行尾：工具栏行是会溢出的货架，而模式不该与一堆可增删的
     * 工具抢同一条行。保存则彻底没有按钮了——它是 `document.save` 动作。
     */
    expect(screen.queryByRole('radiogroup', { name: '编辑模式' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /保存/ })).not.toBeInTheDocument()
  })
})
