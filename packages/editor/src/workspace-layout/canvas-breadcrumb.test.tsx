import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComposeUIProvider } from '@compose-ui/ui-context'
import type { ComposeWorkspaceDocumentSession, WorkspaceContent } from './workspace-context'
import { WorkspaceContentContext } from './workspace-context'
import { CanvasDocumentBreadcrumb } from './canvas-breadcrumb'

afterEach(cleanup)

function pageSession(panelId: string, displayName: string) {
  return { kind: 'page', panelId, displayName, dirty: false } as unknown as ComposeWorkspaceDocumentSession
}

function renderTrail(overrides: Partial<WorkspaceContent>) {
  const content = {
    documents: new Map(),
    activeDocumentPanelId: null,
    stageHostPanelId: '',
    ...overrides,
  } as unknown as WorkspaceContent
  render(
    <ComposeUIProvider locale="zh-CN">
      <WorkspaceContentContext.Provider value={content}>
        <CanvasDocumentBreadcrumb />
      </WorkspaceContentContext.Provider>
    </ComposeUIProvider>,
  )
  return content
}

describe('CanvasDocumentBreadcrumb', () => {
  it('OpenSpec: editor-workspace-layout / 文档标签条 / 画布列头回答的是层', () => {
    renderTrail({
      documents: new Map([['a', pageSession('a', 'Home')]]),
      activeDocumentPanelId: 'a',
    })
    const trail = screen.getByRole('navigation', { name: '文档位置' })
    expect(trail).toHaveTextContent('Home')
    // 文档标签住顶栏，不住这一行。
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    // 「设计 / 动画」切换器已删，不因为这一行留了下来就把它装回去。
    expect(screen.queryByRole('radiogroup', { name: '编辑模式' })).toBeNull()
  })

  it('OpenSpec: editor-workspace-layout / 进入层的呈现 / 进了层之后面包屑有多段', () => {
    const exitEntryLayerTo = vi.fn()
    renderTrail({
      documents: new Map([
        ['page-a', pageSession('page-a', 'Home')],
        ['component-breaker', pageSession('component-breaker', 'Breaker')],
      ]),
      activeDocumentPanelId: 'component-breaker',
      entryLayerPanelIds: ['component-breaker'],
      entryOriginPanelId: 'page-a',
      exitEntryLayerTo,
    })
    /*
     * 末段是终点、不可点；前面几段点下去就回到那一层——走的是场景树根行返回的同一条实现。
     * 一个前几段点了什么都不发生的面包屑是在撒谎。
     */
    const current = screen.getByText('Breaker')
    expect(current).toHaveAttribute('aria-current', 'page')
    fireEvent.click(screen.getByRole('button', { name: 'Home' }))
    expect(exitEntryLayerTo).toHaveBeenCalledWith('page-a')
  })

  it('OpenSpec: editor-workspace-layout / 文档标签条 / 没有打开文档时这一行是空的', () => {
    // 行还在（左右面板头要与它齐平），上面没有任何东西可说。
    renderTrail({})
    expect(screen.getByRole('navigation', { name: '文档位置' })).toBeEmptyDOMElement()
  })
})
