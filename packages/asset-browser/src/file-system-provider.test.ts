import { describe, expect, it } from 'vitest'
import { ComposeAssetError } from '@compose-ui/assets'
import { createComposeFileSystemAssetProvider } from './index'

class FakeFileHandle {
  readonly kind = 'file' as const
  content: Blob
  lastModified = 1

  constructor(readonly name: string, content = new Blob([])) {
    this.content = content
  }

  async getFile() {
    return new File([this.content], this.name, {
      lastModified: this.lastModified,
      type: this.content.type,
    })
  }

  async createWritable() {
    return {
      write: async (content: FileSystemWriteChunkType) => {
        this.content = content instanceof Blob ? content : new Blob([String(content)])
      },
      close: async () => {
        this.lastModified += 1
      },
    } as FileSystemWritableFileStream
  }

  async isSameEntry(other: FileSystemHandle) {
    return other === this as unknown as FileSystemHandle
  }

  async queryPermission() {
    return 'granted' as PermissionState
  }

  async requestPermission() {
    return 'granted' as PermissionState
  }
}

class FakeDirectoryHandle {
  readonly kind = 'directory' as const
  readonly entriesMap = new Map<string, FakeDirectoryHandle | FakeFileHandle>()

  constructor(readonly name: string) {}

  async *entries() {
    for (const entry of this.entriesMap) {
      yield entry as [string, FileSystemHandle]
    }
  }

  async *keys() {
    yield* this.entriesMap.keys()
  }

  async *valuesIterator() {
    yield* this.entriesMap.values() as Iterable<FileSystemHandle>
  }

  values() {
    return this.valuesIterator()
  }

  async getDirectoryHandle(name: string, options?: FileSystemGetDirectoryOptions) {
    const existing = this.entriesMap.get(name)
    if (existing instanceof FakeDirectoryHandle) return existing
    if (existing) throw new DOMException('Wrong type', 'TypeMismatchError')
    if (!options?.create) throw new DOMException('Missing', 'NotFoundError')
    const created = new FakeDirectoryHandle(name)
    this.entriesMap.set(name, created)
    return created
  }

  async getFileHandle(name: string, options?: FileSystemGetFileOptions) {
    const existing = this.entriesMap.get(name)
    if (existing instanceof FakeFileHandle) return existing
    if (existing) throw new DOMException('Wrong type', 'TypeMismatchError')
    if (!options?.create) throw new DOMException('Missing', 'NotFoundError')
    const created = new FakeFileHandle(name)
    this.entriesMap.set(name, created)
    return created
  }

  async removeEntry(name: string, options?: FileSystemRemoveOptions) {
    const entry = this.entriesMap.get(name)
    if (!entry) throw new DOMException('Missing', 'NotFoundError')
    if (
      entry instanceof FakeDirectoryHandle
      && entry.entriesMap.size > 0
      && !options?.recursive
    ) throw new DOMException('Not empty', 'InvalidModificationError')
    this.entriesMap.delete(name)
  }

  async resolve() {
    return null
  }

  async isSameEntry(other: FileSystemHandle) {
    return other === this as unknown as FileSystemHandle
  }

  async queryPermission() {
    return 'granted' as PermissionState
  }

  async requestPermission() {
    return 'granted' as PermissionState
  }
}

function asDirectory(handle: FakeDirectoryHandle) {
  return handle as unknown as FileSystemDirectoryHandle
}

describe('File System Asset Provider', () => {
  it('OpenSpec: asset-browser / 本地目录 Provider / 读取、创建并拒绝同名覆盖', async () => {
    const root = new FakeDirectoryHandle('Assets')
    root.entriesMap.set('logo.svg', new FakeFileHandle('logo.svg', new Blob(['svg'])))
    const provider = createComposeFileSystemAssetProvider(asDirectory(root))
    const entries = await provider.list({ folderId: provider.root.id })
    expect(entries).toEqual([
      expect.objectContaining({ name: 'logo.svg', kind: 'file' }),
    ])
    await expect(provider.createFile?.({
      parentId: provider.root.id,
      name: 'logo.svg',
      content: new Blob(['replace']),
    })).rejects.toMatchObject({ code: 'conflict' })
    const created = await provider.createFolder?.({
      parentId: provider.root.id,
      name: 'Images',
    })
    expect(created).toMatchObject({ name: 'Images', kind: 'folder' })
  })

  it('OpenSpec: assets / 稳定资源引用与解析 / 本地句柄在会话内保持 assetKey', async () => {
    const root = new FakeDirectoryHandle('Assets')
    root.entriesMap.set(
      'logo.svg',
      new FakeFileHandle('logo.svg', new Blob(['<svg/>'], { type: 'image/svg+xml' })),
    )
    const provider = createComposeFileSystemAssetProvider(asDirectory(root))
    const first = await provider.list({ folderId: provider.root.id })
    const second = await provider.list({ folderId: provider.root.id })
    const assetKey = first[0]?.assetKey
    expect(provider.referenceScope).toBe('session')
    expect(provider.capabilities.reference).toBe(true)
    expect(assetKey).toBeTruthy()
    expect(second[0]?.assetKey).toBe(assetKey)
    await expect(provider.resolveAsset?.({ assetKey: assetKey ?? '' }))
      .resolves.toMatchObject({
        mediaType: 'image/svg+xml',
        revision: expect.any(String),
      })
  })

  it('OpenSpec: asset-browser / 本地目录 Provider / 使用 expectedRevision 防止丢失更新', async () => {
    const root = new FakeDirectoryHandle('Assets')
    const file = new FakeFileHandle('main.ts', new Blob(['old']))
    root.entriesMap.set(file.name, file)
    const provider = createComposeFileSystemAssetProvider(asDirectory(root))
    const [entry] = await provider.list({ folderId: provider.root.id })
    if (!entry) throw new Error('fixture')
    file.lastModified += 1
    await expect(provider.writeFile?.({
      fileId: entry.id,
      content: new Blob(['mine']),
      expectedRevision: entry.revision ?? '',
    })).rejects.toEqual(expect.objectContaining({ code: 'conflict' }))
    await expect(provider.writeFile?.({
      fileId: entry.id,
      content: new Blob(['mine']),
      expectedRevision: entry.revision ?? '',
      force: true,
    })).resolves.toEqual(expect.objectContaining({ revision: expect.any(String) }))
  })

  it('OpenSpec: asset-browser / 本地目录 Provider / 不模拟不稳定的 move 和 rename', async () => {
    const root = new FakeDirectoryHandle('Assets')
    root.entriesMap.set('main.ts', new FakeFileHandle('main.ts'))
    const provider = createComposeFileSystemAssetProvider(asDirectory(root))
    const [entry] = await provider.list({ folderId: provider.root.id })
    expect(provider.capabilities.move).toBe(false)
    await expect(provider.moveEntry?.({
      entryId: entry?.id ?? '',
      parentId: provider.root.id,
    })).rejects.toBeInstanceOf(ComposeAssetError)
  })
})
