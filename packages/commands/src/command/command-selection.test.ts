import { describe, expect, it } from 'vitest'
import type {
  ComposeCommandDefinition,
  ComposeCommandPrompt,
  ComposeCommandSession,
} from './command-types'

/*
 * 一条只做「收集对象再确认」的伪命令。本包不认识任何文档协议，因此这里的标识就是普通字符串
 * ——用例锁定的是协议本身：两条次序共用同一条状态机，且「没有要等的输入」表达得出来。
 */

interface FakeContext {
  readonly selection: readonly string[]
}

interface FakeEffect {
  readonly targets: readonly string[]
}

const selectPrompt: ComposeCommandPrompt = { message: '选择对象', accepts: ['selection'] }

function fakeCommand(): ComposeCommandDefinition<FakeContext, FakeEffect> {
  return {
    id: 'PICK',
    title: 'PICK',
    start(context): ComposeCommandSession<FakeEffect> {
      const picked = [...context.selection]
      let prompt: ComposeCommandPrompt | null = picked.length > 0 ? null : selectPrompt
      return {
        get prompt() {
          return prompt
        },
        advance(input) {
          if (input.kind === 'cancel') return { status: 'cancelled' }
          if (input.kind === 'selection') {
            picked.push(...input.ids)
            prompt = selectPrompt
            return { status: 'prompt', prompt }
          }
          if (input.kind === 'accept') {
            return picked.length === 0
              ? { status: 'cancelled' }
              : { status: 'commit', effect: { targets: picked } }
          }
          return { status: 'rejected', message: '需要选择对象' }
        },
      }
    },
  }
}

describe('OpenSpec: commands / 命令消费选择集 / 启动时已有选择则不再提示', () => {
  it('prompt 为 null，宿主据此立刻推进并拿到效果', () => {
    const session = fakeCommand().start({ selection: ['a', 'b'] })

    expect(session.prompt).toBeNull()

    const step = session.advance({ kind: 'accept' })
    expect(step.status).toBe('commit')
    if (step.status !== 'commit') return
    expect(step.effect.targets).toEqual(['a', 'b'])
  })
})

describe('OpenSpec: commands / 命令消费选择集 / 启动时没有选择则提示选择', () => {
  it('提示接受选择输入，收到的选择被累积', () => {
    const session = fakeCommand().start({ selection: [] })

    expect(session.prompt?.accepts).toEqual(['selection'])

    session.advance({ kind: 'selection', ids: ['a'] })
    session.advance({ kind: 'selection', ids: ['b'] })
    const step = session.advance({ kind: 'accept' })

    expect(step.status).toBe('commit')
    if (step.status !== 'commit') return
    expect(step.effect.targets).toEqual(['a', 'b'])
  })
})

describe('OpenSpec: commands / 命令消费选择集 / 不接受选择的步骤拒绝选择输入', () => {
  it('拒绝不结束会话，下一次输入仍按原提示判定', () => {
    const session = fakeCommand().start({ selection: [] })

    const rejected = session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    expect(rejected.status).toBe('rejected')

    expect(session.advance({ kind: 'selection', ids: ['a'] }).status).toBe('prompt')
  })
})
