import { describe, expect, it } from 'vitest'
import { createDocumentTransactionRuntime } from '@compose-ui/core'
import type { DocumentValidationIssueShape } from '@compose-ui/core'
import {
  createEmptyCadDocument,
  getCadArc,
  validateCadDocument,
  type CadDocument,
} from '../document'
import {
  cadTestCommandMessages as messages,
  createCadTestCommandContext as context,
} from '../test-fixtures'
import { createCadCommandHandlers } from './cad-command-handlers'
import { createCadArcSession, createCadCircleSession } from './cad-curve-commands'

function runtime() {
  return createDocumentTransactionRuntime<CadDocument, DocumentValidationIssueShape>({
    document: createEmptyCadDocument(),
    validate: validateCadDocument,
    handlers: createCadCommandHandlers(),
  })
}

describe('OpenSpec: cad-document / CAD CIRCLE 与 ARC 命令 / 两点画圆', () => {
  it('半径由两点距离求得', () => {
    const session = createCadCircleSession(context())
    expect(session.prompt?.message).toBe(messages.circleCenter)
    expect(session.advance({ kind: 'point', point: { x: 100, y: 100 } }).status).toBe('prompt')
    expect(session.prompt?.message).toBe(messages.circleRadius)

    const step = session.advance({ kind: 'point', point: { x: 130, y: 140 } })
    expect(step.status).toBe('commit')
    if (step.status !== 'commit' || !step.effect.command) return

    const store = runtime()
    expect(store.dispatch(step.effect.command).status).toBe('committed')
    const arc = getCadArc(store.document.entities[store.document.rootIds[0]!]!)
    // 3-4-5 直角三角形，半径 50。
    expect(arc).toEqual({ center: { x: 100, y: 100 }, radius: 50, startAngle: 0, sweep: 360 })

    store.undo()
    expect(store.document.rootIds).toEqual([])
  })

  it('半径为零被拒绝且不结束命令', () => {
    const session = createCadCircleSession(context())
    session.advance({ kind: 'point', point: { x: 100, y: 100 } })
    const step = session.advance({ kind: 'point', point: { x: 100, y: 100 } })
    expect(step.status).toBe('rejected')
    // 会话仍在等半径点。
    expect(session.prompt?.message).toBe(messages.circleRadius)
  })
})

describe('OpenSpec: cad-document / CAD CIRCLE 与 ARC 命令 / 三点画弧', () => {
  function drawArc(through: { x: number, y: number }) {
    const session = createCadArcSession(context())
    expect(session.prompt?.message).toBe(messages.arcStartPoint)
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    expect(session.prompt?.message).toBe(messages.arcThroughPoint)
    session.advance({ kind: 'point', point: through })
    expect(session.prompt?.message).toBe(messages.arcEndPoint)
    return session.advance({ kind: 'point', point: { x: 20, y: 0 } })
  }

  it('弧经过三点', () => {
    const step = drawArc({ x: 10, y: -10 })
    if (step.status !== 'commit' || !step.effect.command) throw new Error('应当提交')

    const store = runtime()
    expect(store.dispatch(step.effect.command).status).toBe('committed')
    const arc = getCadArc(store.document.entities[store.document.rootIds[0]!]!)!
    expect(arc.center).toEqual({ x: 10, y: 0 })
    expect(arc.radius).toBeCloseTo(10)
    expect(arc.sweep).toBeCloseTo(180)
  })

  it('中间点换一侧，弧就往另一侧鼓', () => {
    const step = drawArc({ x: 10, y: 10 })
    if (step.status !== 'commit' || !step.effect.command) throw new Error('应当提交')
    const payload = step.effect.command.payload as unknown as {
      entity: { components: { CadArc: { sweep: number } } }
    }
    expect(payload.entity.components.CadArc.sweep).toBeCloseTo(-180)
  })

  it('三点共线时拒绝但命令继续', () => {
    const session = createCadArcSession(context())
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    session.advance({ kind: 'point', point: { x: 10, y: 0 } })
    const rejected = session.advance({ kind: 'point', point: { x: 20, y: 0 } })
    expect(rejected).toEqual({ status: 'rejected', message: messages.collinearArc })
    // 前两点仍然有效，换一个不共线的第三点即可完成——沿一条既有直线连点三下很常见，
    // 结束命令会让用户从头再来。
    expect(session.prompt?.message).toBe(messages.arcEndPoint)
    expect(session.advance({ kind: 'point', point: { x: 10, y: 10 } }).status).toBe('commit')
  })

  it('取消不写入文档', () => {
    const session = createCadArcSession(context())
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    expect(session.advance({ kind: 'cancel' }).status).toBe('cancelled')
  })
})
