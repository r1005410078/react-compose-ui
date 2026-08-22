import type {
  ComposeAssetCapabilities,
  ComposeAssetEntry,
  ComposeAssetProvider,
} from '@compose-ui/assets'
import { ComposeAssetError } from '@compose-ui/assets'
import type { CadCommandContext, CadCommandMessages } from './command'
import { COMPOSE_CAD_MEDIA_TYPE, isComposeCadFileName } from './store'

/** 测试用命令文案；内容只需可区分，不需要真的本地化。 @internal */
export const cadTestCommandMessages: CadCommandMessages = {
  specifyFirstPoint: '指定第一点',
  specifyNextPoint: '指定下一点',
  keywordUndo: '放弃',
  keywordFinish: '结束',
  expectedPoint: '需要一个点',
  lineTitle: '直线',
  eraseTitle: '删除',
  selectObjects: '选择对象',
  expectedSelection: '需要选择对象',
  blockTitle: '创建块',
  blockName: '输入块名',
  blockBasePoint: '指定插入基点',
  expectedName: '需要一个名字',
  insertTitle: '插入块',
  insertName: '输入块名',
  insertPoint: '指定插入点',
  unknownBlock: '未知块名',
}

/**
 * 测试用命令上下文，ID 递增可预期。
 *
 * @param selection - 启动当刻的选择集；「先选后执行」的用例靠它区分两条次序。
 * @param blocks - 文档现有的块，供 INSERT 按名字解析。
 * @internal
 */
export function createCadTestCommandContext(
  selection: readonly string[] = [],
  blocks: readonly { readonly id: string; readonly name: string }[] = [],
): CadCommandContext {
  let counter = 0
  return {
    layerId: '0',
    idFactory: () => `id-${++counter}`,
    selection,
    blocks,
    messages: cadTestCommandMessages,
  }
}

/** 测试用 Provider 的可观测调用计数。 @internal */
export interface FakeProviderCalls {
  list: number
  read: number
  write: number
  createFile: number
}

/** 测试用 Provider 句柄。 @internal */
export interface FakeAssetProvider {
  readonly provider: ComposeAssetProvider
  readonly calls: FakeProviderCalls
  /** 直接写入文件内容，模拟外部写入者。 */
  setFile(path: string, text: string): void
  getFile(path: string): string | undefined
  removeFile(path: string): void
  /** 触发 Provider 变更通知。 */
  notify(): void
}

interface FakeFile {
  text: string
  revision: number
}

const ROOT_ID = 'root'

/**
 * 创建以路径为 id 与 assetKey 的内存 Provider。
 *
 * @remarks
 * 路径既是 `id` 也是 `assetKey`，使测试能直接用 `Cad/Topology.cad.json` 断言 assetKey。
 *
 * 与 `@compose-ui/pages` 的同名夹具形状相同但各自独立：让测试夹具跨包依赖会把
 * `cad → pages` 这条本不存在的边引进来，代价大于这点重复。
 * @internal
 */
export function createFakeAssetProvider(input?: {
  readonly files?: Readonly<Record<string, string>>
  readonly capabilities?: Partial<ComposeAssetCapabilities>
  readonly omit?: readonly ('writeFile' | 'createFile' | 'subscribe')[]
  readonly conflictOnce?: boolean
}): FakeAssetProvider {
  const files = new Map<string, FakeFile>()
  Object.entries(input?.files ?? {}).forEach(([path, text]) => {
    files.set(path, { text, revision: 1 })
  })
  const calls: FakeProviderCalls = { list: 0, read: 0, write: 0, createFile: 0 }
  const listeners = new Set<() => void>()
  const omit = new Set(input?.omit ?? [])
  let pendingConflict = input?.conflictOnce ?? false

  const capabilities: ComposeAssetCapabilities = {
    createFile: true,
    createFolder: true,
    rename: true,
    move: true,
    delete: true,
    write: true,
    reference: true,
    ...input?.capabilities,
  }

  const root: ComposeAssetEntry = {
    id: ROOT_ID,
    parentId: null,
    name: 'fake',
    kind: 'folder',
  }

  const parentOf = (path: string): string => {
    const index = path.lastIndexOf('/')
    return index === -1 ? ROOT_ID : path.slice(0, index)
  }

  const fileEntry = (path: string): ComposeAssetEntry => {
    const name = path.slice(path.lastIndexOf('/') + 1)
    return {
      id: path,
      parentId: parentOf(path),
      name,
      kind: 'file',
      // CAD 身份由媒体类型表达；这个内存 Provider 按命名约定翻译，与真实适配层一致。
      mediaType: isComposeCadFileName(name) ? COMPOSE_CAD_MEDIA_TYPE : undefined,
      assetKey: path,
      revision: String(files.get(path)?.revision ?? 1),
    }
  }

  const provider: ComposeAssetProvider = {
    id: 'fake',
    label: 'Fake',
    root,
    capabilities,
    referenceScope: 'persistent',

    async list({ folderId }) {
      calls.list += 1
      const prefix = folderId === ROOT_ID ? '' : `${folderId}/`
      const entries = new Map<string, ComposeAssetEntry>()
      files.forEach((_file, path) => {
        if (!path.startsWith(prefix)) return
        const rest = path.slice(prefix.length)
        if (rest.length === 0) return
        const slash = rest.indexOf('/')
        if (slash === -1) {
          entries.set(path, fileEntry(path))
          return
        }
        const folderPath = `${prefix}${rest.slice(0, slash)}`
        entries.set(folderPath, {
          id: folderPath,
          parentId: folderId,
          name: rest.slice(0, slash),
          kind: 'folder',
        })
      })
      return [...entries.values()]
    },

    async read({ fileId }) {
      calls.read += 1
      const file = files.get(fileId)
      if (!file) throw new ComposeAssetError('not-found', `不存在：${fileId}`)
      return { blob: new Blob([file.text]), revision: String(file.revision) }
    },
  }

  if (!omit.has('writeFile')) {
    Object.assign(provider, {
      async writeFile({ fileId, content, expectedRevision, force }: {
        fileId: string
        content: Blob
        expectedRevision: string
        force?: boolean
      }) {
        calls.write += 1
        const file = files.get(fileId)
        if (!file) throw new ComposeAssetError('not-found', `不存在：${fileId}`)
        if (pendingConflict && force !== true) {
          pendingConflict = false
          throw new ComposeAssetError('conflict', 'revision 已过期')
        }
        if (force !== true && expectedRevision !== String(file.revision)) {
          throw new ComposeAssetError('conflict', 'revision 已过期')
        }
        file.text = await content.text()
        file.revision += 1
        return fileEntry(fileId)
      },
    })
  }

  if (!omit.has('createFile')) {
    Object.assign(provider, {
      async createFile({ parentId, name, content }: {
        parentId: string
        name: string
        content: Blob
      }) {
        calls.createFile += 1
        const path = parentId === ROOT_ID ? name : `${parentId}/${name}`
        if (files.has(path)) throw new ComposeAssetError('conflict', `已存在：${path}`)
        files.set(path, { text: await content.text(), revision: 1 })
        return fileEntry(path)
      },
    })
  }

  if (!omit.has('subscribe')) {
    Object.assign(provider, {
      subscribe(listener: () => void) {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    })
  }

  return {
    provider,
    calls,
    setFile(path, text) {
      const existing = files.get(path)
      files.set(path, { text, revision: (existing?.revision ?? 0) + 1 })
    },
    getFile(path) {
      return files.get(path)?.text
    },
    removeFile(path) {
      files.delete(path)
    },
    notify() {
      listeners.forEach((listener) => { listener() })
    },
  }
}
