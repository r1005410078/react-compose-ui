import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !/\.(test|stories)\./.test(entry.name) ? [path] : []
  })
}

describe('canvas-kit 依赖边界', () => {
  /**
   * @remarks
   * 「本包不认识文档」这条边界由**包依赖**承载而不是命名约定：想引用文档或选择集类型必须先
   * 加一条依赖，而这条用例会把它挡下。命中测试、场景渲染与手势语义正是两个画布**不能**互相
   * 复用的原因，它们进来就等于把那条差异变成包内的 `if`。
   */
  it('OpenSpec: canvas-kit / 无限画布基础包边界 / 只依赖 core 与 ui-context', () => {
    const manifest = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf8'),
    ) as {
      dependencies?: Readonly<Record<string, string>>
      peerDependencies?: Readonly<Record<string, string>>
    }
    expect(manifest.dependencies).toEqual({
      '@compose-ui/core': 'workspace:*',
      '@compose-ui/ui-context': 'workspace:*',
    })
    expect(Object.keys(manifest.peerDependencies ?? {})).toEqual(['react', 'react-dom'])

    const source = sourceFiles(join(packageRoot, 'src'))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n')
    const executable = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')

    for (const forbidden of ['stage', 'stage-engine', 'cad', 'cad-canvas', 'editor', 'preview']) {
      expect(executable).not.toMatch(new RegExp(`@compose-ui/${forbidden}['"]`))
    }
    // 文档词汇：出现即说明本包开始认识领域模型。标尺的 `selection` 是一段屏幕区间与尺寸文本，
    // 不是选择集，因此不在此列。
    expect(executable).not.toMatch(/\bComposeDocument\b|\bCadDocument\b|\bComposeEntity\b/)
  })
})
