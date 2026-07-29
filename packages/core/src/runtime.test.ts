import { describe, expect, it, vi } from 'vitest'
import {
  BUILTIN_COMMAND_TYPES,
  createTransactionRuntime,
  type EditorCommand,
} from './index'
import { documentFixture } from './test-fixtures'

function rename(id: string, name: string): EditorCommand {
  return {
    id,
    type: BUILTIN_COMMAND_TYPES.renameEntity,
    payload: { entityId: 'rectangle', name },
    meta: { label: `Rename ${name}`, source: 'test', targetIds: ['rectangle'] },
  }
}

describe('TransactionRuntime v5', () => {
  it('提交 Entity 命令并发布正式事务', () => {
    const runtime = createTransactionRuntime({
      document: documentFixture(),
      idFactory: () => 'transaction-1',
      clock: () => 100,
    })
    const listener = vi.fn()
    runtime.subscribeEvents(listener)
    expect(runtime.dispatch(rename('command-1', 'Renamed')).status).toBe('committed')
    expect(runtime.document.entities.rectangle?.name).toBe('Renamed')
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'committed' }))
  })

  it('undo、redo 和 navigate 恢复 v5 Entity 快照', () => {
    const runtime = createTransactionRuntime({ document: documentFixture() })
    runtime.dispatch(rename('one', 'One'))
    runtime.dispatch(rename('two', 'Two'))
    runtime.undo()
    expect(runtime.document.entities.rectangle?.name).toBe('One')
    runtime.redo()
    expect(runtime.document.entities.rectangle?.name).toBe('Two')
    runtime.navigate(runtime.entries[0]!.id)
    expect(runtime.document.entities.rectangle?.name).toBe('rectangle')
  })

  it('reset 拒绝 v4 且接受 v5', () => {
    const runtime = createTransactionRuntime({ document: documentFixture() })
    expect(runtime.reset({
      ...documentFixture(),
      schemaVersion: 3,
    } as never).status).toBe('rejected')
    expect(runtime.reset(documentFixture(), 'Reload').status).toBe('reset')
  })

  it('noop 与 rejected 不进入 History', () => {
    const runtime = createTransactionRuntime({ document: documentFixture() })
    expect(runtime.dispatch(rename('noop', 'rectangle')).status).toBe('noop')
    expect(runtime.dispatch(rename('missing', '')).status).toBe('rejected')
    expect(runtime.entries).toHaveLength(1)
  })
})
