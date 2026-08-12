import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as v from 'valibot'
import {
  createComposeEntityRegistry,
  type ComposeComponentInspectorProps,
} from '@compose-ui/component-registry'
import { ComposePropertyPanel } from '@compose-ui/property-panel'
import type { ComposeComponentStore } from '@compose-ui/component-library'
import {
  BUILTIN_COMMAND_TYPES,
  createDefaultCanvasSettings,
  getComposeLayoutItem,
  createDefaultOutputSettings,
  createTransactionRuntime,
  getComposeHierarchy,
  getComposeLock,
  getComposeSpatialTransform,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutItem,
  type ComposeSpatialTransform,
  type TransactionRuntime,
} from '@compose-ui/core'
import { cloneElement, useEffect, type ReactElement } from 'react'
import { useComposeEditorController } from './controller'

// Controller 契约测试使用确定性 fake；Yoga/WASM 数值与异步加载由 layout-engine 集成测试覆盖。
vi.mock('@compose-ui/layout-engine', () => ({
  createComposeLayoutRuntime: ({ document: initialDocument }: { document: ComposeDocument }) => {
    let revision = 0
    let current = initialDocument
    const listeners = new Set<() => void>()
    const solve = () => ({
      status: 'ready' as const,
      document: current,
      snapshot: {
        revision: ++revision,
        boxes: Object.fromEntries(Object.values(current.entities).map((item) => {
          const layoutItem = item.components.LayoutItem as unknown as ComposeLayoutItem
          return [item.id, {
            x: layoutItem.offset.x,
            y: layoutItem.offset.y,
            width: layoutItem.width.value,
            height: layoutItem.height.value,
            positioning: layoutItem.positioning,
          }]
        })),
        diagnostics: [],
      },
    })
    let state = solve()
    return {
      getState: () => state,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      updateDocument: (document: ComposeDocument) => {
        if (document === current) return
        current = document
        state = solve()
        listeners.forEach((listener) => listener())
      },
      setMeasurementPort: () => undefined,
      dispose: () => listeners.clear(),
    }
  },
}))

function transform(
  x: number,
  y: number,
  width: number,
  height: number,
): ComposeSpatialTransform {
  return {
    position: { x, y },
    size: { width, height },
    rotation: 0,
  }
}

function layoutItem(value: ComposeSpatialTransform): ComposeLayoutItem {
  return {
    positioning: 'absolute',
    offset: value.position,
    width: { mode: 'fixed', value: value.size.width, min: 1, max: null },
    height: { mode: 'fixed', value: value.size.height, min: 1, max: null },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    alignSelf: 'auto',
  }
}

function entity(
  id: string,
  components: ComposeEntity['components'],
  name = id,
  presetId: string | null = null,
): ComposeEntity {
  const spatial = components.Transform && 'position' in components.Transform
    ? components.Transform as unknown as ComposeSpatialTransform
    : transform(0, 0, 100, 100)
  const remaining = Object.fromEntries(
    Object.entries(components).filter(([key]) => key !== 'Transform'),
  )
  const base = {
    Transform: { rotation: spatial.rotation },
    LayoutItem: layoutItem(spatial),
    Visibility: { visible: true },
    Lock: { locked: false },
    ...remaining,
  }
  return {
    id,
    name,
    components: {
      Composition: {
        presetId,
        baseComponentKeys: Object.keys(base),
        capabilityIds: [],
      },
      ...base,
    },
  }
}

function documentFixture(): ComposeDocument {
  return {
    schemaVersion: 6,
    canvas: createDefaultCanvasSettings(),
    output: createDefaultOutputSettings(),
    rootIds: ['dashboard'],
    entities: {
      dashboard: entity('dashboard', {
        Transform: transform(40, 30, 800, 600),
        Hierarchy: { childIds: ['title'] },
        Clip: { enabled: true },
        Appearance: { backgroundPaint: { kind: 'solid', color: '#111827' } },
      }, 'Dashboard', 'container'),
      title: entity('title', {
        Transform: transform(10, 10, 180, 40),
        Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' } },
        Renderer: { type: 'text', props: { text: 'Before' } },
      }, 'Title', 'text'),
    },
  }
}


/**
 * 带一个关联组件实例的文档；实例内部快照是 Group 根加一个文本子项，
 * 用来验证 Scene Tree 的内部层级投影。
 */
function instanceDocumentFixture(): ComposeDocument {
  const innerDocument = {
    schemaVersion: 6 as const,
    canvas: createDefaultCanvasSettings(),
    output: { width: 120, height: 80, backgroundPaint: { kind: 'solid' as const, color: 'transparent' } },
    rootIds: ['c-root'],
    entities: {
      // 组件根是可缩放容器：放宽根约束后这是常态，也让实例继承 Resize 能力。
      'c-root': {
        id: 'c-root',
        name: 'Card Root',
        components: {
          Composition: {
            presetId: 'container',
            baseComponentKeys: ['Transform', 'LayoutItem', 'GeometryConstraints', 'Visibility', 'Lock', 'Hierarchy'],
            capabilityIds: [],
          },
          Transform: { rotation: 0 },
          LayoutItem: layoutItem(transform(0, 0, 120, 80)),
          GeometryConstraints: { movable: true, resize: 'free', rotatable: false },
          Visibility: { visible: true },
          Lock: { locked: false },
          Hierarchy: { childIds: ['c-text'] },
        },
      },
      'c-text': {
        id: 'c-text',
        name: 'Inner Text',
        components: {
          Composition: {
            presetId: 'container',
            baseComponentKeys: ['Transform', 'LayoutItem', 'Visibility', 'Lock', 'Hierarchy'],
            capabilityIds: [],
          },
          Transform: { rotation: 0 },
          LayoutItem: layoutItem(transform(0, 0, 80, 20)),
          Visibility: { visible: true },
          Lock: { locked: false },
          Hierarchy: { childIds: ['c-deep'] },
        },
      },
      'c-deep': {
        id: 'c-deep',
        name: 'Deep Text',
        components: {
          Composition: {
            presetId: 'text',
            baseComponentKeys: ['Transform', 'LayoutItem', 'Visibility', 'Lock', 'Renderer'],
            capabilityIds: [],
          },
          Transform: { rotation: 0 },
          LayoutItem: layoutItem(transform(0, 0, 40, 10)),
          Visibility: { visible: true },
          Lock: { locked: false },
          Renderer: { type: 'text', props: { text: 'Deep' } },
        },
      },
    },
  } as unknown as ComposeDocument
  const reference = {
    kind: 'component' as const,
    providerId: 'project',
    assetKey: 'card',
    scope: 'persistent' as const,
  }
  return {
    schemaVersion: 6,
    canvas: createDefaultCanvasSettings(),
    output: createDefaultOutputSettings(),
    rootIds: ['instance'],
    entities: {
      instance: {
        id: 'instance',
        name: 'Card',
        components: {
          Composition: {
            presetId: 'component-instance',
            baseComponentKeys: ['Transform', 'LayoutItem', 'Visibility', 'Lock', 'Renderer'],
            capabilityIds: [],
          },
          Transform: { rotation: 0 },
          LayoutItem: layoutItem(transform(0, 0, 120, 80)),
          Visibility: { visible: true },
          Lock: { locked: false },
          GeometryConstraints: { movable: true, resize: 'none', rotatable: true },
          Renderer: {
            type: 'component-instance',
            props: {
              reference,
              resolvedSnapshot: {
                componentId: 'card',
                kind: 'base',
                revision: '1',
                document: innerDocument,
                properties: [],
                appliedLineage: [{ reference, componentId: 'card', kind: 'base', revision: '1' }],
              },
              instanceOverrides: { properties: {}, operations: [] },
            },
          },
        },
      } as unknown as ComposeDocument['entities'][string],
    },
  }
}

