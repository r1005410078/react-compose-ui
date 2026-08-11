import {
  ComposeAssetError,
  type ComposeAssetEntry,
  type ComposeAssetProvider,
  type ComposeAssetResolver,
} from '@compose-ui/assets'
import { composePageDisplayName, createTransactionRuntime } from '@compose-ui/core'
import type { ComposePageSetupReference } from '@compose-ui/core'
import { createComposePageStore, type ComposePageCatalog, type ComposePageStore } from '@compose-ui/pages'
import {
  createComposeJavaScriptModuleLoader,
  loadComposePageScriptScope,
  type ComposePageScriptScope,
} from '@compose-ui/script-runtime'
import { useComposePageCatalog } from './use-page-catalog'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { ComposePageDocumentSession } from '../workspace-layout/workspace-context'
import type { ComposeEditorActivePage, ComposeEditorPagesConfig } from './page-workspace-types'

/** 一次页面打开尝试的结果。 @internal */
export type OpenPageResult =
  | { readonly ok: true; readonly session: ComposePageDocumentSession }
  | { readonly ok: false; readonly error: ComposeAssetError }

/** 页面工作区句柄。 @internal */
export interface PageWorkspaceHandle {
  readonly store: ComposePageStore | undefined
  readonly catalog: ComposePageCatalog | undefined
  /** 打开或复用一个页面会话；面板创建由调用方完成。 */
  readonly openPage: (entry: ComposeAssetEntry) => Promise<OpenPageResult>
  /** 保存页面；冲突时返回 `conflict` 让调用方决定是否强制覆盖。 */
  readonly savePage: (panelId: string, force?: boolean) => Promise<'saved' | 'conflict' | 'failed'>
  /** 原子更换/解除 setup，并同步已打开页面会话与作用域。 */
  readonly setPageSetupScript: (
    pageKey: string,
    reference: ComposePageSetupReference | null,
  ) => Promise<void>
  /** 重新执行当前页面已关联的 setup，并用新作用域替换旧实例。 */
  readonly reloadPageSetupScript: (pageKey: string) => Promise<void>
  readonly refreshCatalog: () => void
}

function pageSessionOf(
  session: ComposePageDocumentSession | undefined,
): ComposePageDocumentSession | undefined {
  return session?.kind === 'page' ? session : undefined
}

/**
 * 管理页面 Store、页面目录与已打开页面的事务运行时。
 *
 * @remarks
 * 每个页面一个 `TransactionRuntime`，存活在会话表中，因此切换标签不丢失撤销历史。
 * 本 Hook 不创建 Dockview 面板，也不持有 controller —— 活动页面的运行时通过
 * `onActiveSessionChange` 交回宿主，由宿主决定传给哪一个 controller。
 * @internal
 */
