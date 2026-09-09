import type {
  ComposeAssetCapabilities,
  ComposeAssetEntry,
  ComposeAssetProvider,
} from '@compose-ui/assets'
import { ComposeAssetError } from '@compose-ui/assets'
import {
  type ComposeEntity,
  COMPOSE_COMPONENT_MEDIA_TYPE,
  createComposeGroupEntitySeed,
  serializeComposeComponentAsset,
  type ComposeBaseComponentAsset,
} from '@compose-ui/core'
import { describe, expect, it, vi } from 'vitest'
import * as libraryApi from '../index'

interface StoreApi {
  readonly createComposeComponentStore?: (input: { readonly provider: ComposeAssetProvider }) => {
    listComponents(signal?: AbortSignal): Promise<{
      readonly components: readonly {
        readonly assetKey: string
        readonly kind: string
        readonly folderPath: readonly string[]
      }[]
      readonly folders: readonly (readonly string[])[]
    }>
    readComponent(assetKey: string): Promise<{ readonly asset: { readonly kind: string }; readonly revision: string }>
    createComponent(input: {
      readonly parentId: string | null
      readonly fileName: string
      readonly asset: ReturnType<typeof baseAsset>
    }): Promise<{ readonly assetKey: string }>
    saveComponent(assetKey: string, asset: ReturnType<typeof baseAsset>, expectedRevision: string): Promise<unknown>
    invalidate(assetKey?: string): void
    subscribe(listener: (event: unknown) => void): () => void
  }
}

const api = libraryApi as unknown as StoreApi

/** 给组件根就地加上 Frame Component：组件文档的单根必须是 Frame。 */
function withFrame(entity: ComposeEntity, width: number, height: number): ComposeEntity {
  return {
    ...entity,
    components: {
      ...entity.components,
      Frame: { size: { width, height }, guides: [] },
    },
  }
}

function document(): ComposeBaseComponentAsset['document'] {
  const root = createComposeGroupEntitySeed({ id: 'root' })
  return {
    schemaVersion: 7 as const,
    canvas: {
      grid: { stepX: 8, stepY: 8, offsetX: 0, offsetY: 0, primaryLineEvery: 5, snapEnabled: true },
      smartSnap: { nodes: true, guides: true },
    },
    // 组件文档的单根必须是 Frame；这里给既有根就地加上 Frame Component。
    rootIds: ['root'],
    entities: { root: withFrame(root, 100, 100) },
  }
}

function baseAsset(id = 'button'): ComposeBaseComponentAsset {
  return { schemaVersion: 2, kind: 'base', componentId: id, name: id, document: document() }
}

