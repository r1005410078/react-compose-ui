import { describe, expect, it } from 'vitest'
import type { ComposeDocument, JsonValue } from './document-types'
import { createComposeGroupEntitySeed } from './group'
import * as coreApi from './index'

interface ComponentAssetApi {
  readonly parseComposeComponentAsset?: (text: string) => {
    readonly ok: boolean
    readonly asset?: Record<string, unknown>
    readonly issues?: readonly { readonly code: string }[]
  }
  readonly migrateLegacyComposeComponentAsset?: (value: unknown) => {
    readonly ok: boolean
    readonly asset?: Record<string, unknown>
  }
  readonly applyComposeComponentOverrides?: (
    document: ComposeDocument,
    operations: readonly Record<string, unknown>[],
  ) => { readonly ok: boolean; readonly document?: ComposeDocument }
  readonly resolveComposeComponentAsset?: (input: Record<string, unknown>) => Promise<{
    readonly status: string
    readonly snapshot?: { readonly document: ComposeDocument }
    readonly issues?: readonly { readonly code: string }[]
  }>
  readonly diffComposeComponentDocuments?: (input: {
    readonly parent: ComposeDocument
    readonly current: ComposeDocument
  }) => {
    readonly ok: boolean
    readonly operations?: readonly Record<string, unknown>[]
  }
  readonly planComposeComponentRevert?: (input: Record<string, unknown>) => {
    readonly requiresConfirmation: boolean
    readonly dependentOperationIds: readonly string[]
    readonly overrides: readonly Record<string, unknown>[]
  }
}

const componentApi = coreApi as unknown as ComponentAssetApi

