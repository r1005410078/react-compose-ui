import { createComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  createDefaultCanvasSettings,
  createComposeFrameEntity,
  createEmptyComposePageFile,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
  type ComposeNavigationPort,
  type ComposeNavigationSnapshot,
  type ComposePageFile,
  type ComposePageLoader,
  type ComposePageReference,
} from '@compose-ui/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { ComposePreviewDialog } from '../index'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** 手动驱动 rAF：`flush(now)` 执行当前排队的全部回调，`pending()` 返回排队数。 */
function stubAnimationFrames() {
  const callbacks = new Map<number, FrameRequestCallback>()
  let id = 0
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callbacks.set(++id, callback)
    return id
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => {
    callbacks.delete(handle)
  })
  return {
    flush(now: number) {
      const batch = [...callbacks.values()]
      callbacks.clear()
      batch.forEach((callback) => callback(now))
    },
    pending: () => callbacks.size,
  }
}

/**
 * 桩掉指针捕获。
 *
 * @remarks
 * jsdom 不实现 Pointer Capture API，而拖手柄按下时就要取得捕获——不桩掉整条手势在第一步
 * 就抛错。
 */
function stubPointerCapture(): () => void {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>
  const original = {
    set: proto.setPointerCapture,
    release: proto.releasePointerCapture,
    has: proto.hasPointerCapture,
  }
  proto.setPointerCapture = () => undefined
  proto.releasePointerCapture = () => undefined
  proto.hasPointerCapture = () => true
  return () => {
    proto.setPointerCapture = original.set
    proto.releasePointerCapture = original.release
    proto.hasPointerCapture = original.has
  }
}

/**
 * 桩掉台面的布局尺寸。
 *
 * @remarks
 * jsdom 不做布局，`offsetWidth` / `offsetHeight` 恒为 0，而取景正是由台面尺寸算出来的；
 * 不桩掉时 `fitPreviewViewport` 一律返回 null（宁可不动，也不要按零除算出 Infinity）。
 */
function stubStageBox(width: number, height: number): () => void {
  const original = {
    width: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth'),
    height: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight'),
  }
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => width })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => height })
  return () => {
    if (original.width) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', original.width)
    if (original.height) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original.height)
  }
}

const container: ComposeEntity = {
  id: 'container',
  name: 'Container',
  components: {
    Composition: { presetId: null, baseComponentKeys: [], capabilityIds: [] },
    Transform: { rotation: 0 },
    LayoutItem: {
      positioning: 'absolute',
      offset: { x: 0, y: 0 },
      width: { mode: 'fixed', value: 320, min: 1, max: null },
      height: { mode: 'fixed', value: 180, min: 1, max: null },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      alignSelf: 'auto',
    },
    Visibility: { visible: true },
    Lock: { locked: false },
    Hierarchy: { childIds: [] },
  },
}

const rootFrame = createComposeFrameEntity({
  id: 'frame-root',
  childIds: [container.id],
  size: { width: 640, height: 360 },
})

const document: ComposeDocument = {
  schemaVersion: 7,
  canvas: createDefaultCanvasSettings(),
  rootIds: [rootFrame.id],
  entities: { [container.id]: container, [rootFrame.id]: rootFrame },
}

const layoutSnapshot: ComposeLayoutSnapshot = {
  revision: 1,
  boxes: {
    [container.id]: { x: 0, y: 0, width: 320, height: 180, positioning: 'absolute' },
    [rootFrame.id]: { x: 0, y: 0, width: 640, height: 360, positioning: 'absolute' },
  },
  diagnostics: [],
}

const registry = createComposeEntityRegistry()

/** 带一条位置动画的文档：play-once、时长 400 ms。 */
function animatedDocument(): ComposeDocument {
  return {
    ...document,
    entities: {
      ...document.entities,
      [container.id]: {
        ...container,
        components: {
          ...container.components,
          Animation: {
            clips: {
              intro: [{
                path: ['LayoutItem', 'offset'],
                valueKind: 'vector2',
                keyframes: [
                  { id: 'a', timeMs: 0, value: { x: 0, y: 0 }, interpolation: { kind: 'linear' } },
                  { id: 'b', timeMs: 400, value: { x: 200, y: 0 }, interpolation: { kind: 'linear' } },
                ],
              }],
            },
          },
        },
      },
      [rootFrame.id]: {
        ...rootFrame,
        components: {
          ...rootFrame.components,
          Animations: {
            items: [{ id: 'intro', name: '入场', durationMs: 400, playbackMode: 'play-once' }],
          },
        },
      },
    },
  }
}

