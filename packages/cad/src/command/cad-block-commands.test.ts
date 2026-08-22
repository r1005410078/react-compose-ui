import { describe, expect, it } from 'vitest'
import { createDocumentTransactionRuntime } from '@compose-ui/core'
import type { DocumentValidationIssueShape } from '@compose-ui/core'
import {
  createCadLineEntity,
  createEmptyCadDocument,
  getCadInsert,
  getCadLine,
  validateCadDocument,
  type CadDocument,
} from '../document'
import { createCadTestCommandContext as context } from '../test-fixtures'
import { createCadBlockSession, createCadInsertSession } from './cad-block-commands'
import { createCadCommandHandlers } from './cad-command-handlers'

/** 两条线组成一个方角，占据 (100,100)-(110,110)。 */
function documentWithTwoLines(): CadDocument {
  const base = createEmptyCadDocument()
  return {
    ...base,
    rootIds: ['l1', 'l2'],
    entities: {
      l1: createCadLineEntity('l1', {
        layerId: '0',
        start: { x: 100, y: 100 },
        end: { x: 110, y: 100 },
      }),
      l2: createCadLineEntity('l2', {
        layerId: '0',
        start: { x: 110, y: 100 },
        end: { x: 110, y: 110 },
      }),
    },
  }
}

function runtime(document = documentWithTwoLines()) {
  return createDocumentTransactionRuntime<CadDocument, DocumentValidationIssueShape>({
    document,
    validate: validateCadDocument,
    handlers: createCadCommandHandlers(),
  })
}

describe('OpenSpec: cad-document / CAD BLOCK 与 INSERT 命令 / 先选后执行建块', () => {
  it('一个事务内产生块定义并用实例取代两条线', () => {
    const session = createCadBlockSession(context(['l1', 'l2']))

    expect(session.prompt?.accepts).toEqual(['text'])
    expect(session.advance({ kind: 'text', text: 'CORNER' }).status).toBe('prompt')
    const step = session.advance({ kind: 'point', point: { x: 100, y: 100 } })
    expect(step.status).toBe('commit')
    if (step.status !== 'commit' || !step.effect.command) return

    const store = runtime()
    expect(store.dispatch(step.effect.command).status).toBe('committed')

    // 原件消失，取而代之的是一个实例。
    expect(store.document.entities.l1).toBeUndefined()
    expect(store.document.rootIds).toHaveLength(1)
    const insert = getCadInsert(store.document.entities[store.document.rootIds[0]!]!)
    expect(insert).toMatchObject({ position: { x: 100, y: 100 }, rotation: 0 })

    // 块内几何按基点换算成局部坐标：世界 (100,100) 变成局部原点。
    const block = store.document.blocks[insert!.blockId]!
    expect(block.name).toBe('CORNER')
    expect(getCadLine(block.entities.l1!)).toEqual({
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
    })
  })

  it('一次撤销回到建块之前', () => {
    const session = createCadBlockSession(context(['l1', 'l2']))
    session.advance({ kind: 'text', text: 'CORNER' })
    const step = session.advance({ kind: 'point', point: { x: 100, y: 100 } })
    if (step.status !== 'commit' || !step.effect.command) throw new Error('应当提交')

    const store = runtime()
    store.dispatch(step.effect.command)
    store.undo()

    expect(store.document.rootIds).toEqual(['l1', 'l2'])
    expect(store.document.blocks).toEqual({})
  })

  it('提交时给出新块 id 与被取代的原件', () => {
    const session = createCadBlockSession(context(['l1', 'l2']))
    session.advance({ kind: 'text', text: 'CORNER' })
    const step = session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    if (step.status !== 'commit') throw new Error('应当提交')

    expect(step.effect.createdBlockId).toBeTruthy()
    expect(step.effect.removed).toEqual(['l1', 'l2'])
  })
})

describe('OpenSpec: cad-document / CAD BLOCK 与 INSERT 命令 / 先执行后选建块', () => {
  it('没有选择时先提示选择对象', () => {
    const session = createCadBlockSession(context())

    expect(session.prompt?.accepts).toEqual(['selection'])
    session.advance({ kind: 'selection', ids: ['l1', 'l2'] })
    expect(session.advance({ kind: 'accept' }).status).toBe('prompt')
    expect(session.prompt?.accepts).toEqual(['text'])
  })

  it('什么都没选就确认时命令结束', () => {
    const session = createCadBlockSession(context())

    expect(session.advance({ kind: 'accept' }).status).toBe('cancelled')
  })

  it('空块名被拒绝且不结束会话', () => {
    const session = createCadBlockSession(context(['l1']))

    expect(session.advance({ kind: 'text', text: '  ' }).status).toBe('rejected')
    expect(session.advance({ kind: 'text', text: 'OK' }).status).toBe('prompt')
  })

  it('重名的块被拒绝', () => {
    const session = createCadBlockSession(context(['l1'], [{ id: 'b1', name: 'CORNER' }]))

    expect(session.advance({ kind: 'text', text: 'CORNER' }).status).toBe('rejected')
  })
})

describe('OpenSpec: cad-document / CAD BLOCK 与 INSERT 命令 / 插入', () => {
  it('按名插入，插入点即实例位置', () => {
    const session = createCadInsertSession(context([], [{ id: 'b1', name: 'CORNER' }]))

    expect(session.advance({ kind: 'text', text: 'CORNER' }).status).toBe('prompt')
    expect(session.prompt?.accepts).toEqual(['point'])
    const step = session.advance({ kind: 'point', point: { x: 20, y: 30 } })
    expect(step.status).toBe('commit')
    if (step.status !== 'commit') return

    const payload = step.effect.command!.payload as unknown as {
      entity: { components: Record<string, { blockId: string; position: { x: number } }> }
    }
    expect(payload.entity.components.CadInsert).toMatchObject({
      blockId: 'b1',
      position: { x: 20, y: 30 },
    })
  })

  it('块名匹配不区分大小写', () => {
    const session = createCadInsertSession(context([], [{ id: 'b1', name: 'CORNER' }]))

    expect(session.advance({ kind: 'text', text: 'corner' }).status).toBe('prompt')
  })

  it('未知块名被拒绝且不结束会话', () => {
    const session = createCadInsertSession(context([], [{ id: 'b1', name: 'CORNER' }]))

    expect(session.advance({ kind: 'text', text: 'NOPE' }).status).toBe('rejected')
    // 会话仍停在原提示，随后正常插入。
    expect(session.advance({ kind: 'text', text: 'CORNER' }).status).toBe('prompt')
  })
})

describe('OpenSpec: cad-document / CAD 块定义表 / handler 边界', () => {
  it('块内不得再插入块', () => {
    const store = runtime()
    const first = createCadBlockSession(context(['l1', 'l2']))
    first.advance({ kind: 'text', text: 'CORNER' })
    const made = first.advance({ kind: 'point', point: { x: 100, y: 100 } })
    if (made.status !== 'commit' || !made.effect.command) throw new Error('应当提交')
    store.dispatch(made.effect.command)

    // 把刚生成的实例再收一次块：应当在命令层就被拒绝。
    const second = createCadBlockSession(context([store.document.rootIds[0]!]))
    second.advance({ kind: 'text', text: 'OUTER' })
    const nested = second.advance({ kind: 'point', point: { x: 0, y: 0 } })
    if (nested.status !== 'commit' || !nested.effect.command) throw new Error('应当提交')

    expect(store.dispatch(nested.effect.command).status).toBe('rejected')
  })
})
