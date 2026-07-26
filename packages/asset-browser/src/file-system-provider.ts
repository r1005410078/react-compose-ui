import {
  ComposeAssetError,
  type ComposeAssetCapabilities,
  type ComposeAssetEntry,
  type ComposeAssetProvider,
} from '@compose-ui/assets'
import { normalizeComposeAssetError, validateAssetName } from '@compose-ui/assets'

interface FileSystemHandleWithMove extends FileSystemHandle {
  move(destination: FileSystemDirectoryHandle, name?: string): Promise<void>
}

interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker(options?: {
    readonly mode?: 'read' | 'readwrite'
  }): Promise<FileSystemDirectoryHandle>
}

interface StoredHandle {
  readonly handle: FileSystemHandle
  readonly parentId: string | null
}

function hasNativeMove(handle: FileSystemHandle): handle is FileSystemHandleWithMove {
  return typeof (handle as Partial<FileSystemHandleWithMove>).move === 'function'
}

function revisionOf(file: File) {
  return `${file.lastModified}:${file.size}`
}

async function assertUniqueName(directory: FileSystemDirectoryHandle, name: string) {
  for await (const existingName of directory.keys()) {
    if (existingName === name) {
      throw new ComposeAssetError('conflict', `An entry named "${name}" already exists`)
    }
  }
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('The operation was aborted', 'AbortError')
}

/**
 * 判断当前窗口是否提供 File System Access 目录选择。
 *
 * @public
 */
export function isFileSystemAssetProviderSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

/**
 * 通过用户手势打开可读写目录并创建 Provider。
 *
 * @throws `ComposeAssetError` 当浏览器不支持或用户拒绝权限。
 * @public
 */
export async function openFileSystemAssetProvider(): Promise<ComposeAssetProvider> {
  if (!isFileSystemAssetProviderSupported()) {
    throw new ComposeAssetError('unsupported', 'File System Access API is not supported')
  }
  try {
    const directory = await (window as unknown as WindowWithDirectoryPicker)
      .showDirectoryPicker({ mode: 'readwrite' })
    return createFileSystemAssetProvider(directory)
  } catch (error) {
    throw normalizeComposeAssetError(error)
  }
}

/**
 * 将浏览器目录句柄适配为 ComposeAssetProvider。
 *
 * @remarks
 * 原生 move/rename 仅在运行时句柄确实暴露 `move()` 时启用，不使用复制后删除模拟。
 *
 * @public
 */
