import { describe, expect, it, vi } from 'vitest'
import { createStagePluginRegistry } from './plugin-registry'
import { createStageSessionArbiter } from './session-arbiter'
import type {
  StageClaimResult,
  StageInteractionPlugin,
  StagePluginContext,
  StagePointerDownEvent,
  StageSession,
} from './kernel-types'

/*
 * 内核用伪插件测试：这里锁定的是仲裁语义本身（优先级、consumed 短路、单会话独占、
 * commit 前吃掉最终点），不涉及任何真实手势。真实手势行为由
 * interaction-controller.test.ts 保证，本变更不修改它。
 */

const MODIFIERS = { shift: false, alt: false, command: false } as const

/** 伪 context：仲裁器不读取内容，只负责原样透传给插件。 */
const ctx = {} as StagePluginContext

function pointerDown(pointerId = 1): StagePointerDownEvent {
  return {
    type: 'pointer.down',
    pointerId,
    button: 0,
    point: { x: 0, y: 0 },
    hit: { kind: 'surface' },
    modifiers: MODIFIERS,
  }
}

function fakeSession(pointerId = 1, log: string[] = [], name = 'session'): StageSession {
  return {
    pointerId,
    update: () => { log.push(`${name}.update`) },
    commit: () => { log.push(`${name}.commit`) },
    cancel: () => { log.push(`${name}.cancel`) },
  }
}

function plugin(
  id: string,
  priority: number,
  claim: () => StageClaimResult,
): StageInteractionPlugin {
  return { id, priority, claim }
}

describe('OpenSpec: stage-engine / Stage 交互插件仲裁 / 按优先级接管', () => {
  it('优先级高的插件先被询问且独占本次按下', () => {
    const asked: string[] = []
    const winner = fakeSession()
    const registry = createStagePluginRegistry([
      plugin('low', 10, () => { asked.push('low'); return fakeSession() }),
      plugin('high', 20, () => { asked.push('high'); return winner }),
    ])
    const arbiter = createStageSessionArbiter(registry)

    expect(arbiter.begin(pointerDown(), ctx)).toBe('claimed')

    // 注册顺序是 low 在前，但询问顺序必须由 priority 决定。
    expect(asked).toEqual(['high'])
    expect(arbiter.hasSession()).toBe(true)
    expect(arbiter.activePointerId()).toBe(1)
  })

  it('返回 null 的插件不接管，仲裁器继续询问下一个', () => {
    const asked: string[] = []
    const registry = createStagePluginRegistry([
      plugin('first', 30, () => { asked.push('first'); return null }),
      plugin('second', 20, () => { asked.push('second'); return null }),
      plugin('third', 10, () => { asked.push('third'); return fakeSession() }),
    ])
    const arbiter = createStageSessionArbiter(registry)

    expect(arbiter.begin(pointerDown(), ctx)).toBe('claimed')
    expect(asked).toEqual(['first', 'second', 'third'])
  })

  it('全部返回 null 时结果是 declined，内核可走自己的兜底', () => {
    const registry = createStagePluginRegistry([plugin('only', 10, () => null)])
    const arbiter = createStageSessionArbiter(registry)

    expect(arbiter.begin(pointerDown(), ctx)).toBe('declined')
    expect(arbiter.hasSession()).toBe(false)
  })
})

describe('OpenSpec: stage-engine / Stage 交互插件仲裁 / consumed 阻止后续判定', () => {
  it('consumed 短路其余插件且不创建会话', () => {
    const asked: string[] = []
    const registry = createStagePluginRegistry([
      plugin('guard', 30, () => { asked.push('guard'); return 'consumed' }),
      plugin('never', 20, () => { asked.push('never'); return fakeSession() }),
    ])
    const arbiter = createStageSessionArbiter(registry)

    expect(arbiter.begin(pointerDown(), ctx)).toBe('consumed')

    expect(asked).toEqual(['guard'])
    expect(arbiter.hasSession()).toBe(false)
  })

  it('consumed 之后的指针移动不产生任何会话回调', () => {
    const log: string[] = []
    const registry = createStagePluginRegistry([
      plugin('guard', 30, () => 'consumed'),
      plugin('never', 20, () => fakeSession(1, log, 'never')),
    ])
    const arbiter = createStageSessionArbiter(registry)
    arbiter.begin(pointerDown(), ctx)

    arbiter.update({ type: 'pointer.move', pointerId: 1, point: { x: 5, y: 5 }, modifiers: MODIFIERS }, ctx)
    arbiter.commit({ type: 'pointer.up', pointerId: 1, point: { x: 5, y: 5 }, modifiers: MODIFIERS }, ctx)

    expect(log).toEqual([])
  })
})

