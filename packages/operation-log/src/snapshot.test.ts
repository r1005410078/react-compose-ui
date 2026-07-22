import { describe, expect, it } from 'vitest'
import { createOperationLogSnapshot } from './snapshot'

describe('OpenSpec: operation-log / 结构化操作日志协议 / 生成可持久化快照', () => {
  it('编码 Date、BigInt 和 undefined', () => {
    const snapshot = createOperationLogSnapshot({
      createdAt: new Date('2026-07-22T00:00:00.000Z'),
      count: 9007199254740993n,
      optional: undefined,
    })

    expect(snapshot.status).toBe('complete')
    expect(snapshot.value).toEqual({
      createdAt: { $type: 'date', value: '2026-07-22T00:00:00.000Z' },
      count: { $type: 'bigint', value: '9007199254740993' },
      optional: { $type: 'undefined' },
    })
  })

  it('把循环引用和不可克隆值标记为 unavailable', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular

    expect(createOperationLogSnapshot(circular)).toMatchObject({
      status: 'unavailable',
      reason: expect.stringContaining('循环'),
    })
    expect(createOperationLogSnapshot(() => undefined)).toMatchObject({
      status: 'unavailable',
    })
  })

  it('截断超过上限的快照并保留稳定预览和原始字节数', () => {
    const snapshot = createOperationLogSnapshot({ text: 'x'.repeat(200) }, 64)

    expect(snapshot.status).toBe('truncated')
    expect(snapshot.byteLength).toBeGreaterThan(64)
    expect(snapshot.preview.length).toBeGreaterThan(0)
    expect(snapshot.value).toBeUndefined()
  })
})
