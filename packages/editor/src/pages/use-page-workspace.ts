import {
  getComposeAnimationFileFrame,
  setComposeAnimationFileFrame,
  type ComposeAnimationFile,
} from '@compose-ui/animation'
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
import { loadPageAnimation, writePageAnimationFile } from '../animation-mode/animation-asset-store'
import { useComposePageCatalog } from './use-page-catalog'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type {
  ComposePageAnimationFileState,
  ComposePageDocumentSession,
} from '../workspace-layout/workspace-context'
import type { ComposeEditorActivePage, ComposeEditorPagesConfig } from './page-workspace-types'

/** 列出文档中所有绑定了动画文件的根 Frame。 */
function listFrameAnimationSources(
  document: ComposeDocument,
): readonly (readonly [string, ComposePageAnimationReference])[] {
  return document.rootIds.flatMap((frameId) => {
    const source = (document.entities[frameId]?.components.Animations as
      { source?: ComposePageAnimationReference } | undefined)?.source
    return source ? [[frameId, source] as const] : []
  })
}

/**
 * 把一块 Frame 的文件分区写进文档镜像。
 *
 * @remarks
 * 运行时没有整文档替换 API，水合必须发生在创建运行时之前，因此这里做的是纯文档改写。
 */
function hydrateFrameAnimations(
  document: ComposeDocument,
  frameId: string,
  source: ComposePageAnimationReference,
  items: readonly ComposeAnimation[],
): ComposeDocument {
  const frame = document.entities[frameId]
  if (!frame) return document
  return {
    ...document,
    entities: {
      ...document.entities,
      [frameId]: {
        ...frame,
        components: { ...frame.components, Animations: { source, items: [...items] } },
      },
    },
  }
}

/**
 * 把各 Frame 的文档镜像合并回它们各自绑定的文件。
 *
 * @remarks
 * 以**文件**为单位聚合：多块场景共用一份文件时，合并后一次保存对该文件只写一次。只有会话
 * 里已经载入过的文件参与合并——没载入过就没有可靠的基线，贸然写回会把别处的分区抹掉。
 *
 * @returns assetKey 到合并后文件的映射；调用方与基线比较后决定是否落盘。
 */
function mergeFrameMirrorsIntoFiles(
  document: ComposeDocument,
  files: ReadonlyMap<string, ComposePageAnimationFileState>,
): ReadonlyMap<string, ComposeAnimationFile> {
  const merged = new Map<string, ComposeAnimationFile>()
  for (const [frameId, source] of listFrameAnimationSources(document)) {
    const state = files.get(source.assetKey)
    if (!state) continue
    const base = merged.get(source.assetKey) ?? state.baseline
    merged.set(
      source.assetKey,
      setComposeAnimationFileFrame(base, frameId, getComposeAnimations(document, frameId)),
    )
  }
  return merged
}

/**
 * 把页面文件里的动画绑定带回待保存的文档。
 *
 * @remarks
 * `Animations.source` 住在文档里，却由 `setFrameAnimation` 这条**页面文件**写入产生——
 * 与 `setupScript`、`activeFrameId` 同类。于是会话中途绑定的动画只进了页面文件，运行时文档
 * 并不知道；保存时如果直接把运行时文档写下去，就会把刚写好的绑定覆盖掉，下次打开水合不出
 * 任何清单，再建动画还会因为找不到既有文件而多造一份。
 *
 * 因此保存前按 Frame 把页面文件里的 `source` 补回文档：`items` 以运行时文档为准（它才是
 * 用户编辑的那份），`source` 以页面文件为准（它才是绑定写入的落点）。解除绑定后页面文件
 * 里没有 source，这里自然也不会补回去。
 */
function carryFrameAnimationSources(
  previous: ComposeDocument,
  next: ComposeDocument,
): ComposeDocument {
  let entities = next.entities
  for (const [frameId, source] of listFrameAnimationSources(previous)) {
    const frame = entities[frameId]
    if (!frame) continue
    const animations = frame.components.Animations as
      { readonly items?: readonly ComposeAnimation[]; readonly source?: unknown } | undefined
    if (animations?.source !== undefined) continue
    entities = {
      ...entities,
      [frameId]: {
        ...frame,
        components: {
          ...frame.components,
          Animations: { items: animations?.items ?? [], source } as never,
        },
      },
    }
  }
  return entities === next.entities ? next : { ...next, entities }
}

