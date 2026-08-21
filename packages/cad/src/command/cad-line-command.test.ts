import { describe, expect, it } from 'vitest'
import { createDocumentTransactionRuntime } from '@compose-ui/core'
import type { DocumentValidationIssueShape, EditorCommand } from '@compose-ui/core'
import { createEmptyCadDocument, getCadLine, validateCadDocument, type CadDocument } from '../document'
import { createCadCommandHandlers } from './cad-command-handlers'
import { createCadTestCommandContext as context } from '../test-fixtures'
import { createCadLineSession } from './cad-line-command'

const point = (x: number, y: number) => ({ kind: 'point', point: { x, y } } as const)

function runtime() {
  return createDocumentTransactionRuntime<CadDocument, DocumentValidationIssueShape>({
    document: createEmptyCadDocument(),
    validate: validateCadDocument,
    handlers: createCadCommandHandlers(),
  })
}

function lines(document: CadDocument) {
  return document.rootIds.map((id) => getCadLine(document.entities[id]!)!)
}

describe('LINE 命令状态机', () => {
  it('OpenSpec: cad-document / CAD 直线命令 / 两点画出一条直线', () => {
    const session = createCadLineSession(context())
    expect(session.prompt?.message).toBe('指定第一点')
    expect(session.advance(point(0, 0)).status).toBe('prompt')
    expect(session.prompt?.message).toBe('指定下一点')

    session.advance(point(100, 0))
    const finished = session.advance({ kind: 'accept' })
    expect(finished.status).toBe('commit')
    if (finished.status !== 'commit') return
    expect(finished.effect.segments).toEqual([{ start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }])

    const store = runtime()
    store.dispatch(finished.effect.command as EditorCommand)
    expect(lines(store.document)).toEqual([{ start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }])

    // 一次撤销回到命令开始之前。
    store.undo()
    expect(store.document.rootIds).toEqual([])
  })

  it('OpenSpec: cad-document / CAD 直线命令 / 连续取点产生折线', () => {
    const session = createCadLineSession(context())
    session.advance(point(0, 0))
    session.advance(point(100, 0))
    const stepped = session.advance(point(100, 100))
    expect(stepped.status).toBe('prompt')
    if (stepped.status === 'prompt') {
      // 预览在命令进行中即可用，且不携带待派发命令。
      expect(stepped.preview?.segments).toHaveLength(2)
      expect(stepped.preview?.command).toBeNull()
    }

    const finished = session.advance({ kind: 'keyword', key: 'f' })
    expect(finished.status).toBe('commit')
    if (finished.status !== 'commit') return

    const store = runtime()
    store.dispatch(finished.effect.command as EditorCommand)
    expect(lines(store.document)).toHaveLength(2)
    store.undo()
    expect(store.document.rootIds).toEqual([])
  })

  it('OpenSpec: cad-document / CAD 直线命令 / 放弃上一个顶点', () => {
    const session = createCadLineSession(context())
    session.advance(point(0, 0))
    session.advance(point(100, 0))
    session.advance(point(100, 100))

    const undone = session.advance({ kind: 'keyword', key: 'U' })
    expect(undone.status).toBe('prompt')
    if (undone.status === 'prompt') expect(undone.preview?.segments).toHaveLength(1)

    // 退到只剩第一点再放弃，等同于命令从未开始。
    session.advance({ kind: 'keyword', key: 'U' })
    expect(session.advance({ kind: 'keyword', key: 'U' }).status).toBe('cancelled')
  })

  it('OpenSpec: cad-document / CAD 直线命令 / 取消不写入文档', () => {
    const session = createCadLineSession(context())
    session.advance(point(0, 0))
    session.advance(point(100, 0))
    expect(session.advance({ kind: 'cancel' }).status).toBe('cancelled')

    const store = runtime()
    expect(store.document.rootIds).toEqual([])
    expect(store.canUndo).toBe(false)
  })

  it('OpenSpec: commands / 多步提示命令会话 / 非法输入不结束会话', () => {
    const session = createCadLineSession(context())
    // 第一点之前只接受取点。
    expect(session.advance({ kind: 'keyword', key: 'U' })).toEqual({
      status: 'rejected',
      message: '需要一个点',
    })
    expect(session.advance({ kind: 'accept' }).status).toBe('rejected')
    // 会话仍停在原提示，随后正常取点。
    expect(session.prompt?.message).toBe('指定第一点')
    expect(session.advance(point(1, 1)).status).toBe('prompt')

    // 未列出的关键字同样被拒绝，且不改变已有顶点。
    const rejected = session.advance({ kind: 'keyword', key: 'X' })
    expect(rejected.status).toBe('rejected')
    session.advance(point(2, 2))
    const finished = session.advance({ kind: 'accept' })
    expect(finished.status).toBe('commit')
  })
})

describe('CAD 直线图元', () => {
  it('OpenSpec: cad-document / CAD 直线图元 / 拒绝不存在的图层', () => {
    const base = createEmptyCadDocument()
    const result = validateCadDocument({
      ...base,
      rootIds: ['l1'],
      entities: {
        l1: {
          id: 'l1',
          name: 'Line',
          components: {
            CadPlacement: { layerId: '不存在' },
            CadLine: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
          },
        },
      },
    })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.map(({ code }) => code)).toContain('entity.missing-layer')
  })

  it('OpenSpec: cad-document / CAD 直线图元 / 端点必须是有限数值', () => {
    const base = createEmptyCadDocument()
    for (const line of [
      { start: { x: 0, y: 0 } },
      { start: { x: Number.NaN, y: 0 }, end: { x: 1, y: 1 } },
      { start: { x: 0, y: 0 }, end: { x: Number.POSITIVE_INFINITY, y: 1 } },
    ]) {
      const result = validateCadDocument({
        ...base,
        rootIds: ['l1'],
        entities: {
          l1: { id: 'l1', name: 'Line', components: { CadPlacement: { layerId: '0' }, CadLine: line } },
        },
      })
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.issues.map(({ code }) => code)).toContain('entity.invalid-geometry')
      }
    }
  })

  it('OpenSpec: cad-document / CAD 直线图元 / 直线通过校验并可持久化', () => {
    const store = runtime()
    const entity = {
      id: 'l1',
      name: 'Line',
      components: {
        CadPlacement: { layerId: '0' },
        CadLine: { start: { x: 3, y: 4 }, end: { x: 5, y: 6 } },
      },
    }
    expect(store.dispatch({ id: 'c1', type: 'cad.entity.add', payload: { entity } as never }).status)
      .toBe('committed')
    expect(validateCadDocument(store.document).valid).toBe(true)
    expect(getCadLine(store.document.entities.l1!)).toEqual({
      start: { x: 3, y: 4 },
      end: { x: 5, y: 6 },
    })

    expect(store.dispatch({ id: 'c2', type: 'cad.entity.remove', payload: { entityId: 'l1' } as never }).status)
      .toBe('committed')
    expect(store.document.rootIds).toEqual([])
  })
})
