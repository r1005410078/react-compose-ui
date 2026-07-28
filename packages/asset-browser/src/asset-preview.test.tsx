import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRef } from 'react'
import type { ComponentProps } from 'react'
import { ComposeAssetPreview } from './asset-preview'
import type { ComposeAssetPreviewHandle } from './asset-preview'
import { ComposeAssetError } from '@compose-ui/assets'
import type { ComposeAssetEntry, ComposeAssetProvider } from '@compose-ui/assets'
import type { ScriptEditor } from './script-editor'

vi.mock('./script-editor', () => ({
  ScriptEditor: ({
    onSave,
  }: ComponentProps<typeof ScriptEditor>) => (
      <button type="button" onClick={() => void onSave('const mine = true', 'r1')}>
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

describe('ComposeAssetPreview', () => {
  it('OpenSpec: asset-browser / 独立资源预览组件 / 图片使用 Blob URL 且卸载后释放', async () => {
    const image = {
      ...entry,
      id: 'logo',
      name: 'logo.svg',
      mediaType: 'image/svg+xml',
    }
    const provider: ComposeAssetProvider = {
      id: 'memory',
      label: 'Assets',
      root: { id: 'root', parentId: null, name: 'Assets', kind: 'folder' },
      capabilities: { createFile: false, createFolder: false, rename: false, move: false, delete: false, write: false },
      list: vi.fn(async () => []),
      read: vi.fn(async () => ({ blob: new Blob(['<svg/>'], { type: 'image/svg+xml' }), revision: 'r1' })),
    }
    const { unmount } = render(<ComposeAssetPreview entry={image} provider={provider} />)

    expect(await screen.findByRole('img', { name: 'logo.svg' })).toHaveAttribute('src', 'blob:script')
    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:script')
  })

  it('OpenSpec: asset-browser / 独立资源预览组件 / 非脚本资源的 ref 保存不产生写入', async () => {
    const ref = createRef<ComposeAssetPreviewHandle>()
    const binary = { ...entry, id: 'binary', name: 'mesh.bin', mediaType: 'application/octet-stream' }
    const provider: ComposeAssetProvider = {
      id: 'memory',
      label: 'Assets',
      root: { id: 'root', parentId: null, name: 'Assets', kind: 'folder' },
      capabilities: { createFile: false, createFolder: false, rename: false, move: false, delete: false, write: false },
      list: vi.fn(async () => []),
      read: vi.fn(async () => ({ blob: new Blob(['binary']), revision: 'r1' })),
    }
    render(<ComposeAssetPreview ref={ref} entry={binary} provider={provider} />)

    expect(await screen.findByText('此文件类型暂不支持预览')).toBeVisible()
    await expect(ref.current?.save()).resolves.toBe(true)
    expect(provider.writeFile).toBeUndefined()
  })

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
      <ComposeAssetPreview
        entry={entry}
        provider={provider}
        onDirtyChange={onDirtyChange}
        onSaved={onSaved}
      />,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Mock save' }))
    const conflict = await screen.findByRole('dialog', { name: '文件已在外部修改' })
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
