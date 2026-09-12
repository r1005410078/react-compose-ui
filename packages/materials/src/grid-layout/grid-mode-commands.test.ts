import { describe, expect, it } from 'vitest'
import {
  createComposeFrame,
  createComposeGridItem,
  createDefaultCanvasSettings,
  createDefaultComposeFlexLayout,
  createDefaultComposeGridLayout,
  createDefaultComposeLayoutItem,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeGridItem,
  type ComposeLayoutSnapshot,
  type EditorCommand,
} from '@compose-ui/core'
import {
  planEnableComposeGridLayout,
  planRemoveComposeGridLayout,
  planSwitchComposeLayoutType,
} from './grid-mode-commands'

const LAYOUT = createDefaultComposeGridLayout()
/** 容器宽 752、边框 0、内边距 16 → 内容宽 720 → 列步长 60.5；行步长 54。 */
const COLUMN_STEP = 60.5
const ROW_STEP = 54
const ORIGIN = { x: 16, y: 16 }

let nextId = 0
const idFactory = () => `cmd-${nextId += 1}`

function make(id: string, components: Record<string, unknown>, presetId = 'container'): ComposeEntity {
  return {
    id,
    name: id,
    components: {
      Composition: { presetId, baseComponentKeys: Object.keys(components), capabilityIds: [] },
      ...components,
    },
  } as ComposeEntity
}

function container(childIds: readonly string[], layout?: unknown) {
  return make('grid', {
    Transform: { rotation: 0 },
    LayoutItem: {
      ...createDefaultComposeLayoutItem(),
      positioning: 'absolute',
      offset: { x: 0, y: 0 },
      width: { mode: 'fixed', value: 752, min: null, max: null },
      height: { mode: 'fixed', value: 400, min: null, max: null },
    },
    Visibility: { visible: true },
    Lock: { locked: false },
    Hierarchy: { childIds },
    Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' }, borderWidth: 0 },
    ...(layout ? { Layout: layout } : {}),
  })
}

function child(id: string, extra: Record<string, unknown> = {}, locked = false) {
  return make(id, {
    Transform: { rotation: 0 },
    LayoutItem: {
      ...createDefaultComposeLayoutItem(),
      positioning: 'absolute',
      offset: { x: 0, y: 0 },
      width: { mode: 'fixed', value: 100, min: null, max: null },
      height: { mode: 'fixed', value: 50, min: null, max: null },
    },
    Visibility: { visible: true },
    Lock: { locked },
    Renderer: { type: 'rectangle', props: {} },
    Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' }, borderWidth: 0 },
    ...extra,
  }, 'rectangle')
}

function frame(childIds: readonly string[]) {
  return make('root', {
    Transform: { rotation: 0 },
    LayoutItem: {
      ...createDefaultComposeLayoutItem(),
      positioning: 'absolute',
      offset: { x: 0, y: 0 },
      width: { mode: 'fixed', value: 1280, min: null, max: null },
      height: { mode: 'fixed', value: 720, min: null, max: null },
    },
    Visibility: { visible: true },
    Lock: { locked: false },
    Hierarchy: { childIds },
    Frame: createComposeFrame({ width: 1280, height: 720 }),
    Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' }, borderWidth: 0 },
  }, 'frame')
}

function documentOf(entities: readonly ComposeEntity[]): ComposeDocument {
  return {
    schemaVersion: 7,
    canvas: createDefaultCanvasSettings(),
    rootIds: ['root'],
    entities: Object.fromEntries(entities.map((item) => [item.id, item])),
  } as unknown as ComposeDocument
}

function snapshotOf(boxes: Record<string, { x: number; y: number; width: number; height: number }>) {
  return {
    revision: 1,
    boxes: Object.fromEntries(Object.entries(boxes).map(([id, box]) => [
      id,
      { ...box, positioning: 'absolute' },
    ])),
    diagnostics: [],
  } as unknown as ComposeLayoutSnapshot
}

