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
import {
  BUILTIN_COMMAND_TYPES,
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  createTransactionRuntime,
  getComposeHierarchy,
  getComposeLock,
  getComposeTransform,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeTransform,
  type TransactionRuntime,
} from '@compose-ui/core'
import { useComposeEditorController } from './controller'

function transform(
  x: number,
  y: number,
  width: number,
  height: number,
): ComposeTransform {
  return {
    position: { x, y },
    size: { width, height },
    rotation: 0,
  }
}

function entity(
  id: string,
  components: ComposeEntity['components'],
  name = id,
  presetId: string | null = null,
): ComposeEntity {
  const base = {
    Transform: transform(0, 0, 100, 100),
    Visibility: { visible: true },
    Lock: { locked: false },
    ...components,
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
    schemaVersion: 4,
    canvas: createDefaultCanvasSettings(),
    output: createDefaultOutputSettings(),
    rootIds: ['dashboard'],
    entities: {
      dashboard: entity('dashboard', {
        Transform: transform(40, 30, 800, 600),
        Hierarchy: { childIds: ['title'] },
        Clip: { enabled: true },
        Appearance: { backgroundColor: '#111827' },
      }, 'Dashboard', 'container'),
      title: entity('title', {
        Transform: transform(10, 10, 180, 40),
        Appearance: { backgroundColor: 'transparent' },
        Renderer: { type: 'text', props: { text: 'Before' } },
      }, 'Title', 'text'),
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

function TestTransformInspector({ value }: ComposeComponentInspectorProps) {
  return (
    <ComposePropertyPanel
      aria-label="变换属性"
      schema={testTransformSchema}
      value={{ position: (value as ComposeTransform).position }}
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
  backgroundColor: v.pipe(
    v.string(),
    v.title('背景颜色'),
    v.metadata({ propertyPanel: { editor: 'color' } }),
  ),
})

function TestAppearanceInspector({ value, readOnly }: ComposeComponentInspectorProps) {
  return (
    <ComposePropertyPanel
      aria-label="外观属性"
      readOnly={readOnly}
      schema={testAppearanceSchema}
      value={{
        backgroundColor: typeof value.backgroundColor === 'string'
          ? value.backgroundColor
          : 'transparent',
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
    key: 'Transform',
    label: '变换',
    order: 10,
    createDefault: () => transform(0, 0, 100, 100),
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
    createDefault: () => ({ backgroundColor: 'transparent' }),
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
    key: 'TransformConstraints',
    label: '几何限制',
    order: 70,
    createDefault: () => ({
      movable: true,
      resize: 'free',
      rotatable: true,
      minSize: { width: 1, height: 1 },
      maxSize: null,
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
        Transform: transform(0, 0, 1280, 720),
        Visibility: { visible: true },
        Lock: { locked: false },
        Hierarchy: { childIds: [] },
        Clip: { enabled: true },
        Appearance: { backgroundColor: '#ffffff' },
      }),
    },
    {
      id: 'text',
      label: 'Text',
      createComponents: () => ({
        Transform: transform(0, 0, 180, 40),
        Visibility: { visible: true },
        Lock: { locked: false },
        Appearance: { backgroundColor: 'transparent' },
        Renderer: { type: 'text', props: { text: 'New' } },
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
        TransformConstraints: {
          movable: true,
          resize: 'free',
          rotatable: true,
          minSize: { width: 1, height: 1 },
          maxSize: null,
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
    const hook = renderHook(() => useComposeEditorController({
      runtime: runtime(),
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
    const { result } = renderHook(() => useComposeEditorController({
      runtime: runtime(),
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

  it('场景树创建操作从 Container Preset 创建 v4 Entity', () => {
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
    expect(getComposeTransform(created!).size).toEqual({ width: 1280, height: 720 })
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

    act(() => result.current.sceneTreeProps.onOperation?.({
      type: 'move',
      nodeIds: ['title'],
      parentId: null,
      index: 0,
    }))

    expect(editorRuntime.document.rootIds).toEqual(['title', 'dashboard'])
    expect(getComposeHierarchy(editorRuntime.document.entities.dashboard!)?.childIds).toEqual([])
    // reparent 保持世界坐标：title 原本在 dashboard(40,30) 内偏移 (10,10)。
    expect(getComposeTransform(editorRuntime.document.entities.title!).position)
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
    expect(screen.getByRole('button', { name: '变换' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '可见性' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '锁定' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '内容' })).toBeInTheDocument()

    const root = screen.getByRole('region', { name: 'Title 属性字段' })
    const titles = [...root.querySelectorAll(
      ':scope > .property-panel__group > .property-panel__group-header > button',
    )].map((button) => button.textContent?.trim())
    expect(titles).toEqual(['基础', '变换', '可见性', '锁定', '外观', '内容'])

    fireEvent.change(screen.getByRole('searchbox', { name: '搜索属性' }), {
      target: { value: '背景颜色' },
    })
    expect(screen.queryByRole('button', { name: '基础' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '外观' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择背景颜色' })).toBeInTheDocument()
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

  it('锁定 Entity 时内容只读但 Lock 仍可解除', () => {
    const editorRuntime = runtime()
    editorRuntime.dispatch({
      id: 'lock-title',
      type: BUILTIN_COMMAND_TYPES.setLock,
      payload: { entityIds: ['title'], locked: true },
    })
    render(<InspectorFixture transactionRuntime={editorRuntime} />)

    expect(screen.getByRole('button', { name: '修改内容' })).toBeDisabled()
    const lock = screen.getByRole('checkbox', { name: '锁定' })
    expect(lock).not.toBeDisabled()
    fireEvent.click(lock)
    expect(getComposeLock(editorRuntime.document.entities.title!).locked).toBe(false)
  })

  it('选择 Canvas 输出时展示 Canvas Inspector 并清空 Entity 选择', () => {
    const { result } = renderHook(() => useComposeEditorController({
      initialSelection: ['title'],
      runtime: runtime(),
      registry,
    }))

    act(() => result.current.stageProps.onOutputSelect?.())
    expect(result.current.selectedIds).toEqual([])
    expect(result.current.stageProps.outputSelected).toBe(true)
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
})
