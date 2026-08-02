import {
  BUILTIN_COMMAND_TYPES,
  createDefaultCanvasSettings,
  createDefaultComposeFlexLayout,
  createDefaultComposeLayoutItem,
  createDefaultOutputSettings,
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
    schemaVersion: 6,
    canvas: createDefaultCanvasSettings(),
    output: createDefaultOutputSettings(),
    rootIds: [parent.id],
    entities: Object.fromEntries([parent, ...children].map((item) => [item.id, item])),
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
