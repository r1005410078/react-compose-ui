import type { OperationLogEncodedValue, OperationLogSnapshot } from './types'

class SnapshotEncodingError extends Error {}

function encodeValue(
  value: unknown,
  ancestors: WeakSet<object>,
): OperationLogEncodedValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value
    return { $type: 'number', value: String(value) }
  }
  if (typeof value === 'bigint') return { $type: 'bigint', value: value.toString() }
  if (typeof value === 'undefined') return { $type: 'undefined' }
  if (typeof value === 'function') throw new SnapshotEncodingError('函数不能写入操作日志')
  if (typeof value === 'symbol') throw new SnapshotEncodingError('Symbol 不能写入操作日志')

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new SnapshotEncodingError('无效 Date 不能写入操作日志')
    return { $type: 'date', value: value.toISOString() }
  }
  if (ancestors.has(value)) throw new SnapshotEncodingError('检测到循环引用')
  ancestors.add(value)
  try {
    if (Array.isArray(value)) return value.map((item) => encodeValue(item, ancestors))
    const prototype = Object.getPrototypeOf(value) as object | null
    if (prototype !== Object.prototype && prototype !== null) {
      throw new SnapshotEncodingError('只支持普通对象、数组、Date 和基础值')
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
export function createOperationLogSnapshot(
  value: unknown,
  maxBytes = 64 * 1024,
): OperationLogSnapshot {
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
    const reason = error instanceof Error ? error.message : '无法生成操作日志快照'
    return {
      status: 'unavailable',
      preview: `不可保存：${reason}`,
      byteLength: 0,
      reason,
    }
  }
}
