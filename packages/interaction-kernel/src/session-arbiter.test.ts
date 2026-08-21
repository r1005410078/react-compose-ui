import { describe, expect, it, vi } from 'vitest'
import { createInteractionPluginRegistry } from './plugin-registry'
import { createInteractionSessionArbiter } from './session-arbiter'
import type {
  InteractionClaimResult,
  InteractionKernelProfile,
  InteractionPlugin,
  InteractionPluginContext,
  InteractionSession,
} from './kernel-types'

/*
 * 内核用**中性 profile** 测试：这里锁定的是仲裁语义本身（优先级、consumed 短路、单会话
 * 独占、commit 前吃掉最终点、自检与释放），一个真实文档类型都不出现。绑定到具体文档协议
 * 之后行为是否仍然一致，由各消费者自己的用例保证。
 */

interface TestContext {
  readonly generation: number
}

type TestEvent =
  | { readonly type: 'down'; readonly pointerId: number }
  | { readonly type: 'move'; readonly pointerId: number; readonly at: number }
  | { readonly type: 'up'; readonly pointerId: number; readonly at: number }
  /** 不携带 pointerId 的事件：必须照样转发给活动会话。 */
  | { readonly type: 'aux' }

interface TestProfile extends InteractionKernelProfile {
  readonly context: TestContext
  readonly index: readonly string[]
  readonly event: TestEvent
  readonly claimEvent: Extract<TestEvent, { type: 'down' }>
  readonly effect: { readonly kind: string }
  readonly snapshot: { readonly active: boolean }
}

type TestPlugin = InteractionPlugin<TestProfile>
type TestSession = InteractionSession<TestProfile>

/** 伪 context：仲裁器不读取内容，只负责原样透传给插件。 */
const ctx = {} as InteractionPluginContext<TestProfile>

const down = (pointerId = 1): TestProfile['claimEvent'] => ({ type: 'down', pointerId })
const move = (pointerId: number, at = 1): TestEvent => ({ type: 'move', pointerId, at })
const up = (pointerId = 1, at = 42): TestEvent => ({ type: 'up', pointerId, at })

function fakeSession(pointerId = 1, log: string[] = [], name = 'session'): TestSession {
  return {
    pointerId,
    update: () => { log.push(`${name}.update`) },
    commit: () => { log.push(`${name}.commit`) },
    cancel: () => { log.push(`${name}.cancel`) },
  }
}

function plugin(id: string, priority: number, claim: () => InteractionClaimResult<TestProfile>): TestPlugin {
  return { id, priority, claim }
}

function arbiterOf(plugins: readonly TestPlugin[]) {
  return createInteractionSessionArbiter(createInteractionPluginRegistry(plugins))
}

describe('OpenSpec: interaction-kernel / 插件注册与会话仲裁 / 按优先级接管', () => {
  it('优先级高的插件先被询问且独占本次事件', () => {
    const asked: string[] = []
    const arbiter = arbiterOf([
      plugin('low', 10, () => { asked.push('low'); return fakeSession() }),
      plugin('high', 20, () => { asked.push('high'); return fakeSession() }),
    ])

    expect(arbiter.begin(down(), ctx)).toBe('claimed')

    // 注册顺序是 low 在前，但询问顺序必须由 priority 决定。
    expect(asked).toEqual(['high'])
    expect(arbiter.hasSession()).toBe(true)
    expect(arbiter.activePointerId()).toBe(1)
    expect(arbiter.activePluginId()).toBe('high')
  })

  it('返回 null 的插件不接管，仲裁器继续询问下一个', () => {
    const asked: string[] = []
    const arbiter = arbiterOf([
      plugin('first', 30, () => { asked.push('first'); return null }),
      plugin('second', 20, () => { asked.push('second'); return null }),
      plugin('third', 10, () => { asked.push('third'); return fakeSession() }),
    ])

    expect(arbiter.begin(down(), ctx)).toBe('claimed')
    expect(asked).toEqual(['first', 'second', 'third'])
  })

  it('全部返回 null 时结果是 declined，宿主可走自己的兜底', () => {
    const arbiter = arbiterOf([plugin('only', 10, () => null)])

    expect(arbiter.begin(down(), ctx)).toBe('declined')
    expect(arbiter.hasSession()).toBe(false)
    expect(arbiter.activePluginId()).toBeNull()
  })
})

