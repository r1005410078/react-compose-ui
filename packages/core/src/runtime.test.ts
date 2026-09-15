import { describe, expect, it, vi } from 'vitest'
import {
  BUILTIN_COMMAND_TYPES,
  createTransactionRuntime,
  getComposeHierarchy,
  validateComposeDocument,
  type EditorCommand,
} from './index'
import {
  containerEntity,
  documentFixture,
  rendererEntity,
  ROOT_FRAME_ID,
} from './test-fixtures'

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

  it('batch 只在整体应用后校验一次，子命令逐条推进但不逐条校验', () => {
    // 逐条校验是 O(文档 × 子命令)：一份五千 Entity 的图纸上粘贴五百个实测 47 秒。
    const validate = vi.fn(validateComposeDocument)
    const runtime = createTransactionRuntime({ document: documentFixture(), validate })
    validate.mockClear()
    const batch = (commands: readonly EditorCommand[]): EditorCommand => ({
      id: 'batch',
      type: BUILTIN_COMMAND_TYPES.batch,
      payload: { commands: commands as unknown as never },
    })
    expect(runtime.dispatch(batch([
      rename('one', 'One'),
      rename('two', 'Two'),
      rename('three', 'Three'),
    ])).status).toBe('committed')
    expect(validate).toHaveBeenCalledTimes(1)
    expect(runtime.document.entities.rectangle?.name).toBe('Three')
    expect(runtime.entries).toHaveLength(2)

    // 原子性不靠逐条校验：第三条被拒时前两条也不落地。
    expect(runtime.dispatch(batch([
      rename('four', 'Four'),
      rename('five', 'Five'),
      rename('invalid', ''),
    ])).status).toBe('rejected')
    expect(runtime.document.entities.rectangle?.name).toBe('Three')
    expect(runtime.entries).toHaveLength(2)
  })

  it('batch 里先 set 再对同一对象 insert，整体重放后不重复插入', () => {
    // 子命令就地推进时 set 的值对象会与候选文档共享引用；后一条 insert 若改写了它，
    // 外层按合并 patches 重放会把那次 insert 做两遍。
    const runtime = createTransactionRuntime({ document: documentFixture() })
    expect(runtime.dispatch({
      id: 'batch',
      type: BUILTIN_COMMAND_TYPES.batch,
      payload: {
        commands: [
          {
            id: 'holder',
            type: BUILTIN_COMMAND_TYPES.createEntity,
            payload: { entity: containerEntity('holder'), parentId: ROOT_FRAME_ID, index: 0 },
          },
          {
            id: 'leaf',
            type: BUILTIN_COMMAND_TYPES.createEntity,
            payload: { entity: rendererEntity('leaf'), parentId: 'holder', index: 0 },
          },
        ] as unknown as never,
      },
    }).status).toBe('committed')
    expect(getComposeHierarchy(runtime.document.entities.holder!)?.childIds).toEqual(['leaf'])
  })

  it('noop 与 rejected 不进入 History', () => {
    const runtime = createTransactionRuntime({ document: documentFixture() })
    expect(runtime.dispatch(rename('noop', 'rectangle')).status).toBe('noop')
    expect(runtime.dispatch(rename('missing', '')).status).toBe('rejected')
    expect(runtime.entries).toHaveLength(1)
  })

  it('相同 mergeKey 的连续 set 事务折叠为单条 forward/inverse', () => {
    let now = 1_000
    const runtime = createTransactionRuntime({
      document: documentFixture(),
      clock: () => now,
      mergeWindowMs: 750,
    })
    const appearance = (color: string) => ({
      id: `cmd-${color}`,
      type: BUILTIN_COMMAND_TYPES.setAppearance,
      payload: {
        entityId: 'rectangle',
        appearance: {
          backgroundPaint: { kind: 'solid', color },
          borderColor: 'transparent',
          borderWidth: 0,
          borderRadius: 0,
          opacity: 1,
        },
      },
      meta: {
        label: '修改外观',
        source: 'test',
        targetIds: ['rectangle'],
        mergeKey: 'inspector:rectangle:entity.appearance.set',
      },
    })

    expect(runtime.dispatch(appearance('#111111')).status).toBe('committed')
    now += 10
    expect(runtime.dispatch(appearance('#222222')).status).toBe('committed')
    now += 10
    const third = runtime.dispatch(appearance('#333333'))
    expect(third.status).toBe('committed')
    if (third.status !== 'committed') throw new Error('expected committed')
    expect(third.coalesced).toBe(true)
    expect(runtime.entries).toHaveLength(2)
    expect(third.transaction.forward).toHaveLength(1)
    expect(third.transaction.inverse).toHaveLength(1)
    expect(third.transaction.forward[0]).toMatchObject({
      op: 'set',
      path: ['entities', 'rectangle', 'components', 'Appearance'],
    })
    const forward = third.transaction.forward[0]
    expect(forward?.op).toBe('set')
    if (forward?.op !== 'set') throw new Error('expected set patch')
    expect(
      (forward.value as { backgroundPaint: { color: string } }).backgroundPaint.color,
    ).toBe('#333333')
    runtime.undo()
    expect(
      (runtime.document.entities.rectangle?.components.Appearance as {
        backgroundPaint: { color: string }
      } | undefined)?.backgroundPaint.color,
    ).not.toBe('#333333')
  })
})