function renderDialog(overrides: Partial<ComponentProps<typeof ComposePreviewDialog>> = {}) {
  const onOpenChange = vi.fn()
  return {
    onOpenChange,
    ...render(
      <ComposePreviewDialog
        document={document}
        layoutSnapshot={layoutSnapshot}
        open
        registry={registry}
        onOpenChange={onOpenChange}
        {...overrides}
      />,
    ),
  }
}

describe('ComposePreviewDialog', () => {
  it('OpenSpec: compose-preview / 受控 Preview Dialog / 打开完整文档预览', () => {
    const { onOpenChange } = renderDialog()

    expect(screen.getByRole('dialog', { name: 'Preview' })).toBeInTheDocument()
    // 目标是场景选择器：文档里只有一块场景时它就是唯一选项，且默认选中。
    expect(screen.getByRole('combobox', { name: 'Preview scene' }))
      .toHaveValue(rootFrame.id)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
    fireEvent.mouseDown(screen.getByTestId('compose-preview-dialog-backdrop'))
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('OpenSpec: compose-preview / 受控 Preview Dialog / 切换指定 Container 预览', () => {
    // 预览目标只有场景一种；宿主传入的是页面的激活场景，用户可在选择器里改。
    renderDialog({ selectedFrameId: rootFrame.id })

    expect(screen.getByRole('combobox', { name: 'Preview scene' })).toHaveValue(rootFrame.id)
    expect(screen.getByTestId('compose-preview-frame')).toBeInTheDocument()
  })

  it('OpenSpec: compose-preview / Preview Dialog 视图控制 / 调整视图缩放', () => {
    renderDialog()

    // 视图缩放只改取景：画板在屏幕上的像素变了，屏幕尺寸本身一个数都不动。
    expect(screen.getByTestId('compose-preview-dialog-zoom')).toHaveTextContent('100%')
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(screen.getByTestId('compose-preview-dialog-zoom')).toHaveTextContent('120%')
    expect(screen.getByTestId('compose-preview-dialog-screen-width')).toHaveValue(640)
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(screen.getByTestId('compose-preview-dialog-zoom')).toHaveTextContent('100%')
  })

  it('OpenSpec: compose-preview / 预览屏幕尺寸 / 默认屏幕等于目标自身尺寸', () => {
    renderDialog()

    // Frame 是 640 × 360：屏幕默认就是它，因此 1:1。
    expect(screen.getByTestId('compose-preview-dialog-screen-width')).toHaveValue(640)
    expect(screen.getByTestId('compose-preview-dialog-screen-height')).toHaveValue(360)
    expect(screen.getByTestId('compose-preview-dialog-size-pill')).toHaveTextContent('640 × 360 · 1:1')
    expect(screen.getByTestId('compose-preview-dialog-artboard')).toHaveStyle({ width: '640px' })
  })

  it('OpenSpec: compose-preview / 预览屏幕尺寸 / 选择另一块屏', () => {
    const { onOpenChange } = renderDialog()
    void onOpenChange

    fireEvent.change(screen.getByRole('combobox', { name: 'Screen size' }), {
      target: { value: '1920x1080' },
    })
    expect(screen.getByTestId('compose-preview-dialog-screen-width')).toHaveValue(1920)
    // 640 × 360 映射进 1920 × 1080：等比 300%，但场景填的是这块屏。
    expect(screen.getByTestId('compose-preview-dialog-size-pill'))
      .toHaveTextContent('1920 × 1080 ← 640 × 360 · 300%')
    // 文档一个字节都不动。
    expect(document.entities[rootFrame.id]).toBe(rootFrame)
  })

  it('OpenSpec: compose-preview / 预览屏幕尺寸 / 目标尺寸不在清单上时标为自定义', () => {
    renderDialog()

    // 640 × 360 不匹配任何常见分辨率，因此第一组那一项标自定义而不是伪造一个通名。
    const options = screen.getAllByRole('option')
      .filter((option) => option.textContent?.startsWith('640 × 360'))
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('640 × 360 · Custom · 16:9')
    // 第二组仍然完整列出清单。
    expect(screen.getByRole('option', { name: /1920 × 1080 · Full HD · 16:9/ })).toBeInTheDocument()
  })

  it('宽高输入是自定义尺寸的入口，改完下拉落在自定义那一项上', () => {
    renderDialog()

    fireEvent.change(screen.getByTestId('compose-preview-dialog-screen-width'), {
      target: { value: '800' },
    })
    expect(screen.getByRole('combobox', { name: 'Screen size' })).toHaveValue('')
    expect(screen.getByTestId('compose-preview-dialog-artboard')).toHaveStyle({ width: '800px' })
  })

  it('横竖互换只给场景，组件不出现', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Swap orientation' }))
    expect(screen.getByTestId('compose-preview-dialog-screen-width')).toHaveValue(360)
    expect(screen.getByTestId('compose-preview-dialog-screen-height')).toHaveValue(640)
    cleanup()

    renderDialog({ targetKind: 'component' })
    // 88 × 132 换成 132 × 88 不是任何人会提的请求。
    expect(screen.queryByRole('button', { name: 'Swap orientation' })).not.toBeInTheDocument()
  })

  it('OpenSpec: compose-preview / 受控 Preview Dialog / 组件目标不被拉伸填满屏幕', () => {
    renderDialog({ targetKind: 'component' })

    fireEvent.change(screen.getByRole('combobox', { name: 'Screen size' }), {
      target: { value: '1920x1080' },
    })
    // 组件是屏上的一个零件：原大摆着，不缩放。
    expect(screen.getByTestId('compose-preview-frame').style.transform).toBe('')
    expect(screen.getByTestId('compose-preview-dialog-size-pill'))
      .toHaveTextContent('1920 × 1080 ← 640 × 360 · 1:1')
  })

  it('OpenSpec: compose-preview / 预览屏幕尺寸 / 从选择器换屏幕尺寸后重新取景', () => {
    const restore = stubStageBox(800, 600)
    try {
      renderDialog()
      // 640 × 360 放得下，取景上限是 100%——适应窗口不放大。
      expect(screen.getByTestId('compose-preview-dialog-zoom')).toHaveTextContent('100%')

      fireEvent.change(screen.getByRole('combobox', { name: 'Screen size' }), {
        target: { value: '1920x1080' },
      })
      // 换一块放不下的屏：本帧的取景是按旧尺寸算的，等下一次交互会先给用户一帧错误的取景。
      expect(screen.getByTestId('compose-preview-dialog-zoom')).toHaveTextContent('38%')

      // 但它是一次性的：此后用户自己缩放不再被覆盖。
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
      expect(screen.getByTestId('compose-preview-dialog-zoom')).toHaveTextContent('46%')
    }
    finally { restore() }
  })

  it('OpenSpec: compose-preview / 进出全屏预览重新取景 / 收到事件那一帧不按旧台面取景', () => {
    const restore = stubStageBox(800, 600)
    const originalFullscreen = Object.getOwnPropertyDescriptor(
      Document.prototype,
      'fullscreenElement',
    )
    const setFullscreenElement = (value: Element | null) => {
      Object.defineProperty(Document.prototype, 'fullscreenElement', {
        configurable: true,
        get: () => value,
      })
      // 本文件模块级的 `document` 是 ComposeDocument 夹具，DOM 的那个要走 globalThis。
      fireEvent(globalThis.document, new Event('fullscreenchange'))
    }
    try {
      renderDialog()
      const zoom = screen.getByTestId('compose-preview-dialog-zoom')
      // 640 × 360 在 800 × 600 里放得下，取景上限是 100%。
      expect(zoom).toHaveTextContent('100%')

      /*
       * 先手动放大一档，让**当前比例**与「按这个台面算出来的取景」不是同一个数——否则下面
       * 那条断言在两种实现下都成立，是一条永远绿的假用例。
       */
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
      const zoomed = zoom.textContent
      expect(zoomed).not.toBe('100%')

      /*
       * 判别性断言：`fullscreenchange` 早于新台面被量出来，因此这一帧**不取景**。当帧取景会
       * 按旧的 800 × 600 算出 100%、把手动缩放冲掉，而真实缺陷正是「按旧尺寸算了一遍」——
       * 它在真浏览器里表现为进了全屏比例纹丝不动。jsdom 没有 ResizeObserver，台面永远停在
       * 挂载时那一次，因此这里读到的就是「有没有当帧取景」这件事本身。
       */
      setFullscreenElement(screen.getByRole('dialog', { name: 'Preview' }))
      expect(zoom).toHaveTextContent(zoomed!)

      // 退出同理：状态翻回去也不当帧取景。
      setFullscreenElement(null)
      expect(zoom).toHaveTextContent(zoomed!)
    }
    finally {
      if (originalFullscreen) {
        Object.defineProperty(Document.prototype, 'fullscreenElement', originalFullscreen)
      }
      else {
        Reflect.deleteProperty(Document.prototype, 'fullscreenElement')
      }
      restore()
    }
  })

  it('OpenSpec: compose-preview / 拖动改屏幕尺寸与吸附 / 拖动吸附到清单里的分辨率', () => {
    const restore = stubPointerCapture()
    try {
      renderDialog()
      const handle = screen.getByTestId('compose-preview-dialog-resize-handle')

      fireEvent.pointerDown(handle, { button: 0, clientX: 0, clientY: 0, pointerId: 1 })
      // 从 640 × 360 拖到 1278 × 718：落在 1280 × 720 的容差内。
      fireEvent.pointerMove(handle, { clientX: 638, clientY: 358, pointerId: 1 })
      expect(screen.getByTestId('compose-preview-dialog-screen-width')).toHaveValue(1280)
      expect(handle).toHaveAttribute('data-snapped', 'true')
      expect(screen.getByTestId('compose-preview-dialog-size-pill')).toHaveTextContent('HD')

      fireEvent.pointerUp(handle, { clientX: 638, clientY: 358, pointerId: 1 })
      expect(handle).not.toHaveAttribute('data-snapped')
      expect(screen.getByTestId('compose-preview-dialog-screen-width')).toHaveValue(1280)
    }
    finally { restore() }
  })

  it('拖动不改变取景——重新取景会让画板纹丝不动，拖了等于没有反馈', () => {
    const restore = stubPointerCapture()
    try {
      renderDialog()
      const handle = screen.getByTestId('compose-preview-dialog-resize-handle')
      fireEvent.pointerDown(handle, { button: 0, clientX: 0, clientY: 0, pointerId: 1 })
      fireEvent.pointerMove(handle, { clientX: 400, clientY: 200, pointerId: 1 })
      expect(screen.getByTestId('compose-preview-dialog-zoom')).toHaveTextContent('100%')
    }
    finally { restore() }
  })

  it('OpenSpec: compose-preview / 预览对话框动画播放 / 无动画时不显示播放控件', () => {
    renderDialog()

    expect(screen.queryByRole('button', { name: 'Play animation' })).not.toBeInTheDocument()
  })

  it('OpenSpec: compose-preview / 预览对话框动画播放 / 播放文档动画', () => {
    const raf = stubAnimationFrames()
    renderDialog({ document: animatedDocument() })

    fireEvent.click(screen.getByRole('button', { name: 'Play animation' }))
    expect(screen.getByRole('button', { name: 'Pause animation' })).toHaveAttribute('aria-pressed', 'true')

    // play-once：驱动一帧建立基准，再驱动超过 400 ms 时长的一帧 → 播完自动停止。
    act(() => raf.flush(0))
    act(() => raf.flush(1000))
    expect(screen.getByRole('button', { name: 'Play animation' })).toHaveAttribute('aria-pressed', 'false')
    // 播完后不再排队新的帧回调。
    expect(raf.pending()).toBe(0)
  })

  it('OpenSpec: compose-preview / 预览对话框动画播放 / 关闭对话框停止播放', () => {
    const raf = stubAnimationFrames()
    const onOpenChange = vi.fn()
    const props = {
      document: animatedDocument(),
      registry,
      onOpenChange,
    }
    const view = render(<ComposePreviewDialog {...props} open />)

    fireEvent.click(screen.getByRole('button', { name: 'Play animation' }))
    act(() => raf.flush(0))
    expect(raf.pending()).toBe(1)

    view.rerender(<ComposePreviewDialog {...props} open={false} />)
    // 关闭后计时资源被释放：待执行回调清空，也不再有新的排队。
    expect(raf.pending()).toBe(0)
  })
})


/** 页面预览模式的最小夹具：两块页面，首页上有一个可点击跳转的 Entity。 */
function pageModeFixture() {
  const providerId = 'memory'
  const reference = (assetKey: string): ComposePageReference => ({
    kind: 'page',
    providerId,
    assetKey,
    scope: 'persistent',
  })

  const label = (id: string, text: string, extra: ComposeEntity['components'] = {}): ComposeEntity => ({
    id,
    name: id,
    components: {
      Composition: { presetId: null, baseComponentKeys: [], capabilityIds: [] },
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: 0, y: 0 },
        width: { mode: 'fixed', value: 100, min: 1, max: null },
        height: { mode: 'fixed', value: 40, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      Renderer: { type: 'label', props: { text } },
      ...extra,
    },
  })

  const homeDocument: ComposeDocument = {
    schemaVersion: 7,
    canvas: createDefaultCanvasSettings(),
    rootIds: ['home-frame'],
    entities: {
      cta: label('cta', 'Go to detail', {
        Interaction: {
          version: 1,
          triggers: [{ event: 'click', action: { type: 'navigate', target: reference('detail') } }],
        },
      }),
      'home-frame': createComposeFrameEntity({
        id: 'home-frame',
        childIds: ['cta'],
        size: { width: 400, height: 300 },
      }),
    },
  }
  // 详情页有两块场景：跳转后场景选择器必须换成这两块。
  const detailDocument: ComposeDocument = {
    schemaVersion: 7,
    canvas: createDefaultCanvasSettings(),
    rootIds: ['detail-main', 'detail-alt'],
    entities: {
      headline: label('headline', 'Detail page'),
      aside: label('aside', 'Detail aside'),
      'detail-main': createComposeFrameEntity({
        id: 'detail-main',
        name: '详情主场景',
        childIds: ['headline'],
        size: { width: 400, height: 300 },
      }),
      'detail-alt': createComposeFrameEntity({
        id: 'detail-alt',
        name: '详情副场景',
        childIds: ['aside'],
        size: { width: 400, height: 300 },
      }),
    },
  }

  const pages: Record<string, ComposePageFile> = {
    home: { ...createEmptyComposePageFile(), document: homeDocument, activeFrameId: 'home-frame' },
    detail: { ...createEmptyComposePageFile(), document: detailDocument, activeFrameId: 'detail-main' },
  }

  const listeners = new Set<() => void>()
  let current: ComposePageReference = reference('home')
  let snapshot: ComposeNavigationSnapshot = {
    currentPageKey: 'home',
    current,
    canGoBack: false,
    issue: null,
  }
  const navigation: ComposeNavigationPort = {
    getSnapshot: () => snapshot,
    referenceFor: reference,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    async navigate(target) {
      current = target
      snapshot = { currentPageKey: target.assetKey, current, canGoBack: true, issue: null }
      listeners.forEach((listener) => { listener() })
    },
    async back() {},
    reset(pageKey) {
      current = pageKey === null ? reference('home') : reference(pageKey)
      snapshot = {
        currentPageKey: current.assetKey,
        current,
        canGoBack: false,
        issue: null,
      }
      listeners.forEach((listener) => { listener() })
    },
  }
  const pageLoader: ComposePageLoader = {
    async load(target) {
      const page = pages[target.assetKey]
      if (!page) throw new Error(`缺少页面 ${target.assetKey}`)
      return page
    },
  }
  const pageRegistry = createComposeEntityRegistry({
    renderers: [{
      type: 'label',
      label: 'Label',
      renderer: ({ props }) => <span>{String(props.text)}</span>,
    }],
  })
  const pageSnapshot: ComposeLayoutSnapshot = {
    revision: 1,
    boxes: Object.fromEntries(
      [...Object.keys(homeDocument.entities), ...Object.keys(detailDocument.entities)]
        .map((id) => [id, { x: 0, y: 0, width: 400, height: 300, positioning: 'absolute' as const }]),
    ),
    diagnostics: [],
  }
  return { navigation, pageLoader, pages, registry: pageRegistry, pageSnapshot }
}

describe('OpenSpec: compose-preview / 受控 Preview Dialog（页面预览）', () => {
  it('页面预览内跳转', async () => {
    const { navigation, pageLoader, registry: pageRegistry } = pageModeFixture()
    render(
      <ComposePreviewDialog
        navigation={navigation}
        open
        pageLoader={pageLoader}
        registry={pageRegistry}
        onOpenChange={vi.fn()}
      />,
    )

    const cta = await screen.findByRole('button', { name: 'cta' })
    // 首页只有一块场景，选择器里只有它。
    expect(screen.getByRole('combobox', { name: 'Preview scene' })).toHaveValue('home-frame')

    await act(async () => { fireEvent.click(cta) })
    await waitFor(() => { expect(screen.getByText('Detail page')).toBeTruthy() })
    // 场景选择器跟随新页面重置为它的激活场景。
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Preview scene' })).toHaveValue('detail-main')
    })
    expect(screen.getAllByRole('option').map((option) => option.getAttribute('value')))
      .toContain('detail-alt')
  })

  it('OpenSpec: compose-preview / 受控 Preview Dialog / 场景名取自当前预览的文档', async () => {
    const { navigation, pageLoader, registry: pageRegistry } = pageModeFixture()
    render(
      <ComposePreviewDialog
        navigation={navigation}
        open
        pageLoader={pageLoader}
        registry={pageRegistry}
        onOpenChange={vi.fn()}
      />,
    )

    const cta = await screen.findByRole('button', { name: 'cta' })
    await act(async () => { fireEvent.click(cta) })
    // 名字必须来自目标页面的文档。读成宿主正在编辑的那一份时这里会退化成裸 id。
    await waitFor(() => {
      expect(screen.getByRole('option', { name: '详情主场景' })).toBeInTheDocument()
    })
    expect(screen.getByRole('option', { name: '详情副场景' })).toBeInTheDocument()
  })

  it('OpenSpec: compose-preview / 受控 Preview Dialog / 页面预览内跳转（过程中不出现目标不存在）', async () => {
    const { navigation, pageLoader, registry: pageRegistry, pageSnapshot, pages } = pageModeFixture()
    render(
      <ComposePreviewDialog
        layoutSnapshot={pageSnapshot}
        livePage={{ pageKey: 'home', page: pages.home! }}
        navigation={navigation}
        open
        pageLoader={pageLoader}
        registry={pageRegistry}
        onOpenChange={vi.fn()}
      />,
    )
    const cta = await screen.findByRole('button', { name: 'cta' })
    await act(async () => { fireEvent.click(cta) })
    await waitFor(() => { expect(screen.getByText('Detail page')).toBeTruthy() })

    // 在详情页显式选中第二块场景，再跳回首页——首页没有这块场景。
    fireEvent.change(screen.getByRole('combobox', { name: 'Preview scene' }), {
      target: { value: 'detail-alt' },
    })
    await waitFor(() => { expect(screen.getByText('Detail aside')).toBeTruthy() })

    /*
     * 这里必须观测**过程**而不是终态：错误态只存在于「PageHost 已经渲染新页面、而对话框的
     * onPageChange 还没回灌」那一帧，它会被后续渲染盖掉，终态断言两种实现都能通过。
     *
     * 回的这一页是 live 页，因此 PageHost **不经过加载态**、同一帧就渲染出内容——而加载态
     * 恰好会顺手把显式目标清掉。换句话说这个缺陷只在有 live 页时现形，而那正是编辑器里
     * 每一次预览的形态。
     */
    const seen: string[] = []
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => { seen.push(node.textContent ?? '') })
      })
    })
    observer.observe(window.document.body, { childList: true, subtree: true })
    try {
      await act(async () => { navigation.reset('home') })
      await waitFor(() => { expect(screen.getByRole('button', { name: 'cta' })).toBeTruthy() })
      expect(seen.some((text) => text.includes('不存在或不是 Frame'))).toBe(false)
    }
    finally { observer.disconnect() }
  })

  it('未提供导航端口保持兼容', () => {
    renderDialog()
    expect(screen.getByRole('combobox', { name: 'Preview scene' })).toHaveValue(rootFrame.id)
    expect(screen.queryByTestId('compose-page-host-loading')).toBeNull()
  })
})
