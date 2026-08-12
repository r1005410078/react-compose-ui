import { COMPOSE_COMPONENT_NEST_DEPTH_LIMIT } from './component-types'

/**
 * 复合地址的段分隔符。
 *
 * @remarks
 * Entity ID 不允许包含该字符，因此宿主实体的裸 ID 与实例内部地址在同一选区集合中可无歧义区分。
 *
 * @public
 */
export const COMPOSE_INSTANCE_PATH_SEPARATOR = '/' as const

/** 复合地址解码结果。 @public */
export type ComposeInstancePathDecodeResult =
  | { readonly ok: true; readonly segments: readonly string[] }
  | { readonly ok: false; readonly reason: string }

/**
 * 复合地址允许的最大段数。
 *
 * @remarks
 * 每层实例贡献「实例 ID + 内部 ID」两段，因此段数上限是嵌套上限的两倍。
 */
const MAX_SEGMENTS = COMPOSE_COMPONENT_NEST_DEPTH_LIMIT * 2

/**
 * 把「实例 ID + 内部稳定 ID」逐层拼接为复合地址。
 *
 * @remarks
 * 复合地址只存在于编辑期表示层；持久化文档中实例仍是单个 Entity。
 *
 * @throws 段数不足两段、含分隔符或超过嵌套上限时抛出。
 *
 * @public
 */
export function encodeComposeInstancePath(segments: readonly string[]): string {
  if (segments.length < 2) {
    throw new Error('复合地址至少两段：实例 ID 与内部稳定 ID')
  }
  if (segments.length > MAX_SEGMENTS) {
    throw new Error(`复合地址嵌套层数不得超过 ${COMPOSE_COMPONENT_NEST_DEPTH_LIMIT}`)
  }
  for (const segment of segments) {
    if (segment.length === 0) throw new Error('复合地址不允许空段')
    if (segment.includes(COMPOSE_INSTANCE_PATH_SEPARATOR)) {
      throw new Error(`Entity ID 不允许包含分隔符 ${COMPOSE_INSTANCE_PATH_SEPARATOR}`)
    }
  }
  return segments.join(COMPOSE_INSTANCE_PATH_SEPARATOR)
}

/** 判断一个选区 ID 是否为实例内部复合地址。 @public */
export function isComposeInstancePath(id: string): boolean {
  return id.includes(COMPOSE_INSTANCE_PATH_SEPARATOR)
}

/**
 * 解码复合地址；非法地址不抛出，便于选区归一化直接丢弃。
 *
 * @public
 */
export function decodeComposeInstancePath(address: string): ComposeInstancePathDecodeResult {
  const segments = address.split(COMPOSE_INSTANCE_PATH_SEPARATOR)
  if (segments.length < 2) return { ok: false, reason: '复合地址至少两段' }
  if (segments.length > MAX_SEGMENTS) return { ok: false, reason: '复合地址超过嵌套上限' }
  if (segments.some((segment) => segment.length === 0)) return { ok: false, reason: '复合地址不允许空段' }
  return { ok: true, segments }
}

/**
 * 取复合地址所属的宿主实体 ID；裸 ID 原样返回。
 *
 * @remarks
 * 编辑写入、Undo/Redo 和文档事务都作用在宿主实体上，因此需要这个稳定回退。
 *
 * @public
 */
export function composeInstancePathHostId(id: string): string {
  const separator = id.indexOf(COMPOSE_INSTANCE_PATH_SEPARATOR)
  return separator === -1 ? id : id.slice(0, separator)
}
