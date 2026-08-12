import {
  applyComposeComponentOverrides,
  createComposeGroupEntitySeed,
  createComposeResolvedComponentSnapshot,
  resolveComposeComponentAsset,
  type ComposeBaseComponentAsset,
  type ComposeComponentAssetV1,
  type ComposeComponentReference,
  type ComposeVariantComponentAsset,
} from '@compose-ui/core'
import { describe, expect, it, vi } from 'vitest'
import type { ComposeComponentSnapshot, ComposeComponentStore } from '../component-store'
import {
  applyComposeVariantOverrides,
  revertComposeVariantOverrides,
  updateComposeVariantFromParent,
} from './variant-operations'

const baseRef: ComposeComponentReference = {
  kind: 'component', providerId: 'project', assetKey: 'base', scope: 'persistent',
}
const variantRef: ComposeComponentReference = {
  kind: 'component', providerId: 'project', assetKey: 'variant', scope: 'persistent',
}

function baseAsset(withText = true): ComposeBaseComponentAsset {
  const root = createComposeGroupEntitySeed({
    id: 'root',
    childIds: withText ? ['text'] : [],
    size: { width: 120, height: 60 },
  })
  const text = {
    id: 'text',
    name: 'Text',
    components: {
      Composition: {
        presetId: 'text',
        baseComponentKeys: ['Transform', 'LayoutItem', 'Visibility', 'Lock', 'Renderer'],
        capabilityIds: [],
      },
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: 0, y: 0 },
        width: { mode: 'fixed', value: 100, min: 1, max: null },
        height: { mode: 'fixed', value: 30, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      Renderer: { type: 'text', props: { text: 'Base' } },
    },
  }
  return {
    schemaVersion: 1,
    kind: 'base',
    componentId: 'base',
    name: 'Base',
    document: {
      schemaVersion: 6,
      canvas: {
        grid: { stepX: 8, stepY: 8, offsetX: 0, offsetY: 0, primaryLineEvery: 5, snapEnabled: true },
        smartSnap: { nodes: true, guides: true },
        guides: [],
      },
      output: { width: 120, height: 60, backgroundPaint: { kind: 'solid', color: 'transparent' } },
      rootIds: ['root'],
      entities: withText ? { root, text } : { root },
    },
  }
}

function variantAsset(parent = baseAsset()): ComposeVariantComponentAsset {
  const operation = {
    id: 'set-label',
    kind: 'set-field' as const,
    entityId: 'text',
    componentKey: 'Renderer',
    fieldPath: ['props', 'text'],
    value: 'Danger' as const,
  }
  const applied = applyComposeComponentOverrides(parent.document, [operation])
  const parentSnapshot = createComposeResolvedComponentSnapshot(parent, baseRef, '1')
  return {
    schemaVersion: 1,
    kind: 'variant',
    componentId: 'variant',
    name: 'Variant',
    parentRef: baseRef,
    appliedLineage: parentSnapshot.appliedLineage,
    overrides: [operation],
    resolvedSnapshot: {
      componentId: 'variant',
      kind: 'variant',
      revision: '1',
      document: applied.ok ? applied.document : parent.document,
      appliedLineage: parentSnapshot.appliedLineage,
    },
  }
}

function store(options: { readonly failVariantWrite?: boolean; readonly parent?: ComposeBaseComponentAsset } = {}) {
  const assets = new Map<string, ComposeComponentSnapshot>([
    ['base', { asset: options.parent ?? baseAsset(), revision: '1', entryId: 'base', assetKey: 'base' }],
    ['variant', { asset: variantAsset(), revision: '1', entryId: 'variant', assetKey: 'variant' }],
  ])
  const writes: string[] = []
  const api: ComposeComponentStore = {
    providerId: 'project',
    createReference: (assetKey) => ({ ...baseRef, assetKey }),
    listComponents: async () => ({ components: [], issues: [] }),
    async readComponent(assetKey) {
      const value = assets.get(assetKey)
      if (!value) throw new Error(`missing ${assetKey}`)
      return structuredClone(value)
    },
    createComponent: async () => { throw new Error('unused') },
    async saveComponent(assetKey, asset, expectedRevision) {
      writes.push(assetKey)
      if (assetKey === 'variant' && options.failVariantWrite) throw new Error('variant conflict')
      const current = assets.get(assetKey)
      if (!current || current.revision !== expectedRevision) throw new Error('revision conflict')
      const next = { ...current, asset: structuredClone(asset), revision: String(Number(current.revision) + 1) }
      assets.set(assetKey, next)
      return structuredClone(next)
    },
    async resolveComponent(reference, signal) {
      const current = assets.get(reference.assetKey)
      if (!current) throw new Error('missing')
      return resolveComposeComponentAsset({
        asset: current.asset,
        revision: current.revision,
        reference,
        signal,
        load: async (parentReference) => {
          const parent = assets.get(parentReference.assetKey)
          if (!parent) throw new Error('missing parent')
          return { asset: parent.asset, revision: parent.revision }
        },
      })
    },
    invalidate: () => undefined,
    subscribe: () => () => undefined,
    dispose: () => undefined,
  }
  return { api, assets, writes }
}

