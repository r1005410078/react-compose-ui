import { StrictMode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ComposeAssetError, type ComposeAssetEntry, type ComposeAssetProvider } from '@compose-ui/assets'
import {
  createEmptyCadDocument,
  serializeComposeCadDocument,
  type ComposeCadDescriptor,
} from '@compose-ui/cad'
import { useCadWorkspace } from './use-cad-workspace'

const ROOT_ID = 'root'
const FILE_ID = 'Topology.cad.json'

/** 只够 Store 读一份文档的最小 Provider。 */
function fakeProvider(): ComposeAssetProvider {
  const text = serializeComposeCadDocument(createEmptyCadDocument())
  const entry: ComposeAssetEntry = {
    id: FILE_ID,
    parentId: ROOT_ID,
    name: FILE_ID,
    kind: 'file',
    mediaType: 'application/vnd.compose-ui.cad+json',
    assetKey: FILE_ID,
    revision: '1',
  }
  return {
    id: 'fake',
    label: 'Fake',
    root: { id: ROOT_ID, parentId: null, name: 'fake', kind: 'folder' },
    capabilities: {
      createFile: true,
      createFolder: true,
      rename: true,
      move: true,
      delete: true,
      write: true,
      reference: true,
    },
    referenceScope: 'persistent',
    async list() {
      return [entry]
    },
    async read({ fileId }) {
      if (fileId !== FILE_ID) throw new ComposeAssetError('not-found', fileId)
      return { blob: new Blob([text]), revision: '1' }
    },
  }
}

const descriptor: ComposeCadDescriptor = {
  entryId: FILE_ID,
  assetKey: FILE_ID,
  displayName: 'Topology',
  revision: '1',
}

function renderWorkspace(wrapper?: React.ComponentType<{ children: React.ReactNode }>) {
  return renderHook(
    () => useCadWorkspace({ provider: fakeProvider(), sessions: new Map(), updateSession: () => {} }),
    wrapper ? { wrapper } : undefined,
  )
}

describe('useCadWorkspace 的 Store 生命周期', () => {
  it('StrictMode 的模拟卸载不会把仍在使用的 Store 释放掉', async () => {
    /*
     * StrictMode 在开发期模拟一次「挂载 → 卸载 → 再挂载」，而 useMemo 不会因此重算。
     * 若卸载清理直接 dispose，第二次挂载拿到的就是一个已释放的 Store，此后所有读写都抛
     * 「CAD Store 已释放」——在资源浏览器里的表现是「新建 CAD 之后文件没出现」。
     *
     * 端到端用例拦不住这条：它跑的是生产构建，没有这次双调用。
     */
    const view = renderWorkspace(StrictMode)

    // 微任务里的代次判定要先跑完，才能确定 Store 没被那次模拟卸载释放。
    await waitFor(() => { expect(view.result.current.store).toBeDefined() })
    await new Promise((resolve) => { queueMicrotask(() => resolve(null)) })

    const opened = await view.result.current.openDocument(descriptor)

    expect(opened.ok).toBe(true)
  })

  it('真正卸载之后 Store 被释放', async () => {
    const view = renderWorkspace()
    const store = view.result.current.store!

    view.unmount()
    await new Promise((resolve) => { queueMicrotask(() => resolve(null)) })

    // 释放之后任何读写都必须失败，否则 Provider 订阅会一直留着。
    await expect(store.readDocument(FILE_ID)).rejects.toThrow(/已释放/)
  })
})
