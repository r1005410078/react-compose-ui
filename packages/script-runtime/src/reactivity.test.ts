import { describe, expect, it, vi } from 'vitest'
import { createComposePageScriptScope } from './scope'

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
})
