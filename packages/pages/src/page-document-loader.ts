import type { ComposePageLoader, ComposePageReference } from '@compose-ui/core'
import type { ComposePageStore } from './page-store'

/**
 * 由页面 Store 派生页面文档加载端口。
 *
 * @remarks
 * 只处理属于该 Store 所绑定 Provider 的引用；其余引用直接拒绝，避免跨 Provider 误读。
 * 重复加载命中 Store 缓存，因此同一页面被多个槽位引用时只会读取一次。
 * @public
 */
export function createComposePageLoader(
  store: ComposePageStore,
): ComposePageLoader {
  const belongsToStore = (reference: ComposePageReference) =>
    reference.providerId === store.providerId

  return {
    async load(reference, signal) {
      if (!belongsToStore(reference)) {
        throw new Error(`页面引用不属于当前 Provider：${reference.providerId}`)
      }
      return (await store.readPage(reference.assetKey, signal)).page
    },
    subscribe(reference, listener) {
      if (!belongsToStore(reference)) return () => undefined
      return store.subscribe((event) => {
        // 目录或清单变化不影响单个页面的内容，只在该页面本身变化时重载。
        if (event.type === 'page-changed' && event.pageKey === reference.assetKey) listener()
      })
    },
  }
}

