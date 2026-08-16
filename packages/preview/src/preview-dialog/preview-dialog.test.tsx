import { createComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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

const document: ComposeDocument = {
  schemaVersion: 6,
  canvas: createDefaultCanvasSettings(),
  output: { ...createDefaultOutputSettings(), width: 640, height: 360 },
  rootIds: [container.id],
  entities: { [container.id]: container },
}

const layoutSnapshot: ComposeLayoutSnapshot = {
  revision: 1,
  boxes: {
    [container.id]: { x: 0, y: 0, width: 320, height: 180, positioning: 'absolute' },
  },
  diagnostics: [],
}

const registry = createComposeEntityRegistry()

/** 带一条位置动画的文档：play-once、时长 400 ms。 */
function animatedDocument(): ComposeDocument {
  return {
    ...document,
    entities: {
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
    },
    animations: [{ id: 'intro', name: '入场', durationMs: 400, playbackMode: 'play-once' }],
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
    expect(screen.getByRole('button', { name: 'Selected container' })).toBeDisabled()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
    fireEvent.mouseDown(screen.getByTestId('compose-preview-dialog-backdrop'))
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('OpenSpec: compose-preview / 受控 Preview Dialog / 切换指定 Container 预览', () => {
    renderDialog({ containerId: container.id })

    fireEvent.click(screen.getByRole('button', { name: 'Selected container' }))
    expect(screen.getByTestId('compose-preview-container')).toBeInTheDocument()
  })

  it('OpenSpec: compose-preview / Preview Dialog 视图控制 / 调整预览缩放', () => {
    renderDialog()

    fireEvent.change(screen.getByRole('combobox', { name: 'Preview scale' }), {
      target: { value: '0.5' },
    })
    expect(screen.getByTestId('compose-preview-dialog-artboard')).toHaveStyle('--compose-preview-dialog-scale: 0.5')
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
