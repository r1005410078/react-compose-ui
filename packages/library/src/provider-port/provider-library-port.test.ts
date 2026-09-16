import { describe, expect, it } from 'vitest'
import { COMPOSE_LIBRARY_FILE_NAME, serializeComposeLibraryFile } from './library-file'
import { createProviderLibraryPort } from './provider-library-port'
import { createMemoryProvider } from './test-provider'

function setup(options?: { readonly now?: () => number }) {
  const memory = createMemoryProvider()
  const port = createProviderLibraryPort({
    provider: memory.provider,
    listPages: memory.listPages,
    ...(options?.now === undefined ? {} : { now: options.now }),
  })
  return { memory, port }
}

describe('createProviderLibraryPort', () => {
  it('OpenSpec: page-library / 无后端时的 Provider 实现 / 手动放进目录的页面', async () => {
    const { memory, port } = setup()
    memory.seedPage('一次接线图.page.json')

    // 库文件里一条记录都没有——手动放进目录的页面照样要出现，否则一份合法的页面文件会在
    // 首页上凭空消失。
    const { items } = await port.query({})
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      title: '一次接线图',
      kind: 'project',
      categories: [],
      useCount: 0,
      deletedAt: null,
    })
  })

  it('OpenSpec: page-library / 库记录的性质与删除状态正交 / 删掉一个模板再恢复', async () => {
    const { memory, port } = setup()
    const entry = memory.seedPage('PCS 模板.page.json')
    const pageKey = entry.assetKey as string
    await port.update?.({ pageKey, kind: 'template' })

    await port.trash?.({ pageKeys: [pageKey] })
    const trashed = await port.query({ deleted: true })
    expect(trashed.items.map((item) => item.pageKey)).toEqual([pageKey])
    // 软删除不动页面文件：条目还在，内容一个字节没变。
    expect(memory.has(entry.id)).toBe(true)

    await port.restore?.({ pageKeys: [pageKey] })
    const restored = await port.get({ pageKey })
    expect(restored.kind).toBe('template')
    expect(restored.deletedAt).toBeNull()
  })

  it('OpenSpec: page-library / 一次查询回答整屏 / 选中一个场景类型之后左栏仍可切换', async () => {
    const { memory, port } = setup()
    const pcs = memory.seedPage('PCS 详情.page.json')
    const wiring = memory.seedPage('一次接线图.page.json')
    memory.seedPage('未归类.page.json')
    await port.update?.({ pageKey: pcs.assetKey as string, categories: ['pcs'] })
    await port.update?.({ pageKey: wiring.assetKey as string, categories: ['wiring'] })

    const result = await port.query({ categories: ['pcs'] })
    expect(result.items.map((item) => item.title)).toEqual(['PCS 详情'])
    // 关键：facet 求的时候把 categories 这一项条件摘掉了，否则其余每一类都是 0，
    // 左栏再也切不出去。
    const facet = new Map(result.facets.byCategory.map((item) => [item.category, item.count]))
    expect(facet.get('pcs')).toBe(1)
    expect(facet.get('wiring')).toBe(1)
    expect(facet.get(null)).toBe(1)
  })

  it('OpenSpec: page-library / 一次查询回答整屏 / 搜索时三个去处的计数跟着变', async () => {
    const { memory, port } = setup()
    const a = memory.seedPage('PCS 详情.page.json')
    const b = memory.seedPage('PCS 模板.page.json')
    const c = memory.seedPage('暖通.page.json')
    await port.update?.({ pageKey: b.assetKey as string, kind: 'template' })
    await port.trash?.({ pageKeys: [c.assetKey as string] })

    const { facets } = await port.query({ kind: 'project', search: 'PCS' })
    // byLocation 只受 search 影响：kind 正是要切的那件东西，让它参与会让「模板」恒为 0。
    expect(facets.byLocation).toEqual({ project: 1, template: 1, trash: 0 })
    expect(a.assetKey).toBeDefined()

    const all = await port.query({})
    expect(all.facets.byLocation).toEqual({ project: 1, template: 1, trash: 1 })
  })

  it('OpenSpec: page-library / 新建与复制由端口一次完成 / 从模板新建', async () => {
    const { memory, port } = setup()
    const source = memory.seedPage('PCS 标准画法.page.json', '{"schemaVersion":3}')
    const sourceKey = source.assetKey as string
    await port.update?.({ pageKey: sourceKey, kind: 'template', categories: ['pcs'] })

    const created = await port.instantiate?.({ sourcePageKey: sourceKey, title: '南山储能 PCS' })

    // 默认 project 而不是继承来源：按下那一下的意思是拿模板做一张要交付的图。
    expect(created?.kind).toBe('project')
    expect(created?.categories).toEqual(['pcs'])
    expect(created?.useCount).toBe(0)

    const after = await port.get({ pageKey: sourceKey })
    expect(after.useCount).toBe(1)
    expect(after.kind).toBe('template')
    // 来源内容一个字节都没变。
    expect(memory.textOf(source.id)).toBe('{"schemaVersion":3}')
  })

  it('复制出来的是一份独立文件，改新的不影响来源', async () => {
    const { memory, port } = setup()
    const source = memory.seedPage('底稿.page.json', '{"a":1}')
    const created = await port.instantiate?.({
      sourcePageKey: source.assetKey as string,
      title: '副本',
    })
    expect(created?.pageKey).not.toBe(source.assetKey)
    const { items } = await port.query({})
    expect(items).toHaveLength(2)
  })

  it('游标分页不漏不重', async () => {
    const { memory, port } = setup()
    for (let index = 0; index < 7; index += 1) memory.seedPage(`图 ${index}.page.json`)

    const seen: string[] = []
    let cursor: string | undefined
    for (let page = 0; page < 5; page += 1) {
      const result = await port.query({ limit: 3, cursor, sort: 'title-asc' })
      seen.push(...result.items.map((item) => item.pageKey))
      if (result.nextCursor === null) break
      cursor = result.nextCursor
    }
    expect(seen).toHaveLength(7)
    expect(new Set(seen).size).toBe(7)
  })

  it('只看未分类', async () => {
    const { memory, port } = setup()
    const tagged = memory.seedPage('带标签.page.json')
    memory.seedPage('没标签.page.json')
    await port.update?.({ pageKey: tagged.assetKey as string, categories: ['pcs'] })

    const { items } = await port.query({ categories: [null] })
    expect(items.map((item) => item.title)).toEqual(['没标签'])
  })

  it('彻底删除把文件一起删掉', async () => {
    const { memory, port } = setup()
    const entry = memory.seedPage('要删的.page.json')
    await port.purge?.({ pageKeys: [entry.assetKey as string] })
    expect(memory.has(entry.id)).toBe(false)
    const { items } = await port.query({})
    expect(items).toHaveLength(0)
  })

  it('改名不改 pageKey', async () => {
    const { memory, port } = setup()
    const entry = memory.seedPage('旧名.page.json')
    const pageKey = entry.assetKey as string
    const renamed = await port.update?.({ pageKey, title: '新名' })
    // 身份不是路径：标题住文件名上，而引用它的每一个实例读的是 assetKey。
    expect(renamed?.pageKey).toBe(pageKey)
    expect(renamed?.title).toBe('新名')
  })

  it('坏掉的库文件退化成空库而不是让首页打不开', async () => {
    const { memory, port } = setup()
    memory.seedFile(COMPOSE_LIBRARY_FILE_NAME, '{ 这不是 JSON')
    memory.seedPage('还在的图.page.json')
    const { items } = await port.query({})
    expect(items).toHaveLength(1)
  })

  it('最近打开不含回收站里的', async () => {
    const { memory, port } = setup()
    const a = memory.seedPage('甲.page.json')
    const b = memory.seedPage('乙.page.json')
    await port.recordOpen?.({ pageKey: a.assetKey as string })
    await port.recordOpen?.({ pageKey: b.assetKey as string })
    await port.trash?.({ pageKeys: [b.assetKey as string] })

    const recents = await port.listRecents?.({})
    expect(recents?.map((item) => item.title)).toEqual(['甲'])
  })

  it('缩略图：没有就是 null，不是失败', async () => {
    const { memory, port } = setup()
    const entry = memory.seedPage('图.page.json')
    const pageKey = entry.assetKey as string
    expect(await port.readThumbnail?.({ pageKey })).toBeNull()

    await port.putThumbnail?.({ pageKey, image: new Blob(['png-bytes']) })
    const read = await port.readThumbnail?.({ pageKey })
    expect(await read?.blob.text()).toBe('png-bytes')
  })

  it('已有库文件里的标签清单决定左栏顺序', async () => {
    const { memory, port } = setup()
    memory.seedFile(COMPOSE_LIBRARY_FILE_NAME, serializeComposeLibraryFile({
      version: 1,
      categories: [
        { id: 'overview', label: '总览大屏', builtIn: true },
        { id: 'pcs', label: 'PCS' },
      ],
      records: {},
    }))
    const categories = await port.listCategories()
    expect(categories.map((category) => category.id)).toEqual(['overview', 'pcs'])
    expect(categories[0].label).toBe('总览大屏')
  })
})
