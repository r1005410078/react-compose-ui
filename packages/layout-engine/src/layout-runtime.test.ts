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
import {
  createComposeLayoutRuntime,
  resolveComposeDocumentLayout,
  type ComposeLayoutRuntime,
} from './layout-runtime'

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

function waitForReady(runtime: ComposeLayoutRuntime, afterRevision = 0) {
  return new Promise<ReturnType<ComposeLayoutRuntime['getState']> & { status: 'ready' }>((resolve, reject) => {
    const consume = () => {
      const state = runtime.getState()
      if (state.status === 'error') {
        unsubscribe()
        reject(state.error)
      }
      if (state.status === 'ready' && state.snapshot.revision > afterRevision) {
        unsubscribe()
        resolve(state)
      }
    }
    const unsubscribe = runtime.subscribe(consume)
    consume()
  })
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

  it('OpenSpec: auto-layout-interactions / Fill main axis / grow 1、basis 0、shrink 1', async () => {
    const container = entity('container', fixedItem(0, 0, 300, 200), ['fixed', 'fill'])
    const fixed = entity('fixed', fixedItem(0, 0, 50, 20, 'flow'))
    const fill = entity('fill', {
      ...fixedItem(0, 0, 80, 20, 'flow'),
      width: { mode: 'fill', value: 80, min: null, max: null },
    })
    const snapshot = await resolveComposeDocumentLayout(documentFixture({
      container,
      fixed,
      fill,
    }))

    expect(snapshot.boxes.fixed).toMatchObject({ x: 12, width: 50 })
    expect(snapshot.boxes.fill).toMatchObject({ x: 70, width: 218 })
  })

  it('OpenSpec: auto-layout-interactions / Fill cross axis / 映射为 stretch', async () => {
    const container = entity('container', fixedItem(0, 0, 300, 200), ['fill'])
    const fill = entity('fill', {
      ...fixedItem(0, 0, 50, 20, 'flow'),
      height: { mode: 'fill', value: 20, min: null, max: null },
    })
    const snapshot = await resolveComposeDocumentLayout(documentFixture({ container, fill }))

    expect(snapshot.boxes.fill).toMatchObject({ x: 12, y: 12, width: 50, height: 176 })
  })

  it('OpenSpec: auto-layout-interactions / Fill wrap / min constraint 决定换行后占满每行', async () => {
    const containerBase = entity('container', fixedItem(0, 0, 200, 200), ['first', 'second'])
    const container = {
      ...containerBase,
      components: {
        ...containerBase.components,
        Layout: {
          ...containerBase.components.Layout,
          flexWrap: 'wrap' as const,
        },
      },
    }
    const fillItem = {
      ...fixedItem(0, 0, 80, 20, 'flow'),
      width: { mode: 'fill' as const, value: 80, min: 120, max: null },
    }
    const first = entity('first', fillItem)
    const second = entity('second', fillItem)
    const snapshot = await resolveComposeDocumentLayout(documentFixture({
      container,
      first,
      second,
    }))

    expect(snapshot.boxes.first).toMatchObject({ x: 12, y: 12, width: 176, height: 20 })
    expect(snapshot.boxes.second).toMatchObject({ x: 12, y: 103, width: 176, height: 20 })
  })

  it('OpenSpec: layout-engine / 增量节点树 / 已有 Layout 容器新增 Absolute 子项不会重置卡死', async () => {
    const container = entity('container', fixedItem(0, 0, 300, 200), [])
    const initial = documentFixture({ container })
    const runtime = createComposeLayoutRuntime({ document: initial })
    const first = await waitForReady(runtime)
    const child = entity('child', fixedItem(60, 40, 50, 20))

    runtime.updateDocument(documentFixture({
      container: entity('container', fixedItem(0, 0, 300, 200), ['child']),
      child,
    }))
    const next = await waitForReady(runtime, first.snapshot.revision)

    expect(next.snapshot.boxes.container).toMatchObject({ width: 300, height: 200 })
    expect(next.snapshot.boxes.child).toMatchObject({ x: 62, y: 42, width: 50, height: 20 })
    runtime.dispose()
  })
})
