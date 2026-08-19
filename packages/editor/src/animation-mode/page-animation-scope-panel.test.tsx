import type { ComposeAssetProvider } from '@compose-ui/assets'
import type { ComposeAnimation, ComposePageAnimationReference } from '@compose-ui/core'
import { ComposePropertyPanelRoot } from '@compose-ui/property-panel'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PageAnimationScopePanel } from './page-animation-scope-panel'
import type { PageAnimationSceneBinding } from './page-animation-scope-panel'
import type { AnimationKeyframeEasing } from './keyframe-easing'

const animationEntry = {
  id: 'intro-file',
  parentId: 'root',
  name: 'Intro.animation.json',
  kind: 'file' as const,
  assetKey: 'animations/Intro.animation.json',
}

function providerFixture(): ComposeAssetProvider {
  return {
    id: 'memory',
    label: 'Assets',
    root: { id: 'root', parentId: null, name: 'Assets', kind: 'folder' },
    capabilities: {
      createFile: true,
      createFolder: false,
      rename: false,
      move: false,
      delete: false,
      write: true,
      reference: true,
    },
    list: vi.fn(async () => [animationEntry, {
      id: 'page',
      parentId: 'root',
      name: 'Home.page.json',
      kind: 'file' as const,
      assetKey: 'Home.page.json',
    }]),
    read: vi.fn(),
    createFile: vi.fn(async ({ parentId, name }) => ({
      id: `created-${name}`,
      parentId,
      name,
      kind: 'file' as const,
      assetKey: name,
      revision: '1',
    })),
    writeFile: vi.fn(),
  }
}

const boundReference: ComposePageAnimationReference = {
  providerId: 'memory',
  assetKey: 'animations/Intro.animation.json',
  scope: 'persistent',
}

const mirrorAnimation: ComposeAnimation = {
  id: 'intro',
  name: '入场',
  durationMs: 300,
  playbackMode: 'play-once',
}

const keyframeEasingFixture: AnimationKeyframeEasing = {
  entityId: 'rect',
  path: ['LayoutItem', 'offset'],
  keyframeId: 'k1',
  interpolation: { kind: 'linear' },
  timeMs: 0,
  nextTimeMs: 300,
  entityName: 'Rectangle',
  propertyLabel: '位置',
}

/** 单场景骨架：多数测试只关心一块场景的行为。 */
function sceneFixture(overrides: Partial<PageAnimationSceneBinding> = {}): PageAnimationSceneBinding {
  return {
    frameId: 'frame-root',
    name: '主屏',
    reference: null,
    animation: null,
    isActive: true,
    isScope: true,
    ...overrides,
  }
}

function renderPanel({
  provider = providerFixture(),
  scenes = [sceneFixture()],
  keyframeEasing = null,
}: {
  readonly provider?: ComposeAssetProvider
  readonly scenes?: readonly PageAnimationSceneBinding[]
  readonly keyframeEasing?: AnimationKeyframeEasing | null
} = {}) {
  const dispatch = vi.fn()
  const onAnimationChange = vi.fn(async () => undefined)
  const onError = vi.fn()
  const onInterpolationChange = vi.fn()
  let seq = 0
  // 组件是共享 Root 内的一个 Section：Root 提供分组 chrome、搜索与列宽。
  render(
    <ComposePropertyPanelRoot>
      <PageAnimationScopePanel
        dispatch={dispatch}
        idFactory={() => `id-${seq += 1}`}
        keyframeEasing={keyframeEasing}
        onAnimationChange={onAnimationChange}
        onError={onError}
        onInterpolationChange={onInterpolationChange}
        pageName="Home"
        pageParentId="root"
        provider={provider}
        scenes={scenes}
      />
    </ComposePropertyPanelRoot>,
  )
  return { dispatch, onAnimationChange, onError, onInterpolationChange, provider }
}

afterEach(() => { cleanup() })