function renderedText(asset: ComposeComponentAssetV1) {
  const document = asset.kind === 'base' ? asset.document : asset.resolvedSnapshot.document
  return (document.entities.text?.components.Renderer as { props?: { text?: string } } | undefined)
    ?.props?.text
}

describe('Variant Apply/Revert/update', () => {
  it('OpenSpec: component-library / Apply 到直接父源 / 先写父源再消费当前覆盖', async () => {
    const fixture = store()
    const result = await applyComposeVariantOverrides({
      store: fixture.api,
      assetKey: variantRef.assetKey,
      operationIds: ['set-label'],
    })

    expect(result.status).toBe('applied')
    expect(fixture.writes).toEqual(['base', 'variant'])
    expect(renderedText(fixture.assets.get('base')!.asset)).toBe('Danger')
    expect(fixture.assets.get('variant')!.asset).toMatchObject({ overrides: [] })
  })

  it('父源成功而当前层写入失败时不回滚并报告 partial success', async () => {
    const fixture = store({ failVariantWrite: true })
    const result = await applyComposeVariantOverrides({ store: fixture.api, assetKey: 'variant' })

    expect(result).toMatchObject({ status: 'partial-success', error: { message: 'variant conflict' } })
    expect(renderedText(fixture.assets.get('base')!.asset)).toBe('Danger')
    expect(fixture.assets.get('variant')!.asset).toMatchObject({
      overrides: [{ id: 'set-label' }],
    })
  })

  it('Revert 只保存当前层，新增子树依赖未经确认不写资源', async () => {
    const fixture = store()
    const current = fixture.assets.get('variant')!
    if (current.asset.kind !== 'variant') throw new Error('expected variant')
    const badge = current.asset.resolvedSnapshot.document.entities.text!
    fixture.assets.set('variant', {
      ...current,
      asset: {
        ...current.asset,
        overrides: [
          {
            id: 'add-badge',
            kind: 'add-entity',
            rootEntityId: 'badge',
            entities: { badge: { ...badge, id: 'badge' } },
            parentId: 'root',
            beforeEntityId: null,
          },
          {
            id: 'edit-badge',
            kind: 'set-field',
            entityId: 'badge',
            componentKey: 'Renderer',
            fieldPath: ['props', 'text'],
            value: 'Badge',
          },
        ],
      },
    })
    expect(await revertComposeVariantOverrides({
      store: fixture.api,
      assetKey: 'variant',
      operationIds: ['add-badge'],
    })).toEqual({ status: 'confirmation-required', dependentOperationIds: ['edit-badge'] })
    expect(fixture.writes).toEqual([])
  })

  it('显式更新先列出冲突，确认后一次保存并丢弃对应覆盖', async () => {
    const fixture = store({ parent: baseAsset(false) })
    const writeSpy = vi.spyOn(fixture.api, 'saveComponent')
    const conflict = await updateComposeVariantFromParent({ store: fixture.api, assetKey: 'variant' })
    expect(conflict).toMatchObject({ status: 'conflict', operationIds: ['set-label'] })
    expect(writeSpy).not.toHaveBeenCalled()

    const updated = await updateComposeVariantFromParent({
      store: fixture.api,
      assetKey: 'variant',
      discardConflicts: true,
    })
    expect(updated).toMatchObject({ status: 'updated', discardedOperationIds: ['set-label'] })
    expect(writeSpy).toHaveBeenCalledOnce()
    expect(fixture.assets.get('variant')!.asset).toMatchObject({ overrides: [] })
  })
})
