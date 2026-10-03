// @vitest-environment node
import { COMPOSE_QML_RUNTIME_GLOBALS } from '@compose-ui/qml-export'
import { COMPOSE_PORTABLE_GLOBALS } from '@compose-ui/script-runtime'
import { describe, expect, it } from 'vitest'
import { createComposeQmlScriptCompiler } from './compile-setup'

const compiler = createComposeQmlScriptCompiler()

describe('OpenSpec: qml-page-script / 同一份 setup 在 Qt 中执行', () => {
  it('降级 async、对象展开，把全局改写为对运行时全局模块的导入', async () => {
    const output = await compiler.compile(`
      export function setup(ctx) {
        const count = ctx.state(0)
        setInterval(() => { count.value += 1 }, 1000)
        return { ...{ count }, async load() { const r = await fetch('/data.json'); return r.json() } }
      }
    `)
    expect(output).toMatch(/import \{[^}]*\bsetInterval\b[^}]*\} from "\.\/ComposeRuntime\/globals\.mjs"/)
    expect(output).toMatch(/\bfetch\b/)
    expect(output).not.toMatch(/\basync\s+(function|\w+\s*\()/)
    expect(output).not.toMatch(/\{\s*\.\.\./)
    expect(output).toMatch(/export\s*\{[^}]*\bsetup\b/)
  })

  it('语法错误给出编译器的说明', async () => {
    await expect(compiler.compile('export function setup( {')).rejects.toThrow(/page\.setup\.js/)
  })

  it('编译器注入的全局清单与 Qt 运行时补齐的全局一一对应', () => {
    // 不一致的症状：编译器往脚本里注入了运行时没有的 import，Qt 上整个 setup 模块加载失败。
    expect([...COMPOSE_QML_RUNTIME_GLOBALS].sort()).toEqual([...COMPOSE_PORTABLE_GLOBALS].sort())
  })
})