function componentDocument(): ComposeDocument {
  const child = {
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
        offset: { x: 10, y: 20 },
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
  const group = createComposeGroupEntitySeed({
    id: 'root',
    childIds: ['text'],
    size: { width: 120, height: 60 },
  })
  return {
    schemaVersion: 6,
    canvas: {
      grid: { stepX: 8, stepY: 8, offsetX: 0, offsetY: 0, primaryLineEvery: 5, snapEnabled: true },
      smartSnap: { nodes: true, guides: true },
      guides: [],
    },
    output: { width: 120, height: 60, backgroundPaint: { kind: 'solid', color: 'transparent' } },
    rootIds: ['root'],
    entities: { root: group, text: child },
  }
}

function baseAsset() {
  return {
    schemaVersion: 1,
    kind: 'base',
    componentId: 'button',
    name: 'Button',
    document: componentDocument(),
  }
}

describe('Component Asset v1', () => {
  it('OpenSpec: component-library / Component Asset v1 判别协议 / 解析 Base 与 Variant', () => {
    expect(componentApi.parseComposeComponentAsset).toBeTypeOf('function')
    expect(componentApi.parseComposeComponentAsset!(JSON.stringify(baseAsset()))).toMatchObject({
      ok: true,
      asset: { kind: 'base', componentId: 'button' },
    })
  })

  it('OpenSpec: component-library / Component Asset v1 判别协议 / 拒绝旧草案并显式迁移', () => {
    const legacy = { ...baseAsset() } as Partial<ReturnType<typeof baseAsset>>
    delete legacy.kind
    expect(componentApi.parseComposeComponentAsset!(JSON.stringify(legacy))).toMatchObject({
      ok: false,
      issues: [{ code: 'component-asset.legacy' }],
    })
    expect(componentApi.migrateLegacyComposeComponentAsset!(legacy)).toMatchObject({
      ok: true,
      asset: { kind: 'base' },
    })
  })

  it('OpenSpec: component-library / 稳定 Variant 操作 / 应用结构和字段覆盖', () => {
    expect(componentApi.applyComposeComponentOverrides).toBeTypeOf('function')
    const result = componentApi.applyComposeComponentOverrides!(componentDocument(), [{
      id: 'set-label',
      kind: 'set-field',
      entityId: 'text',
      componentKey: 'Renderer',
      fieldPath: ['props', 'text'],
      value: 'Variant' as JsonValue,
    }])
    expect(result).toMatchObject({ ok: true })
    expect(result.document?.entities.text?.components.Renderer).toMatchObject({
      props: { text: 'Variant' },
    })
  })

  it('OpenSpec: component-library / 组件继承解析 / 解析多层 Variant', async () => {
    expect(componentApi.resolveComposeComponentAsset).toBeTypeOf('function')
    const base = baseAsset()
    const variant = {
      schemaVersion: 1,
      kind: 'variant',
      componentId: 'button-danger',
      name: 'Button Danger',
      parentRef: { kind: 'component', providerId: 'project', assetKey: 'button', scope: 'persistent' },
      appliedLineage: [{
        reference: { kind: 'component', providerId: 'project', assetKey: 'button', scope: 'persistent' },
        componentId: 'button',
        kind: 'base',
        revision: '1',
      }],
      overrides: [{
        id: 'set-label',
        kind: 'set-field',
        entityId: 'text',
        componentKey: 'Renderer',
        fieldPath: ['props', 'text'],
        value: 'Danger',
      }],
      resolvedSnapshot: {
        componentId: 'button-danger',
        kind: 'variant',
        revision: '1',
        document: componentDocument(),
        appliedLineage: [],
      },
    }
    const result = await componentApi.resolveComposeComponentAsset!({
      asset: variant,
      reference: { kind: 'component', providerId: 'project', assetKey: 'danger', scope: 'persistent' },
      revision: '1',
      load: async () => ({ asset: base, revision: '1' }),
    })
    expect(result.status).toBe('resolved')
    expect(result.snapshot?.document.entities.text?.components.Renderer).toMatchObject({
      props: { text: 'Danger' },
    })
  })

  it('OpenSpec: component-library / 组件继承解析 / 拒绝循环和超过八层的继承', async () => {
    const reference = (assetKey: string) => ({
      kind: 'component' as const,
      providerId: 'project',
      assetKey,
      scope: 'persistent' as const,
    })
    const variant = (assetKey: string, parentKey: string) => ({
      schemaVersion: 1,
      kind: 'variant',
      componentId: assetKey,
      name: assetKey,
      parentRef: reference(parentKey),
      appliedLineage: [],
      overrides: [],
      resolvedSnapshot: {
        componentId: assetKey,
        kind: 'variant',
        revision: '1',
        document: componentDocument(),
        appliedLineage: [],
      },
    })

    const loop = variant('loop', 'loop')
    const cycleResult = await componentApi.resolveComposeComponentAsset!({
      asset: loop,
      reference: reference('loop'),
      revision: '1',
      load: async () => ({ asset: loop, revision: '1' }),
    })
    expect(cycleResult).toMatchObject({
      status: 'invalid',
      issues: [{ code: 'component-asset.cycle' }],
    })

    const chain = new Map<string, ReturnType<typeof variant>>()
    for (let index = 1; index <= 8; index += 1) {
      chain.set(`v${index}`, variant(`v${index}`, index === 1 ? 'base' : `v${index - 1}`))
    }
    const depthResult = await componentApi.resolveComposeComponentAsset!({
      asset: chain.get('v8')!,
      reference: reference('v8'),
      revision: '1',
      load: async (parentRef: { readonly assetKey: string }) => ({
        asset: parentRef.assetKey === 'base' ? baseAsset() : chain.get(parentRef.assetKey)!,
        revision: '1',
      }),
    })
    expect(depthResult).toMatchObject({
      status: 'invalid',
      issues: [{ code: 'component-asset.depth-exceeded' }],
    })
  })

  it('OpenSpec: component-library / 稳定 Variant 操作 / 按稳定 ID 生成可重放 diff', () => {
    expect(componentApi.diffComposeComponentDocuments).toBeTypeOf('function')
    const parent = componentDocument()
    const added = {
      ...parent.entities.text!,
      id: 'badge',
      name: 'Badge',
      components: {
        ...parent.entities.text!.components,
        Renderer: { type: 'text', props: { text: 'New' } },
      },
    }
    const current: ComposeDocument = {
      ...parent,
      entities: {
        ...parent.entities,
        root: {
          ...parent.entities.root!,
          components: {
            ...parent.entities.root!.components,
            Hierarchy: { childIds: ['badge', 'text'] },
          },
        },
        text: {
          ...parent.entities.text!,
          components: {
            ...parent.entities.text!.components,
            Renderer: { type: 'text', props: { text: 'Variant', tokens: ['a', 'b'] } },
          },
        },
        badge: added,
      },
    }
    const diff = componentApi.diffComposeComponentDocuments!({ parent, current })
    expect(diff.ok).toBe(true)
    expect(diff.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'add-entity', rootEntityId: 'badge' }),
      expect.objectContaining({
        kind: 'set-field',
        entityId: 'text',
        fieldPath: ['props', 'text'],
        value: 'Variant',
      }),
      expect.objectContaining({
        kind: 'set-field',
        entityId: 'text',
        fieldPath: ['props', 'tokens'],
        value: ['a', 'b'],
      }),
    ]))
    expect(diff.operations?.some((operation) => (
      Array.isArray(operation.fieldPath)
      && operation.fieldPath.some((item) => typeof item === 'number')
    ))).toBe(false)
    const replayed = componentApi.applyComposeComponentOverrides!(parent, diff.operations ?? [])
    expect(replayed.document).toEqual(current)
  })

  it('OpenSpec: component-library / Revert 当前层 / 新增子树依赖需要确认', () => {
    expect(componentApi.planComposeComponentRevert).toBeTypeOf('function')
    const overrides = [
      {
        id: 'add-badge',
        kind: 'add-entity',
        rootEntityId: 'badge',
        entities: { badge: componentDocument().entities.text },
        parentId: 'root',
        beforeEntityId: null,
      },
      {
        id: 'edit-badge',
        kind: 'set-field',
        entityId: 'badge',
        componentKey: 'Renderer',
        fieldPath: ['props', 'text'],
        value: 'Changed',
      },
    ]
    const preview = componentApi.planComposeComponentRevert!({
      overrides,
      operationIds: ['add-badge'],
    })
    expect(preview).toMatchObject({
      requiresConfirmation: true,
      dependentOperationIds: ['edit-badge'],
      overrides,
    })
    expect(componentApi.planComposeComponentRevert!({
      overrides,
      operationIds: ['add-badge'],
      confirmDependencies: true,
    })).toMatchObject({ requiresConfirmation: false, overrides: [] })
  })
})
