import { describe, expect, it, vi } from 'vitest'
import { createComposePageScriptScope } from './scope'
import type { ComposePageScriptContext } from './types'

describe('OpenSpec: page-script-runtime / 页面 setup 模块与返回作用域', () => {
  it('分类普通值、State、Computed 与 Function', () => {
    const method = vi.fn()
    const scope = createComposePageScriptScope((ctx) => {
      const state = ctx.state(2)
      return {
        label: 'Count',
        state,
        computed: ctx.computed(() => state.value + 1),
        method,
      }
    })

    expect(scope.getSnapshot().exports).toEqual([
      { name: 'label', kind: 'value', value: 'Count', reactive: false },
      { name: 'state', kind: 'value', value: 2, reactive: true },
      { name: 'computed', kind: 'value', value: 3, reactive: true },
      { name: 'method', kind: 'method', method },
    ])
  })

  it.each([
    ['missing', undefined, 'script.missing-setup'],
    ['promise', () => Promise.resolve({}), 'script.invalid-return'],
    ['array', () => [], 'script.invalid-return'],
  ])('拒绝非法 setup：%s', (_name, setup, code) => {
    const scope = createComposePageScriptScope(setup)
    expect(scope.getSnapshot().exports).toEqual([])
    expect(scope.getSnapshot().diagnostics).toContainEqual(expect.objectContaining({ code }))
  })

  it('setup 抛错时不发布部分作用域', () => {
    const scope = createComposePageScriptScope((ctx) => {
      ctx.state(1)
      throw new Error('boom')
    })
    expect(scope.getSnapshot().exports).toEqual([])
    expect(scope.getSnapshot().diagnostics).toContainEqual(expect.objectContaining({
      code: 'script.setup-threw',
    }))
  })

  it('状态未变化时保持外部 Store 快照引用稳定', async () => {
    let count: { value: number } | undefined
    const scope = createComposePageScriptScope((ctx) => {
      count = ctx.state(0)
      return { count }
    })
    const initial = scope.getSnapshot()

    expect(scope.getSnapshot()).toBe(initial)
    count!.value += 1
    await Promise.resolve()

    expect(scope.getSnapshot()).not.toBe(initial)
    expect(scope.getSnapshot()).toBe(scope.getSnapshot())
  })

  it('相同 setup 创建独立页面实例，dispose 后迟到写入不通知', async () => {
    const states: Array<{ value: number }> = []
    const setup = (ctx: ComposePageScriptContext) => {
      const count = ctx.state(0)
      states.push(count)
      return { count, add: () => { count.value += 1 } }
    }
    const first = createComposePageScriptScope(setup)
    const second = createComposePageScriptScope(setup)
    const listener = vi.fn()
    first.subscribe(listener)

    states[0]!.value += 1
    await Promise.resolve()
    expect(first.getExport('count')).toMatchObject({ value: 1 })
    expect(second.getExport('count')).toMatchObject({ value: 0 })

    first.dispose()
    states[0]!.value += 1
    await Promise.resolve()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
