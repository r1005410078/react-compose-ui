import {
  ComposeAssetError,
  validateAssetName,
} from '@compose-ui/assets'
import {
  COMPOSE_PAGE_MEDIA_TYPE,
  createDefaultComposeLayoutItem,
  createEmptyComposeAppManifest,
  createComposeFrameEntity,
  createEmptyComposePageDocument,
  createEmptyComposePageFile,
  serializeComposeAppManifest,
  serializeComposePageFile,
} from '@compose-ui/core'
import type {
  ComposeAssetEntry,
  ComposeAssetProvider,
} from '@compose-ui/assets'
import type { ComposeDocument } from '@compose-ui/core'

interface MemoryAsset {
  entry: ComposeAssetEntry
  content?: Blob
}

interface DemoPageSeed {
  readonly id: string
  readonly name: string
  readonly document: ComposeDocument
}

/** 示例应用用于演示 revision 冲突与离线快照的可控 Provider。 */
export interface DemoAssetProvider extends ComposeAssetProvider {
  readonly demo: {
    /** 仅推进指定资源的 revision，模拟另一个客户端已保存源文件。 */
    bumpRevision(assetKey: string): void
    /** 切换资源 I/O；订阅仍保持可用，以便界面观察离线状态。 */
    setOffline(offline: boolean): void
  }
}

const root: ComposeAssetEntry = {
  id: 'demo-assets',
  parentId: null,
  name: 'Demo Assets',
  kind: 'folder',
}

function revision(value: number) {
  return `demo-r${value}`
}

function createDemoBitmap() {
  const width = 256
  const height = 128
  const pixelOffset = 54
  const bytes = new Uint8Array(pixelOffset + width * height * 3)
  const view = new DataView(bytes.buffer)
  bytes.set([0x42, 0x4d])
  view.setUint32(2, bytes.length, true)
  view.setUint32(10, pixelOffset, true)
  view.setUint32(14, 40, true)
  view.setInt32(18, width, true)
  view.setInt32(22, height, true)
  view.setUint16(26, 1, true)
  view.setUint16(28, 24, true)
  for (let offset = pixelOffset; offset < bytes.length; offset += 3) {
    // BMP 使用 BGR；示例蓝色与 Stage accent 保持一致。
    bytes[offset] = 232
    bytes[offset + 1] = 120
    bytes[offset + 2] = 40
  }
  return new Blob([bytes], { type: 'image/bmp' })
}

const demoCounterDocument: ComposeDocument = {
  ...createEmptyComposePageDocument(),
  rootIds: ['frame-root'],
  entities: {
    // v7 的文档根只接受 Frame；示例内容挂在这块画板下。
    'frame-root': createComposeFrameEntity({
      id: 'frame-root',
      name: '画板',
      childIds: ['demo-counter-value', 'demo-counter-button'],
    }),
    'demo-counter-value': {
      id: 'demo-counter-value',
      name: 'Counter value',
      components: {
        Composition: { presetId: 'text', baseComponentKeys: [], capabilityIds: [] },
        Transform: { rotation: 0 },
        LayoutItem: createDefaultComposeLayoutItem(280, 72, { x: 80, y: 80 }),
        Visibility: { visible: true },
        Lock: { locked: false },
        Renderer: { type: 'text', props: { text: 0, color: '#dce8fa', fontSize: 42 } },
        Bindings: {
          version: 1,
          rendererProps: {
            fields: { text: { scope: 'page', exportName: 'num' } },
          },
        },
      },
    },
    'demo-counter-button': {
      id: 'demo-counter-button',
      name: 'Add button',
      components: {
        Composition: { presetId: 'action-button', baseComponentKeys: [], capabilityIds: [] },
        Transform: { rotation: 0 },
        LayoutItem: createDefaultComposeLayoutItem(160, 52, { x: 80, y: 180 }),
        Visibility: { visible: true },
        Lock: { locked: false },
        Renderer: { type: 'action-button', props: { label: 'Add' } },
        Bindings: {
          version: 1,
          rendererProps: {
            fields: {
              label: { scope: 'page', exportName: 'buttonLabel' },
              onClick: { scope: 'page', exportName: 'onAdd' },
            },
          },
        },
      },
    },
  },
}
// Home 页挂同一份 setup：动画播放控制示例需要页面导出（animate 布尔）可绑定。
const demoHomePageText = serializeComposePageFile({
  ...createEmptyComposePageFile(),
  setupScript: {
    providerId: 'demo-memory',
    assetKey: 'demo-home-setup',
    scope: 'persistent',
  },
})
const demoAppManifestText = serializeComposeAppManifest({
  ...createEmptyComposeAppManifest(),
  // 示例工作区需要一个确定首页，Home 不能只是孤立的页面资源。
  homePageKey: 'demo-home-page',
})
const demoCounterPageText = serializeComposePageFile({
  ...createEmptyComposePageFile(),
  document: demoCounterDocument,
  setupScript: {
    providerId: 'demo-memory',
    assetKey: 'demo-home-setup',
    scope: 'persistent',
  },
})

