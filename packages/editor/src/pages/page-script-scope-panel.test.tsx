import type { ComposeAssetProvider } from '@compose-ui/assets'
import type { ComposePageSetupReference } from '@compose-ui/core'
import { ComposePropertyPanelRoot } from '@compose-ui/property-panel'
import { createComposePageScriptScope, type ComposeState } from '@compose-ui/script-runtime'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PageScriptScopePanel } from './page-script-scope-panel'

const pageEntry = {
  id: 'home',
  parentId: 'root',
  name: 'Home.page.json',
  kind: 'file' as const,
  assetKey: 'Home.page.json',
}
const counterEntry = {
  id: 'counter',
  parentId: 'root',
  name: 'Counter.setup.js',
  kind: 'file' as const,
  assetKey: 'scripts/Counter.setup.js',
}

function providerFixture(): ComposeAssetProvider {
  return {
    id: 'memory',
    label: 'Assets',
    root: { id: 'root', parentId: null, name: 'Assets', kind: 'folder' },
    capabilities: {
      createFile: true,
      createFolder: false,
      rename: false,
      move: false,
      delete: false,
      write: true,
      reference: true,
    },
    list: vi.fn(async () => [pageEntry, counterEntry, {
      id: 'plain-js',
      parentId: 'root',
      name: 'helper.js',
      kind: 'file' as const,
      assetKey: 'helper.js',
    }]),
    read: vi.fn(),
    createFile: vi.fn(async ({ parentId, name }) => ({
      id: `created-${name}`,
      parentId,
      name,
      kind: 'file' as const,
      assetKey: name,
      revision: '1',
    })),
    writeFile: vi.fn(),
  }
}

function renderPanel({
  provider = providerFixture(),
  reference = null,
  scope,
}: {
  readonly provider?: ComposeAssetProvider
  readonly reference?: ComposePageSetupReference | null
  readonly scope?: ReturnType<typeof createComposePageScriptScope>
} = {}) {
  const onOpen = vi.fn()
  const onReload = vi.fn(async () => undefined)
  const onSetupChange = vi.fn(async () => undefined)
  const onError = vi.fn()
  // 组件是共享 Root 内的一个 Section：Root 提供分组 chrome、搜索与列宽。
  render(
    <ComposePropertyPanelRoot>
      <PageScriptScopePanel
        onError={onError}
        onOpen={onOpen}
        onReload={onReload}
        onSetupChange={onSetupChange}
        pageName="Home"
        pageParentId="root"
        provider={provider}
        reference={reference}
        scope={scope}
      />
    </ComposePropertyPanelRoot>,
  )
  return { onError, onOpen, onReload, onSetupChange, provider }
}

afterEach(() => { cleanup() })

describe('PageScriptScopePanel', () => {
  it('OpenSpec: editor-workspace-layout / 页面脚本作为 Canvas Inspector 属性 / 未关联页面选择或快捷创建脚本', async () => {
    const { onOpen, onSetupChange, provider } = renderPanel()

    const select = await screen.findByRole('combobox', { name: '脚本文件' })
    expect(screen.getByText('未连接')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Counter.setup.js' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'helper.js' })).not.toBeInTheDocument()

    fireEvent.change(select, { target: { value: 'scripts/Counter.setup.js' } })
    await waitFor(() => {
      expect(onSetupChange).toHaveBeenCalledWith({
        providerId: 'memory',
        assetKey: 'scripts/Counter.setup.js',
        scope: 'persistent',
      })
    })

    fireEvent.click(screen.getByRole('button', { name: '快捷创建页面脚本' }))
    await waitFor(() => {
      expect(provider.createFile).toHaveBeenCalledWith(expect.objectContaining({
        parentId: 'root',
        name: 'Home.setup.js',
      }))
      expect(onSetupChange).toHaveBeenLastCalledWith({
        providerId: 'memory',
        assetKey: 'Home.setup.js',
        scope: 'persistent',
      })
      expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ name: 'Home.setup.js' }))
    })
  })

  it('OpenSpec: editor-workspace-layout / 页面脚本作为 Canvas Inspector 属性 / 已关联页面查看和管理脚本', async () => {
    let num: ComposeState<number> | undefined
    const scope = createComposePageScriptScope((ctx) => {
      num = ctx.state(0)
      return { num, onAdd: () => { num!.value += 1 } }
    })
    const { onOpen, onReload, onSetupChange } = renderPanel({
      reference: {
        providerId: 'memory',
        assetKey: 'scripts/Counter.setup.js',
        scope: 'persistent',
      },
      scope,
    })

    expect(await screen.findByRole('combobox', { name: '脚本文件' }))
      .toHaveValue('scripts/Counter.setup.js')
    expect(screen.getByRole('list', { name: '页面脚本返回成员' })).toHaveTextContent('num')
    expect(screen.getByRole('list', { name: '页面脚本返回成员' })).toHaveTextContent('onAdd')
    expect(screen.queryByText('已连接')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重新加载脚本' }))
    await waitFor(() => { expect(onReload).toHaveBeenCalledOnce() })
    expect(screen.queryByText('响应式')).not.toBeInTheDocument()
    expect(screen.getAllByText('方法')).toHaveLength(1)

    // 折叠/展开由共享 Section 的分组标题按钮承担。
    fireEvent.click(screen.getByRole('button', { name: '页面脚本' }))
    expect(screen.queryByRole('list', { name: '页面脚本返回成员' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '页面脚本' }))
    expect(screen.getByRole('list', { name: '页面脚本返回成员' })).toBeInTheDocument()

    act(() => {
      num!.value = 5
      scope.reportDiagnostic({ code: 'script.method-threw', message: '方法执行失败' })
    })
    expect(screen.getByRole('list', { name: '页面脚本返回成员' })).toHaveTextContent('5')
    expect(screen.getByRole('alert')).toHaveTextContent('方法执行失败')

    fireEvent.click(screen.getByRole('button', { name: '更多页面脚本操作' }))
    expect(await screen.findByRole('menu', { name: '页面脚本操作' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: '打开页面脚本' }))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({
      assetKey: 'scripts/Counter.setup.js',
    }))

    fireEvent.click(screen.getByRole('button', { name: '更多页面脚本操作' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '解除页面脚本' }))
    await waitFor(() => { expect(onSetupChange).toHaveBeenCalledWith(null) })
    scope.dispose()
  })
})
