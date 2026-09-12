import { describe, expect, it } from 'vitest'
import {
  composeGridColumnWidth,
  createComposeGridItem,
  createDefaultComposeGridLayout,
  createDefaultComposeLayoutItem,
  createComposeFrame,
  projectComposeGridCell,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeGridItem,
  type ComposeGridLayout,
  type ComposeGridMetrics,
  type ComposeLayoutSnapshot,
  type EditorCommand,
} from '@compose-ui/core'
import { createStageSceneIndex } from '../hit-testing'
import { planMoveCommit, planMovePreview } from './move-planning'
import { planTransformCommit } from './transform-planning'
import type { StageInteractionContext } from '../interaction-controller'

const LAYOUT: ComposeGridLayout = { ...createDefaultComposeGridLayout(), float: true }
const CONTENT_WIDTH = 720
const METRICS: ComposeGridMetrics = {
  columns: LAYOUT.columns,
  rowHeight: LAYOUT.rowHeight,
  rowGap: LAYOUT.rowGap,
  columnGap: LAYOUT.columnGap,
  contentWidth: CONTENT_WIDTH,
}
const COLUMN_STEP = composeGridColumnWidth(METRICS) + LAYOUT.columnGap
const ROW_STEP = LAYOUT.rowHeight + LAYOUT.rowGap
/** 边框 0，因此内容原点就是内边距。 */
const ORIGIN = { x: LAYOUT.padding.left, y: LAYOUT.padding.top }

function baseComponents(components: Record<string, unknown>, presetId: string) {
  return {
    Composition: { presetId, baseComponentKeys: Object.keys(components), capabilityIds: [] },
    ...components,
  }
}

function gridContainer(id: string, childIds: readonly string[], layout = LAYOUT): ComposeEntity {
  const components = {
    Transform: { rotation: 0 },
    LayoutItem: {
      ...createDefaultComposeLayoutItem(),
      positioning: 'absolute',
      offset: { x: 0, y: 0 },
      width: { mode: 'fixed', value: 752, min: null, max: null },
      height: { mode: 'fixed', value: 600, min: null, max: null },
    },
    Visibility: { visible: true },
    Lock: { locked: false },
    Hierarchy: { childIds },
    Layout: layout,
    Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' }, borderWidth: 0 },
  }
  return { id, name: id, components: baseComponents(components, 'container') } as ComposeEntity
}

function gridCard(id: string, grid: ComposeGridItem): ComposeEntity {
  const components = {
    Transform: { rotation: 0 },
    LayoutItem: { ...createDefaultComposeLayoutItem(), positioning: 'flow' },
    Visibility: { visible: true },
    Lock: { locked: false },
    Renderer: { type: 'rectangle', props: {} },
    Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' }, borderWidth: 0 },
    GridItem: grid,
  }
  return { id, name: id, components: baseComponents(components, 'rectangle') } as ComposeEntity
}

function looseCard(id: string, x: number, y: number): ComposeEntity {
  const components = {
    Transform: { rotation: 0 },
    LayoutItem: {
      ...createDefaultComposeLayoutItem(),
      positioning: 'absolute',
      offset: { x, y },
      width: { mode: 'fixed', value: 120, min: null, max: null },
      height: { mode: 'fixed', value: 60, min: null, max: null },
    },
    Visibility: { visible: true },
    Lock: { locked: false },
    Renderer: { type: 'rectangle', props: {} },
    Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' }, borderWidth: 0 },
  }
  return { id, name: id, components: baseComponents(components, 'rectangle') } as ComposeEntity
}

function frameRoot(childIds: readonly string[]): ComposeEntity {
  const components = {
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
  }
  return { id: 'root', name: 'root', components: baseComponents(components, 'frame') } as ComposeEntity
}

