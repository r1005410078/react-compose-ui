import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComposeEditorController } from '../editor-controller'
import type { ComposeWorkspaceDocumentSession } from '../workspace-layout'
import { useComponentEntry, type UseComponentEntryInput } from './use-component-entry'

afterEach(cleanup)

const PROVIDER = 'demo'
const CANVAS = 'compose-canvas'
const PAGE = 'page-a'

/** 一个能被 `readComposeComponentInstance` 读出来的最小实例 Entity。 */
function instanceEntity(id: string, assetKey: string) {
  return {
    id,
    components: {
      Renderer: {
        type: 'component-instance',
        props: {
          reference: { kind: 'component', providerId: PROVIDER, assetKey, scope: 'persistent' },
          resolvedSnapshot: { document: { entities: {} }, appliedLineage: [] },
          instanceOverrides: { operations: [] },
        },
      },
    },
  }
}

const panelIdOf = (_providerId: string, assetKey: string) => `component:${assetKey}`

/**
 * 一台受控的会话替身：`documents` 是可变的一份，`openComponentDocument` 往里加、
 * `closeDocument` 从里删，`hasDocument` 读的因此始终是最新的一份——与宿主用 ref 读它同构。
 */
function harness(options: {
  readonly entities: Readonly<Record<string, unknown>>
  readonly open?: readonly string[]
  readonly dirty?: readonly string[]
} = { entities: {} }) {
  const documents = new Map<string, ComposeWorkspaceDocumentSession>()
  for (const panelId of options.open ?? []) {
    documents.set(panelId, { kind: 'component', panelId } as unknown as ComposeWorkspaceDocumentSession)
  }
  const dirty = new Set(options.dirty ?? [])
  const closed: string[] = []
  const opened: string[] = []
  let active: string | null = PAGE
  documents.set(PAGE, { kind: 'page', panelId: PAGE } as unknown as ComposeWorkspaceDocumentSession)

  const controller = {
    document: { entities: options.entities },
    runtime: {},
    expandedIds: [],
    setSelectedIds: vi.fn(),
    setExpandedIds: vi.fn(),
  } as unknown as ComposeEditorController

  const input = (): UseComponentEntryInput => ({
    activeDocumentPanelId: active,
    controller,
    documents,
    fixedCanvasPanelId: CANVAS,
    components: undefined,
    store: {
      providerId: PROVIDER,
      readComponent: async (assetKey: string) => ({
        entryId: `entry:${assetKey}`,
        revision: 'r1',
        asset: { name: assetKey, componentId: assetKey, kind: 'base' as const },
      }),
      createReference: (assetKey: string) => ({
        kind: 'component', providerId: PROVIDER, assetKey, scope: 'persistent',
      }) as never,
    },
    createPanelId: panelIdOf,
    openComponentDocument: async (descriptor) => {
      const panelId = panelIdOf(PROVIDER, descriptor.assetKey)
      opened.push(panelId)
      if (!documents.has(panelId)) {
        documents.set(panelId, { kind: 'component', panelId } as unknown as ComposeWorkspaceDocumentSession)
      }
      active = panelId
    },
    hasDocument: (panelId: string) => documents.has(panelId),
    isDocumentDirty: (panelId: string) => dirty.has(panelId),
    closeDocument: (panelId: string) => {
      closed.push(panelId)
      documents.delete(panelId)
      if (active === panelId) active = PAGE
    },
    setActiveDocumentPanelId: (panelId: string) => { active = panelId },
    onError: vi.fn(),
  })

  const view = renderHook((props: UseComponentEntryInput) => useComponentEntry(props), {
    initialProps: input(),
  })
  return {
    closed,
    documents,
    opened,
    session: () => view.result.current,
    /** 把替身里已经变过的活动文档与文档表重新喂回去，模拟宿主的下一次渲染。 */
    sync: () => { view.rerender(input()) },
    /** 宿主自己切了活动文档（点标签、关文档），不经过本 Hook。 */
    activate(panelId: string) {
      active = panelId
      this.sync()
    },
    /** 宿主自己开了一份新文档。 */
    openTab(panelId: string) {
      documents.set(
        panelId,
        { kind: 'page', panelId } as unknown as ComposeWorkspaceDocumentSession,
      )
      this.sync()
    },
    async enter(entityId: string) {
      await act(async () => { await view.result.current.enter(entityId) })
      this.sync()
    },
    /** 同一拍里连发两次，中间不渲染——连点进入按钮时就是这样。 */
    async enterTwice(entityId: string) {
      await act(async () => {
        const first = view.result.current.enter(entityId)
        const second = view.result.current.enter(entityId)
        await Promise.all([first, second])
      })
      this.sync()
    },
    exit() {
      act(() => { view.result.current.exit() })
      this.sync()
    },
  }
}

