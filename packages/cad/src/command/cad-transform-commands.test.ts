import { describe, expect, it } from 'vitest'
import type { ComposeCommandStep } from '@compose-ui/commands'
import { CAD_COMMAND_TYPES } from './cad-command-handlers'
import { createCadCopyCommand, createCadMoveCommand } from './cad-transform-commands'
import type { CadCommandEffect } from './cad-command-context'
import { cadTestCommandMessages, createCadTestCommandContext } from '../test-fixtures'

function payload(step: ComposeCommandStep<CadCommandEffect>) {
  const effect = step.status === 'commit'
    ? step.effect
    : step.status === 'prompt' ? step.commit : undefined
  return effect?.command?.payload as unknown as {
    entityIds: readonly string[]
    delta: { x: number, y: number }
    newIds?: readonly string[]
  } | undefined
}

describe('CAD MOVE / COPY', () => {
  it('OpenSpec: cad-document / CAD 几何位移 / 先选后执行时直接问基点', () => {
    const session = createCadMoveCommand(cadTestCommandMessages)
      .start(createCadTestCommandContext(['a', 'b']))
    expect(session.prompt?.message).toBe(cadTestCommandMessages.basePoint)

    session.advance({ kind: 'point', point: { x: 10, y: 10 } })
    const step = session.advance({ kind: 'point', point: { x: 40, y: 30 } })
    expect(step.status).toBe('commit')
    expect(payload(step)).toEqual({ entityIds: ['a', 'b'], delta: { x: 30, y: 20 } })
  })

  it('OpenSpec: cad-document / CAD 几何位移 / 没有选择时先提示选择对象', () => {
    const session = createCadMoveCommand(cadTestCommandMessages).start(createCadTestCommandContext())
    expect(session.prompt?.message).toBe(cadTestCommandMessages.selectObjects)
    session.advance({ kind: 'selection', ids: ['a'] })
    const afterAccept = session.advance({ kind: 'accept' })
    expect(afterAccept.status).toBe('prompt')
    expect(session.prompt?.message).toBe(cadTestCommandMessages.basePoint)
  })

  /**
   * @remarks
   * 位移始终以**最初的基点**为起点而不是上一个副本的落点：连续放置时用户心里的参照是那一个
   * 基点，AutoCAD 也是如此。
   */
  it('OpenSpec: cad-document / CAD COPY 连续放置 / 每个落点各产生一个副本且会话继续', () => {
    const session = createCadCopyCommand(cadTestCommandMessages)
      .start(createCadTestCommandContext(['a']))
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })

    const first = session.advance({ kind: 'point', point: { x: 100, y: 0 } })
    expect(first.status).toBe('prompt')
    expect(payload(first)?.delta).toEqual({ x: 100, y: 0 })
    expect(payload(first)?.newIds).toHaveLength(1)

    const second = session.advance({ kind: 'point', point: { x: 200, y: 0 } })
    expect(second.status).toBe('prompt')
    expect(payload(second)?.delta).toEqual({ x: 200, y: 0 })
    expect(payload(second)?.newIds?.[0]).not.toBe(payload(first)?.newIds?.[0])

    expect(session.advance({ kind: 'accept' }).status).toBe('cancelled')
  })

  it('OpenSpec: cad-document / CAD 几何位移 / MOVE 与 COPY 派发不同的命令类型', () => {
    const move = createCadMoveCommand(cadTestCommandMessages)
      .start(createCadTestCommandContext(['a']))
    move.advance({ kind: 'point', point: { x: 0, y: 0 } })
    const moved = move.advance({ kind: 'point', point: { x: 5, y: 5 } })
    expect(moved.status === 'commit' && moved.effect.command?.type)
      .toBe(CAD_COMMAND_TYPES.translateEntities)

    const copy = createCadCopyCommand(cadTestCommandMessages)
      .start(createCadTestCommandContext(['a']))
    copy.advance({ kind: 'point', point: { x: 0, y: 0 } })
    const copied = copy.advance({ kind: 'point', point: { x: 5, y: 5 } })
    expect(copied.status === 'prompt' && copied.commit?.command?.type)
      .toBe(CAD_COMMAND_TYPES.duplicateEntities)
  })
})
