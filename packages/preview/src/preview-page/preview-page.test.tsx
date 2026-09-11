import { createComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  createDefaultCanvasSettings,
  createComposeFrameEntity,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { ComposePreviewDialog, ComposePreviewPage } from '../index'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

/**
 * 桩掉台面的布局尺寸。
 *
 * @remarks
 * jsdom 不做布局，`offsetWidth` / `offsetHeight` 恒为 0，而整屏形态的默认屏幕**就是**台面
 * 尺寸；不桩掉时它退回目标自身尺寸，这条用例就什么都没验到。
 */
function stubStageBox(initial: { width: number, height: number }) {
  const box = { ...initial }
  const original = {
    width: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth'),
    height: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight'),
  }
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => box.width })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => box.height })
  return {
    set(next: { width: number, height: number }) {
      box.width = next.width
      box.height = next.height
    },
    restore() {
      if (original.width) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', original.width)
      if (original.height) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original.height)
    },
  }
}

/** 桩掉 ResizeObserver：jsdom 没有它，而「实际屏幕跟着视口走」正是靠它观测到的。 */
function stubResizeObserver() {
  const callbacks = new Set<() => void>()
  class Stub {
    constructor(private readonly callback: () => void) {}
    observe() { callbacks.add(this.callback) }
    disconnect() { callbacks.delete(this.callback) }
    unobserve() { callbacks.delete(this.callback) }
  }
  const previous = (globalThis as Record<string, unknown>).ResizeObserver
  ;(globalThis as Record<string, unknown>).ResizeObserver = Stub
  return {
    fire() { callbacks.forEach((callback) => callback()) },
    restore() { (globalThis as Record<string, unknown>).ResizeObserver = previous },
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

function renderPage(overrides: Partial<ComponentProps<typeof ComposePreviewPage>> = {}) {
  const onRequestExit = vi.fn()
  return {
    onRequestExit,
    ...render(
      <ComposePreviewPage
        document={document}
        layoutSnapshot={layoutSnapshot}
        registry={registry}
        onRequestExit={onRequestExit}
        {...overrides}
      />,
    ),
  }
}

describe('ComposePreviewPage', () => {
  it('OpenSpec: compose-preview / 整屏预览形态 / 默认呈现真实像素', () => {
    const stage = stubStageBox({ width: 1280, height: 720 })
    try {
      renderPage()
      // 画板宽 = 屏幕宽 × 视图缩放。等于 1280 即同时说明屏幕取了视口、缩放是 1:1；
      // 任何一项不成立这个数都会变。
      const artboard = screen.getByTestId('compose-preview-page-artboard')
      expect(artboard).toHaveStyle({ width: '1280px', height: '720px' })
      expect(screen.getByTestId('compose-preview-page-size-pill'))
        .toHaveTextContent('1280 × 720 · Actual screen · 1:1')
    }
    finally { stage.restore() }
  })

  it('OpenSpec: compose-preview / 整屏预览形态 / 实际视口跟随窗口变化', () => {
    const stage = stubStageBox({ width: 1280, height: 720 })
    const observer = stubResizeObserver()
    try {
      renderPage()
      stage.set({ width: 1600, height: 900 })
      act(() => { observer.fire() })
      expect(screen.getByTestId('compose-preview-page-size-pill'))
        .toHaveTextContent('1600 × 900 · Actual screen')
      expect(screen.getByTestId('compose-preview-page-artboard'))
        .toHaveStyle({ width: '1600px' })
    }
    finally {
      observer.restore()
      stage.restore()
    }
  })

  it('OpenSpec: compose-preview / 整屏预览形态 / 挑一块比视口小的屏幕', () => {
    const stage = stubStageBox({ width: 1920, height: 1080 })
    try {
      renderPage()
      fireEvent.change(screen.getByTestId('compose-preview-page-screen-size'), {
        target: { value: '1280x720' },
      })
      const artboard = screen.getByTestId('compose-preview-page-artboard')
      // 1:1 摆在视口中央，四周就是留黑那一圈。
      expect(artboard).toHaveStyle({ width: '1280px', height: '720px', left: '320px', top: '180px' })
    }
    finally { stage.restore() }
  })

  it('OpenSpec: compose-preview / 整屏预览形态 / 窗口变化后固定分辨率重新居中', () => {
    const stage = stubStageBox({ width: 1920, height: 1080 })
    const observer = stubResizeObserver()
    try {
      renderPage()
      fireEvent.change(screen.getByTestId('compose-preview-page-screen-size'), {
        target: { value: '1280x720' },
      })
      const artboard = screen.getByTestId('compose-preview-page-artboard')
      expect(artboard).toHaveStyle({ left: '320px', top: '180px' })
      /*
       * 判别性：默认档下屏幕恒等于台面、偏移永远是 0，怎么改都测不出差别。会错位的是
       * **挑了固定分辨率之后窗口变小**这一档——不重新取景的话画板还停在 320 上，一半在屏幕外。
       */
      stage.set({ width: 1280, height: 720 })
      act(() => { observer.fire() })
      expect(artboard).toHaveStyle({ left: '0px', top: '0px' })
    }
    finally {
      observer.restore()
      stage.restore()
    }
  })

  it('OpenSpec: compose-preview / 整屏预览形态 / 静息后只剩页面本身', () => {
    vi.useFakeTimers()
    const stage = stubStageBox({ width: 1280, height: 720 })
    try {
      renderPage()
      const bar = screen.getByTestId('compose-preview-page-bar')
      expect(bar).toHaveAttribute('data-visible', 'true')
      act(() => { vi.advanceTimersByTime(2000) })
      expect(bar).not.toHaveAttribute('data-visible')
      // 指针一动又浮出来。
      act(() => { fireEvent.pointerMove(screen.getByTestId('compose-preview-page')) })
      expect(bar).toHaveAttribute('data-visible', 'true')
    }
    finally { stage.restore() }
  })

  it('OpenSpec: compose-preview / 整屏预览形态 / 键盘可以唤出控制条', () => {
    vi.useFakeTimers()
    const stage = stubStageBox({ width: 1280, height: 720 })
    try {
      renderPage()
      const bar = screen.getByTestId('compose-preview-page-bar')
      act(() => { vi.advanceTimersByTime(2000) })
      expect(bar).not.toHaveAttribute('data-visible')
      /*
       * 判别性：键盘用户不会移动指针。把显隐只挂在 pointermove 上时这一步必红——
       * 而那正是「控制条对键盘用户永远不存在」这个缺陷在用例里的样子。
       */
      act(() => { screen.getByTestId('compose-preview-page-exit').focus() })
      expect(bar).toHaveAttribute('data-visible', 'true')
      // 焦点还在里面，计时器到点也不该把它收走。
      act(() => { vi.advanceTimersByTime(4000) })
      expect(bar).toHaveAttribute('data-visible', 'true')
    }
    finally { stage.restore() }
  })

  it('OpenSpec: compose-preview / 整屏预览形态 / 两条退出路径', () => {
    const stage = stubStageBox({ width: 1280, height: 720 })
    try {
      const { onRequestExit } = renderPage()
      fireEvent.click(screen.getByTestId('compose-preview-page-exit'))
      expect(onRequestExit).toHaveBeenCalledTimes(1)
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onRequestExit).toHaveBeenCalledTimes(2)
    }
    finally { stage.restore() }
  })
})

describe('两个预览形态', () => {
  it('OpenSpec: compose-preview / 两个预览形态共用同一层实现 / 同一份输入画出同样的内容', () => {
    const stage = stubStageBox({ width: 1280, height: 720 })
    try {
      const dialog = render(
        <ComposePreviewDialog
          document={document}
          layoutSnapshot={layoutSnapshot}
          open
          registry={registry}
          onOpenChange={vi.fn()}
        />,
      )
      const dialogScreen = screen.getByTestId('compose-preview-dialog-artboard')
        .querySelector('.compose-preview-surface__screen')
      const dialogMarkup = dialogScreen?.innerHTML
      dialog.unmount()

      // 同一份文档、同一个目标、同一块屏（640 × 360 = 场景自身尺寸）。
      renderPage({ initialState: { screenSize: { width: 640, height: 360 } } })
      const pageScreen = screen.getByTestId('compose-preview-page-artboard')
        .querySelector('.compose-preview-surface__screen')

      expect(dialogMarkup).toBeTruthy()
      expect(pageScreen?.innerHTML).toBe(dialogMarkup)
    }
    finally { stage.restore() }
  })
})

describe('预览形态之间的切换', () => {
  function renderDialog(overrides: Partial<ComponentProps<typeof ComposePreviewDialog>> = {}) {
    return render(
      <ComposePreviewDialog
        document={document}
        layoutSnapshot={layoutSnapshot}
        open
        registry={registry}
        onOpenChange={vi.fn()}
        {...overrides}
      />,
    )
  }

  it('OpenSpec: compose-preview / 预览形态之间的切换 / 宿主没有提供切换动作', () => {
    renderDialog()
    expect(screen.queryByTestId('compose-preview-dialog-fullscreen-form')).toBeNull()
  })

  it('OpenSpec: compose-preview / 预览形态之间的切换 / 切换请求带着当前状态', () => {
    const stage = stubStageBox({ width: 1280, height: 720 })
    try {
      const onRequestFullscreenForm = vi.fn()
      renderDialog({ onRequestFullscreenForm })
      fireEvent.change(screen.getByTestId('compose-preview-dialog-screen-size'), {
        target: { value: '1440x900' },
      })
      fireEvent.click(screen.getByTestId('compose-preview-dialog-fullscreen-form'))
      expect(onRequestFullscreenForm).toHaveBeenCalledWith({
        frameId: 'frame-root',
        screenSize: { width: 1440, height: 900 },
      })
    }
    finally { stage.restore() }
  })

  it('OpenSpec: compose-preview / 预览形态之间的切换 / 返回后回到原来的状态', () => {
    const stage = stubStageBox({ width: 1280, height: 720 })
    try {
      const handoff = { frameId: 'frame-root', screenSize: { width: 1440, height: 900 } }
      /*
       * **先挂载一个不带交接状态的关闭弹框**，再带着它重开——这一步是这条用例的全部要害。
       * 弹框常驻挂载（关闭时渲染 null，Hook 照常跑），因此 `useState` 初值在第一帧就定死了；
       * 一开始就把 `initialState` 传进去的话，初值恰好就是答案，撤掉「active 转 true 时套用
       * initial」这段修复用例照样绿——试过，那一版什么都没验到。
       */
      const view = renderDialog({ open: false })
      view.rerender(
        <ComposePreviewDialog
          document={document}
          initialState={handoff}
          layoutSnapshot={layoutSnapshot}
          open
          registry={registry}
          onOpenChange={vi.fn()}
        />,
      )
      expect(screen.getByTestId('compose-preview-dialog-screen-width')).toHaveValue(1440)
      expect(screen.getByTestId('compose-preview-dialog-screen-height')).toHaveValue(900)
    }
    finally { stage.restore() }
  })
})
