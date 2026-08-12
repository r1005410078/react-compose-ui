import type {
  ComposeComponentCatalog,
  ComposeComponentStore,
} from '@compose-ui/component-library'
import { useEffect, useState } from 'react'

/** 订阅项目组件目录，供资源树图标等宿主组合使用。 @internal */
export function useComponentCatalog(
  store: ComposeComponentStore | undefined,
): ComposeComponentCatalog | undefined {
  const [state, setState] = useState<{
    readonly store: ComposeComponentStore
    readonly catalog: ComposeComponentCatalog
  } | null>(null)

  useEffect(() => {
    if (!store) return
    let disposed = false
    const load = () => {
      void store.listComponents().then((catalog) => {
        if (!disposed) setState({ store, catalog })
      }).catch(() => {
        if (!disposed) setState(null)
      })
    }
    load()
    const unsubscribe = store.subscribe(() => { load() })
    return () => {
      disposed = true
      unsubscribe()
    }
  }, [store])

  return state !== null && state.store === store ? state.catalog : undefined
}
