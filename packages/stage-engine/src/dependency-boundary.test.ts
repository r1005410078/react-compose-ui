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
})
