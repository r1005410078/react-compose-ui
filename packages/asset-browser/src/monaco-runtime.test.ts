import { describe, expect, it, vi } from 'vitest'

describe('OpenSpec: asset-browser / Monaco 脚本编辑 / 按需加载并保存脚本', () => {
  it('JavaScript 与 TypeScript 注册 tokenizer 并产生不同 token', async () => {
    Object.defineProperty(document, 'queryCommandSupported', {
      configurable: true,
      value: () => false,
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        addEventListener: () => undefined,
        addListener: () => undefined,
        matches: false,
        removeEventListener: () => undefined,
        removeListener: () => undefined,
      }),
    })
    const { getMonaco } = await import('./monaco-runtime')
    const monaco = getMonaco()
    for (const languageId of ['javascript', 'typescript']) {
      const language = monaco.languages.getLanguages().find(
        (item) => item.id === languageId,
      ) as ({
        readonly id: string
        loader?: () => Promise<unknown>
      }) | undefined
      expect(language?.loader).toBeTypeOf('function')
      const loaded = await language?.loader?.() as {
        language: Parameters<typeof monaco.languages.setMonarchTokensProvider>[1]
      }
      const provider = monaco.languages.setMonarchTokensProvider(languageId, loaded.language)
      await vi.waitFor(() => {
        const tokens = monaco.editor.tokenize('export const value = "text"', languageId).flat()
        expect(new Set(tokens.map((token) => token.type)).size).toBeGreaterThan(1)
      })
      provider.dispose()
    }
  }, 30_000)
})
