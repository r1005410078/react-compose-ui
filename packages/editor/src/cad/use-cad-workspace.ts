import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { ComposeAssetProvider } from '@compose-ui/assets'
import {
  createCadCommandHandlers,
  createComposeCadStore,
  validateCadDocument,
  type CadDocument,
  type ComposeCadDescriptor,
  type ComposeCadStore,
} from '@compose-ui/cad'
import { createDocumentTransactionRuntime } from '@compose-ui/core'
import type { DocumentValidationIssueShape } from '@compose-ui/core'
import type { ComposeCadDocumentSession } from '../workspace-layout/workspace-context'

/** 打开一份 CAD 文档的结果。 @internal */
export type OpenCadResult =
  | { readonly ok: true; readonly session: Omit<ComposeCadDocumentSession, 'panelId'> }
  | { readonly ok: false; readonly message: string }

/** CAD 工作区句柄。 @internal */
export interface CadWorkspaceHandle {
  readonly store: ComposeCadStore | undefined
  openDocument(descriptor: ComposeCadDescriptor): Promise<OpenCadResult>
  saveDocument(panelId: string): Promise<boolean>
}

/**
 * 维护当前 Provider 上的 CAD Store 与打开的会话。
 *
 * @remarks
 * 每份文档一个事务运行时，因此各标签的撤销历史在切换后仍然保留。运行时用
 * `createDocumentTransactionRuntime` 注入 `validateCadDocument`——CAD 复用同一套事务、
 * Patch 与 Undo/Redo，不存在第二份实现。
 * @internal
 */
export function useCadWorkspace({
  provider,
  sessions,
  updateSession,
}: {
  readonly provider: ComposeAssetProvider | undefined
  readonly sessions: ReadonlyMap<string, ComposeCadDocumentSession>
  readonly updateSession: (
    panelId: string,
    update: (current: ComposeCadDocumentSession) => ComposeCadDocumentSession,
  ) => void
}): CadWorkspaceHandle {
  const store = useMemo(
    () => (provider ? createComposeCadStore({ provider }) : undefined),
    [provider],
  )
  /*
   * 卸载时释放 Store，但**延后一个微任务并按代次判定**。
   *
   * StrictMode 在开发期会模拟一次「挂载 → 卸载 → 再挂载」，而 `useMemo` 不会因此重算——
   * 直接在卸载清理里 dispose，会把仍在使用的那一个 Store 永久释放掉，随后每次
   * createDocument/readDocument 都抛「CAD Store 已释放」。生产构建没有这次双调用，因此
   * 只有开发期现形，端到端用例（跑的是 vite preview）也照样全绿。
   *
   * 与 `use-layout-runtime.ts` 的 Runtime 释放用同一套代次判定：再挂载会让代次前进，
   * 微任务里发现代次已变就不释放；真正的卸载没有后续挂载，代次不变，照常释放。
   */
  const generation = useRef(0)
  useEffect(() => {
    generation.current += 1
    const mounted = generation.current
    return () => queueMicrotask(() => {
      if (generation.current === mounted) store?.dispose()
    })
  }, [store])

  // 会话与更新入口从 ref 读取而不进依赖数组：宿主每帧新建这些引用，进依赖数组会让
  // openDocument / saveDocument 每帧换身份，注册进宿主保存表的回调随之每帧重建。
  const latest = useRef({ sessions, updateSession })
  useLayoutEffect(() => {
    latest.current = { sessions, updateSession }
  })

  const openDocument = useCallback(async (
    descriptor: ComposeCadDescriptor,
  ): Promise<OpenCadResult> => {
    if (!store) return { ok: false, message: 'CAD Store 尚未就绪' }
    try {
      const snapshot = await store.readDocument(descriptor.assetKey)
      const runtime = createDocumentTransactionRuntime<CadDocument, DocumentValidationIssueShape>({
        document: snapshot.document,
        validate: validateCadDocument,
        // CAD 的命令词汇必须显式注入：泛型运行时不预置任何文档协议的内建 handler。
        handlers: createCadCommandHandlers(),
      })
      return {
        ok: true,
        session: {
          kind: 'cad',
          assetKey: snapshot.assetKey,
          displayName: descriptor.displayName,
          runtime,
          baseRevision: snapshot.revision,
          savedRevisionId: runtime.revision,
          dirty: false,
          save: null,
        },
      }
    }
    catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }, [store])

  const saveDocument = useCallback(async (panelId: string) => {
    const session = latest.current.sessions.get(panelId)
    if (!store || !session) return false
    try {
      const snapshot = await store.saveDocument(
        session.assetKey,
        session.runtime.document,
        session.baseRevision,
      )
      latest.current.updateSession(panelId, (current) => ({
        ...current,
        baseRevision: snapshot.revision,
        savedRevisionId: current.runtime.revision,
        dirty: false,
      }))
      return true
    }
    catch {
      return false
    }
  }, [store])

  // 事务运行时的 revision 与「上次落盘时的 revision」比对得出脏标记；订阅按会话建立，
  // 因此每个标签各自维护自己的脏状态。
  useEffect(() => {
    const unsubscribes = [...sessions.values()].map((session) => session.runtime.subscribe(() => {
      const current = latest.current.sessions.get(session.panelId)
      if (!current) return
      const dirty = current.runtime.revision !== current.savedRevisionId
      if (dirty !== current.dirty) {
        latest.current.updateSession(session.panelId, (value) => ({ ...value, dirty }))
      }
    }))
    return () => { unsubscribes.forEach((unsubscribe) => { unsubscribe() }) }
  }, [sessions])

  return { store, openDocument, saveDocument }
}
