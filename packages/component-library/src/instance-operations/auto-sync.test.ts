import { describe, expect, it } from 'vitest'
import { createComposeResolvedComponentSnapshot } from '@compose-ui/core'
import type { ComposeBaseComponentAsset, ComposeDocument, ComposeEntity, JsonObject } from '@compose-ui/core'
import { planComposeInstanceAutoSync } from './auto-sync'

const reference = {
  kind: 'component' as const,
  providerId: 'project',
  assetKey: 'card',
  scope: 'persistent' as const,
}

function componentDocument(rootWidth: number): ComposeDocument {
  return {
    schemaVersion: 6,
    canvas: {
      grid: { stepX: 8, stepY: 8, offsetX: 0, offsetY: 0, primaryLineEvery: 5, snapEnabled: true },
      smartSnap: { nodes: true, guides: true },
      guides: [],
    },
    output: { width: rootWidth, height: 40, backgroundPaint: { kind: 'solid', color: 'transparent' } },
    rootIds: ['root'],
    entities: {
      root: {
        id: 'root',
        name: 'Root',
        components: {
          Composition: {
            presetId: 'container',
            baseComponentKeys: ['Transform', 'LayoutItem', 'Visibility', 'Lock', 'Hierarchy'],
            capabilityIds: [],
          },
          Transform: { rotation: 0 },
          LayoutItem: {
            positioning: 'absolute',
            offset: { x: 0, y: 0 },
            width: { mode: 'fixed', value: rootWidth, min: 1, max: null },
            height: { mode: 'fixed', value: 40, min: 1, max: null },
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            alignSelf: 'auto',
          },
          Visibility: { visible: true },
          Lock: { locked: false },
          Hierarchy: { childIds: [] },
        },
      },
    },
  } as unknown as ComposeDocument
}

function asset(rootWidth: number): ComposeBaseComponentAsset {
  return {
    schemaVersion: 1,
    kind: 'base',
    componentId: 'card',
    name: 'Card',
    document: componentDocument(rootWidth),
  }
}

function instance(operations: readonly unknown[]): ComposeEntity {
  return {
    id: 'instance',
    name: 'Card',
    components: {
      Renderer: {
        type: 'component-instance',
        props: {
          reference,
          resolvedSnapshot: createComposeResolvedComponentSnapshot(asset(100), reference, '1'),
          instanceOverrides: { operations },
        } as unknown as JsonObject,
      },
    },
  }
}

function hostDocument(entity: ComposeEntity): ComposeDocument {
  return {
    schemaVersion: 6,
    canvas: componentDocument(100).canvas,
    output: componentDocument(100).output,
    rootIds: ['instance'],
    entities: { instance: entity },
  } as unknown as ComposeDocument
}

describe('组件源保存后的实例自动同步', () => {
  it('全部覆盖仍兼容时给出可直接提交的同步计划', () => {
    const entity = instance([{
      id: 'op-1',
      kind: 'set-field',
      entityId: 'root',
      componentKey: 'Visibility',
      fieldPath: ['visible'],
      value: false,
    }])
    const plan = planComposeInstanceAutoSync({
      document: hostDocument(entity),
      reference,
      snapshot: createComposeResolvedComponentSnapshot(asset(200), reference, '2'),
    })

    expect(plan.synced).toHaveLength(1)
    expect(plan.synced[0]?.entityId).toBe('instance')
    expect(plan.synced[0]?.overrides.operations).toHaveLength(1)
    expect(plan.pending).toHaveLength(0)
  })

  it('存在失效覆盖时不自动提交而是列为待确认', () => {
    const entity = instance([{ id: 'op-1', kind: 'remove-entity', entityId: 'gone' }])
    const plan = planComposeInstanceAutoSync({
      document: hostDocument(entity),
      reference,
      snapshot: createComposeResolvedComponentSnapshot(asset(200), reference, '2'),
    })

    expect(plan.synced).toHaveLength(0)
    expect(plan.pending).toHaveLength(1)
    expect(plan.pending[0]?.conflictOperationIds).toEqual(['op-1'])
  })

  it('写回源后与最新快照无差异的覆盖被丢弃，不再算本层覆盖', () => {
    // 源已是 visible:false；实例上仍挂着同一 set-field，应视为已吸收。
    const base = asset(100)
    const root = base.document.entities.root!
    const sourceDoc: ComposeDocument = {
      ...base.document,
      entities: {
        root: {
          ...root,
          components: {
            ...root.components,
            Visibility: { visible: false },
          },
        },
      },
    }
    const entity = instance([{
      id: 'op-1',
      kind: 'set-field',
      entityId: 'root',
      componentKey: 'Visibility',
      fieldPath: ['visible'],
      value: false,
    }])
    const plan = planComposeInstanceAutoSync({
      document: hostDocument(entity),
      reference,
      snapshot: {
        ...createComposeResolvedComponentSnapshot(base, reference, '2'),
        document: sourceDoc,
        revision: '2',
      },
    })

    expect(plan.synced).toHaveLength(1)
    expect(plan.synced[0]?.overrides.operations).toHaveLength(0)
    expect(plan.pending).toHaveLength(0)
  })

  it('忽略引用其他组件的实例', () => {
    const entity = instance([])
    const plan = planComposeInstanceAutoSync({
      document: hostDocument(entity),
      reference: { ...reference, assetKey: 'other' },
      snapshot: createComposeResolvedComponentSnapshot(asset(200), { ...reference, assetKey: 'other' }, '2'),
    })
    expect(plan.synced).toHaveLength(0)
    expect(plan.pending).toHaveLength(0)
  })
})
