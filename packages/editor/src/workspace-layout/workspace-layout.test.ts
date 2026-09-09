import type { DockviewApi } from 'dockview-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildWorkspaceLayout,
  computeToolsHeight,
  initializeWorkspace,
  syncWorkspaceHistoryPanel,
  WORKSPACE_COMPONENT_IDS,
  WORKSPACE_GROUP_IDS,
  WORKSPACE_PANEL_IDS,
  WORKSPACE_SIZES,
} from './workspace-layout'

function createWorkspaceApi(height = 600) {
  const groups = new Map<string, { id: string; locked?: string }>()
  const edgeGroups = new Map<string, { id: string; locked?: string }>()
  const panels = new Map<
    string,
    { id: string; api: { close: ReturnType<typeof vi.fn>; setActive: ReturnType<typeof vi.fn> } }
  >()

  const api = {
    height,
    addGroup: vi.fn((options: { id: string }) => {
      const group = { id: options.id }
      groups.set(options.id, group)
      return group
    }),
    getGroup: vi.fn((id: string) => groups.get(id)),
    addEdgeGroup: vi.fn(
      (position: string, options: { id: string }) => {
        const group = { id: options.id }
        groups.set(options.id, group)
        edgeGroups.set(position, group)
        return group
      },
    ),
    getEdgeGroup: vi.fn((position: string) => edgeGroups.get(position)),
    addPanel: vi.fn((options: { id: string; position?: { referenceGroup?: string } }) => {
      const panel = {
        id: options.id,
        api: { close: vi.fn(() => { panels.delete(options.id) }), setActive: vi.fn() },
      }
      panels.set(options.id, panel)
      return panel
    }),
    getPanel: vi.fn((id: string) => panels.get(id)),
  }

  return {
    api: api as unknown as DockviewApi,
    spies: api,
    edgeGroups,
    groups,
    panels,
  }
}