function fakeProvider() {
  const files = new Map<string, { text: string; revision: number }>([
    ['Components/Button.component.json', { text: serializeComposeComponentAsset(baseAsset()), revision: 1 }],
  ])
  const listeners = new Set<() => void>()
  const calls = { list: 0, read: 0 }
  const capabilities: ComposeAssetCapabilities = {
    createFile: true,
    createFolder: false,
    rename: false,
    move: false,
    delete: false,
    write: true,
    reference: true,
  }
  const entry = (key: string): ComposeAssetEntry => ({
    id: key,
    parentId: key.includes('/') ? key.slice(0, key.lastIndexOf('/')) : 'root',
    name: key.slice(key.lastIndexOf('/') + 1),
    kind: 'file',
    mediaType: COMPOSE_COMPONENT_MEDIA_TYPE,
    assetKey: key,
    revision: String(files.get(key)?.revision ?? 1),
  })
  const provider: ComposeAssetProvider = {
    id: 'project',
    label: 'Project',
    root: { id: 'root', parentId: null, name: 'Project', kind: 'folder' },
    capabilities,
    referenceScope: 'persistent',
    async list({ folderId }) {
      calls.list += 1
      if (folderId === 'root') return [{ id: 'Components', parentId: 'root', name: 'Components', kind: 'folder' }]
      return [...files.keys()].filter((key) => key.startsWith(`${folderId}/`)).map(entry)
    },
    async read({ fileId }) {
      calls.read += 1
      const value = files.get(fileId)
      if (!value) throw new ComposeAssetError('not-found', fileId)
      return { blob: new Blob([value.text], { type: COMPOSE_COMPONENT_MEDIA_TYPE }), revision: String(value.revision) }
    },
    async createFile({ parentId, name, content }) {
      const key = `${parentId}/${name}`
      if (files.has(key)) throw new ComposeAssetError('conflict', key)
      files.set(key, { text: await content.text(), revision: 1 })
      return entry(key)
    },
    async writeFile({ fileId, content, expectedRevision, force }) {
      const value = files.get(fileId)
      if (!value) throw new ComposeAssetError('not-found', fileId)
      if (!force && expectedRevision !== String(value.revision)) throw new ComposeAssetError('conflict', fileId)
      value.text = await content.text()
      value.revision += 1
      return entry(fileId)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
  return { provider, files, calls, notify: () => listeners.forEach((listener) => { listener() }) }
}

describe('ComposeComponentStore', () => {
  it('OpenSpec: component-library / 项目组件 Store / 列举并订阅项目组件', async () => {
    expect(api.createComposeComponentStore).toBeTypeOf('function')
    const fake = fakeProvider()
    const store = api.createComposeComponentStore!({ provider: fake.provider })
    const first = await store.listComponents()
    expect(first.components).toEqual([expect.objectContaining({
      assetKey: 'Components/Button.component.json',
      kind: 'base',
    })])
    const calls = fake.calls.list
    await store.listComponents()
    expect(fake.calls.list).toBe(calls)
    const listener = vi.fn()
    store.subscribe(listener)
    fake.notify()
    expect(listener).toHaveBeenCalledWith({ type: 'catalog-changed' })
  })

  it('目录顺序按显示名稳定，与 assetKey 生成顺序无关', async () => {
    // assetKey 通常含随机段（如 uuid），若按它排序，同一批组件每个会话顺序都会跳。
    const fake = fakeProvider()
    const texts: Record<string, string> = {
      f1: serializeComposeComponentAsset(baseAsset('beta')),
      f2: serializeComposeComponentAsset(baseAsset('alpha')),
    }
    const provider: ComposeAssetProvider = {
      ...fake.provider,
      async list({ folderId }) {
        if (folderId !== 'root') return []
        return [
          {
            id: 'f1',
            parentId: 'root',
            name: 'Beta.component.json',
            kind: 'file',
            mediaType: COMPOSE_COMPONENT_MEDIA_TYPE,
            assetKey: 'asset-aaa',
            revision: '1',
          },
          {
            id: 'f2',
            parentId: 'root',
            name: 'Alpha.component.json',
            kind: 'file',
            mediaType: COMPOSE_COMPONENT_MEDIA_TYPE,
            assetKey: 'asset-zzz',
            revision: '1',
          },
        ]
      },
      async read({ fileId }) {
        const text = texts[fileId]
        if (!text) throw new ComposeAssetError('not-found', fileId)
        return { blob: new Blob([text], { type: COMPOSE_COMPONENT_MEDIA_TYPE }), revision: '1' }
      },
    }
    const store = api.createComposeComponentStore!({ provider })
    const catalog = await store.listComponents()
    // Alpha（assetKey 靠后）必须排在 Beta（assetKey 靠前）之前。
    expect(catalog.components.map((component) => component.assetKey))
      .toEqual(['asset-zzz', 'asset-aaa'])
  })

  it('OpenSpec: component-library / 项目组件 Store / 保存 revision 冲突', async () => {
    const fake = fakeProvider()
    const store = api.createComposeComponentStore!({ provider: fake.provider })
    const snapshot = await store.readComponent('Components/Button.component.json')
    expect(snapshot.revision).toBe('1')
    await expect(store.saveComponent(
      'Components/Button.component.json',
      baseAsset('changed'),
      'stale',
    )).rejects.toMatchObject({ code: 'conflict' })
  })

  it('创建组件拒绝覆盖并返回稳定 assetKey', async () => {
    const fake = fakeProvider()
    const store = api.createComposeComponentStore!({ provider: fake.provider })
    await expect(store.createComponent({
      parentId: 'Components',
      fileName: 'Button.component.json',
      asset: baseAsset(),
    })).rejects.toMatchObject({ code: 'conflict' })
    await expect(store.createComponent({
      parentId: 'Components',
      fileName: 'Card.component.json',
      asset: baseAsset('card'),
    })).resolves.toMatchObject({ assetKey: 'Components/Card.component.json' })
  })

  it('OpenSpec: component-library / 项目组件 Store / 丢弃失效的迟到目录结果', async () => {
    const fake = fakeProvider()
    const originalList = fake.provider.list.bind(fake.provider)
    let releaseFirst!: () => void
    let markFirstStarted!: () => void
    const firstStarted = new Promise<void>((resolve) => { markFirstStarted = resolve })
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve })
    let holdFirstComponentsList = true
    vi.spyOn(fake.provider, 'list').mockImplementation(async (input) => {
      const result = await originalList(input)
      if (input.folderId === 'Components' && holdFirstComponentsList) {
        holdFirstComponentsList = false
        markFirstStarted()
        await firstGate
      }
      return result
    })
    const store = api.createComposeComponentStore!({ provider: fake.provider })
    const staleRequest = store.listComponents()
    await firstStarted
    fake.files.set('Components/Card.component.json', {
      text: serializeComposeComponentAsset(baseAsset('card')),
      revision: 1,
    })
    fake.notify()
    const fresh = await store.listComponents()
    expect(fresh.components).toHaveLength(2)
    releaseFirst()
    await expect(staleRequest).resolves.toMatchObject({ components: [{ kind: 'base' }] })
    await expect(store.listComponents()).resolves.toMatchObject({
      components: [{ kind: 'base' }, { kind: 'base' }],
    })
  })

  it('第一个调用方取消不牵连共用同一次列举的第二个', async () => {
    /*
     * React StrictMode 的挂载→清理→再挂载：第一次挂载在清理时 abort，第二次挂载几乎同时再问
     * 一次。共享的那次列举若绑在第一个调用方的 signal 上，第二次拿到的就是同一个注定以
     * 「操作已取消」失败的 promise，而它自己的 signal 还活着——错误于是被当成真的读取失败显示
     * 出来，目录整个退化成空。端到端跑生产构建，StrictMode 双调用在那里不发生，只有这条挡得住。
     */
    const fake = fakeProvider()
    const originalList = fake.provider.list.bind(fake.provider)
    let release!: () => void
    let markStarted!: () => void
    const started = new Promise<void>((resolve) => { markStarted = resolve })
    const gate = new Promise<void>((resolve) => { release = resolve })
    let hold = true
    vi.spyOn(fake.provider, 'list').mockImplementation(async (input) => {
      const result = await originalList(input)
      if (input.folderId === 'Components' && hold) {
        hold = false
        markStarted()
        await gate
      }
      return result
    })
    const store = api.createComposeComponentStore!({ provider: fake.provider })
    const first = new AbortController()
    const firstRequest = store.listComponents(first.signal)
    await started
    const secondRequest = store.listComponents(new AbortController().signal)
    first.abort('strict-mode cleanup')
    release()

    // 取消的那个仍然按取消失败——取消是调用方自己的事。
    await expect(firstRequest).rejects.toMatchObject({ code: 'io' })
    await expect(secondRequest).resolves.toMatchObject({ components: [{ kind: 'base' }] })
  })

  it('OpenSpec: component-library / 项目组件 Store / 在 Provider 调用前响应取消', async () => {
    const fake = fakeProvider()
    const store = api.createComposeComponentStore!({ provider: fake.provider })
    const abort = new AbortController()
    abort.abort('cancelled')
    await expect(store.listComponents(abort.signal)).rejects.toMatchObject({ code: 'io' })
    expect(fake.calls.list).toBe(0)
  })
  it('OpenSpec: component-library / 混合组件目录 / 描述符带上文件夹路径', async () => {
    // 两层树：根 / Symbols / {Switchgear（有一个组件）, Signs（空）}。
    const tree: Record<string, ComposeAssetEntry[]> = {
      root: [{ id: 'Symbols', parentId: 'root', name: 'Symbols', kind: 'folder' }],
      Symbols: [
        { id: 'Symbols/Switchgear', parentId: 'Symbols', name: 'Switchgear', kind: 'folder' },
        { id: 'Symbols/Signs', parentId: 'Symbols', name: 'Signs', kind: 'folder' },
        {
          id: 'Symbols/Note.component.json',
          parentId: 'Symbols',
          name: 'Note.component.json',
          kind: 'file',
          mediaType: COMPOSE_COMPONENT_MEDIA_TYPE,
          assetKey: 'Symbols/Note.component.json',
          revision: '1',
        },
      ],
      'Symbols/Switchgear': [{
        id: 'Symbols/Switchgear/Breaker.component.json',
        parentId: 'Symbols/Switchgear',
        name: 'Breaker.component.json',
        kind: 'file',
        mediaType: COMPOSE_COMPONENT_MEDIA_TYPE,
        assetKey: 'Symbols/Switchgear/Breaker.component.json',
        revision: '1',
      }],
      'Symbols/Signs': [],
    }
    const provider: ComposeAssetProvider = {
      id: 'project',
      label: 'Project',
      root: { id: 'root', parentId: null, name: 'Project', kind: 'folder' },
      capabilities: {
        createFile: false,
        createFolder: false,
        rename: false,
        move: false,
        delete: false,
        write: false,
        reference: true,
      },
      referenceScope: 'persistent',
      async list({ folderId }) { return tree[folderId] ?? [] },
      async read() {
        return {
          blob: new Blob([serializeComposeComponentAsset(baseAsset())], { type: COMPOSE_COMPONENT_MEDIA_TYPE }),
          revision: '1',
        }
      },
    }
    const store = api.createComposeComponentStore!({ provider })
    const catalog = await store.listComponents()
    expect(catalog.components.map((component) => component.folderPath)).toEqual([
      ['Symbols', 'Switchgear'],
      ['Symbols'],
    ])
    // 空文件夹也要列出来：货架靠它区分「这个分类是空的」与「这个分类没了」。
    expect(catalog.folders).toEqual(expect.arrayContaining([
      ['Symbols'],
      ['Symbols', 'Switchgear'],
      ['Symbols', 'Signs'],
    ]))
  })
})