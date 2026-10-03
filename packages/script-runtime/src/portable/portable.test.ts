import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { createContext, runInContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { COMPOSE_PORTABLE_GLOBALS, COMPOSE_PORTABLE_SCRIPT_TARGET, composePortableGlobalsShim } from './portable'
import { COMPOSE_PORTABLE_RUNTIME_SOURCE } from './portable-runtime'

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/**
 * 按产物同样的配置打包，只把格式换成 IIFE 以便在 `vm` 里运行——`vm` 的新上下文有自己的一套内建
 * 对象（`Promise`、`Map`……），但没有 `queueMicrotask`、`setTimeout` 这类宿主全局，正好是 V4 的样子。
 */
async function bundleInto(context: object) {
  const result = await build({
    entryPoints: [at('./portable-entry.ts')],
    inject: [at('./portable-inject.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'ComposeRuntime',
    target: COMPOSE_PORTABLE_SCRIPT_TARGET,
  })
  runInContext(result.outputFiles[0]!.text, createContext(context))
  return (context as { ComposeRuntime: typeof import('./portable-entry') }).ComposeRuntime
}

describe('OpenSpec: page-script-runtime / 可移植运行时产物', () => {
  it('在没有宿主全局的环境里创建作用域，effect 随 state 刷新', async () => {
    const context: Record<string, unknown> = {}
    const runtime = await bundleInto(context)
    expect(context.queueMicrotask).toBeUndefined()
    expect(context.setTimeout).toBeUndefined()

    // setup 在同一个上下文里定义：跨 realm 的对象原型不是该上下文的 `Object.prototype`，会被判成
    // 「setup 没有返回普通对象」——那是测试夹具的问题，不是运行时的。
    const seen: number[] = []
    context.seen = seen
    runInContext(`
      var setup = function (ctx) {
        var count = ctx.state(0)
        ctx.effect(function () { seen.push(count.value) })
        return { count: count, bump: function () { count.value += 1 } }
      }
    `, context as never)
    const scope = runtime.createComposePageScriptScope(context.setup)
    expect(scope.getSnapshot().diagnostics).toEqual([])
    scope.invokeMethod('bump', [])
    await Promise.resolve()
    await Promise.resolve()
    expect(seen).toEqual([0, 1])
    expect(scope.getExport('count')).toMatchObject({ kind: 'value', value: 1 })
  })

  it('垫片模块把每个可移植全局转导自宿主全局模块', () => {
    expect(composePortableGlobalsShim('./ComposeRuntime/globals.mjs')).toBe(
      `export { ${COMPOSE_PORTABLE_GLOBALS.join(', ')} } from "./ComposeRuntime/globals.mjs"\n`,
    )
  })

  it('包根导出的运行时文本是自包含 ES 模块，不含 V4 解析不了的语法', () => {
    expect(COMPOSE_PORTABLE_RUNTIME_SOURCE).toMatch(/export\s*\{[^}]*\bcreateComposePageScriptScope\b/)
    expect(COMPOSE_PORTABLE_RUNTIME_SOURCE).not.toMatch(/^\s*import\b/m)
    expect(COMPOSE_PORTABLE_RUNTIME_SOURCE).not.toMatch(/\basync\s+(function|\w+\s*\(|\()/)
    expect(COMPOSE_PORTABLE_RUNTIME_SOURCE).not.toMatch(/\{\s*\.\.\./)
    expect(COMPOSE_PORTABLE_RUNTIME_SOURCE).not.toMatch(/\?\?=|\|\|=|&&=/)
  })
})
