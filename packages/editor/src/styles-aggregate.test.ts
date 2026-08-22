import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const workspaceRoot = dirname(packageRoot)

const IMPORT_PATTERN = /@import\s+'(@compose-ui\/[\w-]+)\/styles\.css'/g

function stylesheetPath(name: string): string {
  return join(workspaceRoot, name.replace('@compose-ui/', ''), 'src', 'styles.css')
}

/**
 * 判断一个第一方包是否自带需要宿主加载的样式表。
 *
 * @remarks
 * 判据是**公开的 `./styles.css` 导出**而不是包里有没有 CSS 文件：包内可能有只被组件直接
 * import 的私有样式，而 Vite 的库构建会把 CSS 抽成独立产物、从 `dist/index.js` 里剥掉那条
 * import——所以只有声明成导出的那一份才落到宿主头上。
 *
 * 去掉注释后为空的样式表不算数：`ui-context` 只为包级样式协议占位，真加了规则再要求引入。
 */
function needsLoading(name: string): boolean {
  const manifestPath = join(workspaceRoot, name.replace('@compose-ui/', ''), 'package.json')
  if (!existsSync(manifestPath)) return false
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    exports?: Readonly<Record<string, unknown>>
  }
  if (manifest.exports?.['./styles.css'] === undefined) return false
  const source = stylesheetPath(name)
  if (!existsSync(source)) return false
  return readFileSync(source, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').trim().length > 0
}

/** 从 editor 的聚合样式表出发，沿 `@import` 求第一方样式表的传递闭包。 */
function reachableStylesheets(): ReadonlySet<string> {
  const reached = new Set<string>()
  const queue = [readFileSync(join(packageRoot, 'src', 'styles.css'), 'utf8')]
  while (queue.length > 0) {
    const css = queue.pop() as string
    for (const [, name] of css.matchAll(IMPORT_PATTERN)) {
      if (reached.has(name)) continue
      reached.add(name)
      const source = stylesheetPath(name)
      if (existsSync(source)) queue.push(readFileSync(source, 'utf8'))
    }
  }
  return reached
}

describe('editor 样式聚合', () => {
  /**
   * @remarks
   * 漏掉一条 `@import` 不会让任何东西报错：组件照常挂载、`toBeVisible()` 照常通过，只是完全
   * 没有样式——CAD 画布因此曾经退化成 SVG 的 intrinsic 300×150 加一个裸输入框。端到端断言的是
   * 可见性与行为，结构性地拦不住这一类回归，只能在这里按依赖清单核对。
   *
   * 按**传递闭包**而不是直接引入核对：`components` 这类底座由用到它的领域包各自引入，聚合
   * 表里不该再列一遍。
   */
  it('OpenSpec: editor-workspace-layout / 样式聚合 / 每个自带样式表的第一方依赖都能从 styles.css 到达', () => {
    const manifest = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf8'),
    ) as { dependencies?: Readonly<Record<string, string>> }
    const reached = reachableStylesheets()

    const missing = Object.keys(manifest.dependencies ?? {})
      .filter((name) => name.startsWith('@compose-ui/'))
      .filter(needsLoading)
      .filter((name) => !reached.has(name))

    expect(missing).toEqual([])
  })
})
