import {
  ComposeAssetError,
  type ComposeAssetEntry,
  type ComposeAssetProvider,
  type ComposeAssetResolver,
} from '@compose-ui/assets'
import {
  composePageDisplayName,
  createTransactionRuntime,
  getComposeAnimations,
  resolveComposePageActiveFrameId,
} from '@compose-ui/core'
import type {
  ComposeAnimation,
  ComposeDocument,
  ComposePageAnimationReference,
  ComposePageSetupReference,
} from '@compose-ui/core'
import { createComposePageStore, type ComposePageCatalog, type ComposePageStore } from '@compose-ui/pages'
import {
  createComposeJavaScriptModuleLoader,
  loadComposePageScriptScope,
  type ComposePageScriptScope,
} from '@compose-ui/script-runtime'
import { loadPageAnimation, writePageAnimationManifest } from '../animation-mode/animation-asset-store'
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
  /**
   * 原子绑定/更换/解除页面动画文件引用，并同步已打开页面会话的动画基线。
   *
   * @returns 绑定时返回动画文件中的清单，供调用方派发镜像水合事务；解除时返回 null。
   */
  readonly setPageAnimation: (
    pageKey: string,
    reference: ComposePageAnimationReference | null,
  ) => Promise<ComposeAnimation | null>
  /**
   * 切换页面的激活场景，并同步已打开页面会话的 revision 基线。
   *
   * @remarks
   * 激活状态在页面文件里而不是 ComposeDocument 里，因此这是资源写入，**不进撤销历史**。
   */
  readonly setPageActiveFrame: (pageKey: string, frameId: string) => Promise<void>
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
  useEffect(() => {
    // StrictMode 会同步 cleanup 后重放 setup。必须在每次 setup 复位，否则重放留下的
    // `true` 会让此后每个加载完成的作用域都被当成「卸载后到达」就地释放，页面永远拿不到
    // 脚本作用域。
    unmountedRef.current = false
    // 两个集合实例由 useRef 一次性创建且永不重新赋值，因此在 setup 期取出的引用与
    // cleanup 期读到的是同一个对象。
    const reloadControllers = reloadControllersRef.current
    const ownedScopes = ownedScopesRef.current
    return () => {
      unmountedRef.current = true
      reloadControllers.forEach((controller) => { controller.abort() })
      reloadControllers.clear()
      ownedScopes.forEach((scope) => { scope.dispose() })
      ownedScopes.clear()
    }
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
      // 动画文件是静态权威：打开页面时把文件清单水合进文档镜像，此后编辑走可撤销的
      // animation.* 命令。运行时没有整文档替换 API，水合必须发生在创建运行时之前。
      // 加载失败保留页面内嵌镜像作为降级回退，不阻塞页面打开。
      let document: ComposeDocument = snapshot.page.document
      let animationEntryId: string | undefined
      let animationRevision: string | undefined
      let animationManifest: ComposeAnimation | undefined
      // v7 的动画清单归属 Frame：绑定引用在激活场景的 Animations.source 上。
      const animationFrameId = resolveComposePageActiveFrameId(snapshot.page)
      const animationSource = animationFrameId
        ? (document.entities[animationFrameId]?.components.Animations as
            { source?: ComposePageAnimationReference } | undefined)?.source
        : undefined
      if (animationSource && animationFrameId) {
        try {
          const loaded = await loadPageAnimation(
            provider,
            entry.parentId ?? provider.root.id,
            animationSource,
          )
          animationEntryId = loaded.entryId
          animationRevision = loaded.revision
          animationManifest = loaded.file.animation
          const frame = document.entities[animationFrameId]!
          document = {
            ...document,
            entities: {
              ...document.entities,
              [animationFrameId]: {
                ...frame,
                components: {
                  ...frame.components,
                  Animations: { source: animationSource, items: [loaded.file.animation] },
                },
              },
            },
          }
        }
        catch (error) {
          console.warn('[compose-editor] 绑定动画文件加载失败，使用页面内嵌镜像', error)
        }
      }
      const runtime = createTransactionRuntime({
        document,
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
        animationEntryId,
        animationFrameId: animationFrameId ?? undefined,
        animationRevision,
        animationManifest,
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
    const documentAtSave = session.runtime.document
    try {
      const written = await store.writePage(
        session.pageKey,
        { ...session.page, document: documentAtSave },
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
    }
    catch (error) {
      if (error instanceof ComposeAssetError && error.code === 'conflict') return 'conflict'
      return 'failed'
    }
    // 动画文件是静态权威：页面保存后把镜像清单的变化回写文件。镜像被撤销移除时
    // 只跳过回写，不删除文件——解除绑定才是删除引用的入口。
    const mirrorFrameId = session.animationFrameId ?? documentAtSave.rootIds[0] ?? null
    const mirrorItems = mirrorFrameId ? getComposeAnimations(documentAtSave, mirrorFrameId) : []
    const mirror = mirrorItems.find((item) => item.id === session.animationManifest?.id)
      ?? mirrorItems[0]
    if (session.animationEntryId !== undefined && mirror !== undefined
      && JSON.stringify(mirror) !== JSON.stringify(session.animationManifest)) {
      try {
        const writtenAnimation = await writePageAnimationManifest(
          session.provider,
          session.animationEntryId,
          mirror,
          session.animationRevision ?? '',
          force,
        )
        updateSession(panelId, (current) => ({
          ...current,
          animationRevision: writtenAnimation.revision,
          animationManifest: mirror,
        }))
      }
      catch (error) {
        if (error instanceof ComposeAssetError && error.code === 'conflict') return 'conflict'
        return 'failed'
      }
    }
    return 'saved'
  }, [store, updateSession])

  /**
   * 切换页面的激活场景。
   *
   * @remarks
   * 激活状态在页面文件里，不在 ComposeDocument 里，因此这是一次资源写入而**不进撤销历史**
   * ——与 setPageSetupScript、setPageAnimation 同类。写入成功后必须回写会话的 page 与
   * baseRevision，否则下一次保存会拿着过期 revision 冲突。
   */
  const setPageActiveFrame = useCallback(async (pageKey: string, frameId: string) => {
    if (!store) throw new ComposeAssetError('unsupported', '页面 Store 不可用')
    const session = [...sessionsRef.current.values()].find((item) => item.pageKey === pageKey)
    const base = session ?? await store.readPage(pageKey)
    const expectedRevision = 'baseRevision' in base ? base.baseRevision : base.revision
    const written = await store.setPageActiveFrame(pageKey, frameId, expectedRevision)
    if (!session) return
    updateSession(session.panelId, (current) => ({
      ...current,
      page: written.page,
      baseRevision: written.revision,
    }))
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

  const setPageAnimation = useCallback(async (
    pageKey: string,
    reference: ComposePageAnimationReference | null,
  ): Promise<ComposeAnimation | null> => {
    if (!store || !provider) throw new ComposeAssetError('unsupported', '页面 Store 不可用')
    const session = [...sessionsRef.current.values()].find((item) => item.pageKey === pageKey)
    // 绑定前先加载并解析动画文件：文件不合法时页面包装保持不变，调用方直接得到原因。
    let loaded: Awaited<ReturnType<typeof loadPageAnimation>> | undefined
    if (reference) {
      loaded = await loadPageAnimation(
        provider,
        session?.entry.parentId ?? provider.root.id,
        reference,
      )
    }
    const expectedRevision = session ? session.baseRevision : (await store.readPage(pageKey)).revision
    const targetFrameId = session?.animationFrameId
      ?? (session ? resolveComposePageActiveFrameId(session.page) : null)
      ?? resolveComposePageActiveFrameId((await store.readPage(pageKey)).page)
    if (!targetFrameId) throw new ComposeAssetError('unsupported', '页面没有可绑定动画的 Frame')
    const written = await store.setFrameAnimation(pageKey, targetFrameId, reference, expectedRevision)
    if (session) {
      updateSession(session.panelId, (current) => ({
        ...current,
        page: written.page,
        baseRevision: written.revision,
        animationEntryId: loaded?.entryId,
        animationFrameId: targetFrameId,
        animationRevision: loaded?.revision,
        animationManifest: loaded?.file.animation,
      }))
    }
    return loaded?.file.animation ?? null
  }, [provider, store, updateSession])

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
    setPageAnimation,
    setPageActiveFrame,
    refreshCatalog,
  }
}
