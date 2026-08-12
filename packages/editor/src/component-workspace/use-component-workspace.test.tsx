import { act, renderHook, waitFor } from '@testing-library/react'
import { ComposeAssetError } from '@compose-ui/assets'
import {
  BUILTIN_COMMAND_TYPES,
  createComposeGroupEntitySeed,
  createComposeResolvedComponentSnapshot,
  createDefaultCanvasSettings,
  type ComposeBaseComponentAsset,
} from '@compose-ui/core'
import type {
  ComposeComponentDescriptor,
  ComposeComponentSnapshot,
  ComposeComponentStore,
} from '@compose-ui/component-library'
import { useCallback, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ComposeComponentDocumentSession } from '../workspace-layout'
import { useComponentWorkspace } from './use-component-workspace'

const reference = {
  kind: 'component' as const,
  providerId: 'project',
  assetKey: 'button',
  scope: 'persistent' as const,
}

function baseAsset(): ComposeBaseComponentAsset {
  const root = createComposeGroupEntitySeed({ id: 'root' })
  return {
    schemaVersion: 1,
    kind: 'base',
    componentId: 'button',
    name: 'Button',
    document: {
      schemaVersion: 6,
      canvas: createDefaultCanvasSettings(),
      output: { width: 100, height: 40, backgroundPaint: { kind: 'solid', color: 'transparent' } },
      rootIds: ['root'],
      entities: { root },
    },
  }
}

const descriptor: ComposeComponentDescriptor = {
  entryId: 'button-file',
  assetKey: 'button',
  displayName: 'Button',
  componentId: 'button',
  kind: 'base',
  revision: '1',
  reference,
}

function componentStore(conflict = false): ComposeComponentStore {
  let current: ComposeComponentSnapshot = {
    asset: baseAsset(),
    revision: '1',
    entryId: 'button-file',
    assetKey: 'button',
  }
  return {
    providerId: 'project',
    createReference: () => reference,
    listComponents: async () => ({ components: [descriptor], issues: [] }),
    readComponent: async () => structuredClone(current),
    createComponent: async () => { throw new Error('unused') },
    saveComponent: vi.fn(async (_assetKey, asset, _revision, force) => {
      if (conflict && !force) throw new ComposeAssetError('conflict', 'revision changed')
      current = { ...current, asset: structuredClone(asset), revision: '2' }
      return structuredClone(current)
    }),
    resolveComponent: async () => ({
      status: 'resolved',
      snapshot: createComposeResolvedComponentSnapshot(current.asset, reference, current.revision),
    }),
    invalidate: () => undefined,
    subscribe: () => () => undefined,
    dispose: () => undefined,
  }
}

function useHarness(store: ComposeComponentStore, onActiveSessionChange = vi.fn()) {
  const [sessions, setSessions] = useState<ReadonlyMap<string, ComposeComponentDocumentSession>>(
    () => new Map(),
  )
  const [activePanelId, setActivePanelId] = useState<string | null>(null)
  const updateSession = useCallback((
    panelId: string,
    update: (session: ComposeComponentDocumentSession) => ComposeComponentDocumentSession,
  ) => {
    setSessions((current) => {
      const session = current.get(panelId)
      if (!session) return current
      const next = new Map(current)
      next.set(panelId, update(session))
      return next
    })
  }, [])
  const workspace = useComponentWorkspace({
    activePanelId,
    config: { store, onActiveSessionChange },
    sessions,
    updateSession,
  })
  const open = useCallback(async () => {
    const result = await workspace.openComponent(descriptor)
    if (!result.ok) return result
    const panelId = 'component:button'
    const session = { ...result.session, panelId }
    setSessions(new Map([[panelId, session]]))
    setActivePanelId(panelId)
    return { ...result, session }
  }, [workspace])
  return { sessions, workspace, open }
}

describe('useComponentWorkspace', () => {
  it('OpenSpec: editor-workspace-layout / 组件独立标签 / 维护独立 Runtime、dirty 与保存基线', async () => {
    const store = componentStore()
    const onActiveSessionChange = vi.fn()
    const hook = renderHook(() => useHarness(store, onActiveSessionChange))
    await act(async () => { await hook.result.current.open() })
    const panelId = 'component:button'
    const session = hook.result.current.sessions.get(panelId)!
    expect(session.runtime.document).toEqual(baseAsset().document)
    await waitFor(() => expect(onActiveSessionChange).toHaveBeenLastCalledWith(expect.objectContaining({
      assetKey: 'button',
      kind: 'base',
      runtime: session.runtime,
    })))

    act(() => {
      session.runtime.dispatch({
        id: 'rename-root',
        type: BUILTIN_COMMAND_TYPES.renameEntity,
        payload: { entityId: 'root', name: 'Renamed group' },
      })
    })
    await waitFor(() => expect(hook.result.current.sessions.get(panelId)?.dirty).toBe(true))
    await act(async () => {
      expect(await hook.result.current.workspace.saveComponent(panelId)).toBe('saved')
    })
    expect(hook.result.current.sessions.get(panelId)).toMatchObject({
      baseRevision: '2',
      dirty: false,
    })
  })

  it('OpenSpec: editor-workspace-layout / 组件 revision 冲突 / 普通保存请求显式覆盖确认', async () => {
    const hook = renderHook(() => useHarness(componentStore(true)))
    await act(async () => { await hook.result.current.open() })
    await act(async () => {
      expect(await hook.result.current.workspace.saveComponent('component:button')).toBe('conflict')
    })
    await act(async () => {
      expect(await hook.result.current.workspace.saveComponent('component:button', true)).toBe('saved')
    })
  })
})
