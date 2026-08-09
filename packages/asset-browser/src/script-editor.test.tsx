import type { ComponentType } from 'react'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const monacoFixture = vi.hoisted(() => {
  const changeListeners = new Set<() => void>()
  let value = 'const value = 1'
  const model = {
    getValue: vi.fn(() => value),
    onDidChangeContent: vi.fn((listener: () => void) => {
      changeListeners.add(listener)
      return { dispose: vi.fn(() => changeListeners.delete(listener)) }
    }),
    dispose: vi.fn(),
  }
  const editor = {
    addCommand: vi.fn(),
    dispose: vi.fn(),
    layout: vi.fn(),
  }
  const intelligenceDispose = vi.fn()
  return {
    model,
    editor,
    createModel: vi.fn((text?: string, language?: string, uri?: unknown) => {
      void text
      void language
      void uri
      return model
    }),
    createEditor: vi.fn(() => editor),
    setTheme: vi.fn(),
    prepareIntelligentJavaScript: vi.fn(),
    createIntelligenceSession: vi.fn((options: {
      profile: { createVirtualInsertions(source: string): readonly { offset: number; text: string }[] }
    }) => {
      const source = model.getValue()
      const insertion = options.profile.createVirtualInsertions(source)[0]
      const shadow = insertion
        ? source.slice(0, insertion.offset) + insertion.text + source.slice(insertion.offset)
        : source
      monacoFixture.createModel(shadow, 'javascript', 'compose-script-shadow://test/1.js')
      return { dispose: intelligenceDispose }
    }),
    intelligenceDispose,
    setValue(next: string) {
      value = next
      for (const listener of changeListeners) listener()
    },
  }
})

vi.mock('./monaco-runtime', () => ({
  COMPOSE_INTELLIGENT_JAVASCRIPT_LANGUAGE: 'compose-intelligent-javascript',
  createComposeScriptIntelligenceSession: monacoFixture.createIntelligenceSession,
  getMonaco: () => ({
    Uri: { parse: vi.fn((value: string) => value) },
    KeyMod: { CtrlCmd: 1 },
    KeyCode: { KeyS: 2 },
    editor: {
      getModel: vi.fn(() => null),
      createModel: monacoFixture.createModel,
      create: monacoFixture.createEditor,
      setTheme: monacoFixture.setTheme,
    },
  }),
  prepareComposeIntelligentJavaScript: monacoFixture.prepareIntelligentJavaScript,
}))

import { ScriptEditor } from './script-editor'
import { getAssetScriptLanguage } from './script-language'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('script editor', () => {
  it('OpenSpec: asset-browser / Monaco 脚本编辑 / 按扩展名映射内建语言', () => {
    expect(getAssetScriptLanguage('view.tsx')).toBe('typescript')
    expect(getAssetScriptLanguage('theme.scss')).toBe('scss')
    expect(getAssetScriptLanguage('README.md')).toBe('markdown')
    expect(getAssetScriptLanguage('unknown.txt')).toBe('plaintext')
  })

  it('OpenSpec: asset-browser / Monaco 脚本编辑 / 创建唯一 model、显式保存并释放资源', async () => {
    const onDirtyChange = vi.fn()
    const onSave = vi.fn(async () => true)
    const { unmount } = render(
      <ScriptEditor
        content={new Blob(['const value = 1'])}
        entry={{
          id: 'scripts/main.ts',
          parentId: 'scripts',
          name: 'main.ts',
          kind: 'file',
        }}
        providerId="memory"
        revision="r1"
        loadingLabel="Loading editor"
        theme="dark"
        onDirtyChange={onDirtyChange}
        onSave={onSave}
      />,
    )
    await waitFor(() => expect(monacoFixture.createModel).toHaveBeenCalledWith(
      'const value = 1',
      'typescript',
      expect.stringContaining('compose-asset://memory/'),
    ))
    act(() => monacoFixture.setValue('const value = 2'))
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    const saveCommand = monacoFixture.editor.addCommand.mock.calls[0]?.[1]
    await act(async () => saveCommand?.())
    expect(onSave).toHaveBeenCalledWith('const value = 2', 'r1')
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    unmount()
    expect(monacoFixture.editor.dispose).toHaveBeenCalled()
    expect(monacoFixture.model.dispose).toHaveBeenCalled()
  })

  it('OpenSpec: asset-browser / Monaco 脚本编辑 / 隐藏类型层不污染保存', async () => {
    const IntelligentScriptEditor = ScriptEditor as unknown as ComponentType<Record<string, unknown>>
    const { unmount } = render(
      <IntelligentScriptEditor
        content={new Blob(['export function setup(ctx) { return { value: ctx.state(0) } }'])}
        entry={{
          id: 'scripts/Counter.setup.js',
          parentId: 'scripts',
          name: 'Counter.setup.js',
          kind: 'file',
        }}
        loadingLabel="Loading editor"
        providerId="memory"
        revision="r1"
        theme="dark"
        scriptIntelligence={{
          id: 'compose-page-setup',
          language: 'javascript',
          createVirtualInsertions: () => [{ offset: 0, text: '// @ts-check\n' }],
        }}
        onDirtyChange={() => undefined}
        onSave={async () => true}
      />,
    )

    await waitFor(() => expect(monacoFixture.createModel).toHaveBeenCalledTimes(2))
    expect(monacoFixture.createModel).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('export function setup'),
      'compose-intelligent-javascript',
      expect.anything(),
    )
    expect(monacoFixture.createModel).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('// @ts-check'),
      'javascript',
      expect.anything(),
    )
    const createOptions = (monacoFixture.createEditor.mock.calls as unknown as unknown[][])[0]?.[1]
    expect(createOptions).toMatchObject({ inlayHints: { enabled: 'off' } })
    unmount()
    expect(monacoFixture.intelligenceDispose).toHaveBeenCalledOnce()
  })

  it('OpenSpec: asset-browser / 只读资源预览 / 只读脚本编辑器', async () => {
    const onDirtyChange = vi.fn()
    const onSave = vi.fn(async () => true)
    const handle = { current: null as { save(): Promise<boolean> } | null }
    render(
      <ScriptEditor
        ref={(value) => { handle.current = value }}
        content={new Blob(['{"schemaVersion":5}'])}
        entry={{
          id: 'Pages/Home.page.json',
          parentId: 'Pages',
          name: 'Home.page.json',
          kind: 'file',
        }}
        loadingLabel="Loading editor"
        providerId="memory"
        readOnly
        revision="r1"
        theme="dark"
        onDirtyChange={onDirtyChange}
        onSave={onSave}
      />,
    )
    await waitFor(() => { expect(monacoFixture.createEditor).toHaveBeenCalled() })

    // Monaco 以只读创建，并且一并关闭 contenteditable。
    // createEditor 的 mock 签名未声明参数，取调用实参需要先放宽为数组。
    const createOptions = (monacoFixture.createEditor.mock.calls as unknown as unknown[][])[0]?.[1]
    expect(createOptions).toMatchObject({ readOnly: true, domReadOnly: true })
    // 不注册保存快捷键，也不订阅内容变更。
    expect(monacoFixture.editor.addCommand).not.toHaveBeenCalled()
    expect(monacoFixture.model.onDidChangeContent).not.toHaveBeenCalled()

    act(() => monacoFixture.setValue('tampered'))
    expect(onDirtyChange).not.toHaveBeenCalledWith(true)

    // 保存入口空转成功且不写入 Provider。
    await expect(handle.current?.save()).resolves.toBe(true)
    expect(onSave).not.toHaveBeenCalled()
  })
})