export function usePageWorkspace({
  activePanelId,
  config,
  provider,
  assetResolver,
  sessions,
  updateSession,
}: {
  readonly activePanelId: string | null
  readonly config: ComposeEditorPagesConfig | undefined
  readonly provider: ComposeAssetProvider | undefined
  readonly assetResolver: ComposeAssetResolver | undefined
  readonly sessions: ReadonlyMap<string, ComposePageDocumentSession>
  readonly updateSession: (
    panelId: string,
    update: (current: ComposePageDocumentSession) => ComposePageDocumentSession,
  ) => void
}): PageWorkspaceHandle {
  // 只按「是否启用页面」、宿主 Store 与 Provider 三者派生：config 常常是行内对象字面量，
  // 若把它整个作为依赖，每次渲染都会重建 Store 并丢掉文档缓存与订阅。
  const pagesEnabled = config !== undefined
  const hostStore = config?.store
  const store = useMemo(() => {
    if (!pagesEnabled) return undefined
    if (hostStore) return hostStore
    return provider ? createComposePageStore({ provider }) : undefined
  }, [hostStore, pagesEnabled, provider])

  const catalog = useComposePageCatalog(store)
  const sessionsRef = useRef(sessions)
  const ownedScopesRef = useRef(new Set<ComposePageScriptScope>())
  const reloadControllersRef = useRef(new Map<string, AbortController>())
  const defaultScriptLoader = useMemo(() => assetResolver
    ? createComposeJavaScriptModuleLoader({ assetResolver })
    : undefined, [assetResolver])
  const scriptLoader = config?.scriptModuleLoader ?? defaultScriptLoader
  const setupSubscriptionKey = [...sessions.values()].flatMap((session) => {
    const reference = session.page.setupScript
    return reference
      ? [`${session.panelId}\u0000${reference.providerId}\u0000${reference.assetKey}\u0000${reference.scope}`]
      : []
  }).join('\u0001')

  useEffect(() => {
    sessionsRef.current = sessions
    const liveScopes = new Set([...sessions.values()].flatMap((session) =>
      session.scriptScope ? [session.scriptScope] : []))
    ownedScopesRef.current.forEach((scope) => {
      if (liveScopes.has(scope)) return
      scope.dispose()
      ownedScopesRef.current.delete(scope)
    })
  }, [sessions])

  const unmountedRef = useRef(false)
  useEffect(() => () => {
    unmountedRef.current = true
    reloadControllersRef.current.forEach((controller) => { controller.abort() })
    reloadControllersRef.current.clear()
    ownedScopesRef.current.forEach((scope) => { scope.dispose() })
    ownedScopesRef.current.clear()
  }, [])

  /**
   * 接管一个新建作用域的所有权。卸载后到达的作用域必须就地释放：此时清理 Effect 已经
   * 跑过，再放进 ownedScopesRef 就再也没有人会 dispose 它，它的 Effect 会一直运行。
   */
  const adoptScope = useCallback((scope: ComposePageScriptScope) => {
    if (unmountedRef.current) {
      scope.dispose()
      return undefined
    }
    ownedScopesRef.current.add(scope)
    return scope
  }, [])

  const reloadPageSetupScript = useCallback(async (pageKey: string) => {
    const session = [...sessionsRef.current.values()].find((item) => item.pageKey === pageKey)
    const reference = session?.page.setupScript
    if (!session || !reference || !scriptLoader) {
      throw new ComposeAssetError('unsupported', '当前页面脚本不可重新加载')
    }

    reloadControllersRef.current.get(session.panelId)?.abort()
    const controller = new AbortController()
    reloadControllersRef.current.set(session.panelId, controller)
    const loaded = await loadComposePageScriptScope({
      reference,
      loader: scriptLoader,
      signal: controller.signal,
    })
    if (reloadControllersRef.current.get(session.panelId) === controller) {
      reloadControllersRef.current.delete(session.panelId)
    }
    if (controller.signal.aborted) {
      loaded.scope.dispose()
      return
    }

    const current = sessionsRef.current.get(session.panelId)
    const currentReference = current?.page.setupScript
    if (!currentReference
      || currentReference.providerId !== reference.providerId
      || currentReference.assetKey !== reference.assetKey
      || currentReference.scope !== reference.scope) {
      loaded.scope.dispose()
      return
    }
    const adopted = adoptScope(loaded.scope)
    if (!adopted) return
    updateSession(session.panelId, (item) => ({ ...item, scriptScope: adopted }))
  }, [adoptScope, scriptLoader, updateSession])

  useEffect(() => {
    if (!assetResolver?.subscribe || !scriptLoader) return undefined
    const unsubscribes = [...sessionsRef.current.values()].flatMap((session) => {
      const reference = session.page.setupScript
      return reference
        ? [assetResolver.subscribe!(reference, () => {
            const current = sessionsRef.current.get(session.panelId)
            if (current) void reloadPageSetupScript(current.pageKey)
          })]
        : []
    })
    return () => {
      unsubscribes.forEach((unsubscribe) => { unsubscribe() })
    }
  }, [assetResolver, reloadPageSetupScript, scriptLoader, setupSubscriptionKey])

  const refreshCatalog = useCallback(() => {
    store?.invalidate()
  }, [store])

  const openPage = useCallback(async (entry: ComposeAssetEntry): Promise<OpenPageResult> => {
    if (!store || !provider || !entry.assetKey) {
      return {
        ok: false,
        error: new ComposeAssetError('unsupported', '页面缺少稳定 assetKey，无法打开'),
      }
    }
    const pageKey = entry.assetKey
    const existing = [...sessionsRef.current.values()].find((item) => item.pageKey === pageKey)
    if (existing) return { ok: true, session: existing }
    try {
      const snapshot = await store.readPage(pageKey)
      const displayName = composePageDisplayName(entry.name)
      const runtime = createTransactionRuntime({
        document: snapshot.page.document,
        initialLabel: displayName,
      })
      let scriptScope: ComposePageScriptScope | undefined
      if (snapshot.page.setupScript && scriptLoader) {
        const loaded = await loadComposePageScriptScope({
          reference: snapshot.page.setupScript,
          loader: scriptLoader,
        })
        scriptScope = adoptScope(loaded.scope)
      }
      const session: ComposePageDocumentSession = {
        kind: 'page',
        panelId: '',
        provider,
        entry,
        pageKey,
        displayName,
        page: snapshot.page,
        runtime,
        scriptScope,
        baseRevision: snapshot.revision,
        savedRevisionId: runtime.revision,
        dirty: false,
        save: null,
      }
      return { ok: true, session }
    }
    catch (error) {
      return {
        ok: false,
        error: error instanceof ComposeAssetError
          ? error
          : new ComposeAssetError('io', '页面读取失败', { cause: error }),
      }
    }
  }, [adoptScope, provider, scriptLoader, store])

  const savePage = useCallback(async (
    panelId: string,
    force?: boolean,
  ): Promise<'saved' | 'conflict' | 'failed'> => {
    const session = pageSessionOf(sessionsRef.current.get(panelId))
    if (!store || !session) return 'failed'
    const runtimeRevision = session.runtime.revision
    try {
      const written = await store.writePage(
        session.pageKey,
        { ...session.page, document: session.runtime.document },
        session.baseRevision,
        force,
      )
      updateSession(panelId, (current) => ({
        ...current,
        page: written.page,
        baseRevision: written.revision,
        // 以发起写入时的 runtime revision 为基线：写入期间用户可能又改了一笔，
        // 那笔改动应当仍然被视为未保存。
        savedRevisionId: runtimeRevision,
        dirty: current.runtime.revision !== runtimeRevision,
      }))
      return 'saved'
    }
    catch (error) {
      if (error instanceof ComposeAssetError && error.code === 'conflict') return 'conflict'
      return 'failed'
    }
  }, [store, updateSession])

  const setPageSetupScript = useCallback(async (
    pageKey: string,
    reference: ComposePageSetupReference | null,
  ) => {
    if (!store) throw new ComposeAssetError('unsupported', '页面 Store 不可用')
    const session = [...sessionsRef.current.values()].find((item) => item.pageKey === pageKey)
    const base = session ?? await store.readPage(pageKey)
    const expectedRevision = 'baseRevision' in base ? base.baseRevision : base.revision
    const written = await store.setPageSetupScript(pageKey, reference, expectedRevision)
    if (!session) return

    reloadControllersRef.current.get(session.panelId)?.abort()

    // 与 reload 共用同一把取消闸门：连续更换脚本时，先发起的加载不能把自己的作用域
    // 写回会话，也不能把它挂到实例上继续运行。
    const controller = new AbortController()
    reloadControllersRef.current.set(session.panelId, controller)

    let scriptScope: ComposePageScriptScope | undefined
    if (reference && scriptLoader) {
      const loaded = await loadComposePageScriptScope({
        reference,
        loader: scriptLoader,
        signal: controller.signal,
      })
      if (controller.signal.aborted) {
        loaded.scope.dispose()
        return
      }
      scriptScope = adoptScope(loaded.scope)
    }
    if (reloadControllersRef.current.get(session.panelId) === controller) {
      reloadControllersRef.current.delete(session.panelId)
    }
    else if (controller.signal.aborted) return
    updateSession(session.panelId, (current) => ({
      ...current,
      page: written.page,
      baseRevision: written.revision,
      scriptScope,
    }))
  }, [adoptScope, scriptLoader, store, updateSession])

  // 页面会话的脏状态由其运行时 revision 与保存基线的差异决定。
  useEffect(() => {
    const unsubscribes = [...sessions.values()].map((session) => session.runtime.subscribe(() => {
      const current = pageSessionOf(sessionsRef.current.get(session.panelId))
      if (!current) return
      const dirty = current.runtime.revision !== current.savedRevisionId
      if (dirty !== current.dirty) {
        updateSession(session.panelId, (item) => ({ ...item, dirty }))
      }
    }))
    return () => { unsubscribes.forEach((unsubscribe) => { unsubscribe() }) }
  }, [sessions, updateSession])

  const activeSession = activePanelId ? pageSessionOf(sessions.get(activePanelId)) : undefined
  const onActiveSessionChange = config?.onActiveSessionChange
  const activePage = useMemo<ComposeEditorActivePage | null>(() => activeSession
    ? {
        pageKey: activeSession.pageKey,
        displayName: activeSession.displayName,
        runtime: activeSession.runtime,
        page: activeSession.page,
        scriptScope: activeSession.scriptScope,
      }
    : null, [activeSession])

  useEffect(() => {
    onActiveSessionChange?.(activePage)
  }, [activePage, onActiveSessionChange])

  return {
    store,
    catalog,
    openPage,
    savePage,
    setPageSetupScript,
    reloadPageSetupScript,
    refreshCatalog,
  }
}
