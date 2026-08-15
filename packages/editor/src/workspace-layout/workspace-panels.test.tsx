import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ComposeAnimationPanelProvider } from '@compose-ui/animation-panel'
import { ComposeUIProvider } from '@compose-ui/ui-context'
import type { WorkspaceContent } from './workspace-context'
import { WorkspaceContentContext } from './workspace-context'
import { InspectorPanel } from './workspace-panels'

describe('InspectorPanel', () => {
  it('激活动画标签时右侧仍显示场景属性，不换成关键帧面板', () => {
    const content = {
      animationPanelActive: true,
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
