import {
  ComposeAssetError,
  type ComposeAssetProvider,
} from '@compose-ui/assets'
import {
  createComposeFrameEntity,
  createDefaultComposeLayoutItem,
  createEmptyComposePageFile,
  serializeComposePageFile,
} from '@compose-ui/core'
import { describe, expect, it, vi } from 'vitest'
import { createComposePageStore } from './page-store'
import { createFakeAssetProvider } from './test-fixtures'

const pageText = () => serializeComposePageFile(createEmptyComposePageFile())

/**
 * 一份含单个最小合法 Entity 的页面文档。
 *
 * @remarks
 * Store 的写入路径会重新解析文档，因此测试夹具必须能通过 `validateComposeDocument`：
 * Entity 至少需要 Composition、Transform、Visibility、Lock，并拥有 Renderer 或 Hierarchy。
 */
const ROOT_FRAME_ID = 'frame-root'

/** v7 的顶层 Entity 是根 Frame 的子级。 */
const rootChildIds = (document: { entities: Record<string, { components: Record<string, unknown> }> }) =>
  (document.entities[ROOT_FRAME_ID]?.components.Hierarchy as { childIds?: readonly string[] } | undefined)?.childIds ?? []

const pageWithEntity = (entityId: string) => ({
  ...createEmptyComposePageFile().document,
  rootIds: [ROOT_FRAME_ID],
  entities: {
    [ROOT_FRAME_ID]: createComposeFrameEntity({ id: ROOT_FRAME_ID, childIds: [entityId] }),
    [entityId]: {
      id: entityId,
      name: entityId,
      components: {
        Composition: { presetId: null, baseComponentKeys: [], capabilityIds: [] },
        Transform: { rotation: 0 },
        LayoutItem: createDefaultComposeLayoutItem(10, 10),
        Visibility: { visible: true },
        Lock: { locked: false },
        Hierarchy: { childIds: [] },
      },
    },
  },
})

const defaultFiles = () => ({
  'Pages/Home.page.json': pageText(),
  'Pages/Detail.page.json': pageText(),
  'Pages/nested/Deep.page.json': pageText(),
  'Images/logo.svg': '<svg />',
  'script.ts': 'export const a = 1',
})

describe('OpenSpec: pages / 页面目录列举', () => {
  it('递归列举且只保留页面文件', async () => {
    const fake = createFakeAssetProvider({ files: defaultFiles() })
    const store = createComposePageStore({ provider: fake.provider })
    const catalog = await store.listPages()
    expect(catalog.pages.map((page) => page.pageKey)).toEqual([
      'Pages/Detail.page.json',
      'Pages/Home.page.json',
      'Pages/nested/Deep.page.json',
    ])
    expect(catalog.pages[0]?.displayName).toBe('Detail')
    expect(catalog.pages[0]?.entryId).toBe('Pages/Detail.page.json')
  })

  it('跳过缺少 assetKey 的页面文件', async () => {
    const fake = createFakeAssetProvider({ files: { 'A.page.json': pageText() } })
    const provider: ComposeAssetProvider = {
      ...fake.provider,
      async list(listInput) {
        const entries = await fake.provider.list(listInput)
        return entries.map((entry) => ({ ...entry, assetKey: undefined }))
      },
    }
    const store = createComposePageStore({ provider })
    expect((await store.listPages()).pages).toEqual([])
  })

  it('合并同一时刻的重复列举为一轮 Provider 列举', async () => {
    const fake = createFakeAssetProvider({ files: defaultFiles() })
    const store = createComposePageStore({ provider: fake.provider })
    const [first, second] = await Promise.all([store.listPages(), store.listPages()])
    expect(first).toBe(second)
    const afterFirst = fake.calls.list
    await store.listPages()
    // 第二轮命中缓存，不再访问 Provider。
    expect(fake.calls.list).toBe(afterFirst)
  })

  it('已中止的信号使列举以取消结束', async () => {
    const fake = createFakeAssetProvider({ files: defaultFiles() })
    const store = createComposePageStore({ provider: fake.provider })
    const controller = new AbortController()
    controller.abort()
    await expect(store.listPages(controller.signal)).rejects.toThrow(ComposeAssetError)
  })
})

