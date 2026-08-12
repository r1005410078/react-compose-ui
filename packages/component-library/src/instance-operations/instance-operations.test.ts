import {
  createComposeResolvedComponentSnapshot,
  type ComposeBaseComponentAsset,
  type ComposeEntity,
  type JsonObject,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import type { ComposeComponentSnapshot, ComposeComponentStore } from '../component-store'
import {
  applyComposeInstancePropertyOverrides,
  createComposeVariantAssetFromInstance,
} from './instance-operations'

const reference = {
  kind: 'component' as const,
  providerId: 'project',
  assetKey: 'button',
  scope: 'persistent' as const,
}

function base(): ComposeBaseComponentAsset {
  return {
    schemaVersion: 1,
    kind: 'base',
    componentId: 'button',
    name: 'Button',
    properties: [{
      id: 'label',
      name: 'Label',
      valueType: 'string',
      target: { entityId: 'text', componentKey: 'Renderer', fieldPath: ['props', 'text'] },
    }],
    document: {
      schemaVersion: 6,
      canvas: {
        grid: { stepX: 8, stepY: 8, offsetX: 0, offsetY: 0, primaryLineEvery: 5, snapEnabled: true },
        smartSnap: { nodes: true, guides: true },
        guides: [],
      },
      output: { width: 100, height: 40, backgroundPaint: { kind: 'solid', color: 'transparent' } },
      rootIds: ['root'],
      entities: {
        root: {
          id: 'root', name: 'Group', components: {
            Composition: { presetId: 'group', baseComponentKeys: ['Transform', 'LayoutItem', 'GeometryConstraints', 'Visibility', 'Lock', 'Hierarchy'], capabilityIds: [] },
            Transform: { rotation: 0 },
            LayoutItem: { positioning: 'absolute', offset: { x: 0, y: 0 }, width: { mode: 'fixed', value: 100, min: 0, max: null }, height: { mode: 'fixed', value: 40, min: 0, max: null }, margin: { top: 0, right: 0, bottom: 0, left: 0 }, alignSelf: 'auto' },
            GeometryConstraints: { movable: true, resize: 'none', rotatable: false },
            Visibility: { visible: true }, Lock: { locked: false }, Hierarchy: { childIds: ['text'] },
          },
        },
        text: {
          id: 'text', name: 'Text', components: {
            Composition: { presetId: 'text', baseComponentKeys: ['Transform', 'LayoutItem', 'Visibility', 'Lock', 'Renderer'], capabilityIds: [] },
            Transform: { rotation: 0 },
            LayoutItem: { positioning: 'absolute', offset: { x: 0, y: 0 }, width: { mode: 'fixed', value: 80, min: 0, max: null }, height: { mode: 'fixed', value: 20, min: 0, max: null }, margin: { top: 0, right: 0, bottom: 0, left: 0 }, alignSelf: 'auto' },
            Visibility: { visible: true }, Lock: { locked: false }, Renderer: { type: 'text', props: { text: 'Base' } },
          },
        },
      },
    },
  }
}

function instance(asset: ComposeBaseComponentAsset): ComposeEntity {
  return {
    id: 'instance',
    name: 'Button',
    components: {
      Renderer: {
        type: 'component-instance',
        props: {
          reference,
          resolvedSnapshot: createComposeResolvedComponentSnapshot(asset, reference, '1'),
          propertyOverrides: { label: 'Danger' },
        } as unknown as JsonObject,
      },
    },
  }
}

function store(asset: ComposeBaseComponentAsset) {
  let current: ComposeComponentSnapshot = { asset, assetKey: 'button', entryId: 'button', revision: '1' }
  const api: ComposeComponentStore = {
    providerId: 'project',
    createReference: (assetKey) => ({ ...reference, assetKey }),
    listComponents: async () => ({ components: [], issues: [] }),
    readComponent: async () => structuredClone(current),
    createComponent: async () => { throw new Error('unused') },
    saveComponent: async (_key, next) => {
      current = { ...current, asset: structuredClone(next), revision: '2' }
      return structuredClone(current)
    },
    resolveComponent: async () => ({
      status: 'resolved',
      snapshot: createComposeResolvedComponentSnapshot(current.asset, reference, current.revision),
    }),
    invalidate: () => undefined,
    subscribe: () => () => undefined,
    dispose: () => undefined,
  }
  return { api, get: () => current }
}

describe('component instance operations', () => {
  it('OpenSpec: editor-workspace-layout / 从实例创建 Variant / 只转换公开属性覆盖', () => {
    const source = base()
    const variant = createComposeVariantAssetFromInstance({
      entity: instance(source),
      componentId: 'danger',
      name: 'Danger',
    })
    expect(variant.parentRef).toEqual(reference)
    expect(variant.overrides).toEqual([expect.objectContaining({
      kind: 'set-field', entityId: 'text', value: 'Danger',
    })])
  })

  it('OpenSpec: editor-workspace-layout / Apply 和 Revert 覆盖 / 实例只能 Apply 公开属性', async () => {
    const source = base()
    const fixture = store(source)
    const result = await applyComposeInstancePropertyOverrides({
      store: fixture.api,
      entity: instance(source),
    })
    expect(result.remainingPropertyOverrides).toEqual({})
    const saved = fixture.get().asset
    expect(saved.kind === 'base'
      ? saved.document.entities.text?.components.Renderer
      : null).toMatchObject({ props: { text: 'Danger' } })
  })
})
