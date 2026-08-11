import type { ComposeAssetResolver } from '@compose-ui/assets'
import type { ComposePageFile } from '@compose-ui/core'
import {
  createComposeJavaScriptModuleLoader,
  loadComposePageScriptScope,
  type ComposePageScriptScope,
  type ComposeScriptModuleLoader,
} from '@compose-ui/script-runtime'
import { useEffect, useMemo, useState } from 'react'

/** `useComposePageScriptScope` 的输入。 @public */
export interface UseComposePageScriptScopeOptions {
  /**
   * 当前渲染实例的页面。省略、或页面没有 `setupScript` 时不加载任何作用域。
   */
  readonly page?: ComposePageFile
  /** 解析 setup 稳定引用与订阅其变更的资源端口。 */
  readonly assetResolver?: ComposeAssetResolver
  /**
   * 宿主提供的模块 Loader。省略时由 `assetResolver` 构造默认的自包含 JavaScript Loader。
   */
  readonly scriptModuleLoader?: ComposeScriptModuleLoader
}

/**
 * 为单个页面渲染实例加载并持有 setup 作用域。
 *
 * @remarks
 * Hook 拥有它创建的作用域：卸载、setup 引用变化和资源热重载都会 dispose 上一个实例。
 * 返回值只在作用域与当前 setup 引用匹配时才非空，因此消费者不会拿到属于旧引用的成员。
 * 每个调用点都得到独立作用域——这正是「页面实例隔离」要求的语义，不要在多个渲染实例
 * 之间提升共享这个 Hook 的结果。
 *
 * @returns 当前 setup 作用域；无 setup 脚本、正在加载或引用已切换时为 `undefined`。
 * @public
 */
export function useComposePageScriptScope(
  options: UseComposePageScriptScopeOptions,
): ComposePageScriptScope | undefined {
  const { page, assetResolver, scriptModuleLoader } = options
  const [loadedScope, setLoadedScope] = useState<{
    readonly key: string
    readonly scope: ComposePageScriptScope
  }>()
  const [reloadToken, setReloadToken] = useState(0)
  const defaultLoader = useMemo(() => assetResolver
    ? createComposeJavaScriptModuleLoader({ assetResolver })
    : undefined, [assetResolver])
  const loader = scriptModuleLoader ?? defaultLoader
  const setupScript = page?.setupScript
  const setupKey = setupScript
    ? `${setupScript.providerId}:${setupScript.assetKey}:${setupScript.scope}`
    : null
  const loadKey = setupKey === null ? null : `${setupKey}:${reloadToken}`

  useEffect(() => {
    if (!setupScript) return undefined
    return assetResolver?.subscribe?.(setupScript, () => {
      setReloadToken((current) => current + 1)
    })
    // setupKey 是稳定引用的完整身份；页面文档变化不应重新订阅。
  }, [assetResolver, setupKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!setupScript || !loader || loadKey === null) return undefined
    const controller = new AbortController()
    let disposed = false
    let pendingScope: ComposePageScriptScope | undefined
    void loadComposePageScriptScope({
      reference: setupScript,
      loader,
      signal: controller.signal,
    }).then((loaded) => {
      // 加载函数在取消时同样 resolve，因此必须自己判断是否已经卸载再决定归属。
      if (disposed) {
        loaded.scope.dispose()
        return
      }
      pendingScope = loaded.scope
      setLoadedScope({ key: loadKey, scope: loaded.scope })
    })
    return () => {
      disposed = true
      controller.abort()
      pendingScope?.dispose()
    }
    // setupKey 是稳定引用的完整身份；文档变化不应让 setup 重跑。
  }, [loader, loadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return loadedScope?.key === loadKey ? loadedScope.scope : undefined
}
