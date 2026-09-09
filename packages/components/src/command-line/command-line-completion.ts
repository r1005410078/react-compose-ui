import type { ComposeCommandDescriptor } from '@compose-ui/commands'

/** 一次匹配的结果：查询词与按相关度排好序的候选。 @public */
export interface ComposeCommandCompletionMatch {
  /** 去掉前导 `/` 与首尾空白之后、用于匹配的文本。 */
  readonly query: string
  /** 命中的命令，最相关的在前；空数组表示没有命中。 */
  readonly items: readonly ComposeCommandDescriptor[]
}

/** 大小写无关的比较键；与命令注册表解析名称用的是同一条归一化。 */
function normalize(text: string) {
  return text.trim().toUpperCase()
}

/**
 * 一条命令与查询词的相关度：数字越小越靠前，`null` 表示不相关。
 *
 * @remarks
 * 三档而不是一个分数：**整词命中**排最前，因为它决定 Enter 的含义——用户敲完 `C` 按 Enter
 * 得到的必须仍是 `CIRCLE`（别名整词），而不是按字母序排在 `CIRCLE` 前面的某个 `C` 开头的
 * 命令；少了这一档，加上补全等于改掉了每一个别名的解析结果。**前缀**次之（`LI` → `LINE`），
 * 显示名与检索词的**包含**最末（敲「直线」也找得到 `LINE`）。同档之内保持注册次序。
 */
function rank(descriptor: ComposeCommandDescriptor, query: string): number | null {
  const names = [descriptor.id, ...(descriptor.aliases ?? [])].map(normalize)
  if (names.includes(query)) return 0
  if (names.some((name) => name.startsWith(query))) return 1
  const texts = [descriptor.title, ...(descriptor.keywords ?? [])].map(normalize)
  if (texts.some((text) => text.includes(query))) return 2
  return null
}

/**
 * 按缓冲里的文本挑出可补全的命令。
 *
 * @remarks
 * `/` 是「列出全部」的开关：单独一个 `/` 列出整份词汇表，`/` 后面接的文本只用来过滤。
 * 没有 `/` 时按普通前缀提示——空缓冲不提示（那时 Enter 是「重复上一条」，方向键是召回历史，
 * 弹出列表会抢走这两个含义）。
 *
 * 本函数不认识任何具体命令，只读描述符上的名称、别名、显示名与检索词。
 *
 * @returns 没有可提示的内容时为 `null`：缓冲为空，或没有 `/` 且没有任何命中。
 * @public
 */
export function matchComposeCommandCompletions(
  descriptors: readonly ComposeCommandDescriptor[],
  text: string,
): ComposeCommandCompletionMatch | null {
  const listAll = text.startsWith('/')
  const query = normalize(listAll ? text.slice(1) : text)
  if (!listAll && query.length === 0) return null
  if (query.length === 0) return { query, items: descriptors }
  const ranked = descriptors
    .map((descriptor, order) => ({ descriptor, order, rank: rank(descriptor, query) }))
    .filter((entry): entry is typeof entry & { rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map((entry) => entry.descriptor)
  if (ranked.length === 0 && !listAll) return null
  return { query, items: ranked }
}
