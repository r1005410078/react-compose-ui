import { describe, expect, it, vi } from 'vitest'
import * as core from './index'

type RuntimeLike = {
  readonly document: TestDocument
  readonly entries: readonly { id: string; label: string }[]
  readonly activeEntryId: string | null
  readonly canUndo: boolean
  readonly canRedo: boolean
  dispatch(command: TestCommand): {
    status: 'committed' | 'noop' | 'rejected'
    transaction?: { id: string; forward: readonly unknown[]; inverse: readonly unknown[] }
    issues?: readonly { code: string }[]
    coalesced?: boolean
  }
  undo(): void
  redo(): void
  navigate(id: string): void
  reset(document: TestDocument, label?: string): { status: 'reset' | 'rejected' }
  subscribe(listener: () => void): () => void
  subscribeEvents(listener: (event: { type: string; [key: string]: unknown }) => void): () => void
  registerHandler(handler: TestHandler): () => void
}

type TestCommand = {
  id: string
  type: string
  payload: Record<string, unknown>
  meta?: {
    label?: string
    source?: string
    targetIds?: readonly string[]
    mergeKey?: string
  }
}

type TestPatch =
  | { op: 'set'; path: readonly (string | number)[]; value: unknown }
  | { op: 'insert'; path: readonly (string | number)[]; index: number; value: unknown }
  | { op: 'remove'; path: readonly (string | number)[] }
  | { op: 'move'; path: readonly (string | number)[]; from: number; to: number }

type TestHandler = {
  type: string
  execute(document: TestDocument, command: TestCommand):
    | { status: 'patches'; patches: readonly TestPatch[] }
    | { status: 'noop'; reason?: string }
    | { status: 'rejected'; issues: readonly { code: string; message: string }[] }
}

type TestDocument = {
  schemaVersion: 3
  canvas: {
    grid: {
      stepX: number
      stepY: number
      offsetX: number
      offsetY: number
      primaryLineEvery: number
      snapEnabled: boolean
    }
    smartSnap: { nodes: boolean; guides: boolean }
    guides: { id: string; axis: 'x' | 'y'; position: number }[]
  }
  output: { width: number; height: number; backgroundColor: string }
  rootIds: string[]
  nodes: Record<string, {
    id: string
    kind: 'frame' | 'component'
    name: string
    visible: boolean
    locked: boolean
    transform: { x: number; y: number; width: number; height: number; rotation: number }
    childIds?: string[]
    clipContent?: boolean
    componentType?: string
    props?: Record<string, unknown>
  }>
}

const createTransactionRuntime = (
  core as unknown as {
    createTransactionRuntime(options: {
      document: TestDocument
      handlers?: readonly TestHandler[]
      idFactory?: () => string
      clock?: () => number
      historyLimit?: number
      mergeWindowMs?: number
    }): RuntimeLike
  }
).createTransactionRuntime

function documentFixture(): TestDocument {
  return {
    schemaVersion: 3,
    canvas: {
      grid: {
        stepX: 8,
        stepY: 8,
        offsetX: 0,
        offsetY: 0,
        primaryLineEvery: 8,
        snapEnabled: true,
      },
      smartSnap: { nodes: true, guides: true },
      guides: [],
    },
    output: { width: 1280, height: 720, backgroundColor: '#f8fafc' },
    rootIds: ['frame'],
    nodes: {
      frame: {
        id: 'frame',
        kind: 'frame',
        name: 'Frame',
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 },
        clipContent: true,
        childIds: ['a', 'b'],
      },
      a: {
        id: 'a',
        kind: 'component',
        name: 'A',
        visible: true,
        locked: false,
        transform: { x: 10, y: 20, width: 100, height: 50, rotation: 0 },
        componentType: 'text',
        props: { text: 'A', tags: ['first', 'second'] },
      },
      b: {
        id: 'b',
        kind: 'component',
        name: 'B',
        visible: true,
        locked: false,
        transform: { x: 200, y: 20, width: 100, height: 50, rotation: 0 },
        componentType: 'text',
        props: { text: 'B' },
      },
    },
  }
}