/** 结构相等判定；文件是纯 JSON，序列化比较足够且与落盘内容一致。 */
function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

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
   * 原子绑定/更换/解除某块场景的动画文件引用，并同步已打开页面会话的动画基线。
   *
   * @param frameId - 绑定目标 Frame；省略时回退到页面的激活场景。
   * @returns 绑定时返回该 Frame 分区中的清单，供调用方派发镜像水合事务；解除时返回 null。
   */
  readonly setPageAnimation: (
    pageKey: string,
    reference: ComposePageAnimationReference | null,
    frameId?: string | null,
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
      // 动画文件按 Frame 分区，多块场景通常共用同一份：按 assetKey 去重，一份文件只读一次，
      // 再把各自的分区水合进对应 Frame 的镜像。某份文件读失败只降级它涉及的那些场景。
      const animationFiles = new Map<string, ComposePageAnimationFileState>()
      for (const [frameId, source] of listFrameAnimationSources(document)) {
        try {
          const cached = animationFiles.get(source.assetKey)
          const loaded = cached
            ? { file: cached.baseline, entryId: cached.entryId, revision: cached.revision }
            : await loadPageAnimation(provider, entry.parentId ?? provider.root.id, source)
          animationFiles.set(source.assetKey, {
            entryId: loaded.entryId,
            revision: loaded.revision,
            baseline: loaded.file,
          })
          document = hydrateFrameAnimations(
            document,
            frameId,
            source,
            getComposeAnimationFileFrame(loaded.file, frameId),
          )
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
        animationFiles,
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
    const documentAtSave = carryFrameAnimationSources(
      session.page.document,
      session.runtime.document,
    )
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
    // 动画文件是静态权威：页面保存后把各 Frame 镜像的变化合并回写文件。一份文件承载多块
    // 场景的分区，因此以文件为单位合并，一次保存对同一份文件只写一次；某块场景的镜像被
    // 撤销移除时该分区写空，但不删除文件——解除绑定才是删除引用的入口。
    const merged = mergeFrameMirrorsIntoFiles(documentAtSave, session.animationFiles)
    for (const [assetKey, next] of merged) {
      const current = session.animationFiles.get(assetKey)
      if (!current || jsonEqual(next, current.baseline)) continue
      try {
        const written = await writePageAnimationFile(
          session.provider,
          current.entryId,
          next,
          current.revision,
          force,
        )
        updateSession(panelId, (item) => ({
          ...item,
          animationFiles: new Map(item.animationFiles).set(assetKey, {
            entryId: current.entryId,
            revision: written.revision,
            baseline: next,
          }),
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
    // 激活写的是页面文件，而页面文件里的文档是**上次保存**的那份。刚新建、尚未保存的场景
    // 不在其中，直接写会被 Store 以「不是根 Frame」拒绝——那句话对用户毫无意义。这里提前
    // 给出可操作的说明；不在这里顺手保存文档，保存必须是用户的显式动作。
    if (!base.page.document.rootIds.includes(frameId)) {
      throw new ComposeAssetError('unsupported', '这个场景还没有保存，先保存页面再设为激活场景')
    }
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
    frameId?: string | null,
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
    // 绑定目标由调用方给出（编辑器传当前动画作用域场景），不再用会话固定值：那会让第二块
    // 场景的绑定写到第一块上。
    const targetFrameId = frameId
      ?? (session ? resolveComposePageActiveFrameId(session.page) : null)
      ?? resolveComposePageActiveFrameId((await store.readPage(pageKey)).page)
    if (!targetFrameId) throw new ComposeAssetError('unsupported', '页面没有可绑定动画的 Frame')
    const written = await store.setFrameAnimation(pageKey, targetFrameId, reference, expectedRevision)
    if (session) {
      updateSession(session.panelId, (current) => {
        const animationFiles = new Map(current.animationFiles)
        if (loaded && reference) {
          animationFiles.set(reference.assetKey, {
            entryId: loaded.entryId,
            revision: loaded.revision,
            baseline: loaded.file,
          })
        }
        return {
          ...current,
          page: written.page,
          baseRevision: written.revision,
          animationFiles,
        }
      })
    }
    return loaded ? getComposeAnimationFileFrame(loaded.file, targetFrameId)[0] ?? null : null
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
