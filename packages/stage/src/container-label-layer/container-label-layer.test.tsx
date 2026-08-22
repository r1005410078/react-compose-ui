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
        Frame: { size: { width: 320, height: 240 }, guides: [] },
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
  readonly activeFrameId?: string | null
  readonly onSceneActivate?: (entityId: string) => void
  readonly onScenePreview?: (entityId: string) => void
  readonly onSceneSizeChange?: (entityId: string, size: { width: number; height: number }) => void
} = {}) {
  const document_ = overrides.locked ? lockedDocument : unlockedDocument
  return render(
    <ComposeContainerLabelLayer
      activeFrameId={overrides.activeFrameId}
      document={document_}
      label="容器名称"
      layoutSnapshot={layoutSnapshot}
      renameLabel={(name) => `重命名容器 ${name}`}
      sceneActiveLabel={(name) => `${name} 是当前激活场景`}
      sceneInactiveLabel={(name) => `把 ${name} 设为激活场景`}
      scenePreviewLabel={(name) => `预览场景 ${name}`}
      sceneSizeLabel={(name) => `修改场景 ${name} 的尺寸`}
      selectedIds={overrides.selectedIds ?? []}
      viewport={{ x: 0, y: 0, zoom: 1 }}
      onLabelPointerDown={overrides.onLabelPointerDown ?? (() => {})}
      onRename={overrides.onRename}
      onSceneActivate={overrides.onSceneActivate}
      onScenePreview={overrides.onScenePreview}
      onSceneSizeChange={overrides.onSceneSizeChange}
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
    // 名称现在是按钮里的一个 span（flex 行下省略号必须作用在文本节点上），选中态仍在按钮上。
    expect(screen.getByText('登录页').closest('button')?.className).toContain('is-selected')
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

  it('OpenSpec: stage / 场景标签的激活与预览入口 / 锁定场景仍显示播放、激活与尺寸', () => {
    const onSceneActivate = vi.fn()
    const onScenePreview = vi.fn()
    renderLayer({
      activeFrameId: 'frame',
      locked: true,
      onSceneActivate,
      onScenePreview,
      onSceneSizeChange: vi.fn(),
    })
    expect(screen.getByRole('button', { name: '修改场景 登录页 的尺寸' })).toHaveTextContent(
      '320 × 240',
    )
    // 播放与激活不改场景内容，锁定下仍然可用。
    fireEvent.click(screen.getByRole('button', { name: '预览场景 登录页' }))
    expect(onScenePreview).toHaveBeenCalledWith('frame')
    expect(screen.getByRole('button', { name: '登录页 是当前激活场景' })).toBeInTheDocument()
  })

  it('OpenSpec: stage / 场景尺寸弹框 / 锁定场景的尺寸胶囊只读', () => {
    const onSceneSizeChange = vi.fn()
    renderLayer({ activeFrameId: 'frame', locked: true, onSceneSizeChange })
    const chip = screen.getByRole('button', { name: '修改场景 登录页 的尺寸' })
    expect(chip).toBeDisabled()
    fireEvent.doubleClick(chip)
    expect(screen.queryByTestId('stage-scene-size-dialog')).not.toBeInTheDocument()
    expect(onSceneSizeChange).not.toHaveBeenCalled()
  })

  it('OpenSpec: stage / 场景标签的激活与预览入口 / 激活场景显示播放按钮与实心标记', () => {
    renderLayer({
      activeFrameId: 'frame',
      onSceneActivate: vi.fn(),
      onScenePreview: vi.fn(),
    })
    expect(screen.getByRole('button', { name: '预览场景 登录页' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '登录页 是当前激活场景' })).toBeInTheDocument()
  })

  it('OpenSpec: stage / 场景标签的激活与预览入口 / 非激活场景只有可点标记', () => {
    const onSceneActivate = vi.fn()
    renderLayer({ activeFrameId: 'other', onSceneActivate, onScenePreview: vi.fn() })
    expect(screen.queryByRole('button', { name: /预览场景/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '把 登录页 设为激活场景' }))
    expect(onSceneActivate).toHaveBeenCalledWith('frame')
  })

  it('OpenSpec: stage / 场景标签的激活与预览入口 / 未提供回调时不出现控件', () => {
    renderLayer({ activeFrameId: 'frame' })
    expect(screen.queryByRole('button', { name: /预览场景/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /激活场景/ })).not.toBeInTheDocument()
    expect(screen.getByText('登录页')).toBeInTheDocument()
  })

  it('OpenSpec: stage / 场景标签的激活与预览入口 / 新控件不触发选中也不进入重命名', () => {
    const onLabelPointerDown = vi.fn()
    const onRename = vi.fn()
    renderLayer({
      activeFrameId: 'frame',
      onLabelPointerDown,
      onRename,
      onSceneActivate: vi.fn(),
      onScenePreview: vi.fn(),
    })
    const tag = screen.getByRole('button', { name: '登录页 是当前激活场景' })
    // 连点两次标记：既不能上报选中，也不能被当成标签双击而进入重命名。
    fireEvent.pointerDown(tag, { clientX: 10, clientY: 10 })
    fireEvent.pointerDown(tag, { clientX: 10, clientY: 10 })
    expect(onLabelPointerDown).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})

describe('OpenSpec: stage / 场景标签的激活与预览入口 / 尺寸胶囊', () => {
  it('场景标签显示当前尺寸', () => {
    renderLayer({ activeFrameId: 'frame', onSceneSizeChange: vi.fn() })
    expect(screen.getByRole('button', { name: '修改场景 登录页 的尺寸' })).toHaveTextContent(
      '320 × 240',
    )
  })

  it('尺寸胶囊不触发选中也不进入重命名', () => {
    const onLabelPointerDown = vi.fn()
    const onRename = vi.fn()
    renderLayer({ onLabelPointerDown, onRename, onSceneSizeChange: vi.fn() })
    const chip = screen.getByRole('button', { name: '修改场景 登录页 的尺寸' })
    fireEvent.pointerDown(chip, { clientX: 10, clientY: 10 })
    fireEvent.pointerDown(chip, { clientX: 10, clientY: 10 })
    expect(onLabelPointerDown).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('未提供写入口时胶囊只读，双击不打开弹框', () => {
    renderLayer()
    const chip = screen.getByRole('button', { name: '修改场景 登录页 的尺寸' })
    expect(chip).toBeDisabled()
    fireEvent.doubleClick(chip)
    expect(screen.queryByTestId('stage-scene-size-dialog')).not.toBeInTheDocument()
  })
})

describe('OpenSpec: stage / 场景尺寸弹框', () => {
  const openDialog = (onSceneSizeChange = vi.fn()) => {
    renderLayer({ activeFrameId: 'frame', onSceneSizeChange })
    fireEvent.doubleClick(screen.getByRole('button', { name: '修改场景 登录页 的尺寸' }))
    return onSceneSizeChange
  }

  it('选择预设并确认提交一次新尺寸', () => {
    const onSceneSizeChange = openDialog()
    fireEvent.click(screen.getByTestId('stage-scene-size-preset-1920x1080'))
    expect(screen.getByTestId('stage-scene-size-preset-1920x1080')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.click(screen.getByTestId('stage-scene-size-confirm'))
    expect(onSceneSizeChange).toHaveBeenCalledTimes(1)
    expect(onSceneSizeChange).toHaveBeenCalledWith('frame', { width: 1920, height: 1080 })
    expect(screen.queryByTestId('stage-scene-size-dialog')).not.toBeInTheDocument()
  })

  it('自定义尺寸不选中任何预设', () => {
    const onSceneSizeChange = openDialog()
    fireEvent.change(screen.getByTestId('stage-scene-size-width'), { target: { value: '1000' } })
    fireEvent.change(screen.getByTestId('stage-scene-size-height'), { target: { value: '800' } })
    expect(screen.queryByRole('button', { pressed: true })).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('stage-scene-size-confirm'))
    expect(onSceneSizeChange).toHaveBeenCalledWith('frame', { width: 1000, height: 800 })
  })

  it('预设选中后仍可继续微调', () => {
    const onSceneSizeChange = openDialog()
    fireEvent.click(screen.getByTestId('stage-scene-size-preset-1920x1080'))
    fireEvent.change(screen.getByTestId('stage-scene-size-width'), { target: { value: '1900' } })
    fireEvent.click(screen.getByTestId('stage-scene-size-confirm'))
    expect(onSceneSizeChange).toHaveBeenCalledWith('frame', { width: 1900, height: 1080 })
  })

  it('非法宽高禁用确认', () => {
    openDialog()
    fireEvent.change(screen.getByTestId('stage-scene-size-width'), { target: { value: '0' } })
    expect(screen.getByTestId('stage-scene-size-confirm')).toBeDisabled()
    fireEvent.change(screen.getByTestId('stage-scene-size-width'), { target: { value: '' } })
    expect(screen.getByTestId('stage-scene-size-confirm')).toBeDisabled()
  })

  it('尺寸没变时确认只关闭弹框', () => {
    const onSceneSizeChange = openDialog()
    fireEvent.click(screen.getByTestId('stage-scene-size-confirm'))
    expect(onSceneSizeChange).not.toHaveBeenCalled()
    expect(screen.queryByTestId('stage-scene-size-dialog')).not.toBeInTheDocument()
  })

  it('取消不写文档，重新打开回到当前尺寸', () => {
    const onSceneSizeChange = openDialog()
    fireEvent.change(screen.getByTestId('stage-scene-size-width'), { target: { value: '1000' } })
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onSceneSizeChange).not.toHaveBeenCalled()
    fireEvent.doubleClick(screen.getByRole('button', { name: '修改场景 登录页 的尺寸' }))
    expect(screen.getByTestId('stage-scene-size-width')).toHaveValue(320)
  })
})