function subCommands(command: EditorCommand): readonly EditorCommand[] {
  return (command.payload as { commands?: readonly EditorCommand[] }).commands ?? [command]
}

function gridWrites(command: EditorCommand) {
  return subCommands(command)
    .filter((item) => (item.payload as { key?: string }).key === 'GridItem')
    .map((item) => item.payload as { entityId: string; value: ComposeGridItem })
}

describe('OpenSpec: basic-materials / 网格按需启用', () => {
  it('单事务启用网格并把子项就近落格', () => {
    // a 在第 0 行第 0 列，b 视觉上在第 4 列——落格后应各自落在那里。
    const document = documentOf([frame(['grid']), container(['a', 'b']), child('a'), child('b')])
    const snapshot = snapshotOf({
      root: { x: 0, y: 0, width: 1280, height: 720 },
      grid: { x: 0, y: 0, width: 752, height: 400 },
      a: { x: ORIGIN.x, y: ORIGIN.y, width: 4 * COLUMN_STEP - 6, height: 2 * ROW_STEP - 6 },
      b: { x: ORIGIN.x + 4 * COLUMN_STEP, y: ORIGIN.y, width: 4 * COLUMN_STEP - 6, height: 2 * ROW_STEP - 6 },
    })
    const plan = planEnableComposeGridLayout(document, 'grid', snapshot, idFactory)
    expect(plan.ok).toBe(true)
    if (!plan.ok) return

    expect(plan.command.type).toBe('transaction.batch')
    const sub = subCommands(plan.command)
    expect(sub[0]).toMatchObject({ type: 'entity.component.add', payload: { key: 'Layout' } })
    // 子项转 Flow。
    const layoutItems = sub.filter((item) => (item.payload as { key?: string }).key === 'LayoutItem')
    expect(layoutItems).toHaveLength(2)
    layoutItems.forEach((item) => {
      expect((item.payload as { value: { positioning: string } }).value.positioning).toBe('flow')
    })
    // 就近落格。
    const writes = gridWrites(plan.command)
    expect(writes.find((item) => item.entityId === 'a')?.value).toMatchObject({ x: 0, y: 0, w: 4, h: 2 })
    expect(writes.find((item) => item.entityId === 'b')?.value).toMatchObject({ x: 4, y: 0, w: 4, h: 2 })
  })

  it('落格碰撞由求解器一并解开', () => {
    // 两个子项视觉上重叠在同一片格子上。
    const document = documentOf([frame(['grid']), container(['a', 'b']), child('a'), child('b')])
    const box = { x: ORIGIN.x, y: ORIGIN.y, width: 6 * COLUMN_STEP - 6, height: 2 * ROW_STEP - 6 }
    const plan = planEnableComposeGridLayout(document, 'grid', snapshotOf({
      root: { x: 0, y: 0, width: 1280, height: 720 },
      grid: { x: 0, y: 0, width: 752, height: 400 },
      a: box,
      b: box,
    }), idFactory)
    if (!plan.ok) throw new Error('期望规划成功')
    const writes = gridWrites(plan.command)
    const ys = writes.map((item) => item.value.y).sort()
    expect(ys).toEqual([0, 2])
  })

  it('任一子项锁定时不生成命令', () => {
    const document = documentOf([frame(['grid']), container(['a']), child('a', {}, true)])
    const plan = planEnableComposeGridLayout(document, 'grid', snapshotOf({
      root: { x: 0, y: 0, width: 1280, height: 720 },
      grid: { x: 0, y: 0, width: 752, height: 400 },
      a: { x: 16, y: 16, width: 100, height: 50 },
    }), idFactory)
    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.issue.code).toBe('grid.child-locked')
  })

  it('已经有布局时拒绝', () => {
    const document = documentOf([
      frame(['grid']),
      container([], createDefaultComposeFlexLayout()),
    ])
    const plan = planEnableComposeGridLayout(document, 'grid', snapshotOf({
      root: { x: 0, y: 0, width: 1280, height: 720 },
      grid: { x: 0, y: 0, width: 752, height: 400 },
    }), idFactory)
    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.issue.code).toBe('grid.already-enabled')
  })

  it('移除网格时烘焙几何并删掉全部 GridItem', () => {
    const document = documentOf([
      frame(['grid']),
      container(['a'], LAYOUT),
      child('a', {
        LayoutItem: { ...createDefaultComposeLayoutItem(), positioning: 'flow' },
        GridItem: createComposeGridItem(4, 0, 4, 2),
      }),
    ])
    const plan = planRemoveComposeGridLayout(document, 'grid', snapshotOf({
      root: { x: 0, y: 0, width: 1280, height: 720 },
      grid: { x: 0, y: 0, width: 752, height: 400 },
      a: { x: 258, y: 16, width: 236, height: 102 },
    }), idFactory)
    if (!plan.ok) throw new Error('期望规划成功')
    const sub = subCommands(plan.command)
    const layoutItem = sub.find((item) => (item.payload as { key?: string }).key === 'LayoutItem')!
    const value = (layoutItem.payload as { value: Record<string, unknown> }).value
    expect(value).toMatchObject({ positioning: 'absolute', offset: { x: 258, y: 16 } })
    // 轴尺寸必须烘成 fixed：格中子级的模式在求解里被忽略，脱离网格后必须有确定尺寸。
    expect((value.width as { mode: string; value: number })).toMatchObject({ mode: 'fixed', value: 236 })
    expect(sub.some((item) => item.type === 'entity.component.remove'
      && (item.payload as { key?: string }).key === 'GridItem')).toBe(true)
    expect(sub.some((item) => item.type === 'entity.component.remove'
      && (item.payload as { key?: string }).key === 'Layout')).toBe(true)
  })
})

