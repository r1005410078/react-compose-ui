import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')
      ? [path]
      : []
  })
}

describe('stage-engine dependency boundary', () => {
  it('OpenSpec: stage-engine / 包依赖边界 / 产物入口不依赖 UI 或 DOM', () => {
    const manifest = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf8'),
    ) as {
      dependencies?: Readonly<Record<string, string>>
      peerDependencies?: Readonly<Record<string, string>>
      sideEffects?: boolean
    }
    const source = sourceFiles(join(packageRoot, 'src'))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n')
    const executableSource = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')

    expect(manifest.dependencies).toEqual({ '@compose-ui/core': 'workspace:*' })
    expect(manifest.peerDependencies).toBeUndefined()
    expect(manifest.sideEffects).toBe(false)
    expect(executableSource).not.toMatch(
      /(?:from|import\()\s*['"](?:react|react-dom|@compose-ui\/(?:stage|editor|component-registry|ui-context))/,
    )
    expect(executableSource).not.toMatch(
      /\b(?:HTMLElement|PointerEvent|KeyboardEvent|DOMMatrix|ResizeObserver)\b/,
    )
  })

  it('OpenSpec: stage-engine / 文档无关的交互内核契约 / 内核不引用具体文档类型', () => {
    // 泛型内核的三个模块。Stage 的绑定单独住在 stage-kernel-profile.ts，因此这里是结构性
    // 约束而不是口头约定：一旦有人把 Stage 类型写回这三个文件，这条用例立刻失败。
    const kernelModules = [
      'kernel-types.ts',
      'session-arbiter.ts',
      'plugin-registry.ts',
    ]
    for (const name of kernelModules) {
      const source = readFileSync(
        join(packageRoot, 'src', 'interaction-kernel', name),
        'utf8',
      )
      const executable = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
      expect(
        executable,
        `${name} 不得引用 Stage 专有类型或模块`,
      ).not.toMatch(/\bStage[A-Z]\w*/)
      expect(
        executable,
        `${name} 不得 import interaction-controller、hit-testing 等 Stage 专有模块`,
      ).not.toMatch(/from\s+['"]\.\.\//)
    }
  })
})
