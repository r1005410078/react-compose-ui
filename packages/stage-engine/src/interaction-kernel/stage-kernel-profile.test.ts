import { describe, expect, it } from 'vitest'
import { createStagePluginRegistry, createStageSessionArbiter } from './stage-kernel-profile'
import type {
  StageInteractionPlugin,
  StagePluginContext,
  StagePointerDownEvent,
  StageSession,
} from './stage-kernel-profile'

/*
 * 仲裁语义本身由 `@compose-ui/interaction-kernel` 的用例锁定，这里不重复。本文件只证明
 * **Stage 的绑定接得上**：别名可用、工厂在 Stage 的事件形状上正常工作。抽包最容易出的错
 * 不是仲裁逻辑坏了，而是绑定处的类型退化到约束上——那种错误只有真正跑一次才看得见。
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

function fakeSession(log: string[]): StageSession {
  return {
    pointerId: 1,
    update: () => { log.push('update') },
    commit: () => { log.push('commit') },
    cancel: () => { log.push('cancel') },
  }
}

function plugin(id: string, priority: number, claim: StageInteractionPlugin['claim']): StageInteractionPlugin {
  return { id, priority, claim }
}

describe('OpenSpec: stage-engine / Stage 交互插件仲裁 / 内核来自独立包', () => {
  it('Stage 的别名能建表、能仲裁、能按优先级接管', () => {
    const log: string[] = []
    const asked: string[] = []
    const registry = createStagePluginRegistry([
      plugin('low', 10, () => { asked.push('low'); return null }),
      plugin('high', 20, () => { asked.push('high'); return fakeSession(log) }),
    ])
    const arbiter = createStageSessionArbiter(registry)

    expect(arbiter.begin(pointerDown(), ctx)).toBe('claimed')
    expect(asked).toEqual(['high'])
    expect(arbiter.activePluginId()).toBe('high')

    arbiter.commit(
      { type: 'pointer.up', pointerId: 1, point: { x: 4, y: 2 }, modifiers: MODIFIERS },
      ctx,
    )

    expect(log).toEqual(['update', 'commit'])
  })

  it('注册空数组时类型不退化，仍然得到 Stage 注册表', () => {
    // 显式标注工厂类型就是为了这条：泛型函数直接转导时空数组推不出参数，会退到约束上。
    const registry = createStagePluginRegistry([])

    expect(createStageSessionArbiter(registry).begin(pointerDown(), ctx)).toBe('declined')
  })
})
