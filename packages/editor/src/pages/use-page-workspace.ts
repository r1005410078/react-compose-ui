import { ComposeAssetError, type ComposeAssetEntry, type ComposeAssetProvider } from '@compose-ui/assets'
import { composePageDisplayName, createTransactionRuntime } from '@compose-ui/core'
import { createComposePageStore, type ComposePageCatalog, type ComposePageStore } from '@compose-ui/pages'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  sessions,
  updateSession,
}: {
  readonly activePanelId: string | null
  readonly config: ComposeEditorPagesConfig | undefined
  readonly provider: ComposeAssetProvider | undefined
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

  // Store 变化时上一份目录立即失效；把 store 一起存入 state 使派生值无需额外 Effect 清理。
  const [catalogState, setCatalogState] = useState<{
    readonly store: ComposePageStore
    readonly catalog: ComposePageCatalog
  } | null>(null)
  const catalog = catalogState !== null && catalogState.store === store
    ? catalogState.catalog
    : undefined
  const sessionsRef = useRef(sessions)

  useEffect(() => {
    sessionsRef.current = sessions
  }, [sessions])

  const refreshCatalog = useCallback(() => {
    if (!store) return
    store.invalidate()
  }, [store])

  useEffect(() => {
    if (!store) return
    let disposed = false
    const load = () => {
      void store.listPages().then((next) => {
        if (!disposed) setCatalogState({ store, catalog: next })
      }).catch(() => {
        // 目录列举失败不阻断编辑器；页面菜单项会因为目录为空而无候选。
        if (!disposed) setCatalogState(null)
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
        document: snapshot.document,
        initialLabel: displayName,
      })
      const session: ComposePageDocumentSession = {
        kind: 'page',
        panelId: '',
        provider,
        entry,
        pageKey,
        displayName,
        runtime,
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
  }, [provider, store])

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
        session.runtime.document,
        session.baseRevision,
        force,
      )
      updateSession(panelId, (current) => ({
        ...current,
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
      }
    : null, [activeSession])

  useEffect(() => {
    onActiveSessionChange?.(activePage)
  }, [activePage, onActiveSessionChange])

  return { store, catalog, openPage, savePage, refreshCatalog }
}