describe('OpenSpec: pages / 页面文档读写与乐观并发', () => {
  it('读取页面并在重复读取时命中缓存', async () => {
    const fake = createFakeAssetProvider({ files: defaultFiles() })
    const store = createComposePageStore({ provider: fake.provider })
    const snapshot = await store.readPage('Pages/Home.page.json')
    expect(snapshot.page.document.schemaVersion).toBe(7)
    expect(snapshot.page.setupScript).toBeNull()
    const reads = fake.calls.read
    await store.readPage('Pages/Home.page.json')
    expect(fake.calls.read).toBe(reads)
  })

  it('合并同一页面的并发读取', async () => {
    const fake = createFakeAssetProvider({ files: defaultFiles() })
    const store = createComposePageStore({ provider: fake.provider })
    const [a, b] = await Promise.all([
      store.readPage('Pages/Home.page.json'),
      store.readPage('Pages/Home.page.json'),
    ])
    expect(a).toBe(b)
  })

  it('取消一个并发消费者不会中止同页面的其他消费者', async () => {
    const fake = createFakeAssetProvider({ files: defaultFiles() })
    let finishRead: (() => void) | undefined
    const provider: ComposeAssetProvider = {
      ...fake.provider,
      read(input) {
        return new Promise((resolve, reject) => {
          input.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          }, { once: true })
          finishRead = () => { void fake.provider.read(input).then(resolve, reject) }
        })
      },
    }
    const store = createComposePageStore({ provider })
    // 预热目录缓存，确保本场景只验证页面正文读取的取消隔离。
    await store.listPages()
    const firstController = new AbortController()
    const first = store.readPage('Pages/Home.page.json', firstController.signal)

    await vi.waitFor(() => { expect(finishRead).toBeDefined() })
    const firstCancelled = expect(first).rejects.toMatchObject({ code: 'io' })
    firstController.abort()
    // StrictMode 的 cleanup → setup 发生在同一轮调用栈：新消费者会在延迟中止底层请求的
    // microtask 前接管原请求。
    const secondController = new AbortController()
    const second = store.readPage('Pages/Home.page.json', secondController.signal)

    await firstCancelled
    finishRead?.()
    await expect(second).resolves.toMatchObject({ page: { document: { schemaVersion: 7 } } })
    expect(fake.calls.read).toBe(1)
  })

  it('页面不存在时抛出 not-found', async () => {
    const fake = createFakeAssetProvider({ files: defaultFiles() })
    const store = createComposePageStore({ provider: fake.provider })
    await expect(store.readPage('Pages/Missing.page.json')).rejects.toMatchObject({
      code: 'not-found',
    })
  })

  it('页面内容不合法时抛出而不返回半个文档', async () => {
    const fake = createFakeAssetProvider({ files: { 'A.page.json': '{ broken' } })
    const store = createComposePageStore({ provider: fake.provider })
    await expect(store.readPage('A.page.json')).rejects.toMatchObject({ code: 'io' })
  })

  it('写入成功后持久化并更新缓存', async () => {
    const fake = createFakeAssetProvider({ files: defaultFiles() })
    const store = createComposePageStore({ provider: fake.provider })
    const snapshot = await store.readPage('Pages/Home.page.json')
    await store.writePageDocument('Pages/Home.page.json', pageWithEntity('a'), snapshot.revision)
    expect(fake.getFile('Pages/Home.page.json')).toContain('"rootIds"')
    store.invalidate('Pages/Home.page.json')
    expect(rootChildIds((await store.readPage('Pages/Home.page.json')).page.document))
      .toEqual(['a'])
  })

  it('期望 revision 过期时抛出 conflict 且不修改文件', async () => {
    const fake = createFakeAssetProvider({ files: defaultFiles() })
    const store = createComposePageStore({ provider: fake.provider })
    const before = fake.getFile('Pages/Home.page.json')
    await expect(store.writePageDocument(
      'Pages/Home.page.json',
      createEmptyComposePageFile().document,
      'stale-revision',
    )).rejects.toMatchObject({ code: 'conflict' })
    expect(fake.getFile('Pages/Home.page.json')).toBe(before)
  })

  it('强制覆盖在收到冲突后写入成功', async () => {
    const fake = createFakeAssetProvider({ files: defaultFiles(), conflictOnce: true })
    const store = createComposePageStore({ provider: fake.provider })
    await expect(store.writePage(
      'Pages/Home.page.json',
      createEmptyComposePageFile(),
      '1',
    )).rejects.toMatchObject({ code: 'conflict' })
    const written = await store.writePage(
      'Pages/Home.page.json',
      { ...createEmptyComposePageFile(), document: pageWithEntity('forced') },
      '1',
      true,
    )
    expect(rootChildIds(written.page.document))
      .toEqual(['forced'])
    expect(fake.getFile('Pages/Home.page.json')).toContain('forced')
  })

  it('Provider 不支持写入时抛出 unsupported', async () => {
    const fake = createFakeAssetProvider({ files: defaultFiles(), omit: ['writeFile'] })
    const store = createComposePageStore({ provider: fake.provider })
    await expect(store.writePage(
      'Pages/Home.page.json',
      createEmptyComposePageFile(),
    )).rejects.toMatchObject({ code: 'unsupported' })
  })

  it('创建页面写入空白文档并进入目录', async () => {
    const fake = createFakeAssetProvider({ files: defaultFiles() })
    const store = createComposePageStore({ provider: fake.provider })
    await store.listPages()
    const created = await store.createPage({ parentId: 'Pages', fileName: 'New.page.json' })
    expect(created.pageKey).toBe('Pages/New.page.json')
    const catalog = await store.listPages()
    expect(catalog.pages.map((page) => page.pageKey)).toContain('Pages/New.page.json')
    expect(rootChildIds((await store.readPage('Pages/New.page.json')).page.document)).toEqual([])
  })

  it('外部变更通知失效缓存并广播', async () => {
    const fake = createFakeAssetProvider({ files: defaultFiles() })
    const store = createComposePageStore({ provider: fake.provider })
    await store.readPage('Pages/Home.page.json')
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    fake.setFile('Pages/Home.page.json', serializeComposePageFile({
      ...createEmptyComposePageFile(),
      document: pageWithEntity('external'),
    }))
    fake.notify()
    expect(listener).toHaveBeenCalledWith({ type: 'page-changed', pageKey: 'Pages/Home.page.json' })
    expect(rootChildIds((await store.readPage('Pages/Home.page.json')).page.document))
      .toEqual(['external'])
    unsubscribe()
    fake.notify()
    expect(listener).toHaveBeenCalledTimes(3)
  })
})

