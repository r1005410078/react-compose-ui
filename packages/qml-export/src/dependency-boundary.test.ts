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

describe('OpenSpec: qml-export / QML 导出包边界', () => {
  it('边界检查：只依赖 core，没有 peer', () => {
    const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
      dependencies?: Readonly<Record<string, string>>
      peerDependencies?: Readonly<Record<string, string>>
      sideEffects?: boolean
    }
    expect(manifest.dependencies).toEqual({ '@compose-ui/core': 'workspace:*' })
    expect(manifest.peerDependencies).toBeUndefined()
    expect(manifest.sideEffects).toBe(false)
  })

  it('边界检查：无 React、无 DOM、不求解布局、不读写文件', () => {
    const source = sourceFiles(join(packageRoot, 'src'))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n')
    // 注释里会提到 DOM 与布局求解，判定只看可执行的那部分。
    const executable = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    expect(executable).not.toContain('document.querySelector')
    expect(executable).not.toContain('window.')
    expect(executable).not.toMatch(/from 'react/)
    expect(executable).not.toMatch(/from 'node:/)
    expect(executable).not.toMatch(/from '@compose-ui\/(?!core')/)
  })
})