function handler(
  type: string,
  execute: TestHandler['execute'],
): TestHandler {
  return { type, execute }
}

function command(
  type: string,
  payload: Record<string, unknown> = {},
  meta?: TestCommand['meta'],
): TestCommand {
  return { id: `command-${type}`, type, payload, meta }
}

describe('TransactionRuntime', () => {
  it('OpenSpec: command-transaction / 原子可逆 Patch / 原子提交复合修改', () => {
    const runtime = createTransactionRuntime({
      document: documentFixture(),
      idFactory: () => 'transaction-1',
      clock: () => 100,
      handlers: [handler('fixture.patch', () => ({
        status: 'patches',
        patches: [
          { op: 'set', path: ['nodes', 'a', 'name'], value: 'Renamed' },
          { op: 'insert', path: ['nodes', 'frame', 'childIds'], index: 1, value: 'marker' },
          { op: 'remove', path: ['nodes', 'frame', 'childIds', 1] },
          { op: 'move', path: ['nodes', 'frame', 'childIds'], from: 0, to: 1 },
        ],
      }))],
    })

    const result = runtime.dispatch(command('fixture.patch', {}, { label: '复合修改' }))

    expect(result.status).toBe('committed')
    expect(result.transaction).toMatchObject({
      id: 'transaction-1',
      forward: expect.any(Array),
      inverse: expect.any(Array),
    })
    expect(runtime.document.nodes.a.name).toBe('Renamed')
    expect(runtime.document.nodes.frame.childIds).toEqual(['b', 'a'])

    runtime.undo()
    expect(runtime.document).toEqual(documentFixture())
    runtime.redo()
    expect(runtime.document.nodes.frame.childIds).toEqual(['b', 'a'])
  })

  it('OpenSpec: command-transaction / 原子可逆 Patch / 中途 Patch 失败', () => {
    const listener = vi.fn()
    const runtime = createTransactionRuntime({
      document: documentFixture(),
      handlers: [handler('fixture.invalid', () => ({
        status: 'patches',
        patches: [
          { op: 'set', path: ['nodes', 'a', 'name'], value: 'Leaked' },
          { op: 'remove', path: ['nodes', 'missing', 'name'] },
        ],
      }))],
    })
    runtime.subscribe(listener)

    const result = runtime.dispatch(command('fixture.invalid'))

    expect(result).toMatchObject({
      status: 'rejected',
      issues: [expect.objectContaining({ code: 'patch.invalid-path' })],
    })
    expect(runtime.document).toEqual(documentFixture())
    expect(runtime.entries).toHaveLength(1)
    expect(listener).not.toHaveBeenCalled()
  })

  it('OpenSpec: command-transaction / 原子可逆 Patch / 忽略等价结果', () => {
    const runtime = createTransactionRuntime({
      document: documentFixture(),
      handlers: [handler('fixture.same', () => ({
        status: 'patches',
        patches: [{ op: 'set', path: ['nodes', 'a', 'name'], value: 'A' }],
      }))],
    })

    expect(runtime.dispatch(command('fixture.same'))).toMatchObject({ status: 'noop' })
    expect(runtime.entries).toHaveLength(1)
  })

  it('OpenSpec: command-transaction / 同步命令处理器 / 隔离 handler 异常', () => {
    const runtime = createTransactionRuntime({
      document: documentFixture(),
      handlers: [handler('fixture.throw', () => {
        throw new Error('boom')
      })],
    })

    expect(runtime.dispatch(command('fixture.throw'))).toMatchObject({
      status: 'rejected',
      issues: [expect.objectContaining({ code: 'handler.exception' })],
    })
    expect(runtime.document).toEqual(documentFixture())
  })

  it('OpenSpec: command-transaction / 同步命令处理器 / 注册并执行宿主命令', () => {
    const runtime = createTransactionRuntime({ document: documentFixture() })
    const unregister = runtime.registerHandler(handler('fixture.rename', (_document, input) => ({
      status: 'patches',
      patches: [{ op: 'set', path: ['nodes', 'a', 'name'], value: input.payload.name }],
    })))

    expect(runtime.dispatch(command('fixture.rename', { name: 'Registered' }))).toMatchObject({
      status: 'committed',
    })
    expect(runtime.document.nodes.a.name).toBe('Registered')
    unregister()
    expect(runtime.dispatch(command('fixture.rename', { name: 'Ignored' }))).toMatchObject({
      status: 'rejected',
      issues: [expect.objectContaining({ code: 'command.unknown-type' })],
    })
  })

  it('OpenSpec: command-transaction / 同步命令处理器 / 拒绝重复命令类型', () => {
    const runtime = createTransactionRuntime({
      document: documentFixture(),
      handlers: [handler('fixture.duplicate', () => ({ status: 'noop' }))],
    })

    expect(() => runtime.registerHandler(
      handler('fixture.duplicate', () => ({ status: 'noop' })),
    )).toThrow(/fixture\.duplicate/)
  })

  it('OpenSpec: command-transaction / 成功事务与事件 / 发布成功事务', () => {
    const stateListener = vi.fn()
    const eventListener = vi.fn()
    const runtime = createTransactionRuntime({
      document: documentFixture(),
      idFactory: () => 'transaction-event',
      handlers: [handler('fixture.rename', () => ({
        status: 'patches',
        patches: [{ op: 'set', path: ['nodes', 'a', 'name'], value: 'Event' }],
      }))],
    })
    runtime.subscribe(stateListener)
    runtime.subscribeEvents(eventListener)

    const result = runtime.dispatch(command('fixture.rename'))

    expect(result).toMatchObject({
      status: 'committed',
      transaction: { id: 'transaction-event' },
    })
    expect(stateListener).toHaveBeenCalledTimes(1)
    expect(eventListener).toHaveBeenCalledWith(expect.objectContaining({
      type: 'committed',
      transaction: expect.objectContaining({ id: 'transaction-event' }),
    }))
  })

  it('OpenSpec: command-transaction / 成功事务与事件 / 发布失败结果', () => {
    const stateListener = vi.fn()
    const eventListener = vi.fn()
    const runtime = createTransactionRuntime({
      document: documentFixture(),
      handlers: [handler('fixture.reject', () => ({
        status: 'rejected',
        issues: [{ code: 'fixture.invalid', message: '目标无效' }],
      }))],
    })
    runtime.subscribe(stateListener)
    runtime.subscribeEvents(eventListener)

    const result = runtime.dispatch(command('fixture.reject'))

    expect(result).toMatchObject({
      status: 'rejected',
      issues: [{ code: 'fixture.invalid', message: '目标无效' }],
    })
    expect(eventListener).toHaveBeenCalledWith(expect.objectContaining({
      type: 'rejected',
      issues: result.issues,
    }))
    expect(stateListener).not.toHaveBeenCalled()
  })

  it('OpenSpec: command-transaction / 成功事务与事件 / 异步订阅者失败', async () => {
    const failedSideEffect = vi.fn()
    const runtime = createTransactionRuntime({
      document: documentFixture(),
      handlers: [handler('fixture.rename', (_document, input) => ({
        status: 'patches',
        patches: [{ op: 'set', path: ['nodes', 'a', 'name'], value: input.payload.name }],
      }))],
    })
    runtime.subscribeEvents((event) => {
      if (event.type !== 'committed') return
      void Promise.reject(new Error('storage unavailable')).catch(failedSideEffect)
    })

    expect(runtime.dispatch(command('fixture.rename', { name: 'One' })).status).toBe('committed')
    await Promise.resolve()
    expect(failedSideEffect).toHaveBeenCalledOnce()
    expect(runtime.document.nodes.a.name).toBe('One')
    expect(runtime.dispatch(command('fixture.rename', { name: 'Two' })).status).toBe('committed')
    expect(runtime.document.nodes.a.name).toBe('Two')
  })

  it('OpenSpec: command-transaction / 事务撤销重做与跳转 / 撤销并重做事务', () => {
    const runtime = createTransactionRuntime({
      document: documentFixture(),
      handlers: [handler('fixture.rename', () => ({
        status: 'patches',
        patches: [{ op: 'set', path: ['nodes', 'a', 'name'], value: 'Changed' }],
      }))],
    })
    runtime.dispatch(command('fixture.rename'))
    const entryIds = runtime.entries.map((entry) => entry.id)

    runtime.undo()
    expect(runtime.document.nodes.a.name).toBe('A')
    expect(runtime.entries.map((entry) => entry.id)).toEqual(entryIds)
    runtime.redo()
    expect(runtime.document.nodes.a.name).toBe('Changed')
    expect(runtime.entries.map((entry) => entry.id)).toEqual(entryIds)
  })

  it('OpenSpec: command-transaction / 事务撤销重做与跳转 / 跳转多个历史条目', () => {
    let transaction = 0
    const runtime = createTransactionRuntime({
      document: documentFixture(),
      idFactory: () => `id-${transaction++}`,
      handlers: [handler('fixture.rename', (_document, input) => ({
        status: 'patches',
        patches: [{ op: 'set', path: ['nodes', 'a', 'name'], value: input.payload.name }],
      }))],
    })
    runtime.dispatch(command('fixture.rename', { name: 'One' }, { label: 'One' }))
    runtime.dispatch(command('fixture.rename', { name: 'Two' }, { label: 'Two' }))
    runtime.dispatch(command('fixture.rename', { name: 'Three' }, { label: 'Three' }))

    const oneId = runtime.entries[1]?.id
    const threeId = runtime.entries[3]?.id
    runtime.navigate(oneId)
    expect(runtime.document.nodes.a.name).toBe('One')
    expect(runtime.activeEntryId).toBe(oneId)
    runtime.navigate(threeId)
    expect(runtime.document.nodes.a.name).toBe('Three')
    expect(runtime.activeEntryId).toBe(threeId)
  })

  it('OpenSpec: command-transaction / 事务撤销重做与跳转 / 历史中间提交新分支', () => {
    const runtime = createTransactionRuntime({
      document: documentFixture(),
      handlers: [handler('fixture.rename', (_document, input) => ({
        status: 'patches',
        patches: [{ op: 'set', path: ['nodes', 'a', 'name'], value: input.payload.name }],
      }))],
    })
    runtime.dispatch(command('fixture.rename', { name: 'One' }, { label: 'One' }))
    runtime.dispatch(command('fixture.rename', { name: 'Old future' }, { label: 'Old future' }))
    runtime.undo()
    expect(runtime.canRedo).toBe(true)

    runtime.dispatch(command('fixture.rename', { name: 'New future' }, { label: 'New future' }))

    expect(runtime.canRedo).toBe(false)
    expect(runtime.entries.map((entry) => entry.label)).toEqual(['开始', 'One', 'New future'])
  })

  it('OpenSpec: command-transaction / 历史合并容量与重置 / 合并连续属性输入', () => {
    let now = 100
    let id = 0
    const runtime = createTransactionRuntime({
      document: documentFixture(),
      clock: () => now,
      idFactory: () => `id-${id++}`,
      handlers: [handler('fixture.rename', (_document, input) => ({
        status: 'patches',
        patches: [{ op: 'set', path: ['nodes', 'a', 'name'], value: input.payload.name }],
      }))],
    })

    const first = runtime.dispatch(command(
      'fixture.rename',
      { name: 'First input' },
      { label: '修改名称', mergeKey: 'a:name' },
    ))
    now += 500
    const second = runtime.dispatch(command(
      'fixture.rename',
      { name: 'Last input' },
      { label: '修改名称', mergeKey: 'a:name' },
    ))

    expect(first.status).toBe('committed')
    expect(second).toMatchObject({ status: 'committed', coalesced: true })
    expect(second.transaction?.id).toBe(first.transaction?.id)
    expect(runtime.entries).toHaveLength(2)
    runtime.undo()
    expect(runtime.document.nodes.a.name).toBe('A')
    runtime.redo()
    expect(runtime.document.nodes.a.name).toBe('Last input')
  })

  it('OpenSpec: command-transaction / 历史合并容量与重置 / 不合并结构操作', () => {
    let now = 100
    const runtime = createTransactionRuntime({
      document: documentFixture(),
      clock: () => now,
      handlers: [handler('fixture.rename', (_document, input) => ({
        status: 'patches',
        patches: [{ op: 'set', path: ['nodes', 'a', 'name'], value: input.payload.name }],
      }))],
    })

    runtime.dispatch(command('fixture.rename', { name: 'First' }, { mergeKey: 'a:name' }))
    runtime.dispatch(command('fixture.rename', { name: 'Structure' }))
    runtime.undo()
    now += 100
    const branched = runtime.dispatch(command(
      'fixture.rename',
      { name: 'Branched' },
      { mergeKey: 'a:name' },
    ))

    expect(branched).toMatchObject({ status: 'committed', coalesced: false })
    expect(runtime.entries).toHaveLength(3)
  })

  it('OpenSpec: command-transaction / 历史合并容量与重置 / 裁剪历史容量', () => {
    const runtime = createTransactionRuntime({
      document: documentFixture(),
      historyLimit: 2,
      handlers: [handler('fixture.rename', (_document, input) => ({
        status: 'patches',
        patches: [{ op: 'set', path: ['nodes', 'a', 'name'], value: input.payload.name }],
      }))],
    })
    runtime.dispatch(command('fixture.rename', { name: 'One' }, { label: 'One' }))
    runtime.dispatch(command('fixture.rename', { name: 'Two' }, { label: 'Two' }))
    runtime.dispatch(command('fixture.rename', { name: 'Three' }, { label: 'Three' }))

    expect(runtime.entries.map((entry) => entry.label)).toEqual(['较早状态', 'Two', 'Three'])
    runtime.undo()
    runtime.undo()
    expect(runtime.document.nodes.a.name).toBe('One')
    expect(runtime.canUndo).toBe(false)
  })

  it('OpenSpec: command-transaction / 历史合并容量与重置 / 重置有效或无效文档', () => {
    const runtime = createTransactionRuntime({ document: documentFixture() })
    const next = documentFixture()
    next.nodes.a.name = 'Reset'

    expect(runtime.reset(next, '载入页面')).toEqual({ status: 'reset' })
    expect(runtime.document.nodes.a.name).toBe('Reset')
    expect(runtime.entries).toEqual([{ id: expect.any(String), label: '载入页面' }])

    const invalid = documentFixture()
    invalid.rootIds = ['missing']
    expect(runtime.reset(invalid)).toMatchObject({ status: 'rejected' })
    expect(runtime.document.nodes.a.name).toBe('Reset')
  })

  it('OpenSpec: command-transaction / 确定性运行时依赖 / 注入测试 ID 与时钟', () => {
    const runtime = createTransactionRuntime({
      document: documentFixture(),
      clock: () => 1_234,
      idFactory: () => 'deterministic-transaction',
      historyLimit: 7,
      mergeWindowMs: 321,
      handlers: [handler('fixture.rename', () => ({
        status: 'patches',
        patches: [{ op: 'set', path: ['nodes', 'a', 'name'], value: 'Deterministic' }],
      }))],
    })

    const result = runtime.dispatch(command('fixture.rename'))

    expect(result).toMatchObject({
      status: 'committed',
      transaction: {
        id: 'deterministic-transaction',
        committedAt: 1_234,
      },
    })
    expect(runtime.entries[1]?.id).toBe('deterministic-transaction')
  })
})