describe('OpenSpec: pages / 页面 setup 关联写入', () => {
  it('关联、保存文档与解除 setup 时保持页面聚合字段', async () => {
    const fake = createFakeAssetProvider({ files: defaultFiles() })
    const store = createComposePageStore({ provider: fake.provider })
    const first = await store.readPage('Pages/Home.page.json')
    const setupScript = {
      providerId: fake.provider.id,
      assetKey: 'scripts/Home.setup.js',
      scope: 'persistent' as const,
    }

    const linked = await store.setPageSetupScript(
      'Pages/Home.page.json',
      setupScript,
      first.revision,
    )
    expect(linked.page.setupScript).toEqual(setupScript)

    const saved = await store.writePageDocument(
      'Pages/Home.page.json',
      pageWithEntity('keeps-setup'),
      linked.revision,
    )
    expect(saved.page.setupScript).toEqual(setupScript)
    expect(rootChildIds(saved.page.document))
      .toEqual(['keeps-setup'])

    const unlinked = await store.setPageSetupScript(
      'Pages/Home.page.json',
      null,
      saved.revision,
    )
    expect(unlinked.page.setupScript).toBeNull()
    expect(rootChildIds(unlinked.page.document))
      .toEqual(['keeps-setup'])
    expect(fake.getFile('scripts/Home.setup.js')).toBeUndefined()
  })

  it('setup 关联使用页面 revision 做乐观并发', async () => {
    const fake = createFakeAssetProvider({ files: defaultFiles() })
    const store = createComposePageStore({ provider: fake.provider })
    const before = fake.getFile('Pages/Home.page.json')
    await expect(store.setPageSetupScript(
      'Pages/Home.page.json',
      { providerId: fake.provider.id, assetKey: 'Home.setup.js', scope: 'persistent' },
      'stale-revision',
    )).rejects.toMatchObject({ code: 'conflict' })
    expect(fake.getFile('Pages/Home.page.json')).toBe(before)
  })
})

