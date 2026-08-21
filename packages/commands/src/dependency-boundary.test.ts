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

describe('commands dependency boundary', () => {
  it('OpenSpec: commands / 无 React 无 DOM 的命令与键位包 / 包边界', () => {
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

    expect(manifest.dependencies).toBeUndefined()
    expect(manifest.peerDependencies).toBeUndefined()
    expect(manifest.sideEffects).toBe(false)
    // 连 core 都不依赖：动作只是 run(ctx)，本包不认识任何文档协议。
    expect(executableSource).not.toMatch(/(?:from|import\()\s*['"](?:react|react-dom|@compose-ui\/)/)
    // 平台格式化必须由调用方传入 platform，本包不读取任何浏览器全局。
    expect(executableSource).not.toMatch(
      /\b(?:navigator|window|document|HTMLElement|Element|KeyboardEvent)\b/,
    )
  })
})
