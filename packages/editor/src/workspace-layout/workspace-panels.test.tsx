import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ComposeAnimationPanelProvider } from '@compose-ui/animation-panel'
import { ComposeUIProvider } from '@compose-ui/ui-context'
import type { WorkspaceContent } from './workspace-context'
import { WorkspaceContentContext } from './workspace-context'
import { InspectorPanel } from './workspace-panels'

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