describe('OpenSpec: pages / 页面动画关联写入', () => {
  it('OpenSpec: pages / 页面默认 Frame 与 Frame 级动画绑定 / 按 Frame 绑定动画', async () => {
    const fake = createFakeAssetProvider({ files: defaultFiles() })
    const store = createComposePageStore({ provider: fake.provider })
    const first = await store.readPage('Pages/Home.page.json')
    const frameId = first.page.document.rootIds[0]!
    const animation = {
      providerId: fake.provider.id,
      assetKey: 'Pages/Home.animation.json',
      scope: 'persistent' as const,
    }

    const readSource = (page: typeof first.page, id: string) =>
      (page.document.entities[id]?.components.Animations as { source?: unknown } | undefined)?.source

    const linked = await store.setFrameAnimation(
      'Pages/Home.page.json',
      frameId,
      animation,
      first.revision,
    )
    expect(readSource(linked.page, frameId)).toEqual(animation)

    const unlinked = await store.setFrameAnimation(
      'Pages/Home.page.json',
      frameId,
      null,
      linked.revision,
    )
    expect(readSource(unlinked.page, frameId)).toBeUndefined()
  })

  it('动画关联使用页面 revision 做乐观并发', async () => {
    const fake = createFakeAssetProvider({ files: defaultFiles() })
    const store = createComposePageStore({ provider: fake.provider })
    const before = fake.getFile('Pages/Home.page.json')
    const frameId = (await store.readPage('Pages/Home.page.json')).page.document.rootIds[0]!
    await expect(store.setFrameAnimation(
      'Pages/Home.page.json',
      frameId,
      { providerId: fake.provider.id, assetKey: 'Home.animation.json', scope: 'persistent' },
      'stale-revision',
    )).rejects.toMatchObject({ code: 'conflict' })
    expect(fake.getFile('Pages/Home.page.json')).toBe(before)
  })
})