// 编辑器测试只验证聚合契约：分组来自 Registry 定义顺序、readOnly 与 dispatch 正确
// 透传；内建 Inspector 的真实行为由 @compose-ui/materials 的测试覆盖。
let testCommandIndex = 0

const testTransformSchema = v.object({
  position: v.pipe(
    v.object({ x: v.number(), y: v.number() }),
    v.title('位置'),
    v.metadata({ propertyPanel: { editor: 'vector2' } }),
  ),
})

// Inspector 子树的真实渲染次数探针：只有 Inspector 真的重渲时才会增加。
// 在 effect 里累加，避免渲染期产生副作用。
const renderProbe = { inspector: 0 }

function TestTransformInspector({ value }: ComposeComponentInspectorProps) {
  useEffect(() => {
    renderProbe.inspector += 1
  })
  return (
    <ComposePropertyPanel
      aria-label="变换属性"
      schema={testTransformSchema}
      value={{ position: (value as ComposeLayoutItem).offset }}
    />
  )
}

const testVisibilitySchema = v.object({
  visible: v.pipe(v.boolean(), v.title('可见')),
})

function TestVisibilityInspector({ value, readOnly }: ComposeComponentInspectorProps) {
  return (
    <ComposePropertyPanel
      aria-label="状态属性"
      readOnly={readOnly}
      schema={testVisibilitySchema}
      value={{ visible: value.visible === true }}
    />
  )
}

const testLockSchema = v.object({
  locked: v.pipe(v.boolean(), v.title('锁定')),
})

// 镜像内建 Lock Inspector 的契约：即使聚合层传入 readOnly，锁定仍必须可解除。
function TestLockInspector({ entity, dispatch, value }: ComposeComponentInspectorProps) {
  return (
    <ComposePropertyPanel
      aria-label="锁定属性"
      schema={testLockSchema}
      value={{ locked: value.locked === true }}
      onValueChange={(next) => dispatch({
        id: `test-lock-${testCommandIndex++}`,
        type: BUILTIN_COMMAND_TYPES.setLock,
        payload: { entityIds: [entity.id], locked: next.locked },
        meta: { source: 'inspector', targetIds: [entity.id] },
      })}
    />
  )
}

const testAppearanceSchema = v.object({
  backgroundPaint: v.pipe(
    v.unknown(),
    v.title('背景填充'),
    v.metadata({ propertyPanel: { editor: 'paint' } }),
  ),
})

function TestAppearanceInspector({ paintEditPort, value, readOnly }: ComposeComponentInspectorProps) {
  return (
    <ComposePropertyPanel
      aria-label="外观属性"
      paintEditor={{
        onOpenChange: (open) => {
          if (open) paintEditPort?.open({ entityId: 'title' })
          else paintEditPort?.close()
        },
      }}
      readOnly={readOnly}
      schema={testAppearanceSchema}
      value={{
        backgroundPaint: value.backgroundPaint ?? { kind: 'solid', color: 'transparent' },
      }}
    />
  )
}

const testHierarchySchema = v.object({
  childCount: v.pipe(
    v.number(),
    v.title('子项数量'),
    v.metadata({ propertyPanel: { readOnly: true } }),
  ),
})

function TestHierarchyInspector({ entity }: ComposeComponentInspectorProps) {
  return (
    <ComposePropertyPanel
      aria-label="容器属性"
      readOnly
      schema={testHierarchySchema}
      value={{ childCount: getComposeHierarchy(entity)?.childIds.length ?? 0 }}
    />
  )
}

const componentDefinitions = [
  {
    key: 'Composition',
    label: '组合',
    hidden: true,
    order: -100,
    createDefault: () => ({ presetId: null, baseComponentKeys: [], capabilityIds: [] }),
  },
  {
    key: 'LayoutItem',
    label: '变换',
    order: 10,
    inspectorGroup: 'basic',
    createDefault: () => layoutItem(transform(0, 0, 100, 100)),
    inspector: TestTransformInspector,
  },
  {
    key: 'Visibility',
    label: '可见性',
    order: 20,
    createDefault: () => ({ visible: true }),
    inspector: TestVisibilityInspector,
  },
  {
    key: 'Lock',
    label: '锁定',
    order: 30,
    createDefault: () => ({ locked: false }),
    inspector: TestLockInspector,
  },
  {
    key: 'Appearance',
    label: '外观',
    order: 40,
    createDefault: () => ({ backgroundPaint: { kind: 'solid', color: 'transparent' } }),
    inspector: TestAppearanceInspector,
  },
  {
    key: 'Hierarchy',
    label: '容器',
    order: 50,
    createDefault: () => ({ childIds: [] }),
    inspector: TestHierarchyInspector,
  },
  {
    key: 'Clip',
    label: '裁剪',
    order: 60,
    createDefault: () => ({ enabled: true }),
  },
  {
    key: 'GeometryConstraints',
    label: '几何限制',
    order: 70,
    createDefault: () => ({
      movable: true,
      resize: 'free',
      rotatable: true,
    }),
  },
  {
    key: 'Renderer',
    label: '内容',
    hidden: true,
    order: 80,
    createDefault: () => ({ type: 'unknown', props: {} }),
  },
] as const

