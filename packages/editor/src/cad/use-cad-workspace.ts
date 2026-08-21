import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { ComposeAssetProvider } from '@compose-ui/assets'
import {
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
  useEffect(() => () => { store?.dispose() }, [store])

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