describe('initializeWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('OpenSpec: editor-workspace-layout / 单一 Dockview 实例 / 只有一个 Dockview', () => {
    const { api, spies, edgeGroups, panels } = createWorkspaceApi()

    initializeWorkspace(api)

    // 左右两侧是普通组：只有底部一个边缘组，它因此横跨整个编辑器宽度。
    expect(spies.addEdgeGroup).toHaveBeenCalledTimes(1)
    expect(spies.addEdgeGroup).toHaveBeenCalledWith('bottom', {
      id: WORKSPACE_GROUP_IDS.bottom,
      ...WORKSPACE_SIZES.bottom,
      collapsed: true,
    })
    expect(edgeGroups.get('bottom')).toEqual(
      expect.objectContaining({ id: WORKSPACE_GROUP_IDS.bottom }),
    )
    expect(spies.addGroup.mock.calls.map(([options]) => options.id)).toEqual([
      WORKSPACE_GROUP_IDS.canvas,
      WORKSPACE_GROUP_IDS.scene,
      WORKSPACE_GROUP_IDS.tools,
      WORKSPACE_GROUP_IDS.inspector,
    ])
    expect(panels.get(WORKSPACE_PANEL_IDS.assetBrowser)?.api.setActive).toHaveBeenCalledTimes(1)
    expect(panels.get(WORKSPACE_PANEL_IDS.componentLibrary)?.api.setActive).toHaveBeenCalledTimes(1)
  })

  it('OpenSpec: editor-workspace-layout / 四区编辑器工作区 / 首次挂载编辑器', () => {
    const { api, spies } = createWorkspaceApi()

    initializeWorkspace(api)

    const groupOptions = (id: string) => spies.addGroup.mock.calls.find(([options]) => options.id === id)?.[0]
    // 画布先落地成根，场景组在它左边，工具组在场景组下面，属性组在画布右边。
    expect(groupOptions(WORKSPACE_GROUP_IDS.scene)).toEqual(expect.objectContaining({
      direction: 'left',
      referenceGroup: WORKSPACE_GROUP_IDS.canvas,
      initialWidth: WORKSPACE_SIZES.scene.initialWidth,
      constraints: {
        minimumWidth: WORKSPACE_SIZES.scene.minimumWidth,
        minimumHeight: WORKSPACE_SIZES.scene.minimumHeight,
      },
    }))
    expect(groupOptions(WORKSPACE_GROUP_IDS.tools)).toEqual(expect.objectContaining({
      direction: 'below',
      referenceGroup: WORKSPACE_GROUP_IDS.scene,
      initialHeight: 240,
      constraints: { minimumHeight: WORKSPACE_SIZES.tools.minimumHeight },
    }))
    expect(groupOptions(WORKSPACE_GROUP_IDS.inspector)).toEqual(expect.objectContaining({
      direction: 'right',
      referenceGroup: WORKSPACE_GROUP_IDS.canvas,
      initialWidth: WORKSPACE_SIZES.inspector.initialWidth,
    }))
    const panelGroup = (id: string) => spies.addPanel.mock.calls
      .find(([options]) => options.id === id)?.[0].position
    expect(panelGroup(WORKSPACE_PANEL_IDS.canvas)).toEqual({ referenceGroup: WORKSPACE_GROUP_IDS.canvas })
    expect(panelGroup(WORKSPACE_PANEL_IDS.scene)).toEqual({ referenceGroup: WORKSPACE_GROUP_IDS.scene })
    expect(panelGroup(WORKSPACE_PANEL_IDS.componentLibrary))
      .toEqual({ referenceGroup: WORKSPACE_GROUP_IDS.tools })
    expect(panelGroup(WORKSPACE_PANEL_IDS.inspector))
      .toEqual({ referenceGroup: WORKSPACE_GROUP_IDS.inspector })
  })

  it('OpenSpec: editor-workspace-layout / 时间线是可摆放的工作区面板 / 页面的底部只有资源、命令、日志', () => {
    const { api, spies } = createWorkspaceApi()

    initializeWorkspace(api)

    const bottomPanels = spies.addPanel.mock.calls
      .filter(([options]) => options.position?.referenceGroup === WORKSPACE_GROUP_IDS.bottom)
      .map(([options]) => options.id)
    expect(bottomPanels).toEqual([
      WORKSPACE_PANEL_IDS.assetBrowser,
      WORKSPACE_PANEL_IDS.command,
      WORKSPACE_PANEL_IDS.transactionLog,
    ])
    // 没有摆时间线的布局里就没有时间线：它不再由任何模式动态加入。
    expect(spies.addPanel).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: WORKSPACE_PANEL_IDS.animation }),
    )
  })

  it('OpenSpec: editor-workspace-layout / 时间线是可摆放的工作区面板 / preset 里的 timeline 落成时间线面板', () => {
    const { api, spies } = createWorkspaceApi()

    buildWorkspaceLayout(api, {
      kind: 'preset',
      bottom: ['timeline', 'assetBrowser'],
      bottomCollapsed: false,
    })

    const bottomPanels = spies.addPanel.mock.calls
      .filter(([options]) => options.position?.referenceGroup === WORKSPACE_GROUP_IDS.bottom)
      .map(([options]) => options.id)
    expect(bottomPanels).toEqual([WORKSPACE_PANEL_IDS.animation, WORKSPACE_PANEL_IDS.assetBrowser])
    expect(spies.addPanel).toHaveBeenCalledWith(expect.objectContaining({
      id: WORKSPACE_PANEL_IDS.animation,
      component: WORKSPACE_COMPONENT_IDS.animation,
      inactive: false,
    }))
  })

  it('OpenSpec: editor-workspace-layout / 场景下方工具分栏 / 使用默认历史面板', () => {
    const { api, spies, panels } = createWorkspaceApi()

    initializeWorkspace(api, 'zh-CN', undefined, { historyEnabled: true })

    expect(spies.addPanel).toHaveBeenCalledWith(expect.objectContaining({
      id: WORKSPACE_PANEL_IDS.history,
      inactive: true,
      position: { referenceGroup: WORKSPACE_GROUP_IDS.tools },
    }))
    expect(panels.get(WORKSPACE_PANEL_IDS.componentLibrary)?.api.setActive).toHaveBeenCalledTimes(1)
  })

  it('OpenSpec: editor-workspace-layout / 场景下方工具分栏 / 不启用历史', () => {
    const { api, spies, panels } = createWorkspaceApi()

    initializeWorkspace(api)
    expect(panels.has(WORKSPACE_PANEL_IDS.history)).toBe(false)

    // 宿主挂载后提供历史：标签加入；再撤掉：标签关掉，其余面板不动。
    syncWorkspaceHistoryPanel(api, true)
    expect(panels.has(WORKSPACE_PANEL_IDS.history)).toBe(true)
    const addPanelCalls = spies.addPanel.mock.calls.length
    syncWorkspaceHistoryPanel(api, false)
    expect(panels.has(WORKSPACE_PANEL_IDS.history)).toBe(false)
    expect(spies.addPanel).toHaveBeenCalledTimes(addPanelCalls)
  })

  it('uses a compact, resizable width for the default inspector', () => {
    /*
     * 288 / 270：轨道按比例分之后 400 里那 122px 富余全落在一个输入框上；可读下限是 264，
     * 配置值比它多一条沟槽——`theme.gap` 把间距摊进各视图，画出来的盒总比配置的窄几个像素。
     */
    expect(WORKSPACE_SIZES.inspector).toEqual({ initialWidth: 288, minimumWidth: 270 })
  })

  it('OpenSpec: editor-workspace-layout / Dockview 场景工具布局 / 工具组取 40% 并受最小高度夹紧', () => {
    expect(computeToolsHeight(600)).toBe(240)
    expect(computeToolsHeight(200)).toBe(120)
    // 量不到高度时按默认 480 折算，而不是把 0 交给 Dockview。
    expect(computeToolsHeight(0)).toBe(192)
  })

  it('OpenSpec: editor-workspace-layout / 单一 Dockview 实例 / Strict Mode 下唯一', () => {
    const { api, spies } = createWorkspaceApi()

    initializeWorkspace(api, 'zh-CN', undefined, { historyEnabled: true })
    initializeWorkspace(api, 'zh-CN', undefined, { historyEnabled: true })

    expect(spies.addGroup).toHaveBeenCalledTimes(4)
    expect(spies.addEdgeGroup).toHaveBeenCalledTimes(1)
    expect(spies.addPanel).toHaveBeenCalledTimes(8)
  })
})
