import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COMPOSE_UI_LIBRARY_BROWSER_PACKAGE } from '../index'

const packageJson = JSON.parse(
  // jsdom 环境里 `import.meta.url` 不是 file: URL，因此按包根解析；vitest 的 cwd 就是包根。
  readFileSync(resolve('package.json'), 'utf8'),
) as {
  readonly dependencies?: Readonly<Record<string, string>>
  readonly peerDependencies?: Readonly<Record<string, string>>
}

describe('OpenSpec: library-browser / 独立页面库浏览包边界', () => {
  it('不依赖编辑器', () => {
    expect(COMPOSE_UI_LIBRARY_BROWSER_PACKAGE).toBe('@compose-ui/library-browser')
    const deps = Object.keys(packageJson.dependencies ?? {})
    // 页面库是一个可以完全不加载编辑器的宿主；这条边界由依赖表承载，而不是命名约定。
    expect(deps).not.toContain('@compose-ui/editor')
    expect(deps).not.toContain('@compose-ui/stage')
    expect(deps).not.toContain('@compose-ui/asset-browser')
    expect(deps).toContain('@compose-ui/library')
  })

  it('React 是 peer，不内联进包', () => {
    // 宿主加载多份 React 的症状是 Context 分家，而这个组件要读 ui-context。
    expect(Object.keys(packageJson.peerDependencies ?? {})).toEqual(['react', 'react-dom'])
    expect(Object.keys(packageJson.dependencies ?? {})).not.toContain('react')
  })

  it('包内 reset 走 :where()，不压过组件类', () => {
    const css = readFileSync(resolve('src/styles.css'), 'utf8')
    // `.compose-library button` 是 (0,1,1)，会压过每一条 (0,1,0) 的组件类——症状是主按钮没有
    // 底色、`margin-left: auto` 不生效，两处都不报错，只是看起来「样式没写」。
    expect(css).toContain('.compose-library :where(button)')
    expect(css).not.toMatch(/^\.compose-library button \{/mu)
  })
})
