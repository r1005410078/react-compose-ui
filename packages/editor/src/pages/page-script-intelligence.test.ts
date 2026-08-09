import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import {
  COMPOSE_PAGE_SETUP_SCRIPT_INTELLIGENCE,
  findComposePageSetupParameterOffset,
} from './page-script-intelligence'

function applyInsertions(source: string) {
  const insertions = COMPOSE_PAGE_SETUP_SCRIPT_INTELLIGENCE
    .createVirtualInsertions(source)
  let result = source
  for (const insertion of [...insertions].reverse()) {
    result = result.slice(0, insertion.offset) + insertion.text + result.slice(insertion.offset)
  }
  return { insertions, result }
}

function virtualOffset(sourceOffset: number, insertions: ReturnType<
  typeof COMPOSE_PAGE_SETUP_SCRIPT_INTELLIGENCE.createVirtualInsertions
>) {
  return sourceOffset + insertions
    .filter((insertion) => insertion.offset <= sourceOffset)
    .reduce((total, insertion) => total + insertion.text.length, 0)
}

function createLanguageService(source: string) {
  const fileName = '/Counter.setup.js'
  const declarationName = '/compose-page-script-runtime.d.ts'
  const { insertions, result } = applyInsertions(source)
  const files = new Map([
    [fileName, result],
    [declarationName, COMPOSE_PAGE_SETUP_SCRIPT_INTELLIGENCE.typeDeclarations ?? ''],
  ])
  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => ({
      allowJs: true,
      checkJs: true,
      lib: ['lib.esnext.d.ts'],
      noEmit: true,
      target: ts.ScriptTarget.ESNext,
    }),
    getCurrentDirectory: () => '/',
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    getScriptFileNames: () => [...files.keys()],
    getScriptSnapshot: (name) => {
      const text = files.get(name) ?? ts.sys.readFile(name)
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text)
    },
    getScriptVersion: () => '1',
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
  }
  return {
    fileName,
    insertions,
    service: ts.createLanguageService(host),
    virtualSource: result,
  }
}

describe('OpenSpec: editor-workspace-layout / 页面 Setup JavaScript 智能编辑', () => {
  it('识别三种直接导出并跳过注释、字符串与模板伪匹配', () => {
    expect(findComposePageSetupParameterOffset('export function setup(ctx) {}'))
      .toBe('export function setup('.length)
    expect(findComposePageSetupParameterOffset('export const setup = (context) => ({})'))
      .toBe('export const setup = ('.length)
    expect(findComposePageSetupParameterOffset('export const setup = function (api) {}'))
      .toBe('export const setup = function ('.length)

    const decoys = [
      '// export function setup(fake) {}\nconst value = 1',
      'const text = "export function setup(fake) {}"',
      "const text = 'export const setup = (fake) => ({})'",
      'const text = `export const setup = function (fake) {}`',
    ]
    for (const source of decoys) {
      expect(findComposePageSetupParameterOffset(source)).toBeNull()
      expect(COMPOSE_PAGE_SETUP_SCRIPT_INTELLIGENCE.getSourceDiagnostics?.(source))
        .toEqual([expect.objectContaining({ severity: 'hint' })])
    }
  })

  it('为 ctx. 返回 Context 成员补全', () => {
    const source = 'export function setup(ctx) {\n  ctx.placeholder\n}'
    const { fileName, insertions, service, virtualSource } = createLanguageService(source)
    const sourceOffset = source.indexOf('ctx.placeholder') + 5
    const offset = virtualOffset(sourceOffset, insertions)
    expect(offset).toBe(virtualSource.indexOf('ctx.placeholder') + 5)

    const completions = service.getCompletionsAtPosition(fileName, offset, undefined)
    expect(completions?.entries.map(({ name }) => name))
      .toEqual(expect.arrayContaining(['state', 'computed', 'effect']))

    const expectedDocumentation = {
      state: ['创建可读写的响应式状态', '示例', '```javascript', 'ctx.state(0)'],
      computed: ['创建只读派生值', '示例', '```javascript', 'ctx.computed'],
      effect: ['注册响应式副作用', 'cleanup', '示例', '```javascript', 'ctx.effect'],
    } as const
    for (const [name, fragments] of Object.entries(expectedDocumentation)) {
      const details = service.getCompletionEntryDetails(
        fileName,
        offset,
        name,
        undefined,
        undefined,
        undefined,
        undefined,
      )
      const documentation = ts.displayPartsToString(details?.documentation)
      for (const fragment of fragments) expect(documentation).toContain(fragment)
    }
    service.dispose()
  })

  it('推导 ctx、State.value、Computed 只读、setup 返回成员与赋值错误', () => {
    const source = `export function setup(ctx) {
  const num = ctx.state(0)
  const doubled = ctx.computed(() => num.value * 2)
  doubled.value = 3
  num.value = 'wrong'
  const onAdd = () => { num.value += 1 }
  return { num, doubled, onAdd }
}`
    const { fileName, insertions, service } = createLanguageService(source)
    const at = (needle: string, delta = 0) => virtualOffset(
      source.indexOf(needle) + delta,
      insertions,
    )

    expect(service.getSyntacticDiagnostics(fileName)).toEqual([])
    const contextInfo = service.getQuickInfoAtPosition(
      fileName,
      virtualOffset(source.indexOf('ctx'), insertions),
    )
    expect(ts.displayPartsToString(contextInfo?.displayParts))
      .toContain('ComposePageScriptContext')

    const stateInfo = service.getQuickInfoAtPosition(fileName, at('num =', 1))
    expect(ts.displayPartsToString(stateInfo?.displayParts)).toContain('ComposeState<number>')
    const valueInfo = service.getQuickInfoAtPosition(fileName, at('num.value', 5))
    expect(ts.displayPartsToString(valueInfo?.displayParts)).toContain('number')

    const diagnostics = service.getSemanticDiagnostics(fileName)
    expect(diagnostics.some(({ code }) => code === 2540)).toBe(true)
    expect(diagnostics.some(({ code }) => code === 2322)).toBe(true)

    const setupInfo = service.getQuickInfoAtPosition(fileName, at('setup', 1))
    const setupType = ts.displayPartsToString(setupInfo?.displayParts)
    expect(setupType).toContain('num: ComposeState<number>')
    expect(setupType).toContain('onAdd: () => void')
    service.dispose()
  })
})
