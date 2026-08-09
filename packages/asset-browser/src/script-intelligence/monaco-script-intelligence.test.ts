import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComposeScriptIntelligenceSession } from './monaco-script-intelligence'

class FakeRange {
  constructor(
    readonly startLineNumber: number,
    readonly startColumn: number,
    readonly endLineNumber: number,
    readonly endColumn: number,
  ) {}

  getStartPosition() {
    return { lineNumber: this.startLineNumber, column: this.startColumn }
  }

  getEndPosition() {
    return { lineNumber: this.endLineNumber, column: this.endColumn }
  }
}

function createFixture() {
  let value = 'ctx.'
  const changes = new Set<() => void>()
  const providerDisposables = Array.from({ length: 3 }, () => ({ dispose: vi.fn() }))
  const providers: Record<string, unknown> = {}
  const shadowModel = {
    dispose: vi.fn(),
    setValue: vi.fn(),
  }
  const visibleModel = {
    getLanguageId: () => 'compose-intelligent-javascript',
    getOffsetAt: ({ column }: { column: number }) => column - 1,
    getPositionAt: (offset: number) => ({ lineNumber: 1, column: offset + 1 }),
    getValue: () => value,
    getWordUntilPosition: ({ column }: { column: number }) => ({
      endColumn: column,
      startColumn: column,
    }),
    onDidChangeContent: (listener: () => void) => {
      changes.add(listener)
      return { dispose: vi.fn(() => changes.delete(listener)) }
    },
  }
  const setModelMarkers = vi.fn()
  let disposableIndex = 0
  const register = (key: string, provider: unknown) => {
    providers[key] = provider
    return providerDisposables[disposableIndex++]!
  }
  const monaco = {
    MarkerSeverity: { Error: 8, Hint: 1, Info: 2, Warning: 4 },
    MarkerTag: { Deprecated: 2, Unnecessary: 1 },
    Range: FakeRange,
    Uri: { parse: (value: string) => ({ toString: () => value }) },
    editor: {
      createModel: vi.fn(() => shadowModel),
      setModelMarkers,
    },
    languages: {
      CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
      CompletionItemKind: {
        Class: 7,
        Enum: 12,
        Field: 4,
        Function: 2,
        Interface: 8,
        Keyword: 17,
        Module: 9,
        Property: 10,
        Variable: 5,
      },
      CompletionItemTag: { Deprecated: 1 },
      InlayHintKind: { Type: 1 },
      registerCompletionItemProvider: (_language: string, provider: unknown) => (
        register('completion', provider)
      ),
      registerHoverProvider: (_language: string, provider: unknown) => (
        register('hover', provider)
      ),
      registerInlayHintsProvider: (_language: string, provider: unknown) => (
        register('inlay', provider)
      ),
      registerSignatureHelpProvider: (_language: string, provider: unknown) => (
        register('signature', provider)
      ),
    },
  }
  const worker = {
    getCompletionEntryDetails: vi.fn(async () => ({
      displayParts: [{ text: '(method) state(): ComposeState<undefined>' }],
      documentation: [{
        text: '创建可读写的响应式状态。\n\n示例：\n\n```javascript\nconst count = ctx.state(0)\n```',
      }],
      kind: 'method',
      name: 'state',
    })),
    getCompletionsAtPosition: vi.fn(async () => ({
      entries: [{ kind: 'method', name: 'state', sortText: '0' }],
    })),
    getQuickInfoAtPosition: vi.fn(async () => ({
      displayParts: [{ text: '(parameter) ctx: ComposePageScriptContext' }],
      documentation: [{ text: '页面 setup 函数可使用的响应式工具集合。' }],
      textSpan: { start: 3, length: 3 },
    })),
    getSemanticDiagnostics: vi.fn(async () => [{
      category: 1,
      code: 2322,
      length: 3,
      messageText: 'Type mismatch',
      start: 3,
    }]),
    getSignatureHelpItems: vi.fn(async () => ({
      argumentIndex: 0,
      items: [{
        parameters: [{ displayParts: [{ text: 'initial: number' }] }],
        prefixDisplayParts: [{ text: 'state(' }],
        separatorDisplayParts: [{ text: ', ' }],
        suffixDisplayParts: [{ text: ')' }],
      }],
      selectedItemIndex: 0,
    })),
    getSuggestionDiagnostics: vi.fn(async () => []),
    getSyntacticDiagnostics: vi.fn(async () => []),
    provideInlayHints: vi.fn(async () => [{
      kind: 'Type',
      position: 3,
      text: ': ComposeState<number>',
    }]),
  }
  const extraLibraryDispose = vi.fn()
  const typescript = {
    getJavaScriptWorker: vi.fn(async () => async () => worker),
    javascriptDefaults: {
      addExtraLib: vi.fn(() => ({ dispose: extraLibraryDispose })),
      setInlayHintsOptions: vi.fn(),
    },
  }
  return {
    extraLibraryDispose,
    monaco,
    providerDisposables,
    providers,
    setValue(next: string) {
      value = next
      changes.forEach((listener) => listener())
    },
    shadowModel,
    setModelMarkers,
    typescript,
    visibleModel,
    worker,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('OpenSpec: asset-browser / 隐藏脚本智能层 / Monaco worker bridge', () => {
  it('映射语言能力、debounce diagnostics 并完整释放 session', async () => {
    vi.useFakeTimers()
    const fixture = createFixture()
    const session = createComposeScriptIntelligenceSession({
      model: fixture.visibleModel as never,
      monaco: fixture.monaco as never,
      profile: {
        id: 'test-setup',
        language: 'javascript',
        typeDeclarations: 'interface ComposePageScriptContext {}',
        createVirtualInsertions: () => [{ offset: 0, text: 'xxx' }],
      },
      typescript: fixture.typescript as never,
    })
    const token = { isCancellationRequested: false }
    const position = { lineNumber: 1, column: 5 }

    const completion = await (fixture.providers.completion as {
      provideCompletionItems(
        model: unknown,
        position: unknown,
        context: unknown,
        token: unknown,
      ): Promise<{ suggestions: readonly { label: string }[] } | undefined>
    }).provideCompletionItems(fixture.visibleModel, position, {}, token)
    expect(completion?.suggestions.map(({ label }) => label)).toContain('state')
    expect(fixture.worker.getCompletionsAtPosition).toHaveBeenCalledWith(
      expect.stringContaining('compose-script-shadow://test-setup/'),
      7,
    )
    const stateSuggestion = completion?.suggestions.find(({ label }) => label === 'state')
    const resolved = await (fixture.providers.completion as {
      resolveCompletionItem(item: unknown, token: unknown): Promise<{
        documentation?: { value: string }
      }>
    }).resolveCompletionItem(stateSuggestion, token)
    expect(resolved.documentation?.value).toContain('创建可读写的响应式状态')
    expect(resolved.documentation?.value).toContain('```javascript')
    expect(resolved.documentation?.value).toContain('ctx.state(0)')

    const hover = await (fixture.providers.hover as {
      provideHover(model: unknown, position: unknown, token: unknown): Promise<unknown>
    }).provideHover(fixture.visibleModel, { lineNumber: 1, column: 2 }, token)
    expect(hover).toEqual(expect.objectContaining({
      range: expect.objectContaining({ startColumn: 1, endColumn: 4 }),
      contents: expect.arrayContaining([
        expect.objectContaining({ value: '页面 setup 函数可使用的响应式工具集合。' }),
      ]),
    }))

    expect(fixture.providers).not.toHaveProperty('inlay')
    expect(fixture.typescript.javascriptDefaults.setInlayHintsOptions).not.toHaveBeenCalled()

    await vi.runAllTimersAsync()
    expect(fixture.setModelMarkers).toHaveBeenCalledWith(
      fixture.visibleModel,
      'compose-script-intelligence',
      [expect.objectContaining({ message: 'Type mismatch', startColumn: 1 })],
    )

    fixture.setValue('ctx.state(0)')
    expect(fixture.shadowModel.setValue).toHaveBeenCalledWith('xxxctx.state(0)')
    await vi.advanceTimersByTimeAsync(180)

    session.dispose()
    expect(fixture.shadowModel.dispose).toHaveBeenCalledOnce()
    expect(fixture.extraLibraryDispose).toHaveBeenCalledOnce()
    for (const disposable of fixture.providerDisposables) {
      expect(disposable.dispose).toHaveBeenCalledOnce()
    }
    expect(fixture.setModelMarkers).toHaveBeenLastCalledWith(
      fixture.visibleModel,
      'compose-script-intelligence',
      [],
    )
  })
})
