import type { ComposePageCatalog, ComposePageStore } from '@compose-ui/pages'
import { useEffect, useState } from 'react'

/**
 * 订阅页面 Store 的目录快照。
 *
 * @remarks
 * 目录列举失败不抛出，只让结果保持为空 —— 页面能力缺失不应阻断编辑器其余部分。
 * @public
 */
export function useComposePageCatalog(
  store: ComposePageStore | undefined,
): ComposePageCatalog | undefined {
  // Store 变化时上一份目录立即失效；把 store 一起存入 state 使派生值无需额外清理。
  const [state, setState] = useState<{
    readonly store: ComposePageStore
    readonly catalog: ComposePageCatalog
  } | null>(null)

  useEffect(() => {
    if (!store) return
    let disposed = false
    const load = () => {
      void store.listPages().then((next) => {
        if (!disposed) setState({ store, catalog: next })
      }).catch(() => {
        if (!disposed) setState(null)
      })
    }
    load()
    const unsubscribe = store.subscribe((event) => {
      if (event.type === 'catalog-changed' || event.type === 'manifest-changed') load()
    })
    return () => {
      disposed = true
      unsubscribe()
    }
  }, [store])

  return state !== null && state.store === store ? state.catalog : undefined
}
