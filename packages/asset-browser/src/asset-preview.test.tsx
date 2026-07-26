import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { AssetPreview } from './asset-preview'
import { getAssetBrowserMessages } from './asset-browser-i18n'
import { ComposeAssetError } from '@compose-ui/assets'
import type { ComposeAssetEntry, ComposeAssetProvider } from '@compose-ui/assets'
import type { ScriptEditor } from './script-editor'

vi.mock('./script-editor', () => ({
  ScriptEditor: (props: ComponentProps<typeof ScriptEditor>) => (
    <button type="button" onClick={() => void props.onSave('const mine = true', 'r1')}>
      Mock save
    </button>
  ),
}))

const entry: ComposeAssetEntry = {
  id: 'main',
  parentId: 'root',
  name: 'main.ts',
  kind: 'file',
  mediaType: 'text/typescript',
  revision: 'r1',
}

beforeEach(() => {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:script'),
    revokeObjectURL: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AssetPreview', () => {
  it('OpenSpec: asset-browser / Monaco 脚本编辑 / 冲突后只允许重新载入或明确强制覆盖', async () => {
    const savedEntry = { ...entry, revision: 'r2' }
    const provider: ComposeAssetProvider = {
      id: 'memory',
      label: 'Assets',
      root: { id: 'root', parentId: null, name: 'Assets', kind: 'folder' },
      capabilities: {
        createFile: false,
        createFolder: false,
        rename: false,
        move: false,
        delete: false,
        write: true,
      },
      list: vi.fn(async () => []),
      read: vi.fn(async () => ({ blob: new Blob(['const old = true']), revision: 'r1' })),
      writeFile: vi.fn()
        .mockRejectedValueOnce(new ComposeAssetError('conflict', 'changed'))
        .mockResolvedValueOnce(savedEntry),
    }
    const onDirtyChange = vi.fn()
    const onSaved = vi.fn()
    render(
      <AssetPreview
        entry={entry}
        locale="zh-CN"
        messages={getAssetBrowserMessages('zh-CN')}
        provider={provider}
        theme="dark"
        onDirtyChange={onDirtyChange}
        onSaved={onSaved}
      />,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Mock save' }))
    const conflict = await screen.findByRole('alertdialog', { name: '文件已在外部修改' })
    fireEvent.click(screen.getByRole('button', { name: '强制覆盖' }))
    await waitFor(() => expect(provider.writeFile).toHaveBeenLastCalledWith({
      fileId: 'main',
      content: expect.any(Blob),
      expectedRevision: 'r1',
      force: true,
    }))
    expect(onSaved).toHaveBeenCalledWith(savedEntry)
    expect(onDirtyChange).toHaveBeenCalledWith(false)
    expect(conflict).not.toBeInTheDocument()
  })
})
