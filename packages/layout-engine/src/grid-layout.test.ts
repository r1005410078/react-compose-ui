import {
  createComposeFrame,
  createComposeGridItem,
  createDefaultCanvasSettings,
  createDefaultComposeGridLayout,
  createDefaultComposeLayoutItem,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeGridItem,
  type ComposeGridLayout,
  type ComposeLayoutItem,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { resolveComposeDocumentLayout } from './layout-runtime'

/** 网格容器：边框 0，让内容盒宽等于容器宽，断言里的算术才能一眼核对。 */
function gridContainer(
  id: string,
  childIds: readonly string[],
  layout: Partial<ComposeGridLayout>,
  heightMode: ComposeLayoutItem['height']['mode'] = 'hug',
): ComposeEntity {
  const components = {
    Transform: { rotation: 0 },
    LayoutItem: {
      ...createDefaultComposeLayoutItem(),
      positioning: 'absolute',
      offset: { x: 0, y: 0 },
      width: { mode: 'fixed', value: 752, min: null, max: null },
      height: { mode: heightMode, value: 400, min: null, max: null },
    } as ComposeLayoutItem,
    Visibility: { visible: true },
    Lock: { locked: false },
    Hierarchy: { childIds },
    Layout: { ...createDefaultComposeGridLayout(), ...layout },
    Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' }, borderWidth: 0 },
  } as const
  return {
    id,
    name: id,
    components: {
      Composition: { presetId: 'container', baseComponentKeys: Object.keys(components), capabilityIds: [] },
      ...components,
    },
  }
}

function card(id: string, grid: ComposeGridItem | undefined): ComposeEntity {
  const components = {
    Transform: { rotation: 0 },
    LayoutItem: {
      ...createDefaultComposeLayoutItem(),
      positioning: 'flow',
      // 刻意给一个与格矩形无关的固定尺寸：格中子级的轴尺寸不得参与求解。
      width: { mode: 'fixed', value: 999, min: null, max: null },
      height: { mode: 'fixed', value: 999, min: null, max: null },
    } as ComposeLayoutItem,
    Visibility: { visible: true },
    Lock: { locked: false },
    Renderer: { type: 'rectangle', props: {} },
    Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' }, borderWidth: 0 },
    ...(grid ? { GridItem: grid } : {}),
  } as const
  return {
    id,
    name: id,
    components: {
      Composition: { presetId: 'rectangle', baseComponentKeys: Object.keys(components), capabilityIds: [] },
      ...components,
    },
  }
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
    } as ComposeLayoutItem,
    Visibility: { visible: true },
    Lock: { locked: false },
    Hierarchy: { childIds },
    Frame: createComposeFrame({ width: 1280, height: 720 }),
    Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' } },
  } as const
  return {
    id: 'frame-root',
    name: 'frame-root',
    components: {
      Composition: { presetId: 'frame', baseComponentKeys: Object.keys(components), capabilityIds: [] },
      ...components,
    },
  }
}

function documentWith(entities: Record<string, ComposeEntity>): ComposeDocument {
  return {
    schemaVersion: 7,
    canvas: createDefaultCanvasSettings(),
    rootIds: ['frame-root'],
    entities,
  } as unknown as ComposeDocument
}

/** 12 列、内边距 16、间距 6、容器宽 752 → 内容宽 720 → 列宽 54.5、列步长 60.5。 */
const COLUMN_STEP = 60.5
const ROW_STEP = 54

async function solve(entities: Record<string, ComposeEntity>) {
  return resolveComposeDocumentLayout(documentWith(entities))
}

