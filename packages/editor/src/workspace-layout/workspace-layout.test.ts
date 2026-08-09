import type { DockviewApi } from 'dockview-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  initializeWorkspace,
  WORKSPACE_GROUP_IDS,
  WORKSPACE_PANEL_IDS,
  WORKSPACE_SIZES,
} from './workspace-layout'

function createWorkspaceApi() {
  const groups = new Map<string, { id: string; locked?: string }>()
  const edgeGroups = new Map<string, { id: string; locked?: string }>()
  const panels = new Map<
    string,
    { id: string; api: { setActive: ReturnType<typeof vi.fn> } }
  >()

  const api = {
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
    addPanel: vi.fn((options: { id: string }) => {
      const panel = { id: options.id, api: { setActive: vi.fn() } }
      panels.set(options.id, panel)
      return panel
    }),
    getPanel: vi.fn((id: string) => panels.get(id)),
  }

  return {
    api: api as unknown as DockviewApi,
    spies: api,
    edgeGroups,
    panels,
  }
}

describe('initializeWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('OpenSpec: editor-workspace-layout / 四区编辑器工作区 / 首次挂载编辑器', () => {
    const { api, spies, edgeGroups, panels } = createWorkspaceApi()

    initializeWorkspace(api)

    expect(spies.addGroup).toHaveBeenCalledWith(
      expect.objectContaining({ id: WORKSPACE_GROUP_IDS.canvas }),
    )
    expect(spies.addEdgeGroup).toHaveBeenNthCalledWith(1, 'left', {
      id: WORKSPACE_GROUP_IDS.scene,
      ...WORKSPACE_SIZES.scene,
    })
    expect(spies.addEdgeGroup).toHaveBeenNthCalledWith(2, 'right', {
      id: WORKSPACE_GROUP_IDS.inspector,
      ...WORKSPACE_SIZES.inspector,
    })
    expect(spies.addEdgeGroup).toHaveBeenNthCalledWith(3, 'bottom', {
      id: WORKSPACE_GROUP_IDS.bottom,
      ...WORKSPACE_SIZES.bottom,
      collapsed: true,
    })
    expect(spies.addPanel).toHaveBeenCalledTimes(6)
    expect(panels.get(WORKSPACE_PANEL_IDS.scene)?.api.setActive)
      .toHaveBeenCalledTimes(1)
    expect(edgeGroups.get('bottom')).toEqual(
      expect.objectContaining({ id: WORKSPACE_GROUP_IDS.bottom }),
    )
    expect(panels.get(WORKSPACE_PANEL_IDS.assetBrowser)?.api.setActive)
      .toHaveBeenCalledTimes(1)
  })

  it('OpenSpec: editor-workspace-layout / 页面模式不显示根画布 / 保留中央组但不创建固定 Canvas', () => {
    const { api, spies, panels } = createWorkspaceApi()

    initializeWorkspace(api, 'zh-CN', undefined, { includeCanvas: false })

    expect(spies.addGroup).toHaveBeenCalledWith(
      expect.objectContaining({ id: WORKSPACE_GROUP_IDS.canvas }),
    )
    expect(panels.has(WORKSPACE_PANEL_IDS.canvas)).toBe(false)
    expect(spies.addPanel).not.toHaveBeenCalledWith(expect.objectContaining({
      id: WORKSPACE_PANEL_IDS.canvas,
    }))
  })

  it('OpenSpec: editor-workspace-layout / 边缘工具区 / 检查默认边缘组', () => {
    const { api, spies } = createWorkspaceApi()

    initializeWorkspace(api)

    const sceneOptions = spies.addPanel.mock.calls.find(
      ([options]) => options.id === WORKSPACE_PANEL_IDS.scene,
    )?.[0]
    expect(sceneOptions).toEqual(expect.objectContaining({
      position: { referenceGroup: WORKSPACE_GROUP_IDS.scene },
    }))
    expect(spies.addPanel).not.toHaveBeenCalledWith(expect.objectContaining({
      id: 'compose-component-library',
    }))
  })

  it('uses a compact, resizable width for the default inspector edge', () => {
    expect(WORKSPACE_SIZES.inspector).toEqual({ initialSize: 400, minimumSize: 300 })
  })

  it('OpenSpec: editor-workspace-layout / 资源面板标签 / 将三个底部面板按资源、命令、日志放入默认收起的一组', () => {
    const { api, spies } = createWorkspaceApi()

    initializeWorkspace(api)

    const transactionOptions = spies.addPanel.mock.calls.find(
      ([options]) => options.id === WORKSPACE_PANEL_IDS.transactionLog,
    )?.[0]
    const commandOptions = spies.addPanel.mock.calls.find(
      ([options]) => options.id === WORKSPACE_PANEL_IDS.command,
    )?.[0]
    const assetOptions = spies.addPanel.mock.calls.find(
      ([options]) => options.id === WORKSPACE_PANEL_IDS.assetBrowser,
    )?.[0]

    expect(transactionOptions).toEqual(
      expect.objectContaining({
        inactive: true,
        position: { referenceGroup: WORKSPACE_GROUP_IDS.bottom },
      }),
    )
    expect(commandOptions).toEqual(
      expect.objectContaining({
        inactive: true,
        position: { referenceGroup: WORKSPACE_GROUP_IDS.bottom },
      }),
    )
    expect(assetOptions).toEqual(
      expect.objectContaining({
        position: { referenceGroup: WORKSPACE_GROUP_IDS.bottom },
      }),
    )
    expect(spies.addPanel.mock.calls.map(([options]) => options.id)).toEqual([
      WORKSPACE_PANEL_IDS.canvas,
      WORKSPACE_PANEL_IDS.scene,
      WORKSPACE_PANEL_IDS.inspector,
      WORKSPACE_PANEL_IDS.assetBrowser,
      WORKSPACE_PANEL_IDS.command,
      WORKSPACE_PANEL_IDS.transactionLog,
    ])
  })

  it('is idempotent when initialization is replayed', () => {
    const { api, spies } = createWorkspaceApi()

    initializeWorkspace(api)
    initializeWorkspace(api)

    expect(spies.addGroup).toHaveBeenCalledTimes(1)
    expect(spies.addEdgeGroup).toHaveBeenCalledTimes(3)
    expect(spies.addPanel).toHaveBeenCalledTimes(6)
  })
})
