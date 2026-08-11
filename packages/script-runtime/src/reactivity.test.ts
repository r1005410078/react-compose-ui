import { describe, expect, it, vi } from 'vitest'
import { createComposePageScriptScope } from './scope'
import type { ComposePageScriptContext } from './types'

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('OpenSpec: page-script-runtime / 无编译的响应式原语', () => {
  it('State 写入按 Object.is 判等并批量更新 Computed 与订阅者', async () => {
    let count!: { value: number }
    const snapshots: number[] = []
    const scope = createComposePageScriptScope((ctx) => {
      count = ctx.state(0)
      const doubled = ctx.computed(() => count.value * 2)
      ctx.effect(() => { snapshots.push(doubled.value) })
      return { count, doubled }
    })
    const listener = vi.fn()
    scope.subscribe(listener)

    count.value = 1
    count.value = 2
    count.value = 2
    await flush()

    expect(snapshots).toEqual([0, 4])
    expect(scope.getExport('count')).toMatchObject({ kind: 'value', value: 2, reactive: true })
    expect(scope.getExport('doubled')).toMatchObject({ kind: 'value', value: 4, reactive: true })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('setup 之外调用原语只产生诊断且不注册到实例', async () => {
    let escaped!: ComposePageScriptContext
    const ran: string[] = []
    const scope = createComposePageScriptScope((ctx) => {
      escaped = ctx
      return { ok: ctx.state(1) }
    })

    const late = escaped.state(0)
    const lateComputed = escaped.computed(() => `derived:${late.value}`)
    escaped.effect(() => { ran.push('late-effect') })

    expect(scope.getSnapshot().diagnostics.map(({ code }) => code))
      .toEqual(['script.context-after-setup', 'script.context-after-setup', 'script.context-after-setup'])
    // 降级对象保持可用形状，误用不会让用户脚本直接抛错。
    expect(late.value).toBe(0)
    expect(lateComputed.value).toBe('derived:0')
    expect(ran).toEqual([])

    // 降级 State 写入不参与调度，既有导出保持可用。
    late.value = 5
    await flush()
    expect(lateComputed.value).toBe('derived:5')
    expect(scope.getExport('ok')).toMatchObject({ value: 1 })
  })

  it('只写入未导出的私有 State 时不唤醒作用域订阅者', async () => {
    let priv!: { value: number }
    let shown!: { value: string }
    const logged: number[] = []
    const scope = createComposePageScriptScope((ctx) => {
      priv = ctx.state(0)
      shown = ctx.state('a')
      // 私有 State 被 Effect 观察，因此写入确实会触发一轮刷新——正是这一轮不应该
      // 唤醒作用域订阅者，因为没有任何导出成员发生变化。
      ctx.effect(() => { logged.push(priv.value) })
      return { shown }
    })
    const listener = vi.fn()
    scope.subscribe(listener)

    priv.value = 1
    await flush()
    expect(logged).toEqual([0, 1])
    expect(listener).not.toHaveBeenCalled()

    shown.value = 'b'
    await flush()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('返回 state.value 时只保存普通值快照', async () => {
    let count!: { value: number }
    const scope = createComposePageScriptScope((ctx) => {
      count = ctx.state(1)
      return { count: count.value }
    })
    count.value = 2
    await flush()
    expect(scope.getExport('count')).toEqual({ name: 'count', kind: 'value', value: 1, reactive: false })
  })
})

describe('OpenSpec: page-script-runtime / Effect cleanup 与错误隔离', () => {
  it('重跑前 cleanup，dispose 时按反向注册顺序 cleanup', async () => {
    let count!: { value: number }
    const calls: string[] = []
    const scope = createComposePageScriptScope((ctx) => {
      count = ctx.state(0)
      ctx.effect(() => {
        calls.push(`first:${count.value}`)
        return () => { calls.push('cleanup:first') }
      })
      ctx.effect(() => {
        calls.push('second')
        return () => { calls.push('cleanup:second') }
      })
      return { count }
    })

    count.value += 1
    await flush()
    scope.dispose()

    expect(calls).toEqual([
      'first:0',
      'second',
      'cleanup:first',
      'first:1',
      'cleanup:second',
      'cleanup:first',
    ])
  })

  it('无限自触发 Effect 超限后暂停且其他导出可用', async () => {
    const scope = createComposePageScriptScope((ctx) => {
      const looping = ctx.state(0)
      const healthy = ctx.state('ok')
      ctx.effect(() => { looping.value = looping.value + 1 })
      return { looping, healthy }
    }, { maxEffectRunsPerFlush: 5 })

    await flush()
    expect(scope.getSnapshot().diagnostics).toContainEqual(expect.objectContaining({
      code: 'script.effect-cycle',
    }))
    expect(scope.getExport('healthy')).toMatchObject({ value: 'ok' })
  })

  it('熔断只中止本轮刷新，下一轮依赖变化时 Effect 恢复', async () => {
    let cycling = true
    let probe!: { value: string }
    const seen: string[] = []
    createComposePageScriptScope((ctx) => {
      const tick = ctx.state(0)
      probe = ctx.state('a')
      ctx.effect(() => {
        seen.push(probe.value)
        // cycling 是普通闭包变量，不参与依赖跟踪；由测试决定这一轮是否自触发。
        if (cycling) tick.value = tick.value + 1
      })
      return { probe }
    }, { maxEffectRunsPerFlush: 5 })

    await flush()
    expect(seen.length).toBeGreaterThan(1)

    cycling = false
    seen.length = 0
    probe.value = 'b'
    await flush()
    expect(seen).toEqual(['b'])
  })

  it('Computed 抛错时当前值为 undefined 并在依赖修复后恢复', async () => {
    let input!: { value: number }
    const scope = createComposePageScriptScope((ctx) => {
      input = ctx.state(0)
      const derived = ctx.computed(() => {
        if (input.value === 1) throw new Error('boom')
        return input.value * 10
      })
      return { derived }
    })
    expect(scope.getExport('derived')).toMatchObject({ value: 0 })

    input.value = 1
    await flush()
    expect(scope.getExport('derived')).toMatchObject({ value: undefined })
    expect(scope.getSnapshot().diagnostics).toContainEqual(expect.objectContaining({
      code: 'script.computed-threw',
    }))

    input.value = 2
    await flush()
    expect(scope.getExport('derived')).toMatchObject({ value: 20 })
  })
})
