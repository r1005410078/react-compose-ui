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
  return {
    model,
    editor,
    createModel: vi.fn(() => model),
    createEditor: vi.fn(() => editor),
    setTheme: vi.fn(),
    setValue(next: string) {
      value = next
      for (const listener of changeListeners) listener()
    },
  }
})

vi.mock('./monaco-runtime', () => ({
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
})