describe('OpenSpec: interaction-kernel / 插件注册与会话仲裁 / consumed 阻止后续判定', () => {
  it('consumed 短路其余插件且不创建会话', () => {
    const asked: string[] = []
    const arbiter = arbiterOf([
      plugin('guard', 30, () => { asked.push('guard'); return 'consumed' }),
      plugin('never', 20, () => { asked.push('never'); return fakeSession() }),
    ])

    expect(arbiter.begin(down(), ctx)).toBe('consumed')

    expect(asked).toEqual(['guard'])
    expect(arbiter.hasSession()).toBe(false)
  })

  it('consumed 之后的后续事件不产生任何会话回调', () => {
    const log: string[] = []
    const arbiter = arbiterOf([
      plugin('guard', 30, () => 'consumed'),
      plugin('never', 20, () => fakeSession(1, log, 'never')),
    ])
    arbiter.begin(down(), ctx)

    arbiter.update(move(1), ctx)
    arbiter.commit(up(), ctx)

    expect(log).toEqual([])
  })
})

describe('OpenSpec: interaction-kernel / 插件注册与会话仲裁 / 提交前吃掉最终点', () => {
  it('commit 前先以本事件调用一次 update', () => {
    const log: string[] = []
    const arbiter = arbiterOf([plugin('only', 10, () => fakeSession(1, log))])
    arbiter.begin(down(), ctx)

    arbiter.commit(up(), ctx)

    // 顺序是硬约束：提交状态取自最终点推进之后，而不是最后一帧 move 留下的那份。
    expect(log).toEqual(['session.update', 'session.commit'])
  })

  it('最终点 update 收到的是结束事件本身', () => {
    const received: unknown[] = []
    const session: TestSession = {
      pointerId: 1,
      update: (event) => received.push(event),
      commit: () => {},
      cancel: () => {},
    }
    const arbiter = arbiterOf([plugin('only', 10, () => session)])
    arbiter.begin(down(), ctx)

    const event = up(1, 7)
    arbiter.commit(event, ctx)

    expect(received).toEqual([event])
  })

  it('提交后会话释放，重复提交不再回调', () => {
    const log: string[] = []
    const arbiter = arbiterOf([plugin('only', 10, () => fakeSession(1, log))])
    arbiter.begin(down(), ctx)

    arbiter.commit(up(), ctx)
    arbiter.commit(up(), ctx)

    expect(log).toEqual(['session.update', 'session.commit'])
    expect(arbiter.hasSession()).toBe(false)
  })

  it('commit 内部同步重入时看到的是无会话，不重复提交', () => {
    // 宿主在 commit 里同步回灌 context 并再次调用 commit 是真实存在的路径；仲裁器先清空
    // 引用再回调，就是为了让这条路径退化成空操作。
    const log: string[] = []
    const session: TestSession = {
      pointerId: 1,
      update: () => { log.push('update') },
      commit: () => {
        log.push('commit')
        // 声明在后、调用在闭包里：真正读到 arbiter 时它已经初始化完毕。
        arbiter.commit(up(), ctx)
      },
      cancel: () => { log.push('cancel') },
    }
    const arbiter = arbiterOf([plugin('only', 10, () => session)])
    arbiter.begin(down(), ctx)

    arbiter.commit(up(), ctx)

    expect(log).toEqual(['update', 'commit'])
  })
})

describe('OpenSpec: interaction-kernel / 插件注册与会话仲裁 / 单会话独占', () => {
  it('已有会话时第二次接管被拒绝', () => {
    const claim = vi.fn(() => fakeSession())
    const arbiter = arbiterOf([plugin('only', 10, claim)])
    arbiter.begin(down(1), ctx)

    expect(arbiter.begin(down(2), ctx)).toBe('declined')
    expect(claim).toHaveBeenCalledTimes(1)
  })

  it('其他指针的事件被丢弃', () => {
    const log: string[] = []
    const arbiter = arbiterOf([plugin('only', 10, () => fakeSession(1, log))])
    arbiter.begin(down(1), ctx)

    arbiter.update(move(2), ctx)
    expect(log).toEqual([])

    arbiter.update(move(1), ctx)
    expect(log).toEqual(['session.update'])
  })

  it('不携带 pointerId 的事件转发给活动会话', () => {
    const received: unknown[] = []
    const session: TestSession = {
      pointerId: 1,
      update: (event) => received.push(event),
      commit: () => {},
      cancel: () => {},
    }
    const arbiter = arbiterOf([plugin('only', 10, () => session)])
    arbiter.begin(down(1), ctx)

    arbiter.update({ type: 'aux' }, ctx)

    expect(received).toEqual([{ type: 'aux' }])
  })

  it('会话可声明把临时平移键重新解释为自己的修饰键', () => {
    const arbiter = arbiterOf([
      plugin('only', 10, () => ({ ...fakeSession(), consumesTemporaryPan: true })),
    ])

    expect(arbiter.activeSessionConsumesTemporaryPan()).toBe(false)
    arbiter.begin(down(1), ctx)
    expect(arbiter.activeSessionConsumesTemporaryPan()).toBe(true)
  })
})

