import { ComposeAssetError } from '@compose-ui/assets'
import {
  diffComposeComponentDocuments,
  createTransactionRuntime,
  type ComposeResolvedComponentSnapshot,
  type ComposeVariantComponentAsset,
} from '@compose-ui/core'
import type {
  ComposeComponentDescriptor,
  ComposeComponentStore,
} from '@compose-ui/component-library'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { ComposeComponentDocumentSession } from '../workspace-layout'
import type {
  ComposeEditorActiveComponentSession,
  ComposeEditorComponentsConfig,
} from './component-workspace-types'

/** 组件工作区打开结果。 @internal */
export type OpenComponentResult =
  | { readonly ok: true; readonly session: ComposeComponentDocumentSession }
  | { readonly ok: false; readonly error: Error }

/** 管理 Base/Variant 独立运行时、保存基线和活动会话。 @internal */
export function useComponentWorkspace(input: {
  readonly activePanelId: string | null
  readonly config?: ComposeEditorComponentsConfig
  readonly fallbackStore?: ComposeComponentStore
  readonly sessions: ReadonlyMap<string, ComposeComponentDocumentSession>
  readonly updateSession: (
    panelId: string,
    update: (current: ComposeComponentDocumentSession) => ComposeComponentDocumentSession,
  ) => void
}) {
  const {
    activePanelId,
    config,
    fallbackStore,
    sessions,
    updateSession,
  } = input
  const store = config?.store ?? fallbackStore
  const sessionsRef = useRef(sessions)
  useEffect(() => { sessionsRef.current = sessions }, [sessions])

  const openComponent = useCallback(async (
    descriptor: ComposeComponentDescriptor,
  ): Promise<OpenComponentResult> => {
    if (!store) return { ok: false, error: new Error('Component Store 不可用') }
    const existing = [...sessionsRef.current.values()].find((session) => (
      session.assetKey === descriptor.assetKey
    ))
    if (existing) return { ok: true, session: existing }
    try {
      const source = await store.readComponent(descriptor.assetKey)
      const resolved = await store.resolveComponent(descriptor.reference)
      if (resolved.status === 'invalid') {
        throw new Error(resolved.issues.map(({ message }) => message).join('；'))
      }
      const runtime = createTransactionRuntime({
        document: resolved.snapshot.document,
        initialLabel: descriptor.displayName,
      })
      return {
        ok: true,
        session: {
          kind: 'component',
          panelId: '',
          assetKey: descriptor.assetKey,
          displayName: descriptor.displayName,
          sourceKind: source.asset.kind,
          asset: source.asset,
          snapshot: resolved.snapshot,
          baseRevision: source.revision,
          runtime,
          savedRevisionId: runtime.revision,
          dirty: false,
          save: null,
        },
      }
    }
    catch (error) {
      return { ok: false, error: error instanceof Error ? error : new Error(String(error)) }
    }
  }, [store])

  const saveComponent = useCallback(async (
    panelId: string,
    force?: boolean,
  ): Promise<'saved' | 'conflict' | 'failed'> => {
    const session = sessionsRef.current.get(panelId)
    if (!store || !session) return 'failed'
    const runtimeRevision = session.runtime.revision
    try {
      let next = session.asset
      let snapshot: ComposeResolvedComponentSnapshot
      if (session.asset.kind === 'base') {
        next = { ...session.asset, document: session.runtime.document }
        snapshot = {
          ...session.snapshot,
          revision: session.baseRevision,
          document: session.runtime.document,
          properties: structuredClone(next.properties),
        }
      }
      else {
        const parentResult = await store.resolveComponent(session.asset.parentRef)
        if (parentResult.status === 'invalid') {
          throw new Error(parentResult.issues.map(({ message }) => message).join('；'))
        }
        const diff = diffComposeComponentDocuments({
          parent: parentResult.snapshot.document,
          current: session.runtime.document,
        })
        if (!diff.ok) throw new Error(diff.issues.map(({ message }) => message).join('；'))
        snapshot = {
          componentId: session.asset.componentId,
          kind: 'variant',
          revision: session.baseRevision,
          document: session.runtime.document,
          properties: parentResult.snapshot.properties,
          appliedLineage: [
            ...parentResult.snapshot.appliedLineage,
            {
              reference: store.createReference(session.assetKey),
              componentId: session.asset.componentId,
              kind: 'variant',
              revision: session.baseRevision,
            },
          ],
        }
        next = {
          ...session.asset,
          appliedLineage: parentResult.snapshot.appliedLineage,
          overrides: diff.operations,
          resolvedSnapshot: snapshot,
        } satisfies ComposeVariantComponentAsset
      }
      const written = await store.saveComponent(
        session.assetKey,
        next,
        session.baseRevision,
        force,
      )
      updateSession(panelId, (current) => ({
        ...current,
        asset: written.asset,
        snapshot: { ...snapshot, revision: written.revision },
        baseRevision: written.revision,
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

  useEffect(() => {
    const unsubscribes = [...sessions.values()].map((session) => session.runtime.subscribe(() => {
      const current = sessionsRef.current.get(session.panelId)
      if (!current) return
      const dirty = current.runtime.revision !== current.savedRevisionId
      if (dirty !== current.dirty) {
        updateSession(session.panelId, (value) => ({ ...value, dirty }))
      }
    }))
    return () => { unsubscribes.forEach((unsubscribe) => { unsubscribe() }) }
  }, [sessions, updateSession])

  const activeSession = activePanelId
    ? sessions.get(activePanelId)
    : undefined
  const active = useMemo<ComposeEditorActiveComponentSession | null>(() => activeSession
    ? {
        assetKey: activeSession.assetKey,
        displayName: activeSession.displayName,
        kind: activeSession.sourceKind,
        runtime: activeSession.runtime,
        snapshot: activeSession.snapshot,
      }
    : null, [activeSession])
  const onActiveSessionChange = config?.onActiveSessionChange
  useEffect(() => { onActiveSessionChange?.(active) }, [active, onActiveSessionChange])

  return useMemo(
    () => ({ store, openComponent, saveComponent }),
    [openComponent, saveComponent, store],
  )
}