const registry = createComposeEntityRegistry({
  components: componentDefinitions,
  renderers: [{
    type: 'text',
    label: '文本',
    renderer: ({ props }) => <span>{String(props.text)}</span>,
    inspector: ({ entity, dispatch, readOnly }) => (
      <button
        disabled={readOnly}
        type="button"
        onClick={() => dispatch({
          id: 'renderer-inspector',
          type: BUILTIN_COMMAND_TYPES.setRendererProps,
          payload: { entityId: entity.id, props: { text: 'After' } },
          meta: { source: 'inspector', targetIds: [entity.id] },
        })}
      >
        修改内容
      </button>
    ),
  }],
  presets: [
    {
      id: 'container',
      label: 'Container',
      createComponents: () => ({
        Transform: { rotation: 0 },
        LayoutItem: layoutItem(transform(0, 0, 1280, 720)),
        Visibility: { visible: true },
        Lock: { locked: false },
        Hierarchy: { childIds: [] },
        Clip: { enabled: true },
        Appearance: { backgroundPaint: { kind: 'solid', color: '#ffffff' } },
      }),
    },
    {
      id: 'text',
      label: 'Text',
      createComponents: () => ({
        Transform: { rotation: 0 },
        LayoutItem: layoutItem(transform(0, 0, 180, 40)),
        Visibility: { visible: true },
        Lock: { locked: false },
        Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' } },
        Renderer: { type: 'text', props: { text: 'New' } },
      }),
    },
    {
      id: 'component-instance',
      label: 'Component',
      paletteHidden: true,
      createComponents: () => ({
        Transform: { rotation: 0 },
        LayoutItem: layoutItem(transform(0, 0, 1, 1)),
        Visibility: { visible: true },
        Lock: { locked: false },
        GeometryConstraints: { movable: true, resize: 'none', rotatable: true },
        Renderer: { type: 'component-instance', props: {} },
      }),
    },
  ],
  capabilities: [
    {
      id: 'container',
      label: '容器',
      createComponents: () => ({
        Hierarchy: { childIds: [] },
        Clip: { enabled: true },
      }),
    },
    {
      id: 'geometry-constraints',
      label: '几何限制',
      createComponents: () => ({
        GeometryConstraints: {
          movable: true,
          resize: 'free',
          rotatable: true,
        },
      }),
    },
  ],
})

function runtime() {
  let transactionIndex = 0
  return createTransactionRuntime({
    document: documentFixture(),
    idFactory: () => `transaction-${transactionIndex++}`,
    clock: () => transactionIndex * 10,
  })
}

function ids() {
  let index = 0
  return () => `editor-id-${index++}`
}

function componentStore(
  create: ComposeComponentStore['createComponent'] = async (input) => ({
    asset: input.asset,
    revision: '1',
    entryId: 'component-file',
    assetKey: `Components/${input.fileName}.component.json`,
  }),
): ComposeComponentStore {
  return {
    providerId: 'project',
    createReference: (assetKey) => ({
      kind: 'component',
      providerId: 'project',
      assetKey,
      scope: 'persistent',
    }),
    listComponents: async () => ({ components: [], issues: [] }),
    readComponent: async () => { throw new Error('unused') },
    createComponent: create,
    saveComponent: async () => { throw new Error('unused') },
    resolveComponent: async () => ({ status: 'invalid', issues: [] }),
    invalidate: () => undefined,
    subscribe: () => () => undefined,
    dispose: () => undefined,
  }
}

function InspectorFixture({
  transactionRuntime,
  selection = ['title'],
}: {
  readonly transactionRuntime: TransactionRuntime
  readonly selection?: readonly string[]
}) {
  const controller = useComposeEditorController({
    idFactory: ids(),
    initialSelection: selection,
    registry,
    runtime: transactionRuntime,
  })
  return <>{controller.inspectorPanel}</>
}

afterEach(cleanup)

