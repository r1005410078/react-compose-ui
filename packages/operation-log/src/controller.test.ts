import { describe, expect, it, vi } from 'vitest'
import { createOperationLogRuntime } from './controller'
import { createComposeMemoryOperationLogStore } from './stores'
import type { ComposeOperationLogStore } from './types'

function input(after: number) {
  return {
    action: 'property.change',
    category: 'property' as const,
    summary: `Opacity ${after}`,
    targets: [{ componentId: 'rectangle-1', path: ['appearance', 'opacity'] }],
    before: after - 1,
    after,
  }
}

describe('OpenSpec: operation-log / 连续属性操作合并 / 合并同一属性连续输入', () => {
  it('保留第一次 before、最后一次 after 和累计次数', async () => {
    let currentTime = 1000
    const runtime = createOperationLogRuntime({
      scopeId: 'page-1',
      sessionId: 'session-1',
      store: createComposeMemoryOperationLogStore(),
      now: () => currentTime,
      createId: () => 'entry-1',
    })
    await runtime.initialize()

    await runtime.record(input(1), { coalesceKey: 'rectangle-1:appearance.opacity' })
    currentTime += 200
    await runtime.record(input(2), { coalesceKey: 'rectangle-1:appearance.opacity' })

    expect(runtime.entries).toHaveLength(1)
    expect(runtime.entries[0]).toMatchObject({ count: 2, summary: 'Opacity 2', updatedAt: 1200 })
    expect(runtime.entries[0]?.before?.value).toBe(0)
    expect(runtime.entries[0]?.after?.value).toBe(2)
  })
})

describe('OpenSpec: operation-log / 连续属性操作合并 / 中断或跳过合并', () => {
  it('不同 key、中间操作、超时或无 key 时创建独立条目', async () => {
    let currentTime = 1000
    let id = 0
    const runtime = createOperationLogRuntime({
      scopeId: 'page-1',
      sessionId: 'session-1',
      store: createComposeMemoryOperationLogStore(),
      now: () => currentTime,
      createId: () => `entry-${++id}`,
    })
    await runtime.initialize()

    await runtime.record(input(1), { coalesceKey: 'opacity' })
    await runtime.record({ ...input(2), summary: 'Width 2' }, { coalesceKey: 'width' })
    await runtime.record(input(3), { coalesceKey: 'opacity' })
    currentTime += 801
    await runtime.record(input(4), { coalesceKey: 'opacity' })
    await runtime.record({ ...input(5), action: 'property.reset' })

    expect(runtime.entries).toHaveLength(5)
    expect(runtime.entries.every((entry) => entry.count === 1)).toBe(true)
  })
})

describe('OpenSpec: operation-log / Scoped IndexedDB 持久化 / 限制每个 scope 的记录数量', () => {
  it('按 scope 隔离并删除超过上限的最旧记录', async () => {
    const store = createComposeMemoryOperationLogStore()
    let id = 0
    let currentTime = 0
    const first = createOperationLogRuntime({
      scopeId: 'page-1',
      store,
      maxEntries: 2,
      now: () => ++currentTime,
      createId: () => `entry-${++id}`,
    })
    await first.initialize()
    await first.record(input(1))
    await first.record(input(2))
    await first.record(input(3))

    const second = createOperationLogRuntime({ scopeId: 'page-2', store })
    await second.initialize()
    await second.record(input(9))

    expect((await store.load('page-1')).map(({ summary }) => summary)).toEqual([
      'Opacity 3',
      'Opacity 2',
    ])
    expect(await store.load('page-2')).toHaveLength(1)
  })

  it('初始化时清理 store 中已经超过上限的最旧记录', async () => {
    const store = createComposeMemoryOperationLogStore()
    await store.put({
      id: 'old', scopeId: 'page-1', sessionId: 'old-session', action: 'property.change',
      category: 'property', summary: 'Old', targets: [], startedAt: 1, updatedAt: 1, count: 1,
    })
    await store.put({
      id: 'middle', scopeId: 'page-1', sessionId: 'old-session', action: 'property.change',
      category: 'property', summary: 'Middle', targets: [], startedAt: 2, updatedAt: 2, count: 1,
    })
    await store.put({
      id: 'latest', scopeId: 'page-1', sessionId: 'old-session', action: 'property.change',
      category: 'property', summary: 'Latest', targets: [], startedAt: 3, updatedAt: 3, count: 1,
    })
    const runtime = createOperationLogRuntime({ scopeId: 'page-1', store, maxEntries: 2 })

    await runtime.initialize()

    expect(runtime.entries.map(({ id }) => id)).toEqual(['latest', 'middle'])
    expect((await store.load('page-1')).map(({ id }) => id)).toEqual(['latest', 'middle'])
  })
})

describe('OpenSpec: operation-log / Scoped IndexedDB 持久化 / IndexedDB 不可用时降级', () => {
  it('继续保留会话日志并报告错误', async () => {
    const error = new Error('quota')
    const failingStore: ComposeOperationLogStore = {
      load: vi.fn().mockResolvedValue([]),
      put: vi.fn().mockRejectedValue(error),
      remove: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    }
    const onStorageError = vi.fn()
    const runtime = createOperationLogRuntime({
      scopeId: 'page-1',
      store: failingStore,
      onStorageError,
    })
    await runtime.initialize()
    await expect(runtime.record(input(1))).resolves.toMatchObject({ summary: 'Opacity 1' })

    expect(runtime.status).toBe('degraded')
    expect(runtime.entries).toHaveLength(1)
    expect(onStorageError).toHaveBeenCalledWith(error)
  })
})

describe('OpenSpec: operation-log / Scoped IndexedDB 持久化 / 程序化清理当前 scope', () => {
  it('clear 同时清空响应式状态和当前 scope store', async () => {
    const store = createComposeMemoryOperationLogStore()
    const runtime = createOperationLogRuntime({ scopeId: 'page-1', store })
    await runtime.initialize()
    await runtime.record(input(1))

    await runtime.clear()

    expect(runtime.entries).toEqual([])
    expect(await store.load('page-1')).toEqual([])
  })
})
