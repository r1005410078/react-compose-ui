import { describe, expect, it, vi } from 'vitest'
import type { ComposeAssetProvider } from '@compose-ui/assets'
import type { ComposePageStore, CreateComposePageInput } from '@compose-ui/pages'
import { createPageContextMenuItems, PAGE_CONTEXT_MENU_ITEM_IDS } from './page-context-menu'
import { getEditorMessages } from '../editor-i18n'
import type { ComposeWorkspaceSeeds } from '../workspace-layout/workspace-definition'

const provider = {
  id: 'demo',
  root: { id: 'root', parentId: null, name: 'Demo', kind: 'folder' },
  capabilities: { createFile: true, write: true },
  createFile: vi.fn(),
  writeFile: vi.fn(),
} as unknown as ComposeAssetProvider

function harness(seeds: ComposeWorkspaceSeeds) {
  const created: CreateComposePageInput[] = []
  const store = {
    createPage: vi.fn(async (input: CreateComposePageInput) => {
      created.push(input)
      return {
        pageKey: 'k',
        entryId: 'e',
        fileName: input.fileName,
        displayName: '新页面',
        parentId: null,
        revision: '1',
      }
    }),
  } as unknown as ComposePageStore
  const items = createPageContextMenuItems({
    homePageKey: null,
    messages: getEditorMessages('zh-CN'),
    onHomePageChange: vi.fn(),
    onOpenPageJson: vi.fn(),
    onOpenPageSetup: vi.fn(),
    onPageCreated: vi.fn(),
    onPageSetupChanged: vi.fn(),
    onPageSetupError: vi.fn(),
    provider,
    resolveSeeds: () => seeds,
    store,
  })
  const create = items.find((item) => item.id === PAGE_CONTEXT_MENU_ITEM_IDS.createPage)!
  return { create, created }
}

/** 上下文菜单只用到 `promptName` 与 `parentId`；其余字段由资源浏览器给。 */
const context = {
  parentId: null,
  promptName: async () => '接线图',
  refresh: vi.fn(),
} as never

describe('新建文档种子', () => {
  it('OpenSpec: editor-workspace-layout / 新建文档种子 / 新页面的网格取当前工作区的种子', async () => {
    const { create, created } = harness({
      grid: { stepX: 10, stepY: 10, snapEnabled: true },
      smartSnap: { nodes: false, guides: false },
    })
    await create.onSelect?.(context)
    expect(created[0]?.page?.document.canvas.grid).toMatchObject({
      stepX: 10,
      stepY: 10,
      snapEnabled: true,
    })
    // 种子只管网格与对齐吸附：其余画布设置仍是空白页面的默认值。
    expect(created[0]?.page?.document.canvas.grid.primaryLineEvery).toBe(4)
  })

  it('OpenSpec: editor-workspace-layout / 新建文档种子 / 绘图里新建的页面不开对齐吸附', async () => {
    const { create, created } = harness({
      grid: { stepX: 10, stepY: 10, snapEnabled: true },
      smartSnap: { nodes: false, guides: false },
    })
    await create.onSelect?.(context)
    // 对齐吸附关、网格吸附照旧开：关掉的是 Figma 式参考线那一层，不是整条吸附。
    expect(created[0]?.page?.document.canvas.smartSnap).toEqual({ nodes: false, guides: false })
    expect(created[0]?.page?.document.canvas.grid.snapEnabled).toBe(true)
  })

  it('OpenSpec: editor-workspace-layout / 新建文档种子 / 页面工作区的对齐吸附仍是开的', async () => {
    const { create, created } = harness({
      grid: { stepX: 8, stepY: 8, snapEnabled: true },
      smartSnap: { nodes: true, guides: true },
    })
    await create.onSelect?.(context)
    expect(created[0]?.page?.document.canvas.smartSnap).toEqual({ nodes: true, guides: true })
  })

  it('OpenSpec: editor-workspace-layout / 新建文档种子 / 种子是每次读的，不是构造菜单时捕获的', async () => {
    let seeds: ComposeWorkspaceSeeds = {
      grid: { stepX: 8, stepY: 8, snapEnabled: true },
      smartSnap: { nodes: true, guides: true },
    }
    const created: CreateComposePageInput[] = []
    const store = {
      createPage: vi.fn(async (input: CreateComposePageInput) => {
        created.push(input)
        return { pageKey: 'k', entryId: 'e', fileName: input.fileName, displayName: 'x', parentId: null, revision: '1' }
      }),
    } as unknown as ComposePageStore
    const items = createPageContextMenuItems({
      homePageKey: null,
      messages: getEditorMessages('zh-CN'),
      onHomePageChange: vi.fn(),
      onOpenPageJson: vi.fn(),
      onOpenPageSetup: vi.fn(),
      onPageCreated: vi.fn(),
      onPageSetupChanged: vi.fn(),
      onPageSetupError: vi.fn(),
      provider,
      resolveSeeds: () => seeds,
      store,
    })
    const create = items.find((item) => item.id === PAGE_CONTEXT_MENU_ITEM_IDS.createPage)!
    await create.onSelect?.(context)
    // 换了工作区（菜单项没有重建）：下一次新建拿的是新的种子。
    seeds = {
      grid: { stepX: 10, stepY: 10, snapEnabled: true },
      smartSnap: { nodes: false, guides: false },
    }
    await create.onSelect?.(context)
    expect(created.map((input) => input.page?.document.canvas.grid.stepX)).toEqual([8, 10])
  })
})