describe('OpenSpec: layout-engine / 网格容器的预解算', () => {
  it('格坐标解成绝对矩形，与 flex 子级同形', async () => {
    const snapshot = await solve({
      'frame-root': frameRoot(['grid']),
      grid: gridContainer('grid', ['a'], {}),
      a: card('a', createComposeGridItem(4, 0, 4, 2)),
    })
    const box = snapshot.boxes.a!
    // 左边 = 容器 x + 内边距 16 + 四个列步长。
    expect(box.x).toBeCloseTo(16 + 4 * COLUMN_STEP, 5)
    expect(box.width).toBeCloseTo(4 * COLUMN_STEP - 6, 5)
    expect(box.height).toBeCloseTo(2 * ROW_STEP - 6, 5)
    // 与 flex 子级同形：订阅方不需要区分两者。
    expect(Object.keys(box).sort()).toEqual(['height', 'positioning', 'width', 'x', 'y'])
  })

  it('格中子级的轴尺寸模式被忽略而不是拒绝', async () => {
    const snapshot = await solve({
      'frame-root': frameRoot(['grid']),
      grid: gridContainer('grid', ['a', 'b'], {}),
      // fill / hug 在格中都无意义，必须既不生效也不让求解失败。
      a: {
        ...card('a', createComposeGridItem(0, 0, 3, 1)),
        components: {
          ...card('a', createComposeGridItem(0, 0, 3, 1)).components,
          LayoutItem: {
            ...createDefaultComposeLayoutItem(),
            positioning: 'flow',
            width: { mode: 'fill', value: 10, min: null, max: null },
            height: { mode: 'hug', value: 10, min: null, max: null },
          } as ComposeLayoutItem,
        },
      },
      b: card('b', createComposeGridItem(3, 0, 3, 1)),
    })
    expect(snapshot.boxes.a!.width).toBeCloseTo(3 * COLUMN_STEP - 6, 5)
    expect(snapshot.boxes.a!.height).toBeCloseTo(ROW_STEP - 6, 5)
    // 那个 999 的固定尺寸一个像素都不该生效。
    expect(snapshot.boxes.b!.width).not.toBeCloseTo(999, 1)
  })

  it('Hug 容器的高度由行数决定，删卡后收缩', async () => {
    const before = await solve({
      'frame-root': frameRoot(['grid']),
      grid: gridContainer('grid', ['a', 'b'], { float: true }),
      a: card('a', createComposeGridItem(0, 0, 4, 2)),
      b: card('b', createComposeGridItem(0, 4, 4, 2)),
    })
    // 6 行 + 上下内边距。
    expect(before.boxes.grid!.height).toBeCloseTo(6 * ROW_STEP - 6 + 32, 5)

    const after = await solve({
      'frame-root': frameRoot(['grid']),
      grid: gridContainer('grid', ['a'], { float: true }),
      a: card('a', createComposeGridItem(0, 0, 4, 2)),
    })
    expect(after.boxes.grid!.height).toBeCloseTo(2 * ROW_STEP - 6 + 32, 5)
  })

  it('空网格的 Hug 高度只剩内边距', async () => {
    const snapshot = await solve({
      'frame-root': frameRoot(['grid']),
      grid: gridContainer('grid', [], {}),
    })
    expect(snapshot.boxes.grid!.height).toBeCloseTo(32, 5)
  })

  it('Fixed 高度的网格容器不被内容改写', async () => {
    const snapshot = await solve({
      'frame-root': frameRoot(['grid']),
      grid: gridContainer('grid', ['a'], {}, 'fixed'),
      a: card('a', createComposeGridItem(0, 0, 4, 8)),
    })
    expect(snapshot.boxes.grid!.height).toBe(400)
  })

  it('容器变宽时列宽跟着变、格坐标与行高不变', async () => {
    const wide = await solve({
      'frame-root': frameRoot(['grid']),
      grid: {
        ...gridContainer('grid', ['a'], {}),
        components: {
          ...gridContainer('grid', ['a'], {}).components,
          LayoutItem: {
            ...createDefaultComposeLayoutItem(),
            positioning: 'absolute',
            offset: { x: 0, y: 0 },
            width: { mode: 'fixed', value: 932, min: null, max: null },
            height: { mode: 'hug', value: 400, min: null, max: null },
          } as ComposeLayoutItem,
        },
      },
      a: card('a', createComposeGridItem(0, 1, 4, 2)),
    })
    const narrow = await solve({
      'frame-root': frameRoot(['grid']),
      grid: gridContainer('grid', ['a'], {}),
      a: card('a', createComposeGridItem(0, 1, 4, 2)),
    })
    expect(wide.boxes.a!.width).toBeGreaterThan(narrow.boxes.a!.width)
    expect(wide.boxes.a!.y).toBeCloseTo(narrow.boxes.a!.y, 5)
    expect(wide.boxes.a!.height).toBeCloseTo(narrow.boxes.a!.height, 5)
  })

  it('推挤与重力在求解结果里生效', async () => {
    const snapshot = await solve({
      'frame-root': frameRoot(['grid']),
      grid: gridContainer('grid', ['a', 'b'], {}),
      // 两张卡都声明在第 0 行同一片格子上：b 被推到下一行，然后重力把它拉回紧贴 a 的下方。
      a: card('a', createComposeGridItem(0, 0, 6, 2)),
      b: card('b', createComposeGridItem(0, 0, 6, 2)),
    })
    const top = Math.min(snapshot.boxes.a!.y, snapshot.boxes.b!.y)
    const bottom = Math.max(snapshot.boxes.a!.y, snapshot.boxes.b!.y)
    expect(bottom - top).toBeCloseTo(2 * ROW_STEP, 5)
  })

  it('缺席 GridItem 的子级不参与网格求解', async () => {
    const snapshot = await solve({
      'frame-root': frameRoot(['grid']),
      grid: gridContainer('grid', ['a', 'loose'], {}),
      a: card('a', createComposeGridItem(0, 0, 4, 2)),
      loose: card('loose', undefined),
    })
    // 求解不失败，且它没有拿到格矩形的尺寸。
    expect(snapshot.boxes.loose).toBeDefined()
    expect(snapshot.boxes.a!.width).toBeCloseTo(4 * COLUMN_STEP - 6, 5)
  })

  it('父级不是网格容器时 GridItem 被忽略', async () => {
    const snapshot = await solve({
      'frame-root': frameRoot(['card']),
      // 直接挂在 Frame 下：Frame 没有 grid Layout，GridItem 不得生效也不得让求解失败。
      card: {
        ...card('card', createComposeGridItem(4, 4, 4, 2)),
        components: {
          ...card('card', createComposeGridItem(4, 4, 4, 2)).components,
          LayoutItem: {
            ...createDefaultComposeLayoutItem(),
            positioning: 'absolute',
            offset: { x: 30, y: 40 },
            width: { mode: 'fixed', value: 120, min: null, max: null },
            height: { mode: 'fixed', value: 60, min: null, max: null },
          } as ComposeLayoutItem,
        },
      },
    })
    expect(snapshot.boxes.card).toMatchObject({ x: 30, y: 40, width: 120, height: 60 })
  })
})