/** 手工搭一份「已经解算过」的快照：格矩形 + 容器盒，与 Layout Runtime 的产出同形。 */
function scene(entities: readonly ComposeEntity[], gridId = 'grid') {
  const doc = {
    schemaVersion: 7,
    canvas: {
      grid: { stepX: 8, stepY: 8, offsetX: 0, offsetY: 0, primaryLineEvery: 5, snapEnabled: false },
      smartSnap: { nodes: false, guides: false },
    },
    rootIds: ['root'],
    entities: Object.fromEntries(entities.map((item) => [item.id, item])),
  } as unknown as ComposeDocument

  const boxes: Record<string, unknown> = {}
  entities.forEach((item) => {
    const grid = item.components.GridItem as ComposeGridItem | undefined
    const layoutItem = item.components.LayoutItem as { offset: { x: number; y: number }; width: { value: number }; height: { value: number }; positioning: string }
    if (grid) {
      const rect = projectComposeGridCell(grid, METRICS)
      boxes[item.id] = {
        x: ORIGIN.x + rect.x,
        y: ORIGIN.y + rect.y,
        width: rect.width,
        height: rect.height,
        positioning: 'flow',
      }
      return
    }
    boxes[item.id] = {
      x: layoutItem.offset.x,
      y: layoutItem.offset.y,
      width: layoutItem.width.value,
      height: layoutItem.height.value,
      positioning: layoutItem.positioning,
    }
  })
  const snapshot = { revision: 1, boxes, diagnostics: [] } as unknown as ComposeLayoutSnapshot
  return { doc, snapshot, index: createStageSceneIndex(doc, snapshot), gridId }
}

function contextFor(doc: ComposeDocument, snapshot: ComposeLayoutSnapshot, selectedIds: readonly string[]) {
  return {
    document: doc,
    layoutSnapshot: snapshot,
    viewport: { x: 0, y: 0, zoom: 1 },
    surfaceSize: { width: 1280, height: 720 },
    tool: 'select',
    selectedIds,
    idFactory: () => 'cmd',
  } as unknown as StageInteractionContext
}

/** 把 batch 命令摊成子命令，断言起来比嵌套 payload 好读。 */
function subCommands(command: EditorCommand): readonly EditorCommand[] {
  const payload = command.payload as { commands?: readonly EditorCommand[] }
  return payload.commands ?? [command]
}

function gridWrites(command: EditorCommand) {
  return subCommands(command)
    .filter((item) => (item.payload as { key?: string }).key === 'GridItem')
    .map((item) => item.payload as { entityId: string; value: ComposeGridItem })
}

/** 格 (x, y) 的左上角世界坐标。 */
function cellOrigin(x: number, y: number) {
  const rect = projectComposeGridCell({ x, y, w: 1, h: 1 }, METRICS)
  return { x: ORIGIN.x + rect.x, y: ORIGIN.y + rect.y }
}

