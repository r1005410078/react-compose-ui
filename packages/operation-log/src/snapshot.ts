import type { ComposeOperationLogEncodedValue, ComposeOperationLogSnapshot } from './types'

class SnapshotEncodingError extends Error {}

function encodeValue(
  value: unknown,
  ancestors: WeakSet<object>,
): ComposeOperationLogEncodedValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value
    return { $type: 'number', value: String(value) }
  }
  if (typeof value === 'bigint') return { $type: 'bigint', value: value.toString() }
  if (typeof value === 'undefined') return { $type: 'undefined' }
  if (typeof value === 'function') throw new SnapshotEncodingError('Functions cannot be stored')
  if (typeof value === 'symbol') throw new SnapshotEncodingError('Symbols cannot be stored')

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new SnapshotEncodingError('Invalid dates cannot be stored')
    return { $type: 'date', value: value.toISOString() }
  }
  if (ancestors.has(value)) throw new SnapshotEncodingError('Circular reference detected')
  ancestors.add(value)
  try {
    if (Array.isArray(value)) return value.map((item) => encodeValue(item, ancestors))
    const prototype = Object.getPrototypeOf(value) as object | null
    if (prototype !== Object.prototype && prototype !== null) {
      throw new SnapshotEncodingError('Only plain objects, arrays, dates, and primitive values are supported')
    }
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => [key, encodeValue((value as Record<string, unknown>)[key], ancestors)]),
    )
  } finally {
    ancestors.delete(value)
  }
}

function preview(serialized: string) {
  return serialized.length <= 180 ? serialized : `${serialized.slice(0, 179)}…`
}

/**
 * 把任意宿主值编码为有大小上限的可展示日志快照。
 *
 * @param value - 记录时的业务值。
 * @param maxBytes - 完整标记编码允许占用的最大 UTF-8 字节数。
 * @returns 完整、截断或不可用的快照；本函数不会因值不可序列化而抛出。
 * @defaultValue maxBytes 为 65536。
 */
export function createComposeOperationLogSnapshot(
  value: unknown,
  maxBytes = 64 * 1024,
): ComposeOperationLogSnapshot {
  try {
    const encoded = encodeValue(value, new WeakSet())
    const serialized = JSON.stringify(encoded)
    const byteLength = new TextEncoder().encode(serialized).byteLength
    if (byteLength > maxBytes) {
      return {
        status: 'truncated',
        preview: preview(serialized),
        byteLength,
      }
    }
    return {
      status: 'complete',
      preview: preview(serialized),
      byteLength,
      value: encoded,
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unable to create operation snapshot'
    return {
      status: 'unavailable',
      preview: `Unavailable: ${reason}`,
      byteLength: 0,
      reason,
    }
  }
}