export function createFileSystemAssetProvider(
  directoryHandle: FileSystemDirectoryHandle,
): ComposeAssetProvider {
  const providerId = `filesystem:${directoryHandle.name}`
  const rootId = `${providerId}:/`
  const handles = new Map<string, StoredHandle>([
    [rootId, { handle: directoryHandle, parentId: null }],
  ])
  const assetKeys = new WeakMap<FileSystemHandle, string>()
  const handlesByAssetKey = new Map<string, FileSystemFileHandle>()
  let nextAssetKey = 0
  const nativeMove = hasNativeMove(directoryHandle)
  const capabilities: ComposeAssetCapabilities = {
    createFile: true,
    createFolder: true,
    rename: nativeMove,
    move: nativeMove,
    delete: true,
    write: true,
    reference: true,
  }

  const getStored = (id: string) => {
    const stored = handles.get(id)
    if (!stored) throw new ComposeAssetError('not-found', `Unknown asset: ${id}`)
    return stored
  }
  const getDirectory = (id: string) => {
    const stored = getStored(id)
    if (stored.handle.kind !== 'directory') {
      throw new ComposeAssetError('unsupported', 'Target is not a directory')
    }
    return stored.handle as FileSystemDirectoryHandle
  }
  const entryId = (parentId: string, name: string) => (
    parentId.endsWith('/') ? `${parentId}${encodeURIComponent(name)}` : `${parentId}/${encodeURIComponent(name)}`
  )
  const toEntry = async (
    id: string,
    parentId: string,
    handle: FileSystemHandle,
  ): Promise<ComposeAssetEntry> => {
    handles.set(id, { handle, parentId })
    if (handle.kind === 'directory') {
      return {
        id,
        parentId,
        name: handle.name,
        kind: 'folder',
        capabilities: { move: hasNativeMove(handle), rename: hasNativeMove(handle) },
      }
    }
    const file = await (handle as FileSystemFileHandle).getFile()
    let assetKey = assetKeys.get(handle)
    if (!assetKey) {
      nextAssetKey += 1
      assetKey = `${providerId}:asset:${nextAssetKey}`
      assetKeys.set(handle, assetKey)
    }
    handlesByAssetKey.set(assetKey, handle as FileSystemFileHandle)
    return {
      id,
      parentId,
      name: handle.name,
      kind: 'file',
      mediaType: file.type || undefined,
      size: file.size,
      modifiedAt: file.lastModified,
      revision: revisionOf(file),
      assetKey,
      capabilities: { move: hasNativeMove(handle), rename: hasNativeMove(handle) },
    }
  }

  return {
    id: providerId,
    label: directoryHandle.name,
    root: {
      id: rootId,
      parentId: null,
      name: directoryHandle.name,
      kind: 'folder',
    },
    capabilities,
    referenceScope: 'session',
    async list({ folderId, signal }) {
      assertNotAborted(signal)
      const directory = getDirectory(folderId)
      const entries: ComposeAssetEntry[] = []
      try {
        for await (const [name, handle] of directory.entries()) {
          assertNotAborted(signal)
          entries.push(await toEntry(entryId(folderId, name), folderId, handle))
        }
        return entries
      } catch (error) {
        throw normalizeComposeAssetError(error)
      }
    },
    async read({ fileId, signal }) {
      assertNotAborted(signal)
      const stored = getStored(fileId)
      if (stored.handle.kind !== 'file') {
        throw new ComposeAssetError('unsupported', 'Directories cannot be read as files')
      }
      try {
        const file = await (stored.handle as FileSystemFileHandle).getFile()
        assertNotAborted(signal)
        return { blob: file, revision: revisionOf(file) }
      } catch (error) {
        throw normalizeComposeAssetError(error)
      }
    },
    async resolveAsset({ assetKey, signal }) {
      assertNotAborted(signal)
      const handle = handlesByAssetKey.get(assetKey)
      if (!handle) {
        throw new ComposeAssetError('not-found', `Unknown asset key: ${assetKey}`)
      }
      try {
        const file = await handle.getFile()
        assertNotAborted(signal)
        return {
          blob: file,
          revision: revisionOf(file),
          mediaType: file.type || 'application/octet-stream',
        }
      } catch (error) {
        throw normalizeComposeAssetError(error)
      }
    },
    async createFolder({ parentId, name, signal }) {
      assertNotAborted(signal)
      const directory = getDirectory(parentId)
      const normalizedName = validateAssetName(name)
      try {
        await assertUniqueName(directory, normalizedName)
        const handle = await directory.getDirectoryHandle(normalizedName, { create: true })
        return toEntry(entryId(parentId, normalizedName), parentId, handle)
      } catch (error) {
        throw normalizeComposeAssetError(error)
      }
    },
    async createFile({ parentId, name, content, signal }) {
      assertNotAborted(signal)
      const directory = getDirectory(parentId)
      const normalizedName = validateAssetName(name)
      try {
        await assertUniqueName(directory, normalizedName)
        const handle = await directory.getFileHandle(normalizedName, { create: true })
        const writable = await handle.createWritable()
        await writable.write(content)
        await writable.close()
        return toEntry(entryId(parentId, normalizedName), parentId, handle)
      } catch (error) {
        throw normalizeComposeAssetError(error)
      }
    },
    async renameEntry({ entryId: id, name, signal }) {
      assertNotAborted(signal)
      const stored = getStored(id)
      if (!stored.parentId || !hasNativeMove(stored.handle)) {
        throw new ComposeAssetError('unsupported', 'Native rename is not supported')
      }
      const directory = getDirectory(stored.parentId)
      const normalizedName = validateAssetName(name)
      await assertUniqueName(directory, normalizedName)
      try {
        await stored.handle.move(directory, normalizedName)
        const nextId = entryId(stored.parentId, normalizedName)
        handles.delete(id)
        return toEntry(nextId, stored.parentId, stored.handle)
      } catch (error) {
        throw normalizeComposeAssetError(error)
      }
    },
    async moveEntry({ entryId: id, parentId, signal }) {
      assertNotAborted(signal)
      const stored = getStored(id)
      if (!hasNativeMove(stored.handle)) {
        throw new ComposeAssetError('unsupported', 'Native move is not supported')
      }
      const directory = getDirectory(parentId)
      await assertUniqueName(directory, stored.handle.name)
      try {
        await stored.handle.move(directory)
        const nextId = entryId(parentId, stored.handle.name)
        handles.delete(id)
        return toEntry(nextId, parentId, stored.handle)
      } catch (error) {
        throw normalizeComposeAssetError(error)
      }
    },
    async deleteEntry({ entryId: id, recursive, signal }) {
      assertNotAborted(signal)
      const stored = getStored(id)
      if (!stored.parentId) throw new ComposeAssetError('permission-denied', 'Cannot delete provider root')
      const parent = getDirectory(stored.parentId)
      try {
        await parent.removeEntry(stored.handle.name, { recursive })
        const assetKey = assetKeys.get(stored.handle)
        if (assetKey) handlesByAssetKey.delete(assetKey)
        handles.delete(id)
      } catch (error) {
        throw normalizeComposeAssetError(error)
      }
    },
    async writeFile({ fileId, content, expectedRevision, force, signal }) {
      assertNotAborted(signal)
      const stored = getStored(fileId)
      if (stored.handle.kind !== 'file') {
        throw new ComposeAssetError('unsupported', 'Directories cannot be written')
      }
      const handle = stored.handle as FileSystemFileHandle
      try {
        const current = await handle.getFile()
        if (!force && revisionOf(current) !== expectedRevision) {
          throw new ComposeAssetError('conflict', 'The file changed outside the editor')
        }
        const writable = await handle.createWritable()
        await writable.write(content)
        await writable.close()
        return toEntry(fileId, stored.parentId ?? rootId, handle)
      } catch (error) {
        throw normalizeComposeAssetError(error)
      }
    },
  }
}