describe('OpenSpec: pages / 首页设置与能力门禁', () => {
  it('清单缺失时不写入且首页为 null', async () => {
    const fake = createFakeAssetProvider({ files: defaultFiles() })
    const store = createComposePageStore({ provider: fake.provider })
    expect((await store.listPages()).homePageKey).toBeNull()
    expect(fake.getFile('app.json')).toBeUndefined()
  })

  it('首次设首页惰性创建清单', async () => {
    const fake = createFakeAssetProvider({ files: defaultFiles() })
    const store = createComposePageStore({ provider: fake.provider })
    const manifest = await store.setHomePage('Pages/Home.page.json')
    expect(manifest.homePageKey).toBe('Pages/Home.page.json')
    expect(fake.getFile('app.json')).toContain('Pages/Home.page.json')
    expect((await store.listPages()).homePageKey).toBe('Pages/Home.page.json')
  })

  it('清单已存在时改写首页并保留未知字段', async () => {
    const fake = createFakeAssetProvider({
      files: {
        ...defaultFiles(),
        'app.json': '{"schemaVersion":1,"homePageKey":"Pages/Home.page.json","theme":"dark"}',
      },
    })
    const store = createComposePageStore({ provider: fake.provider })
    await store.setHomePage('Pages/Detail.page.json')
    const written = fake.getFile('app.json') ?? ''
    expect(written).toContain('Pages/Detail.page.json')
    expect(written).toContain('"theme": "dark"')
  })

  it('清单写入冲突时重读并重试一次', async () => {
    const fake = createFakeAssetProvider({
      files: { ...defaultFiles(), 'app.json': '{"schemaVersion":1,"homePageKey":null}' },
      conflictOnce: true,
    })
    const store = createComposePageStore({ provider: fake.provider })
    const manifest = await store.setHomePage('Pages/Home.page.json')
    expect(manifest.homePageKey).toBe('Pages/Home.page.json')
    expect(fake.calls.write).toBe(2)
  })

  it('设首页幂等时不产生写入', async () => {
    const fake = createFakeAssetProvider({
      files: { ...defaultFiles(), 'app.json': '{"schemaVersion":1,"homePageKey":"Pages/Home.page.json"}' },
    })
    const store = createComposePageStore({ provider: fake.provider })
    await store.setHomePage('Pages/Home.page.json')
    expect(fake.calls.write).toBe(0)
  })

  it('清单损坏时降级为无首页并暴露 issue', async () => {
    const fake = createFakeAssetProvider({
      files: { ...defaultFiles(), 'app.json': '{ broken' },
    })
    const store = createComposePageStore({ provider: fake.provider })
    const catalog = await store.listPages()
    expect(catalog.homePageKey).toBeNull()
    expect(catalog.manifestIssues.map((issue) => issue.code)).toEqual(['invalid-json'])
  })

  it('首页 key 悬空时报告缺失但不改写清单', async () => {
    const fake = createFakeAssetProvider({
      files: { ...defaultFiles(), 'app.json': '{"schemaVersion":1,"homePageKey":"Pages/Gone.page.json"}' },
    })
    const store = createComposePageStore({ provider: fake.provider })
    const catalog = await store.listPages()
    expect(catalog.homePageKey).toBe('Pages/Gone.page.json')
    expect(catalog.homePageMissing).toBe(true)
    expect(fake.getFile('app.json')).toContain('Pages/Gone.page.json')
  })

  it('只读 Provider 报告首页不可设置但仍可读取既有首页', async () => {
    const fake = createFakeAssetProvider({
      files: { ...defaultFiles(), 'app.json': '{"schemaVersion":1,"homePageKey":"Pages/Home.page.json"}' },
      omit: ['writeFile', 'createFile'],
    })
    const store = createComposePageStore({ provider: fake.provider })
    expect(store.canWriteManifest()).toBe(false)
    expect((await store.listPages()).homePageKey).toBe('Pages/Home.page.json')
    await expect(store.setHomePage('Pages/Detail.page.json')).rejects.toMatchObject({
      code: 'unsupported',
    })
  })
})

describe('OpenSpec: pages / 页面激活 Frame 与 Frame 级动画绑定', () => {
  it('设置激活 Frame 并拒绝非根 Frame', async () => {
    const fake = createFakeAssetProvider({ files: defaultFiles() })
    const store = createComposePageStore({ provider: fake.provider })
    const current = await store.readPage('Pages/Home.page.json')
    const frameId = current.page.document.rootIds[0]!
    const written = await store.setPageActiveFrame('Pages/Home.page.json', frameId)
    expect(written.page.activeFrameId).toBe(frameId)
    await expect(store.setPageActiveFrame('Pages/Home.page.json', 'missing'))
      .rejects.toThrow(/不是根 Frame/)
  })

  it('删掉激活场景后写入不会写出打不开的页面', async () => {
    const fake = createFakeAssetProvider({ files: defaultFiles() })
    const store = createComposePageStore({ provider: fake.provider })
    const current = await store.readPage('Pages/Home.page.json')
    const oldFrameId = current.page.document.rootIds[0]!
    await store.setPageActiveFrame('Pages/Home.page.json', oldFrameId)

    // 用户删掉了激活场景、换成另一块，再保存。若不对账就会写出悬空 activeFrameId，
    // 而解析侧对悬空 id 直接报错——页面从此打不开。
    const replacement = createComposeFrameEntity({ id: 'frame-next', name: '场景 2' })
    const written = await store.writePageDocument('Pages/Home.page.json', {
      ...current.page.document,
      rootIds: ['frame-next'],
      entities: { 'frame-next': replacement },
    })
    expect(written.page.activeFrameId).toBe('frame-next')

    // 关键断言：写出去的文本必须能被重新解析。
    const reread = await store.readPage('Pages/Home.page.json')
    expect(reread.page.activeFrameId).toBe('frame-next')
  })
})
