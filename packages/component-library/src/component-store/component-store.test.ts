import type {
  ComposeAssetCapabilities,
  ComposeAssetEntry,
  ComposeAssetProvider,
} from '@compose-ui/assets'
import { ComposeAssetError } from '@compose-ui/assets'
import {
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
      readonly components: readonly { readonly assetKey: string; readonly kind: string }[]
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

function document(): ComposeBaseComponentAsset['document'] {
  const root = createComposeGroupEntitySeed({ id: 'root' })
  return {
    schemaVersion: 6 as const,
    canvas: {
      grid: { stepX: 8, stepY: 8, offsetX: 0, offsetY: 0, primaryLineEvery: 5, snapEnabled: true },
      smartSnap: { nodes: true, guides: true },
      guides: [],
    },
    output: { width: 100, height: 100, backgroundPaint: { kind: 'solid', color: 'transparent' } },
    rootIds: ['root'],
    entities: { root },
  }
}

function baseAsset(id = 'button'): ComposeBaseComponentAsset {
  return { schemaVersion: 1, kind: 'base', componentId: id, name: id, document: document() }
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

  it('OpenSpec: component-library / 项目组件 Store / 在 Provider 调用前响应取消', async () => {
    const fake = fakeProvider()
    const store = api.createComposeComponentStore!({ provider: fake.provider })
    const abort = new AbortController()
    abort.abort('cancelled')
    await expect(store.listComponents(abort.signal)).rejects.toMatchObject({ code: 'io' })
    expect(fake.calls.list).toBe(0)
  })
})