describe('OpenSpec: stage-engine / Stage 交互插件仲裁 / 提交前吃掉最终点', () => {
  const up = {
    type: 'pointer.up' as const,
    pointerId: 1,
    point: { x: 42, y: 7 },
    modifiers: MODIFIERS,
  }

  it('commit 前先以本事件调用一次 update', () => {
    const log: string[] = []
    const registry = createStagePluginRegistry([
      plugin('only', 10, () => fakeSession(1, log)),
    ])
    const arbiter = createStageSessionArbiter(registry)
    arbiter.begin(pointerDown(), ctx)

    arbiter.commit(up, ctx)

    // 顺序是硬约束：提交几何取自最终点推进之后的状态。
    expect(log).toEqual(['session.update', 'session.commit'])
  })

  it('最终点 update 收到的是 pointerup 事件本身', () => {
    const received: unknown[] = []
    const session: StageSession = {
      pointerId: 1,
      update: (event) => received.push(event),
      commit: () => {},
      cancel: () => {},
    }
    const registry = createStagePluginRegistry([plugin('only', 10, () => session)])
    const arbiter = createStageSessionArbiter(registry)
    arbiter.begin(pointerDown(), ctx)

    arbiter.commit(up, ctx)

    expect(received).toEqual([up])
  })

  it('提交后会话释放，重复提交不再回调', () => {
    const log: string[] = []
    const registry = createStagePluginRegistry([
      plugin('only', 10, () => fakeSession(1, log)),
    ])
    const arbiter = createStageSessionArbiter(registry)
    arbiter.begin(pointerDown(), ctx)

    arbiter.commit(up, ctx)
    arbiter.commit(up, ctx)

    expect(log).toEqual(['session.update', 'session.commit'])
    expect(arbiter.hasSession()).toBe(false)
  })
})

describe('OpenSpec: stage-engine / Stage 交互插件仲裁 / 单会话独占', () => {
  const move = (pointerId: number) => ({
    type: 'pointer.move' as const,
    pointerId,
    point: { x: 1, y: 1 },
    modifiers: MODIFIERS,
  })

  it('已有会话时第二次按下不被接管', () => {
    const claim = vi.fn(() => fakeSession())
    const registry = createStagePluginRegistry([plugin('only', 10, claim)])
    const arbiter = createStageSessionArbiter(registry)
    arbiter.begin(pointerDown(1), ctx)

    expect(arbiter.begin(pointerDown(2), ctx)).toBe('declined')
    expect(claim).toHaveBeenCalledTimes(1)
  })

  it('其他指针的移动被丢弃', () => {
    const log: string[] = []
    const registry = createStagePluginRegistry([
      plugin('only', 10, () => fakeSession(1, log)),
    ])
    const arbiter = createStageSessionArbiter(registry)
    arbiter.begin(pointerDown(1), ctx)

    arbiter.update(move(2), ctx)
    expect(log).toEqual([])

    arbiter.update(move(1), ctx)
    expect(log).toEqual(['session.update'])
  })

  it('非指针事件转发给活动会话', () => {
    const received: unknown[] = []
    const session: StageSession = {
      pointerId: 1,
      update: (event) => received.push(event),
      commit: () => {},
      cancel: () => {},
    }
    const registry = createStagePluginRegistry([plugin('only', 10, () => session)])
    const arbiter = createStageSessionArbiter(registry)
    arbiter.begin(pointerDown(1), ctx)

    // temporary-pan 没有 pointerId：move 手势用它表达「锁定原父级」，必须能到达会话。
    arbiter.update({ type: 'temporary-pan.start' }, ctx)

    expect(received).toEqual([{ type: 'temporary-pan.start' }])
  })
})

describe('OpenSpec: stage-engine / Stage 交互插件仲裁 / 取消释放会话', () => {
  it('不带 pointerId 的取消释放任意会话', () => {
    const log: string[] = []
    const registry = createStagePluginRegistry([
      plugin('only', 10, () => fakeSession(1, log)),
    ])
    const arbiter = createStageSessionArbiter(registry)
    arbiter.begin(pointerDown(1), ctx)

    arbiter.cancel(ctx)

    expect(log).toEqual(['session.cancel'])
    expect(arbiter.hasSession()).toBe(false)
  })

  it('指针不匹配的取消不影响活动会话', () => {
    const log: string[] = []
    const registry = createStagePluginRegistry([
      plugin('only', 10, () => fakeSession(1, log)),
    ])
    const arbiter = createStageSessionArbiter(registry)
    arbiter.begin(pointerDown(1), ctx)

    arbiter.cancel(ctx, 2)

    expect(log).toEqual([])
    expect(arbiter.hasSession()).toBe(true)
  })

  it('无会话时取消是安全的空操作', () => {
    const registry = createStagePluginRegistry([plugin('only', 10, () => null)])
    const arbiter = createStageSessionArbiter(registry)

    expect(() => arbiter.cancel(ctx)).not.toThrow()
  })

  it('release 丢弃会话但不调用 cancel', () => {
    // 会话已通过其他路径自行拆除（并发文档变化、surface 断开、dispose）时走这条路，
    // 再调一次 cancel 会重复清理。
    const log: string[] = []
    const registry = createStagePluginRegistry([
      plugin('only', 10, () => fakeSession(1, log)),
    ])
    const arbiter = createStageSessionArbiter(registry)
    arbiter.begin(pointerDown(1), ctx)

    arbiter.release()

    expect(log).toEqual([])
    expect(arbiter.hasSession()).toBe(false)
  })

  it('release 之后仲裁器可以接管下一次按下', () => {
    const registry = createStagePluginRegistry([
      plugin('only', 10, () => fakeSession()),
    ])
    const arbiter = createStageSessionArbiter(registry)
    arbiter.begin(pointerDown(1), ctx)
    arbiter.release()

    expect(arbiter.begin(pointerDown(2), ctx)).toBe('claimed')
  })

  it('release 幂等', () => {
    const registry = createStagePluginRegistry([plugin('only', 10, () => null)])
    const arbiter = createStageSessionArbiter(registry)

    expect(() => { arbiter.release(); arbiter.release() }).not.toThrow()
  })
})
