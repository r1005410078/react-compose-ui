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

describe('svg-import dependency boundary', () => {
  const manifest = JSON.parse(
    readFileSync(join(packageRoot, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Readonly<Record<string, string>>
    peerDependencies?: Readonly<Record<string, string>>
    sideEffects?: boolean
  }

  it('OpenSpec: svg-import / SVG 导入产出组件导入计划 / 只依赖 core 与两个解析库', () => {
    expect(manifest.dependencies).toEqual({
      '@compose-ui/core': 'workspace:*',
      'fast-xml-parser': '^5.2.5',
      svgpath: '^2.6.0',
    })
    // React 是 chrome 的事：本包连 peer 都不该有。
    expect(manifest.peerDependencies).toBeUndefined()
    expect(manifest.sideEffects).toBe(false)
  })

  it('OpenSpec: svg-import / SVG 导入产出组件导入计划 / 无 React、无 DOM', () => {
    const source = sourceFiles(join(packageRoot, 'src'))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n')
    // 注释里会提到 DOM 与浏览器，判定必须只看可执行的那部分。
    const executable = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    expect(executable).not.toContain('document.')
    expect(executable).not.toContain('window.')
    expect(executable).not.toContain('DOMParser')
    expect(executable).not.toMatch(/from 'react/)
    expect(executable).not.toMatch(/@compose-ui\/(component-registry|materials|stage|editor)/)
  })

  it('OpenSpec: svg-import / SVG 导入产出组件导入计划 / 第三方类型不出现在公共入口', () => {
    // 包文档注释里会写清楚用了哪两个库，判定只看可执行的那部分。
    const entry = readFileSync(join(packageRoot, 'src', 'index.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    // 与 `layout-engine` 不让 Yoga 类型进公共 API 是同一条边界：换掉解析库不该是一次
    // 破坏性变更。
    expect(entry).not.toContain('fast-xml-parser')
    expect(entry).not.toContain('svgpath')
  })
})
