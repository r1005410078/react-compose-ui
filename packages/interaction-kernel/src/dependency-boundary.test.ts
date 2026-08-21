import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : []
  })
}

describe('interaction-kernel dependency boundary', () => {
  it('OpenSpec: interaction-kernel / 无框架的交互内核包 / 依赖清单为空', () => {
    const manifest = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf8'),
    ) as {
      dependencies?: Readonly<Record<string, string>>
      peerDependencies?: Readonly<Record<string, string>>
      sideEffects?: boolean
    }
    const executableSource = sourceFiles(join(packageRoot, 'src'))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')

    // 依赖为空是本包边界的**载体**而不是巧合：内核不认识文档这件事，靠的就是「想引用文档
    // 类型必须先加一条依赖，而这条断言会立刻失败」。
    expect(manifest.dependencies).toBeUndefined()
    expect(manifest.peerDependencies).toBeUndefined()
    expect(manifest.sideEffects).toBe(false)
    expect(executableSource).not.toMatch(/(?:from|import\()\s*['"](?:react|react-dom|@compose-ui\/)/)
    expect(executableSource).not.toMatch(
      /\b(?:window|document|HTMLElement|Element|PointerEvent|KeyboardEvent|ResizeObserver)\b/,
    )
  })

  it('OpenSpec: interaction-kernel / 无框架的交互内核包 / 内核不认识文档协议', () => {
    // 具体文档类型的名称一个都不该出现。留着这条正则不是重复上一条：上一条拦的是 import，
    // 这条拦的是把类型名硬写进签名——两种越界方式互不覆盖。
    const executableSource = sourceFiles(join(packageRoot, 'src'))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')

    expect(executableSource).not.toMatch(/\b(?:Stage|Compose|Cad)[A-Z]\w*/)
  })
})