describe('PageAnimationScopePanel', () => {
  it('OpenSpec: editor-workspace-layout / 画布动画绑定属性 / 未绑定页面选择或快捷创建动画', async () => {
    const { onAnimationChange, provider } = renderPanel()

    // 行标签是场景名（激活徽标）；文件候选只含动画后缀条目。
    const select = await screen.findByRole('combobox', { name: '主屏（激活）' })
    expect(screen.getByRole('option', { name: 'Intro.animation.json' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Home.page.json' })).not.toBeInTheDocument()

    fireEvent.change(select, { target: { value: 'animations/Intro.animation.json' } })
    await waitFor(() => {
      expect(onAnimationChange).toHaveBeenCalledWith(boundReference, 'frame-root')
    })

    // 快捷创建是文件行的「新建动画文件…」选项：按「页面名-场景名」命名并只绑定该场景。
    fireEvent.change(select, { target: { value: '__compose-create-animation-file__' } })
    await waitFor(() => {
      expect(provider.createFile).toHaveBeenCalledWith(expect.objectContaining({
        parentId: 'root',
        name: 'Home-主屏.animation.json',
      }))
      expect(onAnimationChange).toHaveBeenLastCalledWith({
        providerId: 'memory',
        assetKey: 'Home-主屏.animation.json',
        scope: 'persistent',
      }, 'frame-root')
    })
  })

  it('OpenSpec: editor-workspace-layout / 画布动画绑定属性 / 逐场景列出绑定行', async () => {
    renderPanel({
      scenes: [
        sceneFixture({
          frameId: 'frame-a',
          name: '主屏',
          reference: boundReference,
          animation: mirrorAnimation,
          isActive: true,
          isScope: false,
        }),
        sceneFixture({
          frameId: 'frame-b',
          name: '副屏',
          reference: null,
          animation: null,
          isActive: false,
          isScope: true,
        }),
      ],
    })

    // 激活与作用域分属两块场景时，两行各带自己的徽标。
    const activeRow = await screen.findByRole('combobox', { name: '主屏（激活）' })
    expect((activeRow as HTMLSelectElement).value).toBe('animations/Intro.animation.json')
    const scopeRow = screen.getByRole('combobox', { name: '副屏（编辑中）' })
    expect((scopeRow as HTMLSelectElement).value).toBe('')
  })

  it('OpenSpec: editor-workspace-layout / 画布动画绑定属性 / 为第二块场景创建独立文件', async () => {
    const { onAnimationChange, provider } = renderPanel({
      scenes: [
        sceneFixture({
          frameId: 'frame-a',
          name: '主屏',
          reference: boundReference,
          animation: mirrorAnimation,
        }),
        sceneFixture({ frameId: 'frame-b', name: '副屏', isActive: false, isScope: false }),
      ],
    })

    const scopeRow = await screen.findByRole('combobox', { name: '副屏' })
    fireEvent.change(scopeRow, { target: { value: '__compose-create-animation-file__' } })

    // 不复用主屏已绑定的引用：为副屏落一份按场景名命名的新文件。
    await waitFor(() => {
      expect(provider.createFile).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Home-副屏.animation.json',
      }))
      expect(onAnimationChange).toHaveBeenLastCalledWith({
        providerId: 'memory',
        assetKey: 'Home-副屏.animation.json',
        scope: 'persistent',
      }, 'frame-b')
    })
  })

  it('OpenSpec: editor-workspace-layout / 画布动画绑定属性 / 已绑定页面编辑变量绑定', async () => {
    renderPanel({
      scenes: [sceneFixture({ reference: boundReference, animation: mirrorAnimation })],
    })

    // 已绑定：显示当前动画文件与播放控制绑定行。
    const select = await screen.findByRole('combobox', { name: '主屏（激活）' })
    expect((select as HTMLSelectElement).value).toBe('animations/Intro.animation.json')
    expect(screen.getByText('播放')).toBeInTheDocument()
    expect(screen.getByText('当前时间')).toBeInTheDocument()
  })

  it('OpenSpec: compose-preview / 动画自动播放 / 未绑定变量时手动勾选播放写入清单', async () => {
    const { dispatch } = renderPanel({
      scenes: [sceneFixture({ reference: boundReference, animation: mirrorAnimation })],
    })

    const playing = await screen.findByRole('checkbox', { name: '播放' })
    expect(playing).not.toBeChecked()
    fireEvent.click(playing)

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        type: 'animation.configure',
        payload: { frameId: 'frame-root', animationId: 'intro', autoplay: true },
      }))
    })
  })

  it('OpenSpec: editor-workspace-layout / 画布动画绑定属性 / 取消关联不删除资源', async () => {
    const { onAnimationChange, provider } = renderPanel({
      scenes: [sceneFixture({ reference: boundReference, animation: mirrorAnimation })],
    })

    // 已绑定行的空选项就是「取消关联」。
    const select = await screen.findByRole('combobox', { name: '主屏（激活）' })
    expect(screen.getByRole('option', { name: '解除动画绑定' })).toBeInTheDocument()
    fireEvent.change(select, { target: { value: '' } })

    await waitFor(() => {
      expect(onAnimationChange).toHaveBeenCalledWith(null, 'frame-root')
    })
    expect(provider.writeFile).not.toHaveBeenCalled()
  })

  it('OpenSpec: editor-workspace-layout / 画布动画绑定属性 / 共享文件页面如实显示', async () => {
    const { onAnimationChange } = renderPanel({
      scenes: [
        sceneFixture({
          frameId: 'frame-a',
          name: '主屏',
          reference: boundReference,
          animation: mirrorAnimation,
        }),
        sceneFixture({
          frameId: 'frame-b',
          name: '副屏',
          reference: boundReference,
          animation: mirrorAnimation,
          isActive: false,
          isScope: false,
        }),
      ],
    })

    // 两行显示同一个文件，可独立解绑：解绑副屏只落到 frame-b。
    const rows = [
      await screen.findByRole('combobox', { name: '主屏（激活）' }),
      screen.getByRole('combobox', { name: '副屏' }),
    ]
    rows.forEach((row) => {
      expect((row as HTMLSelectElement).value).toBe('animations/Intro.animation.json')
    })
    fireEvent.change(rows[1] as HTMLSelectElement, { target: { value: '' } })
    await waitFor(() => {
      expect(onAnimationChange).toHaveBeenCalledWith(null, 'frame-b')
    })
  })

  it('OpenSpec: editor-workspace-layout / 画布 Inspector 关键帧缓动编辑 / 未选中关键帧时不渲染缓动区', async () => {
    renderPanel({
      scenes: [sceneFixture({ reference: boundReference, animation: mirrorAnimation })],
    })

    expect(await screen.findByText('当前时间')).toBeInTheDocument()
    expect(screen.queryByText('关键帧')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: '缓动' })).not.toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / 画布 Inspector 关键帧缓动编辑 / 选中关键帧后出现缓动区', async () => {
    renderPanel({
      scenes: [sceneFixture({ reference: boundReference, animation: mirrorAnimation })],
      keyframeEasing: keyframeEasingFixture,
    })

    // 标识行说明正在编辑哪一段出向曲线。
    expect(await screen.findByDisplayValue('Rectangle / 位置 · 0 ms → 300 ms')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '缓动' })).toHaveValue('linear')
  })

  it('缓动区只属于作用域场景的行组', async () => {
    renderPanel({
      scenes: [
        sceneFixture({
          frameId: 'frame-a',
          name: '主屏',
          reference: boundReference,
          animation: mirrorAnimation,
          isScope: false,
        }),
        sceneFixture({
          frameId: 'frame-b',
          name: '副屏',
          reference: boundReference,
          animation: mirrorAnimation,
          isActive: false,
          isScope: true,
        }),
      ],
      keyframeEasing: keyframeEasingFixture,
    })

    // 两块场景都已绑定，但缓动标识行只出现一次——挂在作用域场景（副屏）之下。
    expect(await screen.findByDisplayValue('Rectangle / 位置 · 0 ms → 300 ms')).toBeInTheDocument()
    expect(screen.getAllByRole('combobox', { name: '缓动' })).toHaveLength(1)
  })

  it('OpenSpec: editor-workspace-layout / 关键帧缓动写入文档并可撤销 / 选择预设产生离散改动', async () => {
    const { onInterpolationChange } = renderPanel({
      scenes: [sceneFixture({ reference: boundReference, animation: mirrorAnimation })],
      keyframeEasing: keyframeEasingFixture,
    })

    fireEvent.change(await screen.findByRole('combobox', { name: '缓动' }), {
      target: { value: 'ease-in-out' },
    })

    expect(onInterpolationChange).toHaveBeenCalledWith(
      { kind: 'cubic', control: [0.42, 0, 0.58, 1] },
      false,
    )
  })

  it('OpenSpec: editor-workspace-layout / 关键帧缓动写入文档并可撤销 / 键盘调节控制柄产生连续改动', async () => {
    const { onInterpolationChange } = renderPanel({
      scenes: [sceneFixture({ reference: boundReference, animation: mirrorAnimation })],
      keyframeEasing: {
        ...keyframeEasingFixture,
        interpolation: { kind: 'cubic', control: [0.42, 0, 1, 1] },
      },
    })

    const handle = await screen.findByRole('slider', { name: '控制点 1' })
    fireEvent.keyDown(handle, { key: 'ArrowRight' })

    // 连续调节标记为中间值，宿主据此合并撤销记录。
    expect(onInterpolationChange).toHaveBeenCalledWith(
      { kind: 'cubic', control: [0.43, 0, 1, 1] },
      true,
    )
  })

  it('OpenSpec: editor-workspace-layout / 关键帧缓动写入文档并可撤销 / 末帧可编辑并给出说明', async () => {
    renderPanel({
      scenes: [sceneFixture({ reference: boundReference, animation: mirrorAnimation })],
      keyframeEasing: { ...keyframeEasingFixture, timeMs: 300, nextTimeMs: null },
    })

    expect(await screen.findByDisplayValue('Rectangle / 位置 · 300 ms')).toBeInTheDocument()
    expect(screen.getByText('末帧的出向段没有下一帧，暂不参与求值')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '缓动' })).toBeEnabled()
  })

  it('OpenSpec: editor-workspace-layout / 空动画的创建引导 / 已绑定但镜像缺失时提示载入', async () => {
    renderPanel({ scenes: [sceneFixture({ reference: boundReference, animation: null })] })
    expect(await screen.findByText('绑定的动画尚未载入')).toBeInTheDocument()
    expect(screen.queryByText('播放')).not.toBeInTheDocument()
  })
})
