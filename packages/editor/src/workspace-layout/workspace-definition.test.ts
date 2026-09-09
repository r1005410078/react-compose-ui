import { describe, expect, it } from 'vitest'
import {
  COMPOSE_DEFAULT_WORKSPACES,
  COMPOSE_DRAWING_WORKSPACE_ID,
  COMPOSE_PAGE_WORKSPACE_ID,
  isInjectedWorkspace,
  resolveWorkspaceList,
  resolveWorkspacePaletteTitle,
  resolveWorkspaceTitle,
} from './workspace-definition'
import type { ComposeEditorCustomWorkspace } from './workspace-definition'

const custom = (id: string, title = id): ComposeEditorCustomWorkspace => ({
  id,
  title,
  layout: { kind: 'snapshot', format: 'dockview@7', data: {} },
  session: COMPOSE_DEFAULT_WORKSPACES[0]!.session,
  seeds: COMPOSE_DEFAULT_WORKSPACES[0]!.seeds,
})

describe('工作区定义与注入', () => {
  it('OpenSpec: editor-workspace-layout / 工作区定义与注入 / 重名抛错', () => {
    const page = COMPOSE_DEFAULT_WORKSPACES[0]!
    expect(() => resolveWorkspaceList([page, { ...page, title: '又一个' }], [])).toThrow(/duplicate workspace id "page"/)
  })

  it('OpenSpec: editor-workspace-layout / 工作区定义与注入 / 用户另存的与注入的合成一份，撞 id 的跳过', () => {
    const list = resolveWorkspaceList(COMPOSE_DEFAULT_WORKSPACES, [custom('substation', '变电站'), custom('page', '冒充内建')])
    expect(list.map((workspace) => workspace.id)).toEqual(['page', 'drawing', 'substation'])
    expect(isInjectedWorkspace(COMPOSE_DEFAULT_WORKSPACES, 'page')).toBe(true)
    expect(isInjectedWorkspace(COMPOSE_DEFAULT_WORKSPACES, 'substation')).toBe(false)
  })

  it('OpenSpec: editor-workspace-layout / 内建工作区 / 内建按界面语言取名，自定义用自己的', () => {
    const page = COMPOSE_DEFAULT_WORKSPACES[0]!
    expect(resolveWorkspaceTitle(page, 'zh-CN')).toBe('页面')
    expect(resolveWorkspaceTitle(page, 'en-US')).toBe('Page')
    expect(resolveWorkspaceTitle(custom('x', '变电站'), 'en-US')).toBe('变电站')
  })
  it('OpenSpec: editor-workspace-layout / 内建工作区 / 恰好两个，差别在面板、库与种子', () => {
    const [page, drawing] = COMPOSE_DEFAULT_WORKSPACES
    expect(COMPOSE_DEFAULT_WORKSPACES).toHaveLength(2)
    expect([page?.id, drawing?.id]).toEqual([COMPOSE_PAGE_WORKSPACE_ID, COMPOSE_DRAWING_WORKSPACE_ID])
    // 会话开关只有十字光标臂长不同，其余逐字相同。
    expect({ ...page!.session, crosshairSize: 0 }).toEqual({ ...drawing!.session, crosshairSize: 0 })
    expect([page!.session.crosshairSize, drawing!.session.crosshairSize]).toEqual([5, 100])
    // 新建种子在两处不同：网格步长，以及对齐吸附。
    expect([page!.seeds.grid.stepX, drawing!.seeds.grid.stepX]).toEqual([8, 10])
    // 网格吸附两边都开：关掉的是 Figma 式参考线那一层，不是整条吸附。徒手画的外框与分区框
    // 仍然要网格接着。
    expect([page!.seeds.grid.snapEnabled, drawing!.seeds.grid.snapEnabled]).toEqual([true, true])
    // 对齐吸附与特征点捕捉是姐妹查询，同时生效会在同一次取点里互相拉扯，因此绘图这一档关掉。
    expect(page!.seeds.smartSnap).toEqual({ nodes: true, guides: true })
    expect(drawing!.seeds.smartSnap).toEqual({ nodes: false, guides: false })
    // 布局是同一套四区：面板名与分组逐项相同，只有左栏权重不同（工具组拉高）。
    const preset = (workspace: typeof page) => (
      workspace!.layout.kind === 'preset' ? workspace!.layout : null
    )
    expect(preset(page)?.left).toEqual(preset(drawing)?.left)
    expect(preset(page)?.right).toEqual(preset(drawing)?.right)
    expect(preset(page)?.bottom).toEqual(preset(drawing)?.bottom)
    expect(preset(drawing)?.leftWeights?.[1]).toBeGreaterThan(preset(page)?.leftWeights?.[1] ?? 0.4)
  })

  it('OpenSpec: editor-workspace-layout / 内建工作区 / 两份货架', () => {
    const [page, drawing] = COMPOSE_DEFAULT_WORKSPACES
    // 页面：基础组件 + 全部项目组件平铺，不带搜索。
    expect(page!.palette?.search ?? false).toBe(false)
    expect(page!.palette?.sections.map((section) => section.kind)).toEqual(['presets', 'folder'])
    // 绘图：Symbols 按子文件夹分组打头、基础组件折叠收底，带搜索。
    expect(drawing!.palette?.search).toBe(true)
    const [symbols, , basics] = drawing!.palette!.sections
    expect(symbols).toMatchObject({ kind: 'folder', folderPath: ['Symbols'], groupBy: 'subfolder' })
    expect(basics).toMatchObject({ kind: 'presets', collapsed: true })
  })

  it('OpenSpec: editor-workspace-layout / 内建工作区 / 物料面板标题按界面语言', () => {
    const [page, drawing] = COMPOSE_DEFAULT_WORKSPACES
    expect(resolveWorkspacePaletteTitle(drawing!, 'zh-CN', '基础组件')).toBe('符号库')
    expect(resolveWorkspacePaletteTitle(drawing!, 'en-US', 'Components')).toBe('Symbols')
    // 页面那份货架不写标题：用调用方给的回退，也就是面板本来的名字。
    expect(resolveWorkspacePaletteTitle(page!, 'zh-CN', '基础组件')).toBe('基础组件')
  })
})