/**
 * 构建期产出可移植运行时，并以虚拟模块 `virtual:compose-portable-runtime` 交给源码。
 *
 * @remarks
 * 可移植运行时是给 Qt（V4 引擎）的自包含 ES 模块：同一份 `scope` + `reactivity` 源码，降级到
 * `COMPOSE_PORTABLE_SCRIPT_TARGET`，不引用任何浏览器全局。它以字符串常量从包根导出
 * （`COMPOSE_PORTABLE_RUNTIME_SOURCE`）——跨包只允许从包根导入，单独开一个文件子路径会绕开那条边界。
 * 构建与 Vitest 用同一个插件，测试看到的就是发布出去的那一份。
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { COMPOSE_PORTABLE_SCRIPT_TARGET } from '../src/portable/portable'

const VIRTUAL_ID = 'virtual:compose-portable-runtime'
const RESOLVED_ID = `\0${VIRTUAL_ID}`
const at = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/** 打出可移植运行时的模块文本。 */
export async function buildPortableRuntime(): Promise<string> {
  const result = await build({
    entryPoints: [at('../src/portable/portable-entry.ts')],
    inject: [at('../src/portable/portable-inject.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    target: COMPOSE_PORTABLE_SCRIPT_TARGET,
    legalComments: 'none',
    logLevel: 'warning',
  })
  return result.outputFiles[0]!.text
}

/** 把可移植运行时作为默认导出的字符串提供给 `virtual:compose-portable-runtime`。 */
export function composePortableRuntimePlugin(): Plugin {
  return {
    name: 'compose-portable-runtime',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined
    },
    async load(id) {
      if (id !== RESOLVED_ID) return undefined
      for (const file of ['portable-entry.ts', 'portable-inject.ts', '../scope.ts', '../reactivity.ts']) {
        this.addWatchFile(at(`../src/portable/${file}`))
      }
      return `export default ${JSON.stringify(await buildPortableRuntime())}\n`
    },
  }
}
