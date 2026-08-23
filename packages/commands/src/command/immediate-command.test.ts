import { describe, expect, it, vi } from 'vitest'
import { createComposeCommandRegistry } from './command-registry'
import { createComposeImmediateCommand, runComposeCommandImmediately } from './immediate-command'
import type { ComposeCommandDefinition, ComposeCommandSession } from './command-types'

interface Effect {
  readonly done?: boolean
}

/** 一条要一个点才肯提交的命令，用来对照退化情形。 */
function twoStep(): ComposeCommandDefinition<null, Effect> {
  return {
    id: 'TWOSTEP',
    title: '两步',
    start(): ComposeCommandSession<Effect> {
      return {
        prompt: { message: '指定点', accepts: ['point'] },
        advance: () => ({ status: 'commit', effect: { done: true } }),
      }
    },
  }
}

describe('OpenSpec: commands / 一次性动作是命令会话的退化情形 / 退化命令一次确认即提交', () => {
  it('会话的 prompt 是 null，确认后提交且副作用已发生', () => {
    const run = vi.fn()
    const command = createComposeImmediateCommand<null, Effect>({
      id: 'edit.group',
      aliases: ['GROUP'],
      title: '编组',
      run,
    })

    const session = command.start(null)
    expect(session.prompt).toBeNull()

    const step = session.advance({ kind: 'accept' })

    expect(run).toHaveBeenCalledTimes(1)
    expect(step).toEqual({ status: 'commit', effect: {} })
  })

  it('取消不执行动作', () => {
    const run = vi.fn()
    const command = createComposeImmediateCommand<null, Effect>({ id: 'A', title: 'A', run })

    expect(command.start(null).advance({ kind: 'cancel' })).toEqual({ status: 'cancelled' })
    expect(run).not.toHaveBeenCalled()
  })

  it('每次 start 产出独立会话，因此同一条动作可以反复执行', () => {
    const run = vi.fn()
    const command = createComposeImmediateCommand<null, Effect>({ id: 'A', title: 'A', run })

    command.start(null).advance({ kind: 'accept' })
    command.start(null).advance({ kind: 'accept' })

    expect(run).toHaveBeenCalledTimes(2)
  })

  it('退化命令与手写会话命令同类，可以放进同一个注册表', () => {
    const registry = createComposeCommandRegistry<null, Effect>([
      twoStep(),
      createComposeImmediateCommand<null, Effect>({
        id: 'history.undo',
        aliases: ['UNDO', 'U'],
        title: '撤销',
        run: () => {},
      }),
    ])

    // 别名与全名共用同一个大小写无关的命名空间，退化命令不例外。
    expect(registry.resolve('undo')?.id).toBe('history.undo')
    expect(registry.resolve('TWOSTEP')?.id).toBe('TWOSTEP')
  })
})

describe('OpenSpec: commands / 一次性动作是命令会话的退化情形 / 需要输入的命令不被立即跑掉', () => {
  it('多步命令返回 needs-input 且会话未被推进', () => {
    const outcome = runComposeCommandImmediately(twoStep(), null)

    expect(outcome.status).toBe('needs-input')
    // 会话原样交回：再 start 一次会得到两条互不相干的会话。
    if (outcome.status !== 'needs-input') throw new Error('unreachable')
    expect(outcome.session.prompt).toEqual({ message: '指定点', accepts: ['point'] })
  })

  it('退化命令返回 ran 并带上已经跑完的那一步', () => {
    const run = vi.fn()
    const outcome = runComposeCommandImmediately(
      createComposeImmediateCommand<null, Effect>({ id: 'A', title: 'A', run }),
      null,
    )

    expect(outcome).toEqual({ status: 'ran', step: { status: 'commit', effect: {} } })
    expect(run).toHaveBeenCalledTimes(1)
  })
})

describe('OpenSpec: commands / 命令的可呈现信息与可用性 / 不可用的命令带出原因', () => {
  it('可用性与分组随描述符走，退化包装原样保留', () => {
    const command = createComposeImmediateCommand<null, Effect>({
      id: 'edit.group',
      aliases: ['GROUP'],
      title: '编组',
      category: '编辑器',
      keywords: ['group'],
      disabledReason: '请至少选中两个对象',
      run: () => {},
    })

    expect(command).toMatchObject({
      aliases: ['GROUP'],
      category: '编辑器',
      disabledReason: '请至少选中两个对象',
      keywords: ['group'],
    })
  })
})
