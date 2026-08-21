import { describe, expect, it } from 'vitest'
import { createDocumentTransactionRuntime } from '@compose-ui/core'
import type { DocumentValidationIssueShape } from '@compose-ui/core'
import {
  createCadLineEntity,
  createEmptyCadDocument,
  validateCadDocument,
  type CadDocument,
} from '../document'
import { createCadTestCommandContext as context } from '../test-fixtures'
import { createCadCommandHandlers } from './cad-command-handlers'
import { createCadEraseSession } from './cad-erase-command'

function documentWithTwoLines(): CadDocument {
  const base = createEmptyCadDocument()
  return {
    ...base,
    rootIds: ['l1', 'l2'],
    entities: {
      l1: createCadLineEntity('l1', { layerId: '0', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }),
      l2: createCadLineEntity('l2', { layerId: '0', start: { x: 0, y: 5 }, end: { x: 10, y: 5 } }),
    },
  }
}

function runtime() {
  return createDocumentTransactionRuntime<CadDocument, DocumentValidationIssueShape>({
    document: documentWithTwoLines(),
    validate: validateCadDocument,
    handlers: createCadCommandHandlers(),
  })
}

describe('OpenSpec: cad-document / CAD ERASE 命令与先选后执行 / 先选后执行', () => {
  it('启动时已有选择就不再提示，第一次推进即提交', () => {
    const session = createCadEraseSession(context(['l1', 'l2']))

    // prompt 为 null 是「没有要等的输入」的信号，宿主据此立刻推进。
    expect(session.prompt).toBeNull()

    const step = session.advance({ kind: 'accept' })
    expect(step.status).toBe('commit')
    if (step.status !== 'commit') return
    expect(step.effect.removed).toEqual(['l1', 'l2'])
  })

  it('两条线在一次事务中删除，一次撤销即可全部恢复', () => {
    const session = createCadEraseSession(context(['l1', 'l2']))
    const step = session.advance({ kind: 'accept' })
    if (step.status !== 'commit' || !step.effect.command) throw new Error('应当提交')

    const store = runtime()
    expect(store.dispatch(step.effect.command).status).toBe('committed')
    expect(store.document.rootIds).toEqual([])

    store.undo()
    expect(store.document.rootIds).toEqual(['l1', 'l2'])
  })
})

describe('OpenSpec: cad-document / CAD ERASE 命令与先选后执行 / 先执行后选', () => {
  it('没有选择时提示选择对象，收到的选择被累积', () => {
    const session = createCadEraseSession(context())

    expect(session.prompt?.accepts).toEqual(['selection'])

    expect(session.advance({ kind: 'selection', ids: ['l1'] }).status).toBe('prompt')
    expect(session.advance({ kind: 'selection', ids: ['l2'] }).status).toBe('prompt')

    const step = session.advance({ kind: 'accept' })
    expect(step.status).toBe('commit')
    if (step.status !== 'commit') return
    expect(step.effect.removed).toEqual(['l1', 'l2'])
  })

  it('重复送进来的同一个 Entity 只算一次', () => {
    const session = createCadEraseSession(context())
    session.advance({ kind: 'selection', ids: ['l1'] })
    session.advance({ kind: 'selection', ids: ['l1', 'l2'] })

    const step = session.advance({ kind: 'accept' })
    if (step.status !== 'commit') throw new Error('应当提交')
    expect(step.effect.removed).toEqual(['l1', 'l2'])
  })

  it('预览阶段就能读到已选中的 id', () => {
    const session = createCadEraseSession(context())
    const step = session.advance({ kind: 'selection', ids: ['l1'] })

    expect(step.status).toBe('prompt')
    if (step.status !== 'prompt') return
    expect(step.preview?.removed).toEqual(['l1'])
    expect(step.preview?.command).toBeNull()
  })
})

describe('OpenSpec: cad-document / CAD ERASE 命令与先选后执行 / 边界', () => {
  it('什么都没选就确认时命令结束且不产生文档命令', () => {
    const session = createCadEraseSession(context())

    expect(session.advance({ kind: 'accept' }).status).toBe('cancelled')
  })

  it('取消结束整条命令', () => {
    const session = createCadEraseSession(context(['l1']))

    expect(session.advance({ kind: 'cancel' }).status).toBe('cancelled')
  })

  it('本步不接受的输入被拒绝且不结束会话', () => {
    const session = createCadEraseSession(context())

    const rejected = session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    expect(rejected.status).toBe('rejected')

    expect(session.advance({ kind: 'selection', ids: ['l1'] }).status).toBe('prompt')
  })
})