/**
 * 示例应用的实例级内存 Provider，只用于展示资源协议，不属于公共持久化实现。
 */
export function createDemoAssetProvider(options: {
  readonly pages?: readonly DemoPageSeed[]
} = {}): DemoAssetProvider {
  let revisionNumber = 1
  let offline = false
  const listeners = new Set<() => void>()
  const assets = new Map<string, MemoryAsset>([
    [root.id, { entry: root }],
    ['demo-images', {
      entry: {
        id: 'demo-images',
        parentId: root.id,
        name: 'Images',
        kind: 'folder',
      },
    }],
    ['compose-logo', {
      entry: {
        id: 'compose-logo',
        parentId: 'demo-images',
        name: 'compose-grid.svg',
        kind: 'file',
        mediaType: 'image/svg+xml',
        size: 604,
        revision: revision(revisionNumber),
        assetKey: 'compose-logo',
      },
      content: new Blob([
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">'
        + '<defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#2878e8"/>'
        + '<stop offset="1" stop-color="#70a7ff"/></linearGradient></defs>'
        + '<rect width="640" height="360" rx="24" fill="#121820"/>'
        + '<path d="M0 72h640M0 144h640M0 216h640M0 288h640M128 0v360M256 0v360M384 0v360M512 0v360" stroke="#344151"/>'
        + '<rect x="176" y="92" width="288" height="176" rx="12" fill="url(#g)"/>'
        + '<text x="320" y="190" text-anchor="middle" fill="white" font-family="system-ui" font-size="34">Compose UI</text>'
        + '</svg>',
      ], { type: 'image/svg+xml' }),
    }],
    ['dashboard-image', {
      entry: {
        id: 'dashboard-image',
        parentId: 'demo-images',
        name: 'dashboard.bmp',
        kind: 'file',
        mediaType: 'image/bmp',
        size: 98_358,
        revision: revision(revisionNumber),
        assetKey: 'dashboard-image',
      },
      content: createDemoBitmap(),
    }],
    ['dashboard-script', {
      entry: {
        id: 'dashboard-script',
        parentId: root.id,
        name: 'dashboard.ts',
        kind: 'file',
        mediaType: 'text/typescript',
        size: 118,
        revision: revision(revisionNumber),
        assetKey: 'dashboard-script',
      },
      content: new Blob([
        "export const dashboard = {\n  title: 'Operations overview',\n  refreshInterval: 30,\n  theme: 'dark',\n}\n",
      ], { type: 'text/typescript' }),
    }],
    ['demo-pages', {
      entry: {
        id: 'demo-pages',
        parentId: root.id,
        name: 'Pages',
        kind: 'folder',
      },
    }],
    ['demo-app-manifest', {
      entry: {
        id: 'demo-app-manifest',
        parentId: root.id,
        name: 'app.json',
        kind: 'file',
        mediaType: 'application/json',
        size: demoAppManifestText.length,
        revision: revision(revisionNumber),
        assetKey: 'demo-app-manifest',
      },
      content: new Blob([demoAppManifestText], { type: 'application/json' }),
    }],
    ['demo-home-page', {
      entry: {
        id: 'demo-home-page',
        parentId: 'demo-pages',
        name: 'Home.page.json',
        kind: 'file',
        // 页面文件必须上报页面媒体类型，宿主据此在不读内容的前提下识别页面。
        mediaType: COMPOSE_PAGE_MEDIA_TYPE,
        size: demoHomePageText.length,
        revision: revision(revisionNumber),
        assetKey: 'demo-home-page',
      },
      content: new Blob([demoHomePageText], { type: COMPOSE_PAGE_MEDIA_TYPE }),
    }],
    ['demo-counter-page', {
      entry: {
        id: 'demo-counter-page',
        parentId: 'demo-pages',
        name: 'Counter.page.json',
        kind: 'file',
        mediaType: COMPOSE_PAGE_MEDIA_TYPE,
        size: demoCounterPageText.length,
        revision: revision(revisionNumber),
        assetKey: 'demo-counter-page',
      },
      content: new Blob([demoCounterPageText], { type: COMPOSE_PAGE_MEDIA_TYPE }),
    }],
    ['demo-home-setup', {
      entry: {
        id: 'demo-home-setup',
        parentId: 'demo-pages',
        name: 'Counter.setup.js',
        kind: 'file',
        mediaType: 'text/javascript',
        revision: revision(revisionNumber),
        assetKey: 'demo-home-setup',
      },
      content: new Blob([`export function setup(ctx) {
  const num = ctx.state(0)
  const onAdd = () => { num.value += 1 }
  const buttonLabel = ctx.computed(() => num.value === 0 ? 'Add' : \`Add \${num.value}\`)
  // 动画播放控制示例：把 animate 绑定到动画检查器的"播放"，预览中即自动播放；
  // onToggleAnimate 可绑到按钮，false -> true 的上升沿会让动画从头重播。
  const animate = ctx.state(true)
  const onToggleAnimate = () => { animate.value = !animate.value }
  return { num, onAdd, buttonLabel, animate, onToggleAnimate }
}
`], { type: 'text/javascript' }),
    }],
    ['readme', {
      entry: {
        id: 'readme',
        parentId: root.id,
        name: 'README.md',
        kind: 'file',
        mediaType: 'text/markdown',
        size: 80,
        revision: revision(revisionNumber),
        assetKey: 'readme',
      },
      content: new Blob(['# Demo assets\n\nFiles are stored by an in-memory ComposeAssetProvider.\n']),
    }],
  ])

  options.pages?.forEach((page) => {
    const text = serializeComposePageFile({ ...createEmptyComposePageFile(), document: page.document })
    assets.set(page.id, {
      entry: {
        id: page.id,
        parentId: 'demo-pages',
        name: page.name,
        kind: 'file',
        mediaType: COMPOSE_PAGE_MEDIA_TYPE,
        size: text.length,
        revision: revision(revisionNumber),
        assetKey: page.id,
      },
      content: new Blob([text], { type: COMPOSE_PAGE_MEDIA_TYPE }),
    })
  })

  const notify = () => {
    for (const listener of listeners) listener()
  }
  const assertOnline = () => {
    if (offline) throw new ComposeAssetError('io', 'Demo Asset Provider is offline')
  }
  const requireEntry = (id: string) => {
    const asset = assets.get(id)
    if (!asset) throw new ComposeAssetError('not-found', `Unknown asset ${id}`)
    return asset
  }
  const assertUnique = (parentId: string, name: string, exceptId?: string) => {
    if ([...assets.values()].some((asset) => (
      asset.entry.id !== exceptId
      && asset.entry.parentId === parentId
      && asset.entry.name === name
    ))) throw new ComposeAssetError('conflict', `Asset "${name}" already exists`)
  }

  return {
    id: 'demo-memory',
    label: 'Demo Assets',
    root,
    capabilities: {
      createFile: true,
      createFolder: true,
      rename: true,
      move: true,
      delete: true,
      write: true,
      reference: true,
    },
    referenceScope: 'persistent',
    demo: {
      bumpRevision(assetKey) {
        const asset = [...assets.values()].find(
          (candidate) => candidate.entry.assetKey === assetKey,
        )
        if (!asset) throw new ComposeAssetError('not-found', `Unknown asset key ${assetKey}`)
        revisionNumber += 1
        asset.entry = { ...asset.entry, revision: revision(revisionNumber) }
        notify()
      },
      setOffline(value) {
        if (offline === value) return
        offline = value
        notify()
      },
    },
    async list({ folderId, signal }) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      assertOnline()
      return [...assets.values()]
        .map((asset) => asset.entry)
        .filter((entry) => entry.parentId === folderId)
    },
    async read({ fileId, signal }) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      assertOnline()
      const asset = requireEntry(fileId)
      if (!asset.content) throw new ComposeAssetError('unsupported', 'Cannot read a folder')
      return {
        blob: asset.content,
        revision: asset.entry.revision ?? revision(revisionNumber),
      }
    },
    async resolveAsset({ assetKey, signal }) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      assertOnline()
      const asset = [...assets.values()].find(
        (candidate) => candidate.entry.assetKey === assetKey,
      )
      if (!asset?.content) {
        throw new ComposeAssetError('not-found', `Unknown asset key ${assetKey}`)
      }
      return {
        blob: asset.content,
        revision: asset.entry.revision ?? revision(revisionNumber),
        mediaType: asset.entry.mediaType ?? asset.content.type,
      }
    },
    async createFolder({ parentId, name }) {
      assertOnline()
      const normalized = validateAssetName(name)
      assertUnique(parentId, normalized)
      const id = `folder-${crypto.randomUUID()}`
      const entry: ComposeAssetEntry = {
        id,
        parentId,
        name: normalized,
        kind: 'folder',
      }
      assets.set(id, { entry })
      notify()
      return entry
    },
    async createFile({ parentId, name, content }) {
      assertOnline()
      const normalized = validateAssetName(name)
      assertUnique(parentId, normalized)
      revisionNumber += 1
      const id = `file-${crypto.randomUUID()}`
      const entry: ComposeAssetEntry = {
        id,
        parentId,
        name: normalized,
        kind: 'file',
        mediaType: content.type || undefined,
        size: content.size,
        revision: revision(revisionNumber),
        assetKey: id,
      }
      assets.set(id, { entry, content })
      notify()
      return entry
    },
    async renameEntry({ entryId, name }) {
      assertOnline()
      const asset = requireEntry(entryId)
      const normalized = validateAssetName(name)
      assertUnique(asset.entry.parentId ?? root.id, normalized, entryId)
      asset.entry = { ...asset.entry, name: normalized }
      notify()
      return asset.entry
    },
    async moveEntry({ entryId, parentId }) {
      assertOnline()
      const asset = requireEntry(entryId)
      assertUnique(parentId, asset.entry.name, entryId)
      asset.entry = { ...asset.entry, parentId }
      notify()
      return asset.entry
    },
    async deleteEntry({ entryId, recursive }) {
      assertOnline()
      const descendants = [...assets.values()]
        .filter((asset) => asset.entry.parentId === entryId)
      if (descendants.length > 0 && !recursive) {
        throw new ComposeAssetError('io', 'Folder is not empty')
      }
      const remove = (id: string) => {
        for (const child of [...assets.values()].filter((asset) => asset.entry.parentId === id)) {
          remove(child.entry.id)
        }
        assets.delete(id)
      }
      remove(entryId)
      notify()
    },
    async writeFile({ fileId, content, expectedRevision, force }) {
      assertOnline()
      const asset = requireEntry(fileId)
      if (!force && asset.entry.revision !== expectedRevision) {
        throw new ComposeAssetError('conflict', 'Asset revision changed')
      }
      revisionNumber += 1
      asset.content = content
      asset.entry = {
        ...asset.entry,
        size: content.size,
        revision: revision(revisionNumber),
      }
      notify()
      return asset.entry
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
