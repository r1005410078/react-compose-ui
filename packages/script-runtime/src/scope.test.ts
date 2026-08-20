import { describe, expect, it, vi } from 'vitest'
import { createComposePageScriptScope } from './scope'
import type { ComposePageScriptContext } from './types'
import type { ComposeNavigationPort, ComposePageReference } from '@compose-ui/core'

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

describe('OpenSpec: page-script-runtime / 脚本导航逃生舱', () => {
  function portFake() {
    const navigate = vi.fn(async () => undefined)
    const back = vi.fn(async () => undefined)
    const port: ComposeNavigationPort = {
      navigate,
      back,
      referenceFor: (pageKey: string): ComposePageReference => ({
        kind: 'page',
        providerId: 'demo',
        assetKey: pageKey,
        scope: 'persistent',
      }),
      getSnapshot: () => ({ currentPageKey: null, current: null, canGoBack: false, issue: null }),
      subscribe: () => () => undefined,
    }
    return { port, navigate, back }
  }

  function callMethod(
    scope: ReturnType<typeof createComposePageScriptScope>,
    name: string,
    ...args: unknown[]
  ) {
    const exported = scope.getExport(name)
    if (exported?.kind !== 'method') throw new Error(`${name} 不是方法导出`)
    return exported.method(...args)
  }

  it('脚本条件跳转委托同一个端口', async () => {
    const { port, navigate, back } = portFake()
    const scope = createComposePageScriptScope(
      (ctx) => ({
        open: (key: unknown) => ctx.navigate(key as string),
        goBack: () => ctx.navigateBack(),
      }),
      { navigation: port },
    )

    await callMethod(scope, 'open', 'pages/detail.page.json')
    expect(navigate).toHaveBeenCalledWith({
      kind: 'page',
      providerId: 'demo',
      assetKey: 'pages/detail.page.json',
      scope: 'persistent',
    })

    await callMethod(scope, 'goBack')
    expect(back).toHaveBeenCalledTimes(1)
    scope.dispose()
  })

  it('传入完整引用时不再经过 referenceFor', async () => {
    const { port, navigate } = portFake()
    const reference: ComposePageReference = {
      kind: 'page',
      providerId: 'other',
      assetKey: 'pages/a.page.json',
      scope: 'session',
    }
    const scope = createComposePageScriptScope(
      (ctx) => ({ open: () => ctx.navigate(reference) }),
      { navigation: port },
    )
    await callMethod(scope, 'open')
    expect(navigate).toHaveBeenCalledWith(reference)
    scope.dispose()
  })

  it('未注入端口时只产生 diagnostic', async () => {
    const scope = createComposePageScriptScope((ctx) => ({
      open: () => ctx.navigate('pages/detail.page.json'),
      label: 'ready',
    }))

    await callMethod(scope, 'open')
    const snapshot = scope.getSnapshot()
    expect(snapshot.diagnostics.map((item) => item.code))
      .toContain('script.navigation-unavailable')
    // setup 的其余导出必须继续可用：缺导航不该让整个页面脚本失效。
    expect(scope.getExport('label')).toMatchObject({ kind: 'value', value: 'ready' })
    scope.dispose()
  })

  it('setup 同步执行期间的调用被忽略', () => {
    const { port, navigate } = portFake()
    const scope = createComposePageScriptScope(
      (ctx) => {
        void ctx.navigate('pages/detail.page.json')
        return { label: 'ready' }
      },
      { navigation: port },
    )

    expect(navigate).not.toHaveBeenCalled()
    expect(scope.getSnapshot().diagnostics.map((item) => item.code))
      .toContain('script.navigation-during-setup')
    expect(scope.getExport('label')).toMatchObject({ kind: 'value', value: 'ready' })
    scope.dispose()
  })
})
