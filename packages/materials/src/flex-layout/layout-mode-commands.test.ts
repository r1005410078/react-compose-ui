import {
  adoptComposeCrossAxisSizing,
  BUILTIN_COMMAND_TYPES,
  createComposeFrameEntity,
  createDefaultCanvasSettings,
  createDefaultComposeFlexLayout,
  createDefaultComposeLayoutItem,
  createTransactionRuntime,
  getComposeComposition,
  getComposeLayout,
  getComposeLayoutItem,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import {
  planEnableComposeAutoLayout,
  planRemoveComposeAutoLayout,
} from './layout-mode-commands'

function entity(
  id: string,
  components: ComposeEntity['components'],
  baseComponentKeys = Object.keys(components),
): ComposeEntity {
  return {
    id,
    name: id,
    components: {
      Composition: { presetId: null, baseComponentKeys, capabilityIds: [] },
      Transform: { rotation: 0 },
      LayoutItem: createDefaultComposeLayoutItem(100, 60),
      Visibility: { visible: true },
      Lock: { locked: false },
      ...(components.Hierarchy ? {} : { Renderer: { type: 'rectangle', props: {} } }),
      ...components,
    },
  }
}

function documentOf(parent: ComposeEntity, children: readonly ComposeEntity[]): ComposeDocument {
  return {
    schemaVersion: 7,
    canvas: createDefaultCanvasSettings(),
    rootIds: ['frame-root'],
    entities: {
      ...Object.fromEntries([parent, ...children].map((item) => [item.id, item])),
      'frame-root': createComposeFrameEntity({ id: 'frame-root', childIds: [parent.id] }),
    },
  }
}

function ids() {
  let index = 0
  return () => `layout-command-${++index}`
}

describe('Auto Layout mode command planning', () => {
  it('OpenSpec: 自动布局显式启用 / 单事务添加 Layout 并把直接子项转为 Flow', () => {
    const childA = entity('child-a', {})
    const childB = entity('child-b', {})
    const parent = entity('parent', {
      Hierarchy: { childIds: [childA.id, childB.id] },
    })
    const document = documentOf(parent, [childA, childB])

    const plan = planEnableComposeAutoLayout(document, parent.id, ids())
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.command.type).toBe(BUILTIN_COMMAND_TYPES.batch)

    const runtime = createTransactionRuntime({ document })
    expect(runtime.dispatch(plan.command).status).toBe('committed')
    expect(getComposeLayout(runtime.document.entities[parent.id]!))
      .toEqual(createDefaultComposeFlexLayout())
    expect(getComposeLayoutItem(runtime.document.entities[childA.id]!).positioning).toBe('flow')
    expect(getComposeLayoutItem(runtime.document.entities[childB.id]!).positioning).toBe('flow')
  })

  it('OpenSpec: basic-materials / Auto Layout 按需启用 / 固定尺寸子项转 Flow 时交叉轴改为 Fill', () => {
    const child = entity('child', { LayoutItem: createDefaultComposeLayoutItem(80, 40) })
    const parent = entity('parent', { Hierarchy: { childIds: [child.id] } })
    const document = documentOf(parent, [child])

    const plan = planEnableComposeAutoLayout(document, parent.id, ids())
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    const runtime = createTransactionRuntime({ document })
    runtime.dispatch(plan.command)

    // 默认 Layout 是 row + alignItems stretch，交叉轴是 height；固定值保留为回退。
    const item = getComposeLayoutItem(runtime.document.entities[child.id]!)
    expect(item.height).toMatchObject({ mode: 'fill', value: 40 })
    expect(item.width).toMatchObject({ mode: 'fixed', value: 80 })
  })

  it('OpenSpec: basic-materials / Auto Layout 按需启用 / 方向变化不回退采纳时改写的尺寸模式', () => {
    const child = entity('child', { LayoutItem: createDefaultComposeLayoutItem(80, 40) })
    const parent = entity('parent', { Hierarchy: { childIds: [child.id] } })
    const document = documentOf(parent, [child])

    const plan = planEnableComposeAutoLayout(document, parent.id, ids())
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    const runtime = createTransactionRuntime({ document })
    runtime.dispatch(plan.command)
    const adopted = getComposeLayoutItem(runtime.document.entities[child.id]!)
    expect(adopted.height.mode).toBe('fill')

    // Inspector 改方向走的就是这条命令：只带父级 entityId，只写 Layout。
    const rowLayout = getComposeLayout(runtime.document.entities[parent.id]!)!
    const result = runtime.dispatch({
      id: 'flip-direction',
      type: BUILTIN_COMMAND_TYPES.updateComponent,
      payload: { entityId: parent.id, key: 'Layout', value: { ...rowLayout, flexDirection: 'column' } },
      meta: { label: '修改布局', source: 'inspector', targetIds: [parent.id] },
    })
    expect(result.status).toBe('committed')

    // 子项逐字不变：一次父级属性编辑不级联改写子级。
    expect(getComposeLayoutItem(runtime.document.entities[child.id]!)).toEqual(adopted)
    if (result.status !== 'committed') return
    // 事务的正向 patch 与 targetIds 都不含子项：级联一旦被加进来，这两条会同时变红。
    expect(result.transaction.targetIds).toEqual([parent.id])
    expect(result.transaction.forward.every((patch) => !patch.path.includes(child.id))).toBe(true)
  })

  it('OpenSpec: basic-materials / Auto Layout 按需启用 / 采纳轴与当前交叉轴在方向翻转后分离', () => {
    // 这是「尺寸模式没变、含义变了」的机制本身：采纳把 height 改成 fill，是因为它**当时**
    // 是交叉轴；翻成 column 之后交叉轴是 width，而 fill 还留在 height——也就是主轴上，
    // 按 flexGrow 生效。
    const item = createDefaultComposeLayoutItem(80, 40)
    const rowLayout = createDefaultComposeFlexLayout()
    const columnLayout = { ...rowLayout, flexDirection: 'column' as const }

    const adopted = adoptComposeCrossAxisSizing({ ...item, positioning: 'flow' }, rowLayout)
    expect(adopted.height.mode).toBe('fill')
    expect(adopted.width.mode).toBe('fixed')

    // 同一个已采纳的子项，在新方向下「应采纳的轴」已经换成了 width。
    const reAdopted = adoptComposeCrossAxisSizing(adopted, columnLayout)
    expect(reAdopted.width.mode).toBe('fill')
    // 而 height 仍是 fill——采纳不会把它退回 fixed。
    expect(reAdopted.height.mode).toBe('fill')
  })

  it('OpenSpec: basic-materials / Auto Layout 按需启用 / 子项显式 alignSelf 时不改写尺寸', () => {
    const child = entity('child', {
      LayoutItem: { ...createDefaultComposeLayoutItem(80, 40), alignSelf: 'flex-start' },
    })
    const parent = entity('parent', { Hierarchy: { childIds: [child.id] } })
    const document = documentOf(parent, [child])

    const plan = planEnableComposeAutoLayout(document, parent.id, ids())
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    const runtime = createTransactionRuntime({ document })
    runtime.dispatch(plan.command)

    expect(getComposeLayoutItem(runtime.document.entities[child.id]!).height)
      .toMatchObject({ mode: 'fixed', value: 40 })
  })

  it('OpenSpec: 自动布局显式启用 / 任一受影响子项锁定时不生成命令', () => {
    const child = entity('child', { Lock: { locked: true } })
    const parent = entity('parent', { Hierarchy: { childIds: [child.id] } })

    expect(planEnableComposeAutoLayout(documentOf(parent, [child]), parent.id, ids()))
      .toMatchObject({ ok: false, issue: { code: 'layout.child-locked' } })
  })

  it('OpenSpec: 移除 Auto Layout 的视觉保持 / 烘焙 Snapshot、Fill 与旧基础归属', () => {
    const child = entity('child', {
      LayoutItem: {
        ...createDefaultComposeLayoutItem(80, 40),
        positioning: 'flow',
        width: { mode: 'fill', value: 80, min: null, max: null },
        height: { mode: 'hug', value: 40, min: null, max: null },
      },
    })
    const parent = entity('parent', {
      LayoutItem: {
        ...createDefaultComposeLayoutItem(300, 180),
        width: { mode: 'hug', value: 300, min: 1, max: null },
      },
      Hierarchy: { childIds: [child.id] },
      Layout: createDefaultComposeFlexLayout(),
      Appearance: {
        backgroundPaint: { kind: 'solid', color: 'transparent' },
        borderColor: '#ffffff',
        borderWidth: 2,
        borderRadius: 0,
        opacity: 1,
        shadow: null,
      },
    }, [
      'Transform', 'LayoutItem', 'Visibility', 'Lock', 'Hierarchy', 'Layout', 'Appearance',
    ])
    const document = documentOf(parent, [child])
    const snapshot: ComposeLayoutSnapshot = {
      revision: 7,
      boxes: {
        [parent.id]: { x: 0, y: 0, width: 320, height: 180, positioning: 'absolute' },
        [child.id]: { x: 20, y: 30, width: 120, height: 44, positioning: 'flow' },
      },
      diagnostics: [],
    }

    const plan = planRemoveComposeAutoLayout(document, parent.id, snapshot, ids())
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    const runtime = createTransactionRuntime({ document })
    expect(runtime.dispatch(plan.command).status).toBe('committed')

    const nextParent = runtime.document.entities[parent.id]!
    const nextChild = runtime.document.entities[child.id]!
    expect(getComposeLayout(nextParent)).toBeUndefined()
    expect(getComposeComposition(nextParent).baseComponentKeys).not.toContain('Layout')
    expect(getComposeLayoutItem(nextParent).width).toMatchObject({ mode: 'fixed', value: 320 })
    expect(getComposeLayoutItem(nextChild)).toMatchObject({
      positioning: 'absolute',
      offset: { x: 18, y: 28 },
      width: { mode: 'fixed', value: 120 },
      height: { mode: 'hug', value: 40 },
    })
  })

  it('OpenSpec: 移除 Auto Layout 的视觉保持 / 缺少 Snapshot 或 Flow box 时阻止操作', () => {
    const child = entity('child', {
      LayoutItem: { ...createDefaultComposeLayoutItem(), positioning: 'flow' },
    })
    const parent = entity('parent', {
      Hierarchy: { childIds: [child.id] },
      Layout: createDefaultComposeFlexLayout(),
    })
    const document = documentOf(parent, [child])

    expect(planRemoveComposeAutoLayout(document, parent.id, undefined, ids()))
      .toMatchObject({ ok: false, issue: { code: 'layout.snapshot-missing' } })
    expect(planRemoveComposeAutoLayout(document, parent.id, {
      revision: 1,
      boxes: {
        [parent.id]: { x: 0, y: 0, width: 100, height: 60, positioning: 'absolute' },
      },
      diagnostics: [],
    }, ids())).toMatchObject({ ok: false, issue: { code: 'layout.box-missing' } })
  })
})