describe('OpenSpec: interaction-kernel / 会话自检与释放 / 上下文变化后的自检', () => {
  function sessionWithCheck(compatible: boolean, log: string[]): TestSession {
    return {
      ...fakeSession(1, log),
      isCompatibleWith: () => compatible,
    }
  }

  it('自检返回 false 时会话被取消，并报告发生了取消', () => {
    const log: string[] = []
    const arbiter = arbiterOf([plugin('only', 10, () => sessionWithCheck(false, log))])
    arbiter.begin(down(1), ctx)

    expect(arbiter.revalidate({ generation: 2 }, [], ctx)).toBe(true)
    expect(log).toEqual(['session.cancel'])
    expect(arbiter.hasSession()).toBe(false)
  })

  it('自检通过时会话保持进行', () => {
    const log: string[] = []
    const arbiter = arbiterOf([plugin('only', 10, () => sessionWithCheck(true, log))])
    arbiter.begin(down(1), ctx)

    expect(arbiter.revalidate({ generation: 2 }, [], ctx)).toBe(false)
    expect(log).toEqual([])
    expect(arbiter.hasSession()).toBe(true)
  })

  it('未声明自检的会话视为始终成立', () => {
    const log: string[] = []
    const arbiter = arbiterOf([plugin('only', 10, () => fakeSession(1, log))])
    arbiter.begin(down(1), ctx)

    expect(arbiter.revalidate({ generation: 2 }, [], ctx)).toBe(false)
    expect(arbiter.hasSession()).toBe(true)
  })

  it('自检收到的是新的 context 与 index', () => {
    const received: unknown[] = []
    const arbiter = arbiterOf([
      plugin('only', 10, () => ({
        ...fakeSession(),
        isCompatibleWith: (next, nextIndex) => { received.push([next, nextIndex]); return true },
      })),
    ])
    arbiter.begin(down(1), ctx)

    arbiter.revalidate({ generation: 9 }, ['a'], ctx)

    expect(received).toEqual([[{ generation: 9 }, ['a']]])
  })

  it('无会话时自检是空操作', () => {
    const arbiter = arbiterOf([plugin('only', 10, () => null)])

    expect(arbiter.revalidate({ generation: 1 }, [], ctx)).toBe(false)
  })
})

describe('OpenSpec: interaction-kernel / 会话自检与释放 / 取消与释放', () => {
  it('不带 pointerId 的取消释放任意会话', () => {
    const log: string[] = []
    const arbiter = arbiterOf([plugin('only', 10, () => fakeSession(1, log))])
    arbiter.begin(down(1), ctx)

    arbiter.cancel(ctx)

    expect(log).toEqual(['session.cancel'])
    expect(arbiter.hasSession()).toBe(false)
  })

  it('指针不匹配的取消不影响活动会话', () => {
    const log: string[] = []
    const arbiter = arbiterOf([plugin('only', 10, () => fakeSession(1, log))])
    arbiter.begin(down(1), ctx)

    arbiter.cancel(ctx, 2)

    expect(log).toEqual([])
    expect(arbiter.hasSession()).toBe(true)
  })

  it('无会话时取消是安全的空操作', () => {
    const arbiter = arbiterOf([plugin('only', 10, () => null)])

    expect(() => arbiter.cancel(ctx)).not.toThrow()
  })

  it('release 丢弃会话但不调用 cancel', () => {
    // 会话已通过其他路径自行拆除（并发文档变化、宿主断开、dispose）时走这条路，
    // 再调一次 cancel 会重复清理。
    const log: string[] = []
    const arbiter = arbiterOf([plugin('only', 10, () => fakeSession(1, log))])
    arbiter.begin(down(1), ctx)

    arbiter.release()

    expect(log).toEqual([])
    expect(arbiter.hasSession()).toBe(false)
    expect(arbiter.activePluginId()).toBeNull()
  })

  it('release 之后仲裁器可以接管下一次事件', () => {
    const arbiter = arbiterOf([plugin('only', 10, () => fakeSession())])
    arbiter.begin(down(1), ctx)
    arbiter.release()

    expect(arbiter.begin(down(2), ctx)).toBe('claimed')
  })

  it('release 幂等', () => {
    const arbiter = arbiterOf([plugin('only', 10, () => null)])

    expect(() => { arbiter.release(); arbiter.release() }).not.toThrow()
  })
})
