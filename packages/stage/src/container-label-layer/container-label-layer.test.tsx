import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComposeDocument, ComposeLayoutSnapshot } from '@compose-ui/core'
import { ComposeContainerLabelLayer } from './container-label-layer'

const unlockedDocument = {
  schemaVersion: 6,
  canvas: {
    grid: { stepX: 8, stepY: 8, offsetX: 0, offsetY: 0, primaryLineEvery: 5, snapEnabled: true },
    smartSnap: { nodes: true, guides: true },
    guides: [],
  },
  output: { width: 1280, height: 720, backgroundPaint: null },
  rootIds: ['frame'],
  entities: {
    frame: {
      id: 'frame',
      name: '登录页',
      components: {
        Composition: { presetId: 'container', baseComponentKeys: [], capabilityIds: [] },
        Transform: { rotation: 0 },
        LayoutItem: {
          positioning: 'absolute',
          offset: { x: 0, y: 0 },
          width: { mode: 'fixed', value: 320, min: 1, max: null },
          height: { mode: 'fixed', value: 240, min: 1, max: null },
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          alignSelf: 'auto',
        },
        Visibility: { visible: true },
        Lock: { locked: false },
        Hierarchy: { childIds: [] },
        Clip: { enabled: true },
      },
    },
  },
} as unknown as ComposeDocument

const lockedDocument = {
  ...unlockedDocument,
  entities: {
    frame: {
      ...unlockedDocument.entities.frame,
      components: {
        ...unlockedDocument.entities.frame!.components,
        Lock: { locked: true },
      },
    },
  },
} as unknown as ComposeDocument

const layoutSnapshot = {
  revision: 1,
  boxes: { frame: { x: 0, y: 0, width: 320, height: 240, positioning: 'absolute' } },
  diagnostics: [],
} as ComposeLayoutSnapshot

function renderLayer(overrides: {
  readonly onRename?: (entityId: string, name: string) => void
  readonly onLabelPointerDown?: (entityId: string) => void
  readonly selectedIds?: readonly string[]
  readonly locked?: boolean
} = {}) {
  const document_ = overrides.locked ? lockedDocument : unlockedDocument
  return render(
    <ComposeContainerLabelLayer
      document={document_}
      label="容器名称"
      layoutSnapshot={layoutSnapshot}
      renameLabel={(name) => `重命名容器 ${name}`}
      selectedIds={overrides.selectedIds ?? []}
      viewport={{ x: 0, y: 0, zoom: 1 }}
      onLabelPointerDown={overrides.onLabelPointerDown ?? (() => {})}
      onRename={overrides.onRename}
    />,
  )
}

afterEach(cleanup)

/** 标签自己判连击（pointerdown 的 detail 恒为 0），因此测试也要发两次 pointerdown。 */
function doubleClickLabel(element: HTMLElement) {
  fireEvent.pointerDown(element, { clientX: 10, clientY: 10 })
  fireEvent.pointerDown(element, { clientX: 10, clientY: 10 })
}

describe('OpenSpec: stage / 顶层容器标题标签', () => {
  it('按下标签上报容器 ID', () => {
    const onLabelPointerDown = vi.fn()
    renderLayer({ onLabelPointerDown })
    fireEvent.pointerDown(screen.getByText('登录页'))
    expect(onLabelPointerDown).toHaveBeenCalledWith('frame', expect.anything())
  })

  it('选中态标记在标签上', () => {
    renderLayer({ selectedIds: ['frame'] })
    expect(screen.getByText('登录页').className).toContain('is-selected')
  })

  it('双击重命名，Enter 提交', () => {
    const onRename = vi.fn()
    renderLayer({ onRename })
    doubleClickLabel(screen.getByText('登录页'))
    const input = screen.getByLabelText('重命名容器 登录页')
    fireEvent.change(input, { target: { value: '首页' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRename).toHaveBeenCalledWith('frame', '首页')
  })

  it('Escape 取消重命名并恢复原名', () => {
    const onRename = vi.fn()
    renderLayer({ onRename })
    doubleClickLabel(screen.getByText('登录页'))
    const input = screen.getByLabelText('重命名容器 登录页')
    fireEvent.change(input, { target: { value: '首页' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onRename).not.toHaveBeenCalled()
    expect(screen.getByText('登录页')).toBeTruthy()
  })

  it('未提供重命名回调时标签只读', () => {
    renderLayer()
    doubleClickLabel(screen.getByText('登录页'))
    expect(screen.queryByLabelText('重命名容器 登录页')).toBeNull()
  })
})

describe('OpenSpec: 锁定容器与 Group 退出画布选中', () => {
  it('锁定容器的标签既不选中也不重命名', () => {
    const onLabelPointerDown = vi.fn()
    const onRename = vi.fn()
    renderLayer({ locked: true, onLabelPointerDown, onRename })
    const label = screen.getByText('登录页')
    expect(label.className).toContain('is-locked')
    expect(label.tagName).toBe('SPAN')
    doubleClickLabel(label)
    expect(onLabelPointerDown).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('重命名容器 登录页')).toBeNull()
  })
})