describe('OpenSpec: basic-materials / 网格按需启用 / 切换布局类型', () => {
  it('切到自动布局删掉全部格坐标，一条事务', () => {
    const document = documentOf([
      frame(['grid']),
      container(['a'], LAYOUT),
      child('a', {
        LayoutItem: { ...createDefaultComposeLayoutItem(), positioning: 'flow' },
        GridItem: createComposeGridItem(4, 0, 4, 2),
      }),
    ])
    const plan = planSwitchComposeLayoutType(document, 'grid', 'flex', undefined, idFactory)
    if (!plan.ok) throw new Error('期望规划成功')
    expect(plan.command.type).toBe('transaction.batch')
    const sub = subCommands(plan.command)
    expect((sub[0]!.payload as { value: { type: string } }).value.type).toBe('flex')
    expect(sub.some((item) => item.type === 'entity.component.remove'
      && (item.payload as { key?: string }).key === 'GridItem')).toBe(true)
  })

  it('切到网格按当前视觉位置落格，一条事务', () => {
    const document = documentOf([
      frame(['grid']),
      container(['a'], createDefaultComposeFlexLayout()),
      child('a', { LayoutItem: { ...createDefaultComposeLayoutItem(), positioning: 'flow' } }),
    ])
    const plan = planSwitchComposeLayoutType(document, 'grid', 'grid', snapshotOf({
      root: { x: 0, y: 0, width: 1280, height: 720 },
      grid: { x: 0, y: 0, width: 752, height: 400 },
      a: { x: ORIGIN.x + 4 * COLUMN_STEP, y: ORIGIN.y, width: 4 * COLUMN_STEP - 6, height: 2 * ROW_STEP - 6 },
    }), idFactory)
    if (!plan.ok) throw new Error('期望规划成功')
    expect(plan.command.type).toBe('transaction.batch')
    expect(gridWrites(plan.command).find((item) => item.entityId === 'a')?.value)
      .toMatchObject({ x: 4, y: 0, w: 4, h: 2 })
  })

  it('目标类型与当前一致时拒绝', () => {
    const document = documentOf([frame(['grid']), container([], LAYOUT)])
    const plan = planSwitchComposeLayoutType(document, 'grid', 'grid', undefined, idFactory)
    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.issue.code).toBe('grid.already-enabled')
  })
})
