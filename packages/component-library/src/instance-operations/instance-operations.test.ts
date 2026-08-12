import {
  createComposeResolvedComponentSnapshot,
  type ComposeBaseComponentAsset,
  type ComposeEntity,
  type JsonObject,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import type { ComposeComponentSnapshot, ComposeComponentStore } from '../component-store'
import {
  applyComposeInstanceOverrides,
  createComposeVariantAssetFromInstance,
  readComposeComponentInstance,
  updateComposeComponentInstanceFromSource,
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
          instanceOverrides: {
            operations: [{
              id: 'op-1',
              kind: 'set-field',
              entityId: 'text',
              componentKey: 'Renderer',
              fieldPath: ['props', 'text'],
              value: 'Danger',
            }],
          },
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

  it('OpenSpec: editor-workspace-layout / Apply 和 Revert 覆盖 / 实例结构操作 Apply 到 Base', async () => {
    const source = base()
    const fixture = store(source)
    const result = await applyComposeInstanceOverrides({
      store: fixture.api,
      entity: instance(source),
    })
    expect(result.remainingOverrides.operations).toEqual([])
    const saved = fixture.get().asset
    expect(saved.kind === 'base'
      ? saved.document.entities.text?.components.Renderer
      : null).toMatchObject({ props: { text: 'Danger' } })
  })
})

describe('实例覆盖读取', () => {
  it('读取分区形状的 instanceOverrides', () => {
    const entity: ComposeEntity = {
      id: 'instance',
      name: 'Button',
      components: {
        Renderer: {
          type: 'component-instance',
          props: {
            reference,
            resolvedSnapshot: createComposeResolvedComponentSnapshot(base(), reference, '1'),
            instanceOverrides: {
              operations: [{ id: 'op-1', kind: 'remove-entity', entityId: 'text' }],
            },
          } as unknown as JsonObject,
        },
      },
    }
    const facts = readComposeComponentInstance(entity)
    expect(facts).not.toBeNull()
    expect(facts?.overrides.operations).toHaveLength(1)
    expect(facts?.migratedFromLegacy).toBe(false)
  })

  it('显式迁移旧分区形状并标记来源', () => {
    const entity = instance(base())
    const renderer = entity.components.Renderer as { props: Record<string, unknown> }
    renderer.props.instanceOverrides = {
      properties: { label: 'Danger' },
      operations: [{ id: 'op-1', kind: 'remove-entity', entityId: 'text' }],
    }
    const facts = readComposeComponentInstance(entity)
    // 属性覆盖需要已删除的 Base 定义才能还原字段目标，只能保留结构分区。
    expect(facts?.overrides.operations).toHaveLength(1)
    expect(facts?.migratedFromLegacy).toBe(true)
  })
})

describe('实例结构覆盖 Apply', () => {
  function structuralInstance(asset: ComposeBaseComponentAsset): ComposeEntity {
    return {
      id: 'instance',
      name: 'Button',
      components: {
        Renderer: {
          type: 'component-instance',
          props: {
            reference,
            resolvedSnapshot: createComposeResolvedComponentSnapshot(asset, reference, '1'),
            instanceOverrides: {
              operations: [{ id: 'op-1', kind: 'remove-entity', entityId: 'text' }],
            },
          } as unknown as JsonObject,
        },
      },
    }
  }

  it('结构操作 Apply 到 Base 后落进 Base 文档并从实例消费', async () => {
    // 结构删除与指向被删实体的属性覆盖必然冲突，这里只验证结构 Apply 本身。
    const asset = base()
    const backing = store(asset)
    const result = await applyComposeInstanceOverrides({
      store: backing.api,
      entity: structuralInstance(asset),
    })

    // Base 是文档型父源，结构操作由同一 Applier 落到文档。
    const saved = backing.get().asset as ComposeBaseComponentAsset
    expect(saved.document.entities.text).toBeUndefined()
    expect(result.remainingOverrides.operations).toEqual([])
  })

  it('只 Apply 选中的结构操作，其余保留在实例', async () => {
    const asset = base()
    const backing = store(asset)
    const result = await applyComposeInstanceOverrides({
      store: backing.api,
      entity: structuralInstance(asset),
      // 不选中任何操作，全部留在本层。
      operationIds: [],
    })
    expect(result.remainingOverrides.operations).toHaveLength(1)
  })
})

describe('来源更新时的结构操作冲突', () => {
  it('锚点失效的结构操作被列为冲突而不是留到解析期报错', async () => {
    const asset = base()
    const backing = store(asset)
    const entity: ComposeEntity = {
      id: 'instance',
      name: 'Button',
      components: {
        Renderer: {
          type: 'component-instance',
          props: {
            reference,
            resolvedSnapshot: createComposeResolvedComponentSnapshot(asset, reference, '1'),
            instanceOverrides: {
              // 目标实体在最新来源中已不存在。
              operations: [{ id: 'op-1', kind: 'remove-entity', entityId: 'gone' }],
            },
          } as unknown as JsonObject,
        },
      },
    }

    const result = await updateComposeComponentInstanceFromSource({
      store: backing.api,
      entity,
    })
    expect(result.status).toBe('conflict')
    if (result.status !== 'conflict') return
    expect(result.operationIds).toEqual(['op-1'])
  })

  it('确认丢弃冲突后只保留仍然兼容的操作', async () => {
    const asset = base()
    const backing = store(asset)
    const entity: ComposeEntity = {
      id: 'instance',
      name: 'Button',
      components: {
        Renderer: {
          type: 'component-instance',
          props: {
            reference,
            resolvedSnapshot: createComposeResolvedComponentSnapshot(asset, reference, '1'),
            instanceOverrides: {
              operations: [
                { id: 'op-1', kind: 'remove-entity', entityId: 'gone' },
                { id: 'op-2', kind: 'remove-entity', entityId: 'text' },
              ],
            },
          } as unknown as JsonObject,
        },
      },
    }

    const result = await updateComposeComponentInstanceFromSource({
      store: backing.api,
      entity,
      discardConflicts: true,
    })
    expect(result.status).toBe('updated')
    if (result.status !== 'updated') return
    expect(result.overrides.operations.map(({ id }) => id)).toEqual(['op-2'])
    expect(result.discardedOperationIds).toEqual(['op-1'])
  })
})
