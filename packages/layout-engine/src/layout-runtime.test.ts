import {
  createDefaultCanvasSettings,
  createDefaultComposeFlexLayout,
  createDefaultComposeLayoutItem,
  createDefaultOutputSettings,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutItem,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { resolveComposeDocumentLayout } from './layout-runtime'

function entity(
  id: string,
  item: Partial<ComposeLayoutItem>,
  childIds?: readonly string[],
): ComposeEntity {
  const layoutItem = {
    ...createDefaultComposeLayoutItem(),
    ...item,
  } as ComposeLayoutItem
  const components = {
    Transform: { rotation: 0 },
    LayoutItem: layoutItem,
    Visibility: { visible: true },
    Lock: { locked: false },
    Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' }, borderWidth: 2 },
    ...(childIds
      ? {
          Hierarchy: { childIds },
          Layout: {
            ...createDefaultComposeFlexLayout(),
            padding: { top: 10, right: 10, bottom: 10, left: 10 },
            rowGap: 6,
            columnGap: 8,
          },
        }
      : { Renderer: { type: 'rectangle', props: {} } }),
  } as const
  return {
    id,
    name: id,
    components: {
      Composition: {
        presetId: childIds ? 'container' : 'rectangle',
        baseComponentKeys: Object.keys(components),
        capabilityIds: [],
      },
      ...components,
    },
  }
}

function fixedItem(
  x: number,
  y: number,
  width: number,
  height: number,
  positioning: ComposeLayoutItem['positioning'] = 'absolute',
): Partial<ComposeLayoutItem> {
  return {
    positioning,
    offset: { x, y },
    width: { mode: 'fixed', value: width, min: null, max: null },
    height: { mode: 'fixed', value: height, min: null, max: null },
  }
}

function documentFixture(entities: Record<string, ComposeEntity>): ComposeDocument {
  return {
    schemaVersion: 6,
    canvas: createDefaultCanvasSettings(),
    output: createDefaultOutputSettings(),
    rootIds: ['container'],
    entities,
  }
}

describe('Yoga Compose layout runtime', () => {
  it('OpenSpec: layout-engine / Fixed Flex 数值布局 / 解析 border、padding 与双轴 gap', async () => {
    const container = entity('container', fixedItem(10, 20, 300, 200), ['first', 'second'])
    const first = entity('first', fixedItem(0, 0, 50, 20, 'flow'))
    const second = entity('second', fixedItem(0, 0, 50, 20, 'flow'))
    const snapshot = await resolveComposeDocumentLayout(documentFixture({
      container,
      first,
      second,
    }))

    expect(snapshot.boxes.container).toMatchObject({ x: 10, y: 20, width: 300, height: 200 })
    expect(snapshot.boxes.first).toMatchObject({ x: 12, y: 12, width: 50, height: 20 })
    expect(snapshot.boxes.second).toMatchObject({ x: 70, y: 12, width: 50, height: 20 })
  })

  it('OpenSpec: layout-engine / Absolute 子项 / 不参与 Flow 排列', async () => {
    const container = entity('container', fixedItem(0, 0, 300, 200), ['flow', 'absolute'])
    const flow = entity('flow', fixedItem(0, 0, 40, 20, 'flow'))
    const absolute = entity('absolute', fixedItem(100, 80, 30, 25))
    const snapshot = await resolveComposeDocumentLayout(documentFixture({
      container,
      flow,
      absolute,
    }))

    expect(snapshot.boxes.flow).toMatchObject({ x: 12, y: 12 })
    expect(snapshot.boxes.absolute).toMatchObject({ x: 102, y: 82, width: 30, height: 25 })
  })
})
