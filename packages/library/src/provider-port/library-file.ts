import { ComposeAssetError } from '@compose-ui/assets'
import type { ComposeLibraryCategory, ComposeLibraryKind } from '../port/library-types'

/** 库文件在 Provider 根目录下的文件名。 @public */
export const COMPOSE_LIBRARY_FILE_NAME = 'library.json'

/** 库文件的媒体类型。 @public */
export const COMPOSE_LIBRARY_MEDIA_TYPE = 'application/vnd.compose-ui.library+json'

/** 库文件的格式版本。 @public */
export const COMPOSE_LIBRARY_FILE_VERSION = 1

/** 缩略图在 Provider 上的目录名。 @public */
export const COMPOSE_LIBRARY_THUMBNAIL_FOLDER = '.thumbnails'

/**
 * 库文件里一条记录**只存 Provider 答不了的那几个字段**。
 *
 * @remarks
 * `title`、`modifiedAt` 与 `revision` 不在这里——它们在资源条目上。存两份必然漂移，而漂移之后
 * 「哪一份是真的」没有答案。
 * @public
 */
export interface ComposeLibraryFileRecord {
  readonly kind: ComposeLibraryKind
  readonly categories: readonly string[]
  readonly useCount: number
  /** 非 null 即在回收站。软删除**不动页面文件**。 */
  readonly deletedAt: number | null
  /**
   * 建库记录的时刻。
   *
   * @remarks
   * 资源条目上没有创建时间，因此它只能住在这里；库文件里没有记录的页面按 `modifiedAt` 兜底。
   */
  readonly createdAt?: number
}

/** 没有后端时顶上的那份业务字段。 @public */
export interface ComposeLibraryFile {
  readonly version: number
  readonly categories: readonly ComposeLibraryCategory[]
  readonly records: Readonly<Record<string, ComposeLibraryFileRecord>>
  /** 最近打开，最新的在前。 */
  readonly recents?: readonly string[]
}

/** 一份空库文件。 @public */
export function createEmptyComposeLibraryFile(): ComposeLibraryFile {
  return { version: COMPOSE_LIBRARY_FILE_VERSION, categories: [], records: {}, recents: [] }
}

function readKind(value: unknown): ComposeLibraryKind {
  return value === 'template' ? 'template' : 'project'
}

function readCategories(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return []
  // 去重并丢掉空串：空标签在左栏上是一行点不中的空白，而「未分类」已经由空数组表达了。
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item !== ''))]
}

function readRecord(value: unknown): ComposeLibraryFileRecord | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  const useCount = typeof raw.useCount === 'number' && Number.isFinite(raw.useCount)
    ? Math.max(0, Math.trunc(raw.useCount))
    : 0
  return {
    kind: readKind(raw.kind),
    categories: readCategories(raw.categories),
    useCount,
    deletedAt: typeof raw.deletedAt === 'number' ? raw.deletedAt : null,
    ...(typeof raw.createdAt === 'number' ? { createdAt: raw.createdAt } : {}),
  }
}

function readCategory(value: unknown): ComposeLibraryCategory | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  if (typeof raw.id !== 'string' || raw.id === '') return null
  return {
    id: raw.id,
    label: typeof raw.label === 'string' && raw.label !== '' ? raw.label : raw.id,
    ...(raw.builtIn === true ? { builtIn: true as const } : {}),
  }
}

/**
 * 解析库文件。
 *
 * @remarks
 * **坏内容退化成空库而不是抛错**：库文件是派生数据（真正的页面在目录里），把它读坏而让整个
 * 首页打不开，代价远大于丢掉几个标签——而没有记录的页面本来就按默认值出现在库里，因此退化的
 * 结果是「分类没了」，不是「图没了」。版本号高于本实现时同样退化。
 * @public
 */
export function parseComposeLibraryFile(text: string): ComposeLibraryFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  }
  catch {
    return createEmptyComposeLibraryFile()
  }
  if (typeof raw !== 'object' || raw === null) return createEmptyComposeLibraryFile()
  const source = raw as Record<string, unknown>
  const version = typeof source.version === 'number' ? source.version : 0
  if (version > COMPOSE_LIBRARY_FILE_VERSION) return createEmptyComposeLibraryFile()

  const records: Record<string, ComposeLibraryFileRecord> = {}
  if (typeof source.records === 'object' && source.records !== null) {
    for (const [pageKey, value] of Object.entries(source.records)) {
      const record = readRecord(value)
      if (record !== null) records[pageKey] = record
    }
  }
  const categories = Array.isArray(source.categories)
    ? source.categories.map(readCategory).filter((item): item is ComposeLibraryCategory => item !== null)
    : []
  const recents = Array.isArray(source.recents)
    ? source.recents.filter((item): item is string => typeof item === 'string')
    : []

  return { version: COMPOSE_LIBRARY_FILE_VERSION, categories, records, recents }
}

/** 序列化库文件。 @public */
export function serializeComposeLibraryFile(file: ComposeLibraryFile): string {
  return `${JSON.stringify(file, null, 2)}\n`
}

/** 库文件写入失败时的稳定错误。 @internal */
export function libraryWriteUnsupported(what: string): ComposeAssetError {
  return new ComposeAssetError('unsupported', `Library provider cannot ${what}`)
}
