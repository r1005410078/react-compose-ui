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

    expect(manifest.dependencies).toEqual({
      '@compose-ui/core': 'workspace:*',
      '@compose-ui/interaction-kernel': 'workspace:*',
    })
    expect(manifest.peerDependencies).toBeUndefined()
    expect(manifest.sideEffects).toBe(false)
    expect(executableSource).not.toMatch(
      /(?:from|import\()\s*['"](?:react|react-dom|@compose-ui\/(?:stage|editor|component-registry|ui-context))/,
    )
    expect(executableSource).not.toMatch(
      /\b(?:HTMLElement|PointerEvent|KeyboardEvent|DOMMatrix|ResizeObserver)\b/,
    )
  })

  it('OpenSpec: stage-engine / Stage 交互插件仲裁 / 内核来自独立包', () => {
    // 原先这里用正则拦「内核文件里不许出现 Stage 类型」。抽包之后这条约束由**依赖清单**
    // 承载：内核住在一个 dependencies 为空的包里，想引用 Stage 类型必须先加依赖，那条依赖
    // 会被内核包自己的边界用例挡下。正则拦得住 `StageSceneIndex`，拦不住一个改名成
    // `SceneIndex` 的类型被 import 进来——包边界拦得住。
    //
    // 留在 Stage 这一侧要守的只剩一件事：绑定不许扩散。内核目录下除了 profile 与插件，
    // 不得再出现第二份仲裁实现。
    const kernelDirectory = join(packageRoot, 'src', 'interaction-kernel')
    const localSource = sourceFiles(kernelDirectory)
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')

    expect(localSource).toMatch(/from\s+['"]@compose-ui\/interaction-kernel['"]/)
    expect(
      localSource,
      '仲裁器与注册表由 @compose-ui/interaction-kernel 提供，Stage 侧不得再实现一份',
    ).not.toMatch(/export function createInteraction(?:SessionArbiter|PluginRegistry)\b/)
  })
})