describe('useComposeEditorController', () => {
  it('Stage 与 Palette 共享同一 interaction controller 并在卸载时释放', async () => {
    const editorRuntime = runtime()
    const hook = renderHook(() => useComposeEditorController({
      runtime: editorRuntime,
      registry,
    }))
    const controller = hook.result.current.interactionController
    expect(hook.result.current.stageProps.interactionController).toBe(controller)

    hook.unmount()
    await act(async () => new Promise<void>((resolve) => queueMicrotask(resolve)))
    expect(() => controller.connectSurface({
      resolveClientPoint: (point) => point,
      applyEffects: () => undefined,
    })).toThrow(/disposed/)
  })

  it('场景树由 Hierarchy 构建并使用 Preset 图标', () => {
    const editorRuntime = runtime()
    const { result } = renderHook(() => useComposeEditorController({
      runtime: editorRuntime,
      registry,
    }))

    expect(result.current.sceneTreeProps.nodes).toHaveLength(1)
    expect(result.current.sceneTreeProps.nodes[0]).toMatchObject({
      id: 'dashboard',
      label: 'Dashboard',
      canHaveChildren: true,
    })
    expect(result.current.sceneTreeProps.nodes[0]?.children?.[0]).toMatchObject({
      id: 'title',
      canHaveChildren: false,
    })
  })

  it('展开组件实例时投影内部层级，未展开保持单节点', () => {
    const editorRuntime = createTransactionRuntime({
      document: instanceDocumentFixture(),
      idFactory: () => 'transaction-0',
      clock: () => 0,
    })
    const { result } = renderHook(() => useComposeEditorController({
      runtime: editorRuntime,
      registry,
    }))

    const collapsed = result.current.sceneTreeProps.nodes[0]
    // hasChildren 必须显式声明：惰性投影下 children 为空，仅凭 children 推断会让展开控件消失。
    expect(collapsed).toMatchObject({ id: 'instance', canHaveChildren: true, hasChildren: true })
    // 未展开不构建投影，观感与既有单节点一致。
    expect(collapsed?.children).toBeUndefined()

    act(() => {
      result.current.sceneTreeProps.onExpandedChange?.(['instance'])
    })

    const expanded = result.current.sceneTreeProps.nodes[0]
    expect(expanded?.children).toHaveLength(1)
    // 内部节点自身还有后代，必须同样声明 hasChildren，否则第二层起没有展开控件。
    expect(expanded?.children?.[0]).toMatchObject({
      id: 'instance/c-text',
      label: 'Inner Text',
      canHaveChildren: true,
      hasChildren: true,
    })
    expect(expanded?.children?.[0]?.children).toBeUndefined()

    act(() => {
      result.current.sceneTreeProps.onExpandedChange?.(['instance', 'instance/c-text'])
    })

    const deep = result.current.sceneTreeProps.nodes[0]?.children?.[0]
    expect(deep?.children).toHaveLength(1)
    // 地址段数对应实例嵌套层数而非树深度：内部实体 ID 在组件文档内唯一，无需逐层拼接。
    expect(deep?.children?.[0]).toMatchObject({
      id: 'instance/c-deep',
      label: 'Deep Text',
      hasChildren: false,
    })
  })

  it('选区保留实例内部复合地址', () => {
    const editorRuntime = createTransactionRuntime({
      document: instanceDocumentFixture(),
      idFactory: () => 'transaction-0',
      clock: () => 0,
    })
    const { result } = renderHook(() => useComposeEditorController({
      runtime: editorRuntime,
      registry,
    }))

    act(() => {
      result.current.sceneTreeProps.onSelectionChange?.(['instance/c-text'])
    })
    expect(result.current.sceneTreeProps.selectedIds).toEqual(['instance/c-text'])
    // 选中内部节点必须自动展开宿主实例，否则从 Stage 下钻后树里看不到被选中的行。
    expect(result.current.sceneTreeProps.expandedIds).toContain('instance')

    act(() => {
      result.current.sceneTreeProps.onSelectionChange?.(['instance/c-deep'])
    })
    // 深层节点还要展开其内部祖先链。
    expect(result.current.sceneTreeProps.expandedIds).toEqual(
      expect.arrayContaining(['instance', 'instance/c-text']),
    )

    // 文档变化时归一化：宿主实例不存在的复合地址被丢弃，否则选区指向不可达节点。
    act(() => {
      result.current.sceneTreeProps.onSelectionChange?.(['missing/c-text'])
      editorRuntime.dispatch({
        id: 'select-normalize',
        type: BUILTIN_COMMAND_TYPES.renameEntity,
        payload: { entityId: 'instance', name: 'Card 2' },
        meta: { label: 'rename', source: 'test', targetIds: ['instance'] },
      })
    })
    expect(result.current.sceneTreeProps.selectedIds).toEqual([])
  })

  it('选中实例内部节点时 Inspector 编辑写入实例覆盖而非宿主文档', () => {
    const editorRuntime = createTransactionRuntime({
      document: instanceDocumentFixture(),
      idFactory: () => 'transaction-0',
      clock: () => 0,
    })
    const { result } = renderHook(() => useComposeEditorController({
      runtime: editorRuntime,
      registry,
    }))

    act(() => {
      result.current.sceneTreeProps.onSelectionChange?.(['instance/c-deep'])
    })

    const target = result.current.instanceInnerSelection
    expect(target).not.toBeNull()
    expect(target?.entity.id).toBe('c-deep')

    act(() => {
      target?.dispatch({
        id: 'inner-edit',
        type: BUILTIN_COMMAND_TYPES.setRendererProps,
        payload: { entityId: 'c-deep', props: { text: 'Edited' } },
        meta: { label: 'edit', source: 'inspector', targetIds: ['c-deep'] },
      })
    })

    // 宿主文档只多出实例覆盖，内部实体不会被写进宿主 entities。
    const host = result.current.document.entities.instance!
    expect(result.current.document.entities['c-deep']).toBeUndefined()
    const overrides = (host.components.Renderer as { props: Record<string, unknown> })
      .props.instanceOverrides as { operations: readonly { kind: string }[] }
    expect(overrides.operations.length).toBeGreaterThan(0)
    expect(overrides.operations.every(({ kind }) => kind === 'set-field')).toBe(true)
  })

  it('实例内部结构编辑写入覆盖，越界移动被拒绝', () => {
    const editorRuntime = createTransactionRuntime({
      document: instanceDocumentFixture(),
      idFactory: () => 'transaction-0',
      clock: () => 0,
    })
    const { result } = renderHook(() => useComposeEditorController({
      runtime: editorRuntime,
      registry,
    }))

    function overrides() {
      const host = result.current.document.entities.instance!
      return (host.components.Renderer as { props: Record<string, unknown> })
        .props.instanceOverrides as { operations: readonly { kind: string }[] }
    }

    // 删除内部实体产生 remove-entity 覆盖，宿主 entities 不受影响。
    act(() => {
      result.current.sceneTreeProps.onOperation?.({
        type: 'delete',
        nodeIds: ['instance/c-deep'],
      })
    })
    expect(overrides().operations.some(({ kind }) => kind === 'remove-entity')).toBe(true)
    expect(Object.keys(result.current.document.entities)).toEqual(['instance'])

    // 把内部实体移到宿主场景是越界操作，必须被拒绝且不改变任何文档。
    const before = result.current.document
    act(() => {
      result.current.sceneTreeProps.onOperation?.({
        type: 'move',
        nodeIds: ['instance/c-text'],
        parentId: null,
        index: 0,
      })
    })
    expect(result.current.document).toBe(before)
  })

  it('选中实例本身时 Inspector 路由到组件根', () => {
    const editorRuntime = createTransactionRuntime({
      document: instanceDocumentFixture(),
      idFactory: () => 'transaction-0',
      clock: () => 0,
    })
    const { result } = renderHook(() => useComposeEditorController({
      runtime: editorRuntime,
      registry,
    }))

    act(() => {
      result.current.sceneTreeProps.onSelectionChange?.(['instance'])
    })

    // 实例的最外层就是组件根，其属性编辑必须写入实例覆盖而不是宿主文档。
    const target = result.current.instanceRootSelection
    expect(target).not.toBeNull()
    expect(target?.entity.id).toBe('c-root')

    act(() => {
      target?.dispatch({
        id: 'root-edit',
        type: BUILTIN_COMMAND_TYPES.setAppearance,
        payload: {
          entityId: 'c-root',
          appearance: { backgroundPaint: { kind: 'solid', color: '#ff0000' } },
        },
        meta: { label: 'edit', source: 'inspector', targetIds: ['c-root'] },
      })
    })

    const host = result.current.document.entities.instance!
    expect(result.current.document.entities['c-root']).toBeUndefined()
    const overrides = (host.components.Renderer as { props: Record<string, unknown> })
      .props.instanceOverrides as { operations: readonly { entityId: string }[] }
    expect(overrides.operations.length).toBeGreaterThan(0)
    expect(overrides.operations.every(({ entityId }) => entityId === 'c-root')).toBe(true)
  })

  it('实例 Resize 写入以组件根为目标的覆盖而不是宿主尺寸', () => {
    const editorRuntime = createTransactionRuntime({
      document: instanceDocumentFixture(),
      idFactory: () => 'transaction-0',
      clock: () => 0,
    })
    const { result } = renderHook(() => useComposeEditorController({
      runtime: editorRuntime,
      registry,
    }))

    act(() => {
      result.current.dispatch({
        id: 'resize-1',
        type: BUILTIN_COMMAND_TYPES.setTransform,
        payload: {
          operation: 'resize',
          updates: [{
            entityId: 'instance',
            transform: {
              position: { x: 0, y: 0 },
              size: { width: 300, height: 200 },
              rotation: 0,
            },
          }],
        },
        meta: { label: 'resize', source: 'stage', targetIds: ['instance'] },
      })
    })

    const host = result.current.document.entities.instance!
    // 宿主保持 Hug；回退 value 同步为新尺寸供测量/Inspector，模式不得变成 fixed。
    expect(getComposeLayoutItem(host)).toMatchObject({
      width: { mode: 'hug', value: 300 },
      height: { mode: 'hug', value: 200 },
    })
    const overrides = (host.components.Renderer as { props: Record<string, unknown> })
      .props.instanceOverrides as { operations: readonly { entityId: string; value?: unknown }[] }
    expect(overrides.operations.some(({ entityId }) => entityId === 'c-root')).toBe(true)
  })

  it('Inspector 修改实例尺寸写入组件根覆盖而不是宿主 LayoutItem', () => {
    const editorRuntime = createTransactionRuntime({
      document: instanceDocumentFixture(),
      idFactory: () => 'transaction-0',
      clock: () => 0,
    })
    const { result } = renderHook(() => useComposeEditorController({
      runtime: editorRuntime,
      registry,
    }))

    const hostBefore = getComposeLayoutItem(result.current.document.entities.instance!)
    act(() => {
      result.current.dispatch({
        id: 'layout-size-1',
        type: BUILTIN_COMMAND_TYPES.updateComponent,
        payload: {
          entityId: 'instance',
          key: 'LayoutItem',
          value: {
            ...hostBefore,
            width: { ...hostBefore.width, mode: 'fixed', value: 360 },
          },
        },
        meta: { label: 'size', source: 'inspector', targetIds: ['instance'] },
      })
    })

    const host = result.current.document.entities.instance!
    expect(getComposeLayoutItem(host).width.value).toBe(hostBefore.width.value)
    const overrides = (host.components.Renderer as { props: Record<string, unknown> })
      .props.instanceOverrides as { operations: readonly { entityId: string }[] }
    expect(overrides.operations.some(({ entityId }) => entityId === 'c-root')).toBe(true)
  })

  it('场景树创建操作从 Container Preset 创建 v6 Entity', () => {
    const editorRuntime = runtime()
    const { result } = renderHook(() => useComposeEditorController({
      idFactory: ids(),
      runtime: editorRuntime,
      registry,
    }))

    act(() => result.current.sceneTreeProps.onOperation?.({
      type: 'create',
      parentId: null,
      index: 1,
    }))

    const created = Object.values(editorRuntime.document.entities)
      .find((candidate) => candidate.id.startsWith('editor-id-'))
    expect(created).toBeDefined()
    expect(getComposeHierarchy(created!)).toEqual({ childIds: [] })
    expect(getComposeSpatialTransform(created!).size).toEqual({ width: 1280, height: 720 })
    expect(result.current.selectedIds).toEqual([created!.id])
  })

  it('场景树重命名、可见性和锁定操作使用 entity 命令', () => {
    const editorRuntime = runtime()
    const { result } = renderHook(() => useComposeEditorController({
      idFactory: ids(),
      runtime: editorRuntime,
      registry,
    }))

    act(() => result.current.sceneTreeProps.onOperation?.({
      type: 'rename',
      nodeId: 'title',
      label: 'Headline',
    }))
    expect(editorRuntime.document.entities.title?.name).toBe('Headline')

    act(() => result.current.sceneTreeProps.onOperation?.({
      type: 'set-visibility',
      nodeIds: ['title'],
      visible: false,
    }))
    expect(editorRuntime.document.entities.title?.components.Visibility).toEqual({ visible: false })

    act(() => result.current.sceneTreeProps.onOperation?.({
      type: 'set-locked',
      nodeIds: ['dashboard'],
      locked: true,
    }))
    expect(getComposeLock(editorRuntime.document.entities.dashboard!).locked).toBe(true)
  })

  it('场景树删除操作移除 Entity 并从父容器解除引用', () => {
    const editorRuntime = runtime()
    const { result } = renderHook(() => useComposeEditorController({
      idFactory: ids(),
      runtime: editorRuntime,
      registry,
    }))

    act(() => result.current.sceneTreeProps.onOperation?.({
      type: 'delete',
      nodeIds: ['title'],
    }))

    expect(editorRuntime.document.entities.title).toBeUndefined()
    expect(getComposeHierarchy(editorRuntime.document.entities.dashboard!)?.childIds).toEqual([])
  })

  it('场景树移动操作跨父级 reparent 并在同父级内重排序', () => {
    const editorRuntime = runtime()
    const { result } = renderHook(() => useComposeEditorController({
      idFactory: ids(),
      runtime: editorRuntime,
      registry,
    }))

    expect(result.current.stageProps.layoutSnapshot).toBeDefined()

    act(() => result.current.sceneTreeProps.onOperation?.({
      type: 'move',
      nodeIds: ['title'],
      parentId: null,
      index: 0,
    }))

    expect(editorRuntime.document.rootIds).toEqual(['title', 'dashboard'])
    expect(getComposeHierarchy(editorRuntime.document.entities.dashboard!)?.childIds).toEqual([])
    // reparent 保持世界坐标：title 原本在 dashboard(40,30) 内偏移 (10,10)。
    expect(getComposeSpatialTransform(editorRuntime.document.entities.title!).position)
      .toEqual({ x: 50, y: 40 })

    act(() => result.current.sceneTreeProps.onOperation?.({
      type: 'move',
      nodeIds: ['title'],
      parentId: null,
      index: 2,
    }))
    expect(editorRuntime.document.rootIds).toEqual(['dashboard', 'title'])
  })

  it('场景树复制操作创建副本并选中；多个来源合并为一个事务', () => {
    const editorRuntime = runtime()
    // idFactory 必须跨渲染稳定：写成 `ids()` 会在每次重渲染重置计数器，
    // 使后续操作复用已存在的 Entity ID 而被运行时拒绝。
    const idFactory = ids()
    const { result } = renderHook(() => useComposeEditorController({
      idFactory,
      runtime: editorRuntime,
      registry,
    }))

    act(() => result.current.sceneTreeProps.onOperation?.({
      type: 'duplicate',
      sourceNodeIds: ['title'],
      parentId: 'dashboard',
      index: 1,
    }))

    const children = getComposeHierarchy(editorRuntime.document.entities.dashboard!)?.childIds ?? []
    expect(children).toHaveLength(2)
    const copyId = children.find((id) => id !== 'title')!
    expect(editorRuntime.document.entities[copyId]).toBeDefined()
    expect(result.current.selectedIds).toEqual([copyId])

    const entriesBefore = editorRuntime.entries.length
    act(() => result.current.sceneTreeProps.onOperation?.({
      type: 'duplicate',
      sourceNodeIds: ['title', copyId],
      parentId: 'dashboard',
      index: 2,
    }))
    expect(editorRuntime.entries).toHaveLength(entriesBefore + 1)
    expect(getComposeHierarchy(editorRuntime.document.entities.dashboard!)?.childIds)
      .toHaveLength(4)
    expect(result.current.selectedIds).toHaveLength(2)
  })

  it('Renderer Inspector 派发 entity.renderer.props.set', () => {
    const editorRuntime = runtime()
    render(<InspectorFixture transactionRuntime={editorRuntime} />)

    // 有内容的分组默认展开；再点标题会折叠并隐藏字段。
    expect(screen.getByRole('button', { name: '高级' })).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('button', { name: '修改内容' }))
    expect(editorRuntime.document.entities.title?.components.Renderer).toEqual({
      type: 'text',
      props: { text: 'After' },
    })
  })

  it('OpenSpec: editor-workspace-layout / 聚合 Inspector / 外部 Transform 事务同步输入值', async () => {
    const editorRuntime = runtime()
    render(<InspectorFixture transactionRuntime={editorRuntime} />)
    expect(screen.getByRole('spinbutton', { name: '位置 X' })).toHaveValue(10)

    act(() => {
      editorRuntime.dispatch({
        id: 'external-transform',
        type: BUILTIN_COMMAND_TYPES.setTransform,
        payload: {
          operation: 'move',
          updates: [{
            entityId: 'title',
            transform: transform(42, 18, 180, 40),
          }],
        },
        meta: { source: 'stage', targetIds: ['title'] },
      })
    })

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: '位置 X' })).toHaveValue(42)
      expect(screen.getByRole('spinbutton', { name: '位置 Y' })).toHaveValue(18)
    })
  })

  it('OpenSpec: editor-workspace-layout / ECS 聚合 Inspector / 使用单一属性工具栏和 Component 分组', () => {
    const editorRuntime = runtime()
    render(<InspectorFixture transactionRuntime={editorRuntime} />)

    expect(screen.getAllByRole('searchbox', { name: '搜索属性' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: '基础' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '变换' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '可见性' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '锁定' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '高级' })).toBeInTheDocument()

    const root = screen.getByRole('region', { name: 'Title 属性字段' })
    const titles = [...root.querySelectorAll(
      ':scope > .property-panel__group > .property-panel__group-header > button',
    )].map((button) => button.textContent?.trim())
    expect(titles).toEqual(['基础', '可见性', '锁定', '外观', '高级'])

    fireEvent.change(screen.getByRole('searchbox', { name: '搜索属性' }), {
      target: { value: '背景填充' },
    })
    expect(screen.queryByRole('button', { name: '基础' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '外观' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '背景填充' })).toBeInTheDocument()
  })

  it('OpenSpec: stage-paint-tools / Inspector 打开背景填充后同步 Stage Paint 编辑会话', () => {
    const editorRuntime = runtime()
    const { result } = renderHook(() => useComposeEditorController({
      initialSelection: ['title'],
      registry,
      runtime: editorRuntime,
    }))
    render(<>{result.current.inspectorPanel}</>)

    expect(screen.getByRole('button', { name: '外观' })).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('button', { name: '背景填充' }))
    expect(result.current.stageProps.paintEditing).toEqual({ entityId: 'title' })
  })

  it('添加能力通过单个 batch 原子写入 Component 和 Composition', () => {
    const editorRuntime = runtime()
    render(<InspectorFixture transactionRuntime={editorRuntime} />)

    fireEvent.change(screen.getByRole('combobox', { name: '添加能力' }), {
      target: { value: 'container' },
    })

    expect(editorRuntime.document.entities.title?.components.Hierarchy).toEqual({ childIds: [] })
    expect(editorRuntime.document.entities.title?.components.Clip).toEqual({ enabled: true })
    expect(editorRuntime.document.entities.title?.components.Composition?.capabilityIds)
      .toEqual(['container'])
    expect(editorRuntime.entries).toHaveLength(2)
    expect(screen.getAllByRole('searchbox', { name: '搜索属性' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: '容器' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '裁剪' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '容器' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('spinbutton', { name: '子项数量' })).toHaveValue(0)
  })

  it('未知 Component 使用普通分组降级，且不新增工具栏', () => {
    const editorRuntime = runtime()
    editorRuntime.dispatch({
      id: 'add-host-state',
      type: BUILTIN_COMMAND_TYPES.addComponent,
      payload: {
        entityId: 'title',
        key: 'HostState',
        value: { enabled: true },
      },
      meta: { source: 'test', targetIds: ['title'] },
    })
    render(<InspectorFixture transactionRuntime={editorRuntime} />)

    expect(screen.getByRole('button', { name: 'HostState' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'HostState' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByLabelText('未知 Component')).toHaveValue('未知 Component：HostState')
    expect(screen.getAllByRole('searchbox', { name: '搜索属性' })).toHaveLength(1)
  })

  it('移除能力先确认并原子删除能力数据', async () => {
    const editorRuntime = runtime()
    const plan = registry.planAddCapability(editorRuntime.document, 'title', 'container', ids())
    if (!plan.ok) throw new Error(plan.issue.message)
    editorRuntime.dispatch(plan.command)
    render(<InspectorFixture transactionRuntime={editorRuntime} />)

    fireEvent.click(screen.getByRole('button', { name: '移除容器' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('移除能力')
    fireEvent.click(screen.getByRole('button', { name: '移除' }))

    await waitFor(() => {
      expect(editorRuntime.document.entities.title?.components.Hierarchy).toBeUndefined()
    })
    expect(editorRuntime.document.entities.title?.components.Clip).toBeUndefined()
    expect(editorRuntime.document.entities.title?.components.Composition?.capabilityIds).toEqual([])
  })

  it('锁定 Entity 时 Renderer Props 只读但 Lock 仍可解除', () => {
    const editorRuntime = runtime()
    editorRuntime.dispatch({
      id: 'lock-title',
      type: BUILTIN_COMMAND_TYPES.setLock,
      payload: { entityIds: ['title'], locked: true },
    })
    render(<InspectorFixture transactionRuntime={editorRuntime} />)

    // 有内容的「高级」默认展开；锁定已并入「基础」。
    expect(screen.getByRole('button', { name: '高级' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: '修改内容' })).toBeDisabled()
    const lock = screen.getByRole('checkbox', { name: '锁定' })
    expect(lock).not.toBeDisabled()
    fireEvent.click(lock)
    expect(getComposeLock(editorRuntime.document.entities.title!).locked).toBe(false)
  })

  it('选择 Canvas 输出时展示 Canvas Inspector 并清空 Entity 选择', () => {
    // runtime 必须在渲染之间保持稳定：换 runtime 表示换文档，会重置全部会话状态。
    const editorRuntime = runtime()
    const { result } = renderHook(() => useComposeEditorController({
      initialSelection: ['title'],
      runtime: editorRuntime,
      registry,
    }))

    act(() => result.current.stageProps.onOutputSelect?.())
    expect(result.current.selectedIds).toEqual([])
    expect(result.current.stageProps.outputSelected).toBe(true)
  })

  it('OpenSpec: editor-workspace-layout / 工作区跟随活动页面 / 换 runtime 重置会话状态', () => {
    const first = runtime()
    const second = runtime()
    const { result, rerender } = renderHook(
      ({ transactionRuntime }: { transactionRuntime: TransactionRuntime }) =>
        useComposeEditorController({
          initialSelection: ['title'],
          initialExpandedIds: ['dashboard'],
          runtime: transactionRuntime,
          registry,
        }),
      { initialProps: { transactionRuntime: first } },
    )

    act(() => result.current.setViewport({ x: 500, y: 500, zoom: 2 }))
    act(() => result.current.stageProps.onOutputSelect?.())
    expect(result.current.viewport.x).toBe(500)
    expect(result.current.stageProps.outputSelected).toBe(true)

    // 换 runtime 表示换文档：选择、检视目标、展开集合与视口都不得残留。
    rerender({ transactionRuntime: second })

    expect(result.current.runtime).toBe(second)
    expect(result.current.selectedIds).toEqual([])
    expect(result.current.expandedIds).toEqual([])
    expect(result.current.stageProps.outputSelected).toBe(false)
    expect(result.current.viewport).toEqual({ x: 80, y: 64, zoom: 1 })
  })

  it('切换选中 Entity 时重置能力移除确认对话框', () => {
    const editorRuntime = runtime()
    const plan = registry.planAddCapability(editorRuntime.document, 'title', 'container', ids())
    if (!plan.ok) throw new Error(plan.issue.message)
    editorRuntime.dispatch(plan.command)

    // 模态对话框会阻挡页面交互；选择变化的真实来源是场景树或文档事务，测试直接
    // 通过 controller API 切换。
    const { result } = renderHook(() => useComposeEditorController({
      idFactory: ids(),
      initialSelection: ['title'],
      registry,
      runtime: editorRuntime,
    }))
    const view = render(<>{result.current.inspectorPanel}</>)

    fireEvent.click(screen.getByRole('button', { name: '移除容器' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()

    act(() => result.current.setSelectedIds(['dashboard']))
    view.rerender(<>{result.current.inspectorPanel}</>)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('containerPresetId 缺失时创建入口输出警告且不产生事务', () => {
    const editorRuntime = runtime()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const { result } = renderHook(() => useComposeEditorController({
        containerPresetId: 'missing-container',
        idFactory: ids(),
        registry,
        runtime: editorRuntime,
      }))
      const entriesBefore = editorRuntime.entries.length
      act(() => {
        result.current.sceneTreeProps.onOperation?.({
          type: 'create',
          parentId: null,
          index: 0,
        })
      })
      expect(editorRuntime.entries).toHaveLength(entriesBefore)
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('missing-container'))
    }
    finally {
      warn.mockRestore()
    }
  })

  it('成功事务只通过 onTransaction 通知一次', () => {
    const observer = vi.fn()
    const editorRuntime = runtime()
    const { result } = renderHook(() => useComposeEditorController({
      idFactory: ids(),
      onTransaction: observer,
      runtime: editorRuntime,
      registry,
    }))

    act(() => result.current.dispatch({
      id: 'rename',
      type: BUILTIN_COMMAND_TYPES.renameEntity,
      payload: { entityId: 'title', name: 'Latest title' },
      meta: { source: 'test', targetIds: ['title'] },
    }))

    expect(observer).toHaveBeenCalledOnce()
    expect(observer).toHaveBeenCalledWith(expect.objectContaining({
      direction: 'commit',
      source: 'test',
      targets: ['title'],
    }))
  })

  it('OpenSpec: refactor-editor-viewport-render-scope / 视口更新的渲染范围 / 平移不重渲无关面板', () => {
    const editorRuntime = runtime()
    const handle: { current: ReturnType<typeof useComposeEditorController> | null } = {
      current: null,
    }

    function Workspace() {
      const controller = useComposeEditorController({
        idFactory: ids(),
        initialSelection: ['title'],
        registry,
        runtime: editorRuntime,
      })
      useEffect(() => {
        handle.current = controller
      })
      return (
        <>
          {controller.stage}
          {controller.inspectorPanel}
        </>
      )
    }

    render(<Workspace />)
    // Registry inspector 的渲染次数代表 Inspector 子树真的重渲了；场景树属性引用稳定则
    // 说明记忆化的场景树面板可以 bail out。
    const controller = handle.current!
    const inspectorBefore = renderProbe.inspector
    const sceneTreePropsBefore = controller.sceneTreeProps

    act(() => controller.setViewport({ x: 240, y: 160, zoom: 2 }))

    expect(controller.viewport).toEqual({ x: 240, y: 160, zoom: 2 })
    expect(renderProbe.inspector).toBe(inspectorBefore)
    expect(controller.sceneTreeProps).toBe(sceneTreePropsBefore)
  })

  it('controller.stage 透传宿主克隆注入的 Stage 属性', () => {
    // ComposeEditor 用 cloneElement 往 controller.stage 上注入 assetResolver、shortcuts 与
    // onToolChange。stage 节点若不透传这些属性，资源解析与自定义快捷键都会静默失效。
    const editorRuntime = runtime()
    const { result } = renderHook(() => useComposeEditorController({
      idFactory: ids(),
      registry,
      runtime: editorRuntime,
    }))

    render(cloneElement(result.current.stage as ReactElement<Record<string, unknown>>, {
      shortcuts: { 'stage.temporaryPan': [{ code: 'KeyP' }] },
    }))
    const stage = screen.getByRole('application', { name: 'Stage' })
    expect(stage).toHaveAttribute('data-interaction-cursor', 'default')

    fireEvent.keyDown(stage, { code: 'KeyP', key: 'p' })

    expect(stage).toHaveAttribute('data-interaction-cursor', 'grab')
  })

  it('OpenSpec: editor-workspace-layout / 从场景选区创建组件 / 资源成功后原子替换并可撤销重做', async () => {
    const editorRuntime = runtime()
    const create = vi.fn<ComposeComponentStore['createComponent']>(async (input) => ({
      asset: input.asset,
      revision: '1',
      entryId: 'card-file',
      assetKey: 'Components/Card.component.json',
    }))
    const store = componentStore(create)
    const { result } = renderHook(() => useComposeEditorController({
      componentStore: store,
      idFactory: ids(),
      initialSelection: ['title'],
      registry,
      runtime: editorRuntime,
    }))

    let outcome: Awaited<ReturnType<typeof result.current.createComponentFromSelection>> | undefined
    await act(async () => {
      outcome = await result.current.createComponentFromSelection({ name: 'Card' })
    })

    expect(outcome).toMatchObject({ status: 'committed' })
    expect(create).toHaveBeenCalledOnce()
    const saved = create.mock.calls[0]![0].asset
    expect(saved).toMatchObject({ kind: 'base', name: 'Card' })
    if (saved.kind !== 'base') throw new Error('expected Base Component')
    expect(saved.document.rootIds).toHaveLength(1)
    expect(editorRuntime.document.entities.title).toBeUndefined()
    const instanceId = outcome?.status === 'committed' ? outcome.instanceId : ''
    expect(getComposeHierarchy(editorRuntime.document.entities.dashboard!)?.childIds)
      .toEqual([instanceId])

    act(() => editorRuntime.undo())
    expect(getComposeHierarchy(editorRuntime.document.entities.dashboard!)?.childIds)
      .toEqual(['title'])
    expect(create).toHaveBeenCalledOnce()
    act(() => editorRuntime.redo())
    expect(getComposeHierarchy(editorRuntime.document.entities.dashboard!)?.childIds)
      .toEqual([instanceId])
    expect(create).toHaveBeenCalledOnce()
  })

  it('组件资源写入失败时场景保持不变', async () => {
    const editorRuntime = runtime()
    const store = componentStore(async () => { throw new Error('disk full') })
    const { result } = renderHook(() => useComposeEditorController({
      componentStore: store,
      idFactory: ids(),
      initialSelection: ['title'],
      registry,
      runtime: editorRuntime,
    }))

    let outcome: Awaited<ReturnType<typeof result.current.createComponentFromSelection>> | undefined
    await act(async () => {
      outcome = await result.current.createComponentFromSelection({ name: 'Card' })
    })
    expect(outcome).toMatchObject({ status: 'failed', error: { message: 'disk full' } })
    expect(getComposeHierarchy(editorRuntime.document.entities.dashboard!)?.childIds)
      .toEqual(['title'])
    expect(editorRuntime.entries).toHaveLength(1)
  })

  it('资源写入期间文档 revision 改变时保留资源但不实例化', async () => {
    const editorRuntime = runtime()
    let finish: ((value: Awaited<ReturnType<ComposeComponentStore['createComponent']>>) => void) | undefined
    const create = vi.fn<ComposeComponentStore['createComponent']>((input) => new Promise((resolve) => {
      finish = () => resolve({
        asset: input.asset,
        revision: '1',
        entryId: 'card-file',
        assetKey: 'Components/Card.component.json',
      })
    }))
    const { result } = renderHook(() => useComposeEditorController({
      componentStore: componentStore(create),
      idFactory: ids(),
      initialSelection: ['title'],
      registry,
      runtime: editorRuntime,
    }))

    let outcome: Awaited<ReturnType<typeof result.current.createComponentFromSelection>> | undefined
    await act(async () => {
      const pending = result.current.createComponentFromSelection({ name: 'Card' })
      editorRuntime.dispatch({
        id: 'concurrent-rename',
        type: BUILTIN_COMMAND_TYPES.renameEntity,
        payload: { entityId: 'title', name: 'Changed during save' },
      })
      finish?.({} as never)
      outcome = await pending
    })

    expect(outcome).toMatchObject({ status: 'saved-not-instantiated' })
    expect(editorRuntime.document.entities.title?.name).toBe('Changed during save')
    expect(getComposeHierarchy(editorRuntime.document.entities.dashboard!)?.childIds)
      .toEqual(['title'])
  })
})
