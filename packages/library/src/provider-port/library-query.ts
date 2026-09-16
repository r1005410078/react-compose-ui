import type {
  ComposeLibraryCategoryFacet,
  ComposeLibraryFacets,
  ComposeLibraryLocationFacet,
  ComposeLibraryQuery,
  ComposeLibraryRecord,
  ComposeLibrarySort,
} from '../port/library-types'

/** 一页取多少条；调用方没给 `limit` 时用它。 @public */
export const COMPOSE_LIBRARY_DEFAULT_LIMIT = 48

function matchesSearch(record: ComposeLibraryRecord, search: string | undefined) {
  if (search === undefined) return true
  const needle = search.trim().toLowerCase()
  if (needle.length === 0) return true
  // 只匹配标题。匹配内容要解析每一份 `.page.json`，那是另一件事（见端口的 `search` 说明）。
  return record.title.toLowerCase().includes(needle)
}

function matchesCategories(
  record: ComposeLibraryRecord,
  categories: ComposeLibraryQuery['categories'],
) {
  if (categories === undefined || categories.length === 0) return true
  return categories.some((candidate) => (candidate === null
    // `null` 这一档是「未分类」——它是标签为空，不是一个保留的标签 id。
    ? record.categories.length === 0
    : record.categories.includes(candidate)))
}

/**
 * 一条记录是否落在这次查询里。
 *
 * @remarks
 * `deleted` 缺席即 `false`：回收站是显式要的，不是默认混在里面的。
 * @public
 */
export function matchesComposeLibraryQuery(
  record: ComposeLibraryRecord,
  query: ComposeLibraryQuery,
): boolean {
  if ((record.deletedAt !== null) !== (query.deleted ?? false)) return false
  if (query.kind !== undefined && record.kind !== query.kind) return false
  if (!matchesCategories(record, query.categories)) return false
  return matchesSearch(record, query.search)
}

function compareBy(sort: ComposeLibrarySort, locale: string) {
  return (left: ComposeLibraryRecord, right: ComposeLibraryRecord): number => {
    const primary = sort === 'title-asc'
      ? left.title.localeCompare(right.title, locale, { numeric: true, sensitivity: 'base' })
      : sort === 'created-desc'
        ? right.createdAt - left.createdAt
        : sort === 'used-desc'
          ? right.useCount - left.useCount || right.modifiedAt - left.modifiedAt
          : right.modifiedAt - left.modifiedAt
    // 次序必须是**全序**：游标分页靠「上一页最后一条的位置」续，两条记录比不出先后时
    // 它们的相对位置会在两次查询之间翻转，那一条要么被跳过要么被取两遍。
    return primary !== 0 ? primary : left.pageKey.localeCompare(right.pageKey)
  }
}

/** 按排序档位给出一个全序结果。 @public */
export function sortComposeLibraryRecords(
  records: readonly ComposeLibraryRecord[],
  sort: ComposeLibrarySort = 'modified-desc',
  locale = 'zh-CN',
): readonly ComposeLibraryRecord[] {
  return [...records].sort(compareBy(sort, locale))
}

/**
 * 按游标切出一页。
 *
 * @remarks
 * 游标是**上一页最后一条的 `pageKey`**，不是下标：offset 在并发写入下会漏项与重项，而这个库
 * 正被多个实施工程师同时写。游标指向的记录已经不在结果里时从头开始——那说明它被删了或被筛掉了，
 * 静默从头读一页比抛错更贴近用户此刻在做的事（他只是往下滚）。
 * @public
 */
export function paginateComposeLibraryRecords(
  sorted: readonly ComposeLibraryRecord[],
  cursor: string | undefined,
  limit: number = COMPOSE_LIBRARY_DEFAULT_LIMIT,
): { readonly items: readonly ComposeLibraryRecord[]; readonly nextCursor: string | null } {
  const size = Math.max(1, Math.trunc(limit))
  const start = cursor === undefined
    ? 0
    : sorted.findIndex((record) => record.pageKey === cursor) + 1
  const from = start <= 0 ? 0 : start
  const items = sorted.slice(from, from + size)
  const last = items.length === 0 ? undefined : items[items.length - 1]
  const hasMore = from + items.length < sorted.length
  return { items, nextCursor: hasMore && last !== undefined ? last.pageKey : null }
}

/**
 * 求两组 facet。
 *
 * @remarks
 * 两条各自独立、都容易实现错：
 *
 * - `byCategory` **摘掉 `categories` 这一项条件、保留其余**。不摘的话，选中某一类之后其余每一类
 *   都变成 0，左栏再也切不出去。
 * - `byLocation` **只受 `search` 影响**。它回答的是「切过去有多少」，而 `kind` 正是要切的那件
 *   东西——让它参与会让「模板」那个数在看项目时恒为 0。
 *
 * 计数为 0 的场景类型仍然**列出来**：行随着筛选出现又消失会让左栏在用户眼皮底下跳，而那一跳
 * 屏幕上没有任何东西解释。顺序照 `categoryIds` 给的那一份，未分类恒在末尾。
 * @public
 */
export function computeComposeLibraryFacets(input: {
  readonly records: readonly ComposeLibraryRecord[]
  readonly query: ComposeLibraryQuery
  readonly categoryIds: readonly string[]
}): ComposeLibraryFacets {
  const { records, query, categoryIds } = input

  const withoutCategory: ComposeLibraryQuery = { ...query, categories: undefined }
  const scoped = records.filter((record) => matchesComposeLibraryQuery(record, withoutCategory))
  const counts = new Map<string, number>(categoryIds.map((id) => [id, 0]))
  let uncategorized = 0
  for (const record of scoped) {
    if (record.categories.length === 0) {
      uncategorized += 1
      continue
    }
    for (const id of record.categories) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const byCategory: ComposeLibraryCategoryFacet[] = categoryIds
    .map((id) => ({ category: id as string | null, count: counts.get(id) ?? 0 }))
  // 清单之外的标签（记录上有、清单里没有）照样计数并排在清单之后，否则它们的图数不进任何一格。
  for (const [id, count] of counts) {
    if (!categoryIds.includes(id)) byCategory.push({ category: id, count })
  }
  byCategory.push({ category: null, count: uncategorized })

  const searched = records.filter((record) => matchesSearch(record, query.search))
  const byLocation: ComposeLibraryLocationFacet = {
    project: searched.filter((r) => r.deletedAt === null && r.kind === 'project').length,
    template: searched.filter((r) => r.deletedAt === null && r.kind === 'template').length,
    trash: searched.filter((r) => r.deletedAt !== null).length,
  }

  return { byCategory, byLocation }
}
