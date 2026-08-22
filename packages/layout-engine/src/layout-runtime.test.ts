import {
  createDefaultCanvasSettings,
  createDefaultComposeFlexLayout,
  createDefaultComposeLayoutItem,
  createComposeFrame,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutMeasurementPort,
  type ComposeLayoutItem,
} from '@compose-ui/core'
import { describe, expect, it, vi } from 'vitest'
import {
  createComposeLayoutRuntime,
  createComposeLayoutRuntimeWithBackendForTesting,
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

/** v7 的文档根必须是 Frame，因此夹具把既有 'container' 根挂进一个 1280×720 的根 Frame。 */
function frameEntity(childIds: readonly string[]): ComposeEntity {
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
      Composition: {
        presetId: 'frame',
        baseComponentKeys: Object.keys(components),
        capabilityIds: [],
      },
      ...components,
    },
  }
}

function documentFixture(entities: Record<string, ComposeEntity>): ComposeDocument {
  return {
    schemaVersion: 7,
    canvas: createDefaultCanvasSettings(),
    rootIds: ['frame-root'],
    entities: { ...entities, 'frame-root': frameEntity(['container']) },
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
  it('OpenSpec: layout-engine / 可注入 fake backend / 验证 Config、LTR 求解与 dispose', async () => {
    const config = {
      setUseWebDefaults: vi.fn(),
      setPointScaleFactor: vi.fn(),
      free: vi.fn(),
    }
    const root = {
      setWidth: vi.fn(),
      setHeight: vi.fn(),
      setFlexDirection: vi.fn(),
      getChildCount: vi.fn(() => 0),
      calculateLayout: vi.fn(),
      free: vi.fn(),
    }
    const backend = {
      Config: { create: vi.fn(() => config) },
      Node: { createWithConfig: vi.fn(() => root) },
      FLEX_DIRECTION_ROW: 2,
      DIRECTION_LTR: 1,
    }
    const runtime = createComposeLayoutRuntimeWithBackendForTesting({
      document: {
        schemaVersion: 7,
        canvas: createDefaultCanvasSettings(),
        rootIds: [],
        entities: {},
      },
    }, async () => backend)

    await waitForReady(runtime)

    expect(config.setUseWebDefaults).toHaveBeenCalledWith(true)
    expect(config.setPointScaleFactor).toHaveBeenCalledWith(0)
    // v7 没有文档级输出尺寸：合成根的可用空间是全部根 Frame 的并集包围盒，
    // 空文档因此是 0×0。这里验证的是 LTR 方向与求解被调用一次。
    expect(root.calculateLayout).toHaveBeenCalledWith(0, 0, 1)
    runtime.dispose()
    expect(root.free).toHaveBeenCalledOnce()
    expect(config.free).toHaveBeenCalledOnce()
  })

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

  it('OpenSpec: hug-content-layout / Renderer leaf Hug / 使用同步测量并服从 min/max', async () => {
    const leaf = entity('container', {
      ...fixedItem(20, 30, 100, 40),
      width: { mode: 'hug', value: 100, min: 80, max: 120 },
      height: { mode: 'hug', value: 40, min: 20, max: 60 },
    })
    const measure = vi.fn(() => ({ width: 200, height: 12, baseline: 10 }))
    const snapshot = await resolveComposeDocumentLayout(
      documentFixture({ container: leaf }),
      { revision: 0, measure, subscribe: () => () => undefined },
    )

    expect(snapshot.boxes.container).toMatchObject({
      x: 20,
      y: 30,
      width: 120,
      height: 20,
    })
    expect(measure).toHaveBeenCalledWith(expect.objectContaining({
      entity: expect.objectContaining({ id: 'container' }),
    }))
    expect(snapshot.diagnostics).toEqual([])
  })

  it('OpenSpec: hug-content-layout / Auto Layout container Hug / 包含 border、padding 与 gap', async () => {
    const container = entity('container', {
      ...fixedItem(0, 0, 300, 200),
      width: { mode: 'hug', value: 300, min: null, max: null },
      height: { mode: 'hug', value: 200, min: null, max: null },
    }, ['first', 'second'])
    const first = entity('first', fixedItem(0, 0, 50, 20, 'flow'))
    const second = entity('second', fixedItem(0, 0, 40, 16, 'flow'))
    const snapshot = await resolveComposeDocumentLayout(documentFixture({
      container,
      first,
      second,
    }))

    expect(snapshot.boxes.container).toMatchObject({ width: 122, height: 44 })
    expect(snapshot.boxes.first).toMatchObject({ x: 12, y: 12 })
    expect(snapshot.boxes.second).toMatchObject({ x: 70, y: 12 })
  })

  it('OpenSpec: layout-engine / Auto Layout 交叉轴拉伸继承 / stretch 父级拉伸 Hug 子级', async () => {
    // 容器 300x200、border 2、padding 10 → 交叉轴内容区 200 - 2*2 - 2*10 = 176。
    const container = entity('container', fixedItem(0, 0, 300, 200), ['child'])
    const child = entity('child', {
      ...fixedItem(0, 0, 50, 20, 'flow'),
      height: { mode: 'hug', value: 20, min: null, max: null },
    })
    const snapshot = await resolveComposeDocumentLayout(
      documentFixture({ container, child }),
      { revision: 0, measure: () => ({ width: 50, height: 20 }), subscribe: () => () => undefined },
    )

    expect(container.components.Layout).toMatchObject({ alignItems: 'stretch' })
    expect(snapshot.boxes.child).toMatchObject({ height: 176 })
  })

  it('OpenSpec: layout-engine / Auto Layout 交叉轴拉伸继承 / 子级显式 alignSelf 优先于父级', async () => {
    const container = entity('container', fixedItem(0, 0, 300, 200), ['pinned', 'stretched'])
    const pinned = entity('pinned', {
      ...fixedItem(0, 0, 50, 20, 'flow'),
      height: { mode: 'hug', value: 20, min: null, max: null },
      alignSelf: 'flex-start',
    })
    const stretched = entity('stretched', {
      ...fixedItem(0, 0, 50, 20, 'flow'),
      height: { mode: 'hug', value: 20, min: null, max: null },
    })
    const snapshot = await resolveComposeDocumentLayout(
      documentFixture({ container, pinned, stretched }),
      { revision: 0, measure: () => ({ width: 50, height: 20 }), subscribe: () => () => undefined },
    )

    // 测量返回 content box，Snapshot 发布 border box：20 + 2*2 = 24。
    expect(snapshot.boxes.pinned).toMatchObject({ height: 24 })
    expect(snapshot.boxes.stretched).toMatchObject({ height: 176 })
  })

  it('OpenSpec: layout-engine / Auto Layout 交叉轴拉伸继承 / 非拉伸父级保持内容尺寸', async () => {
    const base = entity('container', fixedItem(0, 0, 300, 200), ['child'])
    const container = {
      ...base,
      components: {
        ...base.components,
        Layout: { ...base.components.Layout, alignItems: 'flex-start' as const },
      },
    }
    const child = entity('child', {
      ...fixedItem(0, 0, 50, 20, 'flow'),
      height: { mode: 'hug', value: 20, min: null, max: null },
    })
    const snapshot = await resolveComposeDocumentLayout(
      documentFixture({ container, child }),
      { revision: 0, measure: () => ({ width: 50, height: 20 }), subscribe: () => () => undefined },
    )

    expect(snapshot.boxes.child).toMatchObject({ height: 24 })
  })

  it('OpenSpec: hug-content-layout / Measurement fallback / 每个 Hug axis 使用稳定 value 与诊断', async () => {
    const leaf = entity('container', {
      ...fixedItem(0, 0, 90, 32),
      width: { mode: 'hug', value: 90, min: null, max: null },
      height: { mode: 'hug', value: 32, min: null, max: null },
    })
    const snapshot = await resolveComposeDocumentLayout(documentFixture({ container: leaf }))

    expect(snapshot.boxes.container).toMatchObject({ width: 90, height: 32 })
    expect(snapshot.diagnostics).toEqual([
      expect.objectContaining({ entityId: 'container', axis: 'width' }),
      expect.objectContaining({ entityId: 'container', axis: 'height' }),
    ])
  })

  it('OpenSpec: hug-content-layout / 精确失效 / 只重新测量通知的 leaf 与祖先', async () => {
    const container = entity('container', {
      ...fixedItem(0, 0, 300, 200),
      width: { mode: 'hug', value: 300, min: null, max: null },
      height: { mode: 'hug', value: 200, min: null, max: null },
    }, ['first', 'second'])
    const hugItem = {
      ...fixedItem(0, 0, 50, 20, 'flow'),
      width: { mode: 'hug' as const, value: 50, min: null, max: null },
      height: { mode: 'hug' as const, value: 20, min: null, max: null },
    }
    let firstWidth = 40
    const calls = new Map<string, number>()
    let invalidate: ((entityIds?: readonly string[]) => void) | undefined
    const port: ComposeLayoutMeasurementPort = {
      revision: 0,
      measure: ({ entity }) => {
        calls.set(entity.id, (calls.get(entity.id) ?? 0) + 1)
        return { width: entity.id === 'first' ? firstWidth : 30, height: 20 }
      },
      subscribe: (listener) => {
        invalidate = listener
        return () => undefined
      },
    }
    const runtime = createComposeLayoutRuntime({
      document: documentFixture({
        container,
        first: entity('first', hugItem),
        second: entity('second', hugItem),
      }),
      measurementPort: port,
    })
    const initial = await waitForReady(runtime)
    const secondCalls = calls.get('second')
    firstWidth = 80
    invalidate?.(['first'])
    const next = await waitForReady(runtime, initial.snapshot.revision)

    // Renderer 测量返回 content box；LayoutSnapshot 始终发布包含两侧 border 的 border box。
    expect(next.snapshot.boxes.first?.width).toBe(84)
    expect(next.snapshot.boxes.container?.width).toBeGreaterThan(initial.snapshot.boxes.container!.width)
    expect(calls.get('second')).toBe(secondCalls)
    runtime.dispose()
  })

  it('OpenSpec: layout-engine / 增量重解性能 / 单节点变更不重写全树样式', async () => {
    const hugItem = {
      ...fixedItem(0, 0, 50, 20, 'flow'),
      width: { mode: 'hug' as const, value: 50, min: null, max: null },
      height: { mode: 'hug' as const, value: 20, min: null, max: null },
    }
    const calls = new Map<string, number>()
    const port: ComposeLayoutMeasurementPort = {
      revision: 0,
      measure: ({ entity }) => {
        calls.set(entity.id, (calls.get(entity.id) ?? 0) + 1)
        return { width: 40, height: 20 }
      },
      subscribe: () => () => undefined,
    }
    const container = entity('container', fixedItem(0, 0, 300, 200), ['first', 'second'])
    const second = entity('second', hugItem)
    const runtime = createComposeLayoutRuntime({
      document: documentFixture({ container, first: entity('first', hugItem), second }),
      measurementPort: port,
    })
    const initial = await waitForReady(runtime)
    const secondCalls = calls.get('second')

    // 只替换 first 的对象引用（margin 变化），container 与 second 保持同一引用。
    runtime.updateDocument(documentFixture({
      container,
      first: entity('first', { ...hugItem, margin: { top: 4, right: 0, bottom: 0, left: 0 } }),
      second,
    }))
    const next = await waitForReady(runtime, initial.snapshot.revision)

    expect(next.snapshot.boxes.first).toMatchObject({ y: 16 })
    expect(calls.get('second')).toBe(secondCalls)
    runtime.dispose()
  })

  it('OpenSpec: layout-engine / 增量重解性能 / 引用变化但测量输入未变时命中缓存', async () => {
    // Absolute hug leaf 拖拽（只改 offset）是最高频路径：Yoga 以相同约束重测，必须命中缓存。
    const hugItem = {
      ...fixedItem(10, 10, 50, 20),
      width: { mode: 'hug' as const, value: 50, min: null, max: null },
      height: { mode: 'hug' as const, value: 20, min: null, max: null },
    }
    const measure = vi.fn(() => ({ width: 40, height: 20 }))
    const port: ComposeLayoutMeasurementPort = {
      revision: 0,
      measure,
      subscribe: () => () => undefined,
    }
    const container = entity('container', fixedItem(0, 0, 300, 200), ['leaf'])
    const leaf = entity('leaf', hugItem)
    const runtime = createComposeLayoutRuntime({
      document: documentFixture({ container, leaf }),
      measurementPort: port,
    })
    const initial = await waitForReady(runtime)
    const initialCalls = measure.mock.calls.length

    // 模拟真实 Patch：只替换 LayoutItem（offset 变化），Renderer 等组件保持同一引用。
    // 样式因此重写，但 Renderer 与 Yoga 约束未变，测量应命中缓存。
    const movedLeaf: typeof leaf = {
      ...leaf,
      components: {
        ...leaf.components,
        LayoutItem: {
          ...(leaf.components.LayoutItem as object),
          offset: { x: 60, y: 40 },
        } as typeof leaf.components.LayoutItem,
      },
    }
    runtime.updateDocument(documentFixture({ container, leaf: movedLeaf }))
    const next = await waitForReady(runtime, initial.snapshot.revision)

    expect(next.snapshot.boxes.leaf).toMatchObject({ x: 62, y: 42 })
    expect(measure.mock.calls.length).toBe(initialCalls)
    runtime.dispose()
  })

  it('OpenSpec: layout-engine / 增量重解性能 / 未变化 box 保持引用相等', async () => {
    const container = entity('container', fixedItem(0, 0, 300, 200), ['first', 'second'])
    const first = entity('first', fixedItem(10, 10, 40, 20))
    const second = entity('second', fixedItem(100, 80, 30, 25))
    const runtime = createComposeLayoutRuntime({
      document: documentFixture({ container, first, second }),
    })
    const initial = await waitForReady(runtime)

    runtime.updateDocument(documentFixture({
      container,
      first: entity('first', fixedItem(20, 10, 40, 20)),
      second,
    }))
    const next = await waitForReady(runtime, initial.snapshot.revision)

    expect(next.snapshot.boxes.second).toBe(initial.snapshot.boxes.second)
    expect(next.snapshot.boxes.first).not.toBe(initial.snapshot.boxes.first)
    expect(next.snapshot.boxes.first).toMatchObject({ x: 22 })
    runtime.dispose()
  })

  it('OpenSpec: layout-engine / 手势期预览求解通道 / 预览求解不污染提交态', async () => {
    const container = entity('container', fixedItem(0, 0, 300, 200), ['child'])
    const child = entity('child', fixedItem(10, 10, 40, 20))
    const committed = documentFixture({ container, child })
    const runtime = createComposeLayoutRuntime({ document: committed })
    const initial = await waitForReady(runtime)
    expect(initial.preview).toBe(false)

    runtime.previewDocument(documentFixture({
      container,
      child: entity('child', fixedItem(80, 10, 40, 20)),
    }))
    const previewed = await waitForReady(runtime, initial.snapshot.revision)
    expect(previewed.preview).toBe(true)
    expect(previewed.snapshot.boxes.child).toMatchObject({ x: 82 })

    runtime.clearPreview()
    const restored = await waitForReady(runtime, previewed.snapshot.revision)
    expect(restored.preview).toBe(false)
    expect(restored.document).toBe(committed)
    expect(restored.snapshot.boxes.child).toMatchObject({ x: 12 })
    runtime.dispose()
  })

  it('OpenSpec: layout-engine / 手势期预览求解通道 / 正式提交隐式终止预览', async () => {
    const container = entity('container', fixedItem(0, 0, 300, 200), ['child'])
    const child = entity('child', fixedItem(10, 10, 40, 20))
    const runtime = createComposeLayoutRuntime({
      document: documentFixture({ container, child }),
    })
    const initial = await waitForReady(runtime)

    runtime.previewDocument(documentFixture({
      container,
      child: entity('child', fixedItem(80, 10, 40, 20)),
    }))
    const previewed = await waitForReady(runtime, initial.snapshot.revision)

    const next = documentFixture({ container, child: entity('child', fixedItem(50, 10, 40, 20)) })
    runtime.updateDocument(next)
    const committed = await waitForReady(runtime, previewed.snapshot.revision)
    expect(committed.preview).toBe(false)
    expect(committed.document).toBe(next)
    expect(committed.snapshot.boxes.child).toMatchObject({ x: 52 })

    // 预览已被正式提交终止，clearPreview 不得再回退状态。
    runtime.clearPreview()
    expect(runtime.getState()).toBe(committed)
    runtime.dispose()
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

describe('Interaction 不参与布局求解', () => {
  it('OpenSpec: 可选 Interaction Component / 任意 Entity 携带 Interaction', async () => {
    const container = entity('container', fixedItem(10, 20, 300, 200), ['first', 'second'])
    const first = entity('first', fixedItem(0, 0, 120, 60, 'flow'))
    const second = entity('second', fixedItem(0, 0, 90, 40, 'flow'))
    const plain = documentFixture({ container, first, second })
    // 同一份文档，只在两个 Entity 上加 Interaction；求解结果必须逐字段一致。
    const interactive = documentFixture({
      container: {
        ...container,
        components: {
          ...container.components,
          Interaction: { version: 1, triggers: [{ event: 'click', action: { type: 'navigate-back' } }] },
        },
      },
      first: {
        ...first,
        components: {
          ...first.components,
          Interaction: {
            version: 1,
            triggers: [{
              event: 'click',
              action: {
                type: 'navigate',
                target: { kind: 'page', providerId: 'demo', assetKey: 'pages/a.page.json', scope: 'persistent' },
              },
            }],
          },
        },
      },
      second,
    })

    const before = await resolveComposeDocumentLayout(plain)
    const after = await resolveComposeDocumentLayout(interactive)

    expect(after.boxes).toEqual(before.boxes)
  })
})