describe('useComponentEntry', () => {
  it('OpenSpec: editor-workspace-layout / 场景树进入组件与返回 / 干净地返回即丢弃', async () => {
    const app = harness({ entities: { 'inst-1': instanceEntity('inst-1', 'breaker') } })
    await app.enter('inst-1')

    // 进入压的是一层：它是会话但不是标签，标签条要把它剔除掉。
    expect(app.session().canExit).toBe(true)
    expect(app.session().layerPanelIds).toEqual(['component:breaker'])
    expect(app.session().originPanelId).toBe(PAGE)

    app.exit()
    expect(app.closed).toEqual(['component:breaker'])
    expect(app.session().canExit).toBe(false)
    expect(app.session().layerPanelIds).toEqual([])
    expect(app.session().originPanelId).toBeNull()
  })

  it('OpenSpec: editor-workspace-layout / 场景树进入组件与返回 / 带着未保存修改返回', async () => {
    const app = harness({
      entities: { 'inst-1': instanceEntity('inst-1', 'breaker') },
      dirty: ['component:breaker'],
    })
    await app.enter('inst-1')
    app.exit()

    // 未保存的修改必须在屏幕上有一个家：层不再压着，它就回到标签条。
    expect(app.closed).toEqual([])
    expect(app.documents.has('component:breaker')).toBe(true)
    expect(app.session().layerPanelIds).toEqual([])
  })

  it('OpenSpec: editor-workspace-layout / 场景树进入组件与返回 / 进入已经打开的组件', async () => {
    const app = harness({
      entities: { 'inst-1': instanceEntity('inst-1', 'breaker') },
      open: ['component:breaker'],
    })
    await app.enter('inst-1')

    // 复用那份会话而不是新建，它在层存续期间从标签条让位。
    expect(app.documents.size).toBe(2)
    expect(app.session().layerPanelIds).toEqual(['component:breaker'])

    app.exit()
    // 进入只是临时借用了它的呈现，不该顺手把用户自己打开的那份文件关掉。
    expect(app.closed).toEqual([])
    expect(app.documents.has('component:breaker')).toBe(true)
  })

  it('OpenSpec: editor-workspace-layout / 场景树进入组件与返回 / 连点两下只进一层', async () => {
    const app = harness({ entities: { 'inst-1': instanceEntity('inst-1', 'breaker') } })
    // 两次 enter 之间不重新渲染：这正是连点进入按钮时发生的事。
    await app.enterTwice('inst-1')

    expect(app.opened).toEqual(['component:breaker'])
    expect(app.session().layerPanelIds).toEqual(['component:breaker'])

    /*
     * 第二次若真的跑起来，它看到目标已经被第一次打开了，会把这一层记成「进入前就存在」，
     * 返回时那份会话就被留成一条谁也没要过的标签。
     */
    app.exit()
    expect(app.closed).toEqual(['component:breaker'])
  })

  it('OpenSpec: editor-workspace-layout / 场景树进入组件与返回 / 回到栈中已有的那一层', async () => {
    const app = harness({
      entities: {
        'inst-1': instanceEntity('inst-1', 'breaker'),
        'inst-2': instanceEntity('inst-2', 'coil'),
      },
    })
    await app.enter('inst-1')
    await app.enter('inst-2')
    expect(app.session().layerPanelIds).toEqual(['component:breaker', 'component:coil'])

    // 从 coil 里进入 breaker：同一份会话在栈里出现两次，返回就会走进一个绕不出去的圈。
    await app.enter('inst-1')
    expect(app.session().layerPanelIds).toEqual(['component:breaker'])
    expect(app.closed).toEqual(['component:coil'])
    expect(app.opened.filter((id) => id === 'component:breaker')).toHaveLength(1)
  })

  it('OpenSpec: editor-workspace-layout / 场景树进入组件与返回 / 切到栈外的文档丢弃来路', async () => {
    const app = harness({ entities: { 'inst-1': instanceEntity('inst-1', 'breaker') } })
    await app.enter('inst-1')
    expect(app.session().canExit).toBe(true)

    // 来路必须描述当前屏幕上这棵树，否则根行会给出一个通往别处的返回控件。
    app.openTab('page-b')
    app.activate('page-b')
    expect(app.session().canExit).toBe(false)
    expect(app.session().layerPanelIds).toEqual([])
    expect(app.session().originPanelId).toBeNull()
  })

  it('OpenSpec: editor-workspace-layout / 场景树进入组件与返回 / 来路那份文档被关闭', async () => {
    const app = harness({ entities: { 'inst-1': instanceEntity('inst-1', 'breaker') } })
    await app.enter('inst-1')

    // 来路那条页面被关掉：栈截断到仍然存在的最长前缀，不足两段即退无可退。
    app.documents.delete(PAGE)
    app.sync()
    expect(app.session().canExit).toBe(false)
    expect(app.session().layerPanelIds).toEqual([])
  })
})