describe('OpenSpec: stage-engine / 网格容器内的拖动与缩放规划', () => {
  const build = () => scene([
    frameRoot(['grid']),
    gridContainer('grid', ['a', 'trend', 'list']),
    gridCard('a', createComposeGridItem(0, 0, 4, 2)),
    gridCard('trend', createComposeGridItem(0, 2, 7, 2)),
    gridCard('list', createComposeGridItem(7, 2, 5, 2)),
  ])

  function dragTo(ids: readonly string[], target: { x: number; y: number }) {
    const { doc, snapshot, index } = build()
    const from = snapshot.boxes[ids[0]!]!
    const to = cellOrigin(target.x, target.y)
    const delta = { x: to.x - from.x, y: to.y - from.y }
    const preview = planMovePreview({
      context: contextFor(doc, snapshot, ids),
      index,
      ids,
      bounds: { x: from.x, y: from.y, width: from.width, height: from.height },
      startWorld: { x: from.x + 5, y: from.y + 5 },
      world: { x: from.x + 5 + delta.x, y: from.y + 5 + delta.y },
      zoom: 1,
      modifiers: { shift: false, alt: false, command: false },
      parentLocked: false,
    } as Parameters<typeof planMovePreview>[0])
    return { doc, snapshot, index, preview }
  }

  it('落点解算成格坐标而不是像素', () => {
    const { preview } = dragTo(['a'], { x: 4, y: 0 })
    expect(preview.dropTarget).toEqual({ kind: 'grid-cell', containerId: 'grid', x: 4, y: 0 })
  })

  it('落点取被拖盒的左上角而不是指针', () => {
    // 抓在卡片中心往右拖一格：按指针算会多跑出若干格，按盒左上角算恰好是第 1 格。
    const { doc, snapshot, index } = build()
    const box = snapshot.boxes.a!
    const preview = planMovePreview({
      context: contextFor(doc, snapshot, ['a']),
      index,
      ids: ['a'],
      bounds: { x: box.x, y: box.y, width: box.width, height: box.height },
      startWorld: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      world: { x: box.x + box.width / 2 + COLUMN_STEP, y: box.y + box.height / 2 },
      zoom: 1,
      modifiers: { shift: false, alt: false, command: false },
      parentLocked: false,
    } as Parameters<typeof planMovePreview>[0])
    expect(preview.dropTarget).toMatchObject({ kind: 'grid-cell', x: 1, y: 0 })
  })

  it('拖动写格坐标，不写 LayoutItem.offset', () => {
    const { doc, snapshot, index, preview } = dragTo(['a'], { x: 8, y: 0 })
    const effect = planMoveCommit({
      document: doc,
      layoutSnapshot: snapshot,
      index,
      ids: ['a'],
      transforms: preview.transforms,
      dropTarget: preview.dropTarget,
      idFactory: () => 'cmd',
    })
    expect(effect?.type).toBe('command.dispatch')
    const writes = gridWrites(effect!.command)
    expect(writes.find((item) => item.entityId === 'a')?.value).toMatchObject({ x: 8, y: 0 })
    // 位置的事实来源是格坐标；写 offset 会造出第二份事实。
    expect(subCommands(effect!.command).some((item) =>
      (item.payload as { key?: string }).key === 'LayoutItem')).toBe(false)
  })

  it('推挤与目标写在同一条事务', () => {
    // 把 a 拖到 trend 头上：trend 被推下去，两者同属一条 batch。
    const { doc, snapshot, index, preview } = dragTo(['a'], { x: 0, y: 2 })
    const effect = planMoveCommit({
      document: doc,
      layoutSnapshot: snapshot,
      index,
      ids: ['a'],
      transforms: preview.transforms,
      dropTarget: preview.dropTarget,
      idFactory: () => 'cmd',
    })
    const writes = gridWrites(effect!.command)
    expect(writes.find((item) => item.entityId === 'a')?.value).toMatchObject({ x: 0, y: 2 })
    expect(writes.find((item) => item.entityId === 'trend')?.value).toMatchObject({ y: 4 })
    // 一条命令，因此一次撤销两者同时回去。
    expect(effect!.command.type).toBe('transaction.batch')
    // 没被压住的一动不动。
    expect(writes.some((item) => item.entityId === 'list')).toBe(false)
  })

  it('落点钳制在列范围内', () => {
    // 4 格宽的卡拖到 12 列网格最右侧之外，落点最多到第 8 格。
    const { preview } = dragTo(['a'], { x: 11, y: 0 })
    expect(preview.dropTarget).toMatchObject({ kind: 'grid-cell', x: 8 })
  })

  it('缩放吸到格线并写格跨度', () => {
    const { doc, snapshot, index } = build()
    const box = snapshot.boxes.trend!
    // 东手柄往右拖到第 8 格宽与第 9 格宽之间，略偏 8。
    const effect = planTransformCommit({
      document: doc,
      layoutSnapshot: snapshot,
      index,
      finished: {
        type: 'resize',
        handle: 'e',
        transforms: {
          trend: {
            x: box.x,
            y: box.y,
            width: 8 * COLUMN_STEP - LAYOUT.columnGap + 4,
            height: box.height,
            rotation: 0,
          },
        },
      },
      idFactory: () => 'cmd',
    } as Parameters<typeof planTransformCommit>[0])
    const writes = gridWrites(effect!.command)
    expect(writes.find((item) => item.entityId === 'trend')?.value).toMatchObject({ w: 8, h: 2 })
  })

  it('缩放同样推挤', () => {
    const { doc, snapshot, index } = build()
    const box = snapshot.boxes.trend!
    const effect = planTransformCommit({
      document: doc,
      layoutSnapshot: snapshot,
      index,
      finished: {
        type: 'resize',
        handle: 'e',
        transforms: {
          trend: {
            x: box.x,
            y: box.y,
            width: 8 * COLUMN_STEP - LAYOUT.columnGap,
            height: box.height,
            rotation: 0,
          },
        },
      },
      idFactory: () => 'cmd',
    } as Parameters<typeof planTransformCommit>[0])
    // 拉宽到 8 格挡住了 list（7..12 列），它被推到下一行。
    expect(gridWrites(effect!.command).find((item) => item.entityId === 'list')?.value)
      .toMatchObject({ y: 4 })
  })

  it('缩放尊重最小跨度', () => {
    const { doc, snapshot, index } = scene([
      frameRoot(['grid']),
      gridContainer('grid', ['a']),
      gridCard('a', { x: 0, y: 0, w: 6, h: 2, minW: 3 }),
    ])
    const box = snapshot.boxes.a!
    const effect = planTransformCommit({
      document: doc,
      layoutSnapshot: snapshot,
      index,
      finished: {
        type: 'resize',
        handle: 'e',
        transforms: { a: { x: box.x, y: box.y, width: COLUMN_STEP, height: box.height, rotation: 0 } },
      },
      idFactory: () => 'cmd',
    } as Parameters<typeof planTransformCommit>[0])
    expect(gridWrites(effect!.command).find((item) => item.entityId === 'a')?.value)
      .toMatchObject({ w: 3 })
  })

  it('拖进网格容器时写入 GridItem 并转 Flow', () => {
    const { doc, snapshot, index } = scene([
      frameRoot(['grid', 'loose']),
      gridContainer('grid', ['a']),
      gridCard('a', createComposeGridItem(0, 0, 4, 2)),
      looseCard('loose', 800, 400),
    ])
    const effect = planMoveCommit({
      document: doc,
      layoutSnapshot: snapshot,
      index,
      ids: ['loose'],
      transforms: {},
      dropTarget: { kind: 'grid-cell', containerId: 'grid', x: 4, y: 0 },
      idFactory: () => 'cmd',
    })
    const sub = subCommands(effect!.command)
    expect(sub.find((item) => (item.payload as { key?: string }).key === 'GridItem'))
      .toMatchObject({ type: 'entity.component.add', payload: { entityId: 'loose' } })
    const layoutItem = sub.find((item) => (item.payload as { key?: string }).key === 'LayoutItem')
    expect((layoutItem!.payload as { value: { positioning: string } }).value.positioning).toBe('flow')
  })

  it('拖出网格容器时删除 GridItem', () => {
    const { doc, snapshot, index } = scene([
      frameRoot(['grid', 'box']),
      gridContainer('grid', ['a']),
      gridCard('a', createComposeGridItem(0, 0, 4, 2)),
      { ...looseCard('box', 800, 100), components: {
        ...looseCard('box', 800, 100).components,
        Hierarchy: { childIds: [] },
      } } as ComposeEntity,
    ])
    const effect = planMoveCommit({
      document: doc,
      layoutSnapshot: snapshot,
      index,
      ids: ['a'],
      transforms: {},
      dropTarget: { kind: 'reparent', containerId: 'box' },
      idFactory: () => 'cmd',
    })
    expect(subCommands(effect!.command).some((item) =>
      item.type === 'entity.component.remove'
      && (item.payload as { key?: string }).key === 'GridItem')).toBe(true)
  })

  it('落点没有变化时不产生事务', () => {
    const { doc, snapshot, index } = build()
    const effect = planMoveCommit({
      document: doc,
      layoutSnapshot: snapshot,
      index,
      ids: ['a'],
      transforms: {},
      dropTarget: { kind: 'grid-cell', containerId: 'grid', x: 0, y: 0 },
      idFactory: () => 'cmd',
    })
    expect(effect).toBeNull()
  })
})
