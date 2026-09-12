import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  composeGridColumnWidth,
  createComposeFrame,
  createComposeGridItem,
  createDefaultComposeGridLayout,
  createDefaultComposeLayoutItem,
  projectComposeGridCell,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeGridItem,
  type ComposeGridMetrics,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import { createStageSceneIndex } from '@compose-ui/stage-engine'
import { resolveStageGridLines } from './stage-grid-lines'
import { StageGridLinesLayer } from './stage-grid-lines-layer'

const LAYOUT = createDefaultComposeGridLayout()
const METRICS: ComposeGridMetrics = {
  columns: LAYOUT.columns,
  rowHeight: LAYOUT.rowHeight,
  rowGap: LAYOUT.rowGap,
  columnGap: LAYOUT.columnGap,
  contentWidth: 720,
}
const COLUMN_STEP = composeGridColumnWidth(METRICS) + LAYOUT.columnGap
const VIEWPORT = { x: 0, y: 0, zoom: 1 }

function withComponents(id: string, components: Record<string, unknown>, presetId: string) {
  return {
    id,
    name: id,
    components: {
      Composition: { presetId, baseComponentKeys: Object.keys(components), capabilityIds: [] },
      ...components,
    },
  } as ComposeEntity
}

function grid(childIds: readonly string[], columns = LAYOUT.columns) {
  return withComponents('grid', {
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
    Layout: { ...LAYOUT, columns },
    Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' }, borderWidth: 0 },
  }, 'container')
}

function card(id: string, item: ComposeGridItem) {
  return withComponents(id, {
    Transform: { rotation: 0 },
    LayoutItem: { ...createDefaultComposeLayoutItem(), positioning: 'flow' },
    Visibility: { visible: true },
    Lock: { locked: false },
    Renderer: { type: 'rectangle', props: {} },
    Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' }, borderWidth: 0 },
    GridItem: item,
  }, 'rectangle')
}

function plain(id: string) {
  return withComponents(id, {
    Transform: { rotation: 0 },
    LayoutItem: {
      ...createDefaultComposeLayoutItem(),
      positioning: 'absolute',
      offset: { x: 0, y: 0 },
      width: { mode: 'fixed', value: 100, min: null, max: null },
      height: { mode: 'fixed', value: 100, min: null, max: null },
    },
    Visibility: { visible: true },
    Lock: { locked: false },
    Hierarchy: { childIds: [] },
    Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' }, borderWidth: 0 },
  }, 'container')
}

function frame(childIds: readonly string[]) {
  return withComponents('root', {
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

function indexFor(entities: readonly ComposeEntity[]) {
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
  entities.forEach((entity) => {
    const item = entity.components.GridItem as ComposeGridItem | undefined
    const layoutItem = entity.components.LayoutItem as {
      offset: { x: number; y: number }
      width: { value: number }
      height: { value: number }
    }
    if (item) {
      const rect = projectComposeGridCell(item, METRICS)
      boxes[entity.id] = {
        x: LAYOUT.padding.left + rect.x,
        y: LAYOUT.padding.top + rect.y,
        width: rect.width,
        height: rect.height,
        positioning: 'flow',
      }
      return
    }
    boxes[entity.id] = {
      x: layoutItem.offset.x,
      y: layoutItem.offset.y,
      width: layoutItem.width.value,
      height: layoutItem.height.value,
      positioning: 'absolute',
    }
  })
  const snapshot = { revision: 1, boxes, diagnostics: [] } as unknown as ComposeLayoutSnapshot
  return createStageSceneIndex(doc, snapshot)
}

describe('OpenSpec: stage / 网格容器的画布反馈', () => {
  it('格线与预解算出自同一份列宽', () => {
    const lines = resolveStageGridLines(
      indexFor([frame(['grid']), grid(['a']), card('a', createComposeGridItem(0, 0, 4, 2))]),
      'grid',
      VIEWPORT,
    )
    expect(lines).not.toBeNull()
    expect(lines!.columns).toHaveLength(12)
    // 第 4 条列带的左边等于四个列步长——与 projectComposeGridCell 给卡片的位置同源。
    expect(lines!.columns[4]!.x).toBeCloseTo(LAYOUT.padding.left + 4 * COLUMN_STEP, 5)
    expect(lines!.columns[0]!.width).toBeCloseTo(composeGridColumnWidth(METRICS), 5)
  })

  it('最后一列的右边缘落在内容盒右边', () => {
    const lines = resolveStageGridLines(
      indexFor([frame(['grid']), grid([])]),
      'grid',
      VIEWPORT,
    )!
    const last = lines.columns[11]!
    expect(last.x + last.width).toBeCloseTo(LAYOUT.padding.left + METRICS.contentWidth, 5)
  })

  it('列数改变时格线跟着改', () => {
    const lines = resolveStageGridLines(
      indexFor([frame(['grid']), grid([], 8)]),
      'grid',
      VIEWPORT,
    )!
    expect(lines.columns).toHaveLength(8)
  })

  it('行数跟着最下面那张卡，且空网格仍画出几行', () => {
    const many = resolveStageGridLines(
      indexFor([frame(['grid']), grid(['a']), card('a', createComposeGridItem(0, 6, 4, 2))]),
      'grid',
      VIEWPORT,
    )!
    // 8 行 → 7 条分隔线。
    expect(many.rows).toHaveLength(7)
    const empty = resolveStageGridLines(indexFor([frame(['grid']), grid([])]), 'grid', VIEWPORT)!
    // 空板子上一条线都不画等于没画，因此有下限。
    expect(empty.rows.length).toBeGreaterThan(0)
  })

  it('缩放作用在格线上', () => {
    const zoomed = resolveStageGridLines(
      indexFor([frame(['grid']), grid([])]),
      'grid',
      { x: 0, y: 0, zoom: 2 },
    )!
    const base = resolveStageGridLines(indexFor([frame(['grid']), grid([])]), 'grid', VIEWPORT)!
    expect(zoomed.columns[0]!.width).toBeCloseTo(base.columns[0]!.width * 2, 5)
  })

  it('不是网格容器时给出 null', () => {
    expect(resolveStageGridLines(indexFor([frame(['plain']), plain('plain')]), 'plain', VIEWPORT))
      .toBeNull()
  })

  it('渲染层按容器分组，静息时什么都不画', () => {
    const lines = resolveStageGridLines(
      indexFor([frame(['grid']), grid([])]),
      'grid',
      VIEWPORT,
    )!
    const { rerender } = render(<svg><StageGridLinesLayer lines={[lines]} /></svg>)
    expect(screen.getByTestId('stage-grid-lines-grid')).toBeInTheDocument()
    rerender(<svg><StageGridLinesLayer lines={[]} /></svg>)
    expect(screen.queryByTestId('stage-grid-lines-grid')).not.toBeInTheDocument()
  })
})
