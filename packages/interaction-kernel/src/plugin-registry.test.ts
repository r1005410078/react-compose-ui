import { describe, expect, it } from 'vitest'
import { createInteractionPluginRegistry } from './plugin-registry'
import type { InteractionKernelProfile, InteractionPlugin } from './kernel-types'

/** 排序只看 `priority`，与 profile 无关，因此这里用最空的一个。 */
interface EmptyProfile extends InteractionKernelProfile {
  readonly context: null
  readonly index: null
  readonly event: { readonly type: string }
  readonly claimEvent: { readonly type: string }
  readonly effect: never
  readonly snapshot: null
}

function plugin(id: string, priority: number): InteractionPlugin<EmptyProfile> {
  return { id, priority, claim: () => null }
}

describe('OpenSpec: interaction-kernel / 插件注册与会话仲裁 / 注册表按优先级排序', () => {
  it('按 priority 降序排列', () => {
    const registry = createInteractionPluginRegistry([
      plugin('c', 1),
      plugin('a', 30),
      plugin('b', 20),
    ])

    expect(registry.ordered().map(({ id }) => id)).toEqual(['a', 'b', 'c'])
  })

  it('同优先级保持注册顺序', () => {
    const registry = createInteractionPluginRegistry([
      plugin('first', 10),
      plugin('second', 10),
      plugin('third', 10),
    ])

    expect(registry.ordered().map(({ id }) => id)).toEqual(['first', 'second', 'third'])
  })

  it('重复 id 被拒绝', () => {
    expect(() => createInteractionPluginRegistry([plugin('dup', 10), plugin('dup', 20)]))
      .toThrow(/Duplicate interaction plugin id: dup/)
  })

  it('拒绝信息不提及任何具体文档类型', () => {
    // 这条不是文字洁癖：错误串一旦写上「Stage」，第二个消费者拿到的报错就是错的。
    expect(() => createInteractionPluginRegistry([plugin('dup', 10), plugin('dup', 20)]))
      .toThrow(/^(?!.*(?:Stage|Cad|Compose)).*$/)
  })

  it('排序结果引用稳定，不在每次询问时重排', () => {
    const registry = createInteractionPluginRegistry([plugin('a', 10)])

    expect(registry.ordered()).toBe(registry.ordered())
  })
})
