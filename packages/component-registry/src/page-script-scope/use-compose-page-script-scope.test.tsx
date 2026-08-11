import type { ComposeAssetResolver } from '@compose-ui/assets'
import type { ComposePageFile, ComposePageSetupReference } from '@compose-ui/core'
import type {
  ComposeLoadedScriptModule,
  ComposeScriptModuleLoader,
} from '@compose-ui/script-runtime'
import { act, render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useComposePageScriptScope } from './use-compose-page-script-scope'

/** 取最近一次渲染交给消费方的作用域；仓库 target 为 ES2020，不能用 `Array.at`。 */
function lastScope(onScope: { mock: { calls: unknown[][] } }) {
  const { calls } = onScope.mock
  return calls.length > 0 ? calls[calls.length - 1]![0] : undefined
}

function reference(assetKey: string): ComposePageSetupReference {
  return { providerId: 'local', assetKey, scope: 'persistent' }
}

function page(setupScript: ComposePageSetupReference | null): ComposePageFile {
  return {
    kind: 'compose-page',
    pageSchemaVersion: 1,
    setupScript,
    document: {
      schemaVersion: 6,
      rootIds: [],
      entities: {},
      canvas: { background: null },
      output: { width: 1920, height: 1080 },
    },
  } as unknown as ComposePageFile
}

/** 受测试控制的 Loader：可以延迟 resolve，用来构造卸载期间仍在加载的竞态。 */
function deferredLoader(setup: () => Record<string, unknown>) {
  const pending: Array<(value: ComposeLoadedScriptModule) => void> = []
  let revision = 0
  const loader: ComposeScriptModuleLoader = {
    load: () => new Promise<ComposeLoadedScriptModule>((resolve) => {
      pending.push(resolve)
    }),
  }
  return {
    loader,
    settleAll() {
      const waiting = pending.splice(0, pending.length)
      revision += 1
      waiting.forEach((resolve) => {
        resolve({ module: { setup }, revision: `r${revision}` })
      })
    },
    get pendingCount() {
      return pending.length
    },
  }
}

function Probe({
  file,
  loader,
  assetResolver,
  onScope,
}: {
  file: ComposePageFile
  loader: ComposeScriptModuleLoader
  assetResolver?: ComposeAssetResolver
  onScope: (scope: ReturnType<typeof useComposePageScriptScope>) => void
}) {
  const scope = useComposePageScriptScope({
    page: file,
    assetResolver,
    scriptModuleLoader: loader,
  })
  onScope(scope)
  return null
}

describe('OpenSpec: component-registry / 页面脚本作用域加载 Hook', () => {
  it('没有 setup 脚本时不加载任何作用域', () => {
    const deferred = deferredLoader(() => ({}))
    const onScope = vi.fn()
    render(<Probe file={page(null)} loader={deferred.loader} onScope={onScope} />)
    expect(deferred.pendingCount).toBe(0)
    expect(onScope).toHaveBeenLastCalledWith(undefined)
  })

  it('加载完成后交出作用域，卸载时 dispose', async () => {
    const deferred = deferredLoader(() => ({ label: 'ready' }))
    const onScope = vi.fn()
    const view = render(
      <Probe file={page(reference('a.js'))} loader={deferred.loader} onScope={onScope} />,
    )

    await act(async () => { deferred.settleAll() })
    const scope = lastScope(onScope) as ReturnType<typeof useComposePageScriptScope>
    expect(scope?.getExport('label')).toMatchObject({ value: 'ready' })

    view.unmount()
    expect(scope?.getSnapshot().disposed).toBe(true)
  })

  it('加载期间卸载时 dispose 迟到到达的作用域且不更新状态', async () => {
    const deferred = deferredLoader(() => ({ label: 'late' }))
    const onScope = vi.fn()
    const view = render(
      <Probe file={page(reference('a.js'))} loader={deferred.loader} onScope={onScope} />,
    )
    expect(onScope).toHaveBeenLastCalledWith(undefined)

    view.unmount()
    // 迟到 resolve 不能触发卸载后的状态更新，也不能留下仍在运行的作用域。
    await act(async () => { deferred.settleAll() })
    expect(onScope).toHaveBeenLastCalledWith(undefined)
  })

  it('资源变更通知后以新模块重建作用域并 dispose 旧实例', async () => {
    const deferred = deferredLoader(() => ({ label: 'v' }))
    const listeners: Array<() => void> = []
    const assetResolver = {
      resolve: vi.fn(),
      subscribe: vi.fn((_target: ComposePageSetupReference, listener: () => void) => {
        listeners.push(listener)
        return () => {}
      }),
    } as unknown as ComposeAssetResolver
    const onScope = vi.fn()
    render(
      <Probe
        assetResolver={assetResolver}
        file={page(reference('a.js'))}
        loader={deferred.loader}
        onScope={onScope}
      />,
    )

    await act(async () => { deferred.settleAll() })
    const first = lastScope(onScope) as ReturnType<typeof useComposePageScriptScope>
    expect(first).toBeDefined()

    act(() => { listeners.forEach((listener) => { listener() }) })
    await act(async () => { deferred.settleAll() })
    await waitFor(() => {
      expect(lastScope(onScope)).not.toBe(first)
    })
    expect(first?.getSnapshot().disposed).toBe(true)
  })
})
